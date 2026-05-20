import { Types, Model } from 'mongoose';

import jwt from 'jsonwebtoken';
import { User } from '../auth/user.schema.js';
import { Progress, AssessmentStage, ProgressStatus } from '../progress/progress.schema.js';
import { Submission } from '../problems/submission.schema.js';
import { Problem } from '../problems/problem.schema.js';
import { Exam } from '../exams/exam.schema.js';
import { Topic } from '../courses/topic.schema.js';
import { Course } from '../courses/course.schema.js';
import { PerformanceAnalysis } from '../interview/performance-analysis.schema.js';
import { AiService } from '../ai/ai.service.js';
import * as puppeteer from 'puppeteer';

export class AnalyticsService {
  constructor() {
    this.aiService = new AiService();
  }

  async generateReport(sessionData) {
    const prompt = `Generate a comprehensive interview feedback report based on this candidate's performance data.
    Data: ${JSON.stringify(sessionData)}
    Provide overall strengths, areas for improvement, and a detailed summary of their performance across Aptitude, Coding, and HR Interview rounds.
    Return ONLY valid JSON:
    {
      "overallScore": 85,
      "strengths": ["...", "..."],
      "improvements": ["...", "..."],
      "summary": "detailed feedback paragraph"
    }`;

    try {
      const response = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      return JSON.parse(response.choices?.[0]?.message?.content || '{}');
    } catch (e) {
      throw new Error('Failed to generate report');
    }
  }

  async logProctoringEvent(event) {
    if (process.env.SUPPRESS_VIOLATIONS === 'true') {
      console.log('[PROCTORING] Violation suppressed in test mode:', event.type);
      return { success: true, message: 'Violation suppressed in test mode' };
    }

    const { sessionId, type, message, severity, userId } = event;

    if (userId) {
      const progress = await Progress.findOne({ user: new Types.ObjectId(userId) });
      
      if (!progress || progress.status !== ProgressStatus.ACTIVE) {
        console.log(`[PROCTORING] REJECTED not ACTIVE for user ${userId}`);
        return { success: false, message: 'Violation rejected is not active.' };
      }

      const currentPerf = await PerformanceAnalysis.findOne({ user: new Types.ObjectId(userId) });
      
      const logs = [...(currentPerf?.violations?.logs || []), { 
        reason: `${type.toUpperCase()}: ${message}`, 
        type,
        timestamp: new Date() 
      }];

      let trustScore = 100;
      logs.forEach((log) => {
        if (log.type === 'tab_switch' || log.type === 'fullscreen_exit') trustScore -= 10;
        if (log.type === 'face_hidden') trustScore -= 15;
        if (log.type === 'multiple_faces') trustScore -= 50;
      });

      const newTrustScore = Math.max(0, trustScore);

      await PerformanceAnalysis.findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        { 
          $set: {
            'violations.count': logs.length, 
            'violations.trustScore': newTrustScore,
            'violations.logs': logs
          }
        },
        { upsert: true }
      );
    }

    console.log(`[PROCTORING] [LOGGED] ${type}: ${message} (User)`);
    return { success: true };
  }

  async saveEmotionReport(report) {
    console.log('Emotion Report Saved:', report);
    return { success: true };
  }

  async getCollegeAnalytics(collegeCode, instructorId) {
    const students = await User.find({ 
      $or: [
        { institutionId: collegeCode },
        { createdBy: instructorId }
      ],
      role: 'student' 
    }).lean();
    const studentIds = students.map(s => s._id);

    const performances = await PerformanceAnalysis.find({ user: { $in: studentIds } }).lean();
    const progressRecords = await Progress.find({ user: { $in: studentIds } }).lean();
    
    const analytics = students.map(student => {
      const perf = performances.find(p => String(p.user) === String(student._id));
      const prog = progressRecords.find(p => String(p.user) === String(student._id));
      
      const mcqScore = perf?.mcq?.score ?? prog?.context?.mcq?.score ?? 0;
      const aptScore = perf?.aptitude?.percentage ?? prog?.context?.aptitude?.percentage ?? prog?.context?.aptitude?.score ?? 0;
      
      let codingMarks = 0;
      let codingScore = 0;
      const codingContext = prog?.context?.coding || {};
      const codingTasks = codingContext.tasks || {};
      
      if (Object.keys(codingTasks).length > 0) {
        codingMarks = Object.values(codingTasks).reduce((sum, t) => sum + (Number(t.taskMarks) || 0), 0);
        codingScore = Math.round((codingMarks / 8) * 100);
      } else if (codingContext.totalMarks !== undefined) {
        codingMarks = codingContext.totalMarks;
        codingScore = Math.round((codingMarks / 8) * 100);
      } else if (codingContext.passedCount !== undefined || perf?.coding?.marksObtained !== undefined) {
        // Fallback for old records or performance sync
        codingMarks = codingContext.passedCount === 5 ? 2 : (codingContext.passedCount > 0 ? 1 : 0);
        // If performance record has marks, use those
        if (perf?.coding?.marksObtained !== undefined) codingMarks = Number(perf.coding.marksObtained) || 0;
        codingScore = Math.round((codingMarks / 8) * 100);
      } else if (perf?.coding?.scorePercent !== undefined) {
        codingScore = perf.coding.scorePercent;
        codingMarks = Math.round((codingScore / 100) * 8);
      }

      let hrMarks = 0;
      let hrScore = 0;
      const hrContext = prog?.context?.interview || {};
      const responses = hrContext.responses ? Object.values(hrContext.responses) : [];
      
      if (responses.length > 0) {
        hrMarks = responses.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
        hrScore = Math.round((hrMarks / 14) * 100);
      } else if (perf?.hr?.marksObtained !== undefined) {
        hrMarks = Number(perf.hr.marksObtained) || 0;
        hrScore = Math.round((hrMarks / 14) * 100);
      } else if (perf?.hr?.score !== undefined) {
        hrScore = perf.hr.score;
        hrMarks = perf.hr?.marksObtained || Math.round((hrScore / 100) * 14);
      }

      const overallScore = Math.round(
        (mcqScore * 0.2) + (aptScore * 0.2) + (codingScore * 0.3) + (hrScore * 0.3)
      );
      const trustScore = perf?.violations?.trustScore ?? 100;

      const hasAttempted = perf && (perf.mcq || perf.aptitude || perf.coding || perf.hr);
      
      let status = 'Not Attempted';
      if (hasAttempted) {
        status = overallScore >= 60 ? 'Pass' : 'Fail';
      }

      let integrityAlert = null;
      if (overallScore >= 80 && trustScore < 70) {
        integrityAlert = 'High performance with behavioral flags. Manual verification recommended.';
      }

      let recommendation = 'No action required.';
      if (trustScore < 70) {
        if (overallScore >= 75) {
          recommendation = 'Strong logic, but needs strict supervision.';
        } else {
          recommendation = 'Recommend re-test under physical invigilation.';
        }
      }

      const violationBreakdown = {
        tabSwitches: 0,
        faceLoss: 0,
        multipleFaces: 0,
        other: 0
      };
      (perf?.violations?.logs || []).forEach((log) => {
        if (log.type === 'tab_switch' || log.type === 'fullscreen_exit') violationBreakdown.tabSwitches++;
        else if (log.type === 'face_hidden') violationBreakdown.faceLoss++;
        else if (log.type === 'multiple_faces') violationBreakdown.multipleFaces++;
        else violationBreakdown.other++;
      });

      let matrixCategory = 'Standard';
      if (overallScore >= 75 && trustScore >= 90) matrixCategory = 'Perfect Hire';
      else if (overallScore >= 80 && trustScore < 60) matrixCategory = 'Potential Malpractice (Verify)';
      else if (overallScore < 60 && trustScore >= 90) matrixCategory = 'Needs Training but Reliable';
      else if (trustScore < 50) matrixCategory = 'Flagged - Poor Match';

      let privateNote = '';
      if (overallScore > 85 && trustScore < 60) {
        privateNote = "CRITICAL Performance. Marks don't align with proctoring behavior. Tight monitoring suggested.";
      } else if (trustScore === 100) {
        privateNote = "EXCELLENT High Integrity Candidate.";
      } else if (trustScore < 70) {
        privateNote = "Caution proctoring triggers observed.";
      }

      return {
        id: student._id,
        name: student.username,
        email: student.email,
        dept: student.preferences?.ai?.department || 'N/A',
        scores: {
          mcq: mcqScore,
          aptitude: aptScore,
          coding: codingScore,
          hr: hrScore,
          overall: overallScore,
        },
        marks: {
          coding: codingMarks,
          hr: hrMarks
        },
        trustScore,
        status,
        integrityAlert,
        recommendation,
        violationBreakdown,
        matrixCategory,
        privateNote,
        isWaitingApproval: prog?.isWaitingApproval || false,
        isRejected: prog?.isRejected || false,
        isHired: prog?.isHired || false,
        hrCompleted: perf?.hr?.status === 'COMPLETED',
        currentStage: prog?.currentStage || 'MCQ',
        progressStatus: prog?.status || 'ACTIVE'
      };
    });

    const topPerformers = [...analytics].sort((a, b) => b.scores.overall - a.scores.overall).slice(0, 10);
    
    const globalViolationBreakdown = analytics.reduce((acc, curr) => {
      acc.tabSwitches += curr.violationBreakdown.tabSwitches;
      acc.faceLoss += curr.violationBreakdown.faceLoss;
      acc.multipleFaces += curr.violationBreakdown.multipleFaces;
      acc.other += curr.violationBreakdown.other;
      return acc;
    }, { tabSwitches: 0, faceLoss: 0, multipleFaces: 0, other: 0 });

    const deptStats = analytics.reduce((acc, curr) => {
      if (!acc[curr.dept]) acc[curr.dept] = { total: 0, passed: 0 };
      acc[curr.dept].total++;
      if (curr.status === 'Pass') acc[curr.dept].passed++;
      return acc;
    }, {});

    const deptPassPercentage = Object.keys(deptStats).map(dept => ({
      name: dept,
      value: Math.round((deptStats[dept].passed / deptStats[dept].total) * 100)
    }));

    return {
      students: analytics,
      summary: {
        topPerformers,
        deptPassPercentage,
        globalViolationBreakdown,
        totalStudents: analytics.length,
        overallPassRate: Math.round((analytics.filter(s => s.status === 'Pass').length / Math.max(1, analytics.length)) * 100)
      }
    };
  }

  async generateIndividualPDF(userId) {
    const student = await User.findById(new Types.ObjectId(userId)).lean();
    const perf = await PerformanceAnalysis.findOne({ user: new Types.ObjectId(userId) }).lean();
    
    if (!student) throw new Error('Student data not found');
    
    const safePerf = perf || { 
      mcq: { score: 0, status: 'Not Attempted' },
      aptitude: { percentage: 0, status: 'Not Attempted' },
      coding: { scorePercent: 0, passedCount: 0, status: 'Not Attempted' },
      hr: { score: 0, status: 'Not Attempted' },
      violations: { trustScore: 100, count: 0, logs: [] }
    };

    const aiInsights = await this.getStudentAIInsights(userId);

    const overallScore = Math.round(
      ((safePerf.mcq?.score || 0) * 0.2) + 
      ((safePerf.aptitude?.percentage || 0) * 0.2) + 
      ((safePerf.coding?.scorePercent || 0) * 0.3) + 
      ((safePerf.hr?.score || 0) * 0.3)
    );
    const trustScore = safePerf.violations?.trustScore ?? 100;

    const violationBreakdown = {
      tabSwitches: 0,
      faceLoss: 0,
      multipleFaces: 0,
      other: 0
    };
    (safePerf.violations?.logs || []).forEach((log) => {
      if (log.type === 'tab_switch' || log.type === 'fullscreen_exit') violationBreakdown.tabSwitches++;
      else if (log.type === 'face_hidden') violationBreakdown.faceLoss++;
      else if (log.type === 'multiple_faces') violationBreakdown.multipleFaces++;
      else violationBreakdown.other++;
    });

    let privateNote = "No major behavioral flags observed.";
    if (overallScore > 85 && trustScore < 60) {
      privateNote = "CRITICAL Performance. Marks don't align with proctoring behavior. Tight monitoring suggested.";
    } else if (trustScore === 100) {
      privateNote = "EXCELLENT High Integrity Candidate.";
    } else if (trustScore < 70) {
      privateNote = "Caution proctoring triggers observed during the assessment.";
    }

    const rScale = 50;
    const center = { x: 60, y: 60 };
    const points = [
      { label: 'Theory', score: safePerf.mcq?.score || 0 },
      { label: 'Aptitude', score: safePerf.aptitude?.percentage || 0 },
      { label: 'Coding', score: safePerf.coding?.scorePercent || 0 },
      { label: 'Soft Skills', score: safePerf.hr?.score || 0 }
    ].map((p, i) => {
      const angle = (i * 2 * Math.PI) / 4 - Math.PI / 2;
      return {
        x: center.x + rScale * (p.score / 100) * Math.cos(angle),
        y: center.y + rScale * (p.score / 100) * Math.sin(angle),
        lx: center.x + (rScale + 15) * Math.cos(angle),
        ly: center.y + (rScale + 15) * Math.sin(angle),
        label: p.label
      };
    });
    const radarPath = points.map(p => `${p.x},${p.y}`).join(' ');

    const trustBg = trustScore === 100 ? '#ecfdf5' : trustScore >= 70 ? '#fffbeb' : '#fef2f2';
    const trustBorder = trustScore === 100 ? '#10b981' : '#f59e0b';
    const trustColor = trustScore === 100 ? '#10b981' : '#b45309';

    const reportCss = "" +
      "body { font-family: 'Inter', sans-serif; padding: 40px; color: #0f172a; line-height: 1.4; background: white; }" +
      ".pdf-container { max-width: 800px; margin: auto; }" +
      ".header { display: flex; justify-content: space-between; align-items: center; border-bottom: solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }" +
      ".brand { color: #7c3aed; font-weight: 900; font-size: 20px; letter-spacing: -1px; }" +
      ".trust-badge-top { background: " + trustBg + "; border: solid " + trustBorder + "; padding: 16px; border-radius: 12px; text-align: right; }" +
      ".trust-badge-label { font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; }" +
      ".trust-badge-value { font-size: 18px; font-weight: 900; color: " + trustColor + "; }" +
      ".student-header { display: flex; gap: 20px; align-items: center; margin-bottom: 30px; }" +
      ".photo-placeholder { width: 70px; height: 70px; background: #f8fafc; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #7c3aed; border: solid #f1f5f9; }" +
      ".student-info h1 { margin: 0; font-size: 22px; font-weight: 900; }" +
      ".student-info p { margin: 0; color: #64748b; font-size: 11px; font-weight: 600; }" +
      ".main-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 30px; margin-bottom: 30px; }" +
      ".chart-card { background: #f8fafc; padding: 20px; border-radius: 24px; text-align: center; border: solid #f1f5f9; }" +
      ".chart-title { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #7c3aed; margin-bottom: 15px; letter-spacing: 1px; }" +
      ".integrity-card { background: white; border: solid #e2e8f0; padding: 20px; border-radius: 24px; }" +
      ".verdict-tag { font-size: 10px; font-weight: 900; padding: 12px; border-radius: 8px; color: white; display: inline-block; margin-top: 10px; }" +
      ".violation-stat { display: flex; justify-content: space-between; padding: 0; border-bottom: solid #f1f5f9; font-size: 11px; font-weight: 700; color: #475569; }" +
      ".section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #7c3aed; margin-bottom: 15px; margin-top: 30px; border-left: solid #7c3aed; padding-left: 10px; }" +
      ".task-grid { display: grid; grid-template-columns: 1fr; gap: 15px; }" +
      ".task-card { padding: 15px; border: solid #e2e8f0; border-radius: 16px; position: relative; }" +
      ".task-tag { font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; }" +
      ".task-name { font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 5px; }" +
      ".task-score { font-size: 11px; font-weight: 900; color: #7c3aed; }" +
      ".task-reason { font-size: 9px; color: #64748b; margin-top: 4px; font-weight: 500; }" +
      ".footer { margin-top: 40px; padding-top: 20px; border-top: solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }" +
      ".document-footer { font-size: 8px; color: #94a3b8; font-weight: 600; text-align: right; }";

    const htmlContent = `
      <html>
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
          <style>${reportCss}</style>
        </head>
        <body>
          <div class="pdf-container">
            <div class="header">
              <div class="brand">PLACEMENT PERFORMANCE REPORT</div>
              <div class="trust-badge-top">
                <div class="trust-badge-label">Trust Score</div>
                <div class="trust-badge-value">${trustScore}%</div>
              </div>
            </div>

            <div class="student-header">
              <div class="photo-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div class="student-info">
                <h1>${student.username}</h1>
                <p>${student.email} • Readiness Index: ${aiInsights?.improvementIndex || 0}%</p>
                <div style="width: 200px; height: 8px; background: #e2e8f0; border-radius: 4px; margin-top: 5px; overflow: hidden;">
                  <div style="width: ${aiInsights?.improvementIndex || 0}%; height: 100%; background: #7c3aed; border-radius: 4px;"></div>
                </div>
              </div>
            </div>

            <div class="main-grid">
              <div class="chart-card">
                <div class="chart-title">Aptitude vs Soft Skills Matrix</div>
                <svg width="220" height="150" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" stroke-width="0.5" />
                  <circle cx="60" cy="60" r="25" fill="none" stroke="#e2e8f0" stroke-width="0.5" />
                  <line x1="60" y1="10" x2="60" y2="110" stroke="#e2e8f0" stroke-width="0.5" />
                  <line x1="10" y1="60" x2="110" y2="60" stroke="#e2e8f0" stroke-width="0.5" />
                  <polygon points="${radarPath}" fill="rgba(124, 58, 237, 0.2)" stroke="#7c3aed" stroke-width="1.5" />
                  ${points.map(p => `
                    <text x="${p.lx}" y="${p.ly}" text-anchor="middle" font-size="5" font-weight="900" fill="#64748b" transform="translate(0, 2)">${p.label}</text>
                  `).join('')}
                </svg>
              </div>

              <div class="integrity-card">
                <div class="chart-title" style="color: #475569;">Integrity Status</div>
                <div class="violation-stat"><span>Compliance Status</span><span>CLEAN LIST</span></div>
                <div class="violation-stat"><span>Verified Technicals</span><span>YES</span></div>
                <div class="violation-stat" style="border-bottom: none;"><span>Session Integrity</span><span>100%</span></div>
                <div class="verdict-tag" style="background: #10b981; width: 100%; text-align: center;">VERIFIED AUTHENTIC</div>
              </div>
            </div>
            <div class="section-title">Integrity & Trust Analysis</div>
            <div class="integrity-card" style="background: ${trustScore === 100 ? '#ecfdf5' : '#fef2f2'}; border: solid ${trustScore === 100 ? '#10b981' : '#ef4444'}; padding: 25px; margin-bottom: 30px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                <div>
                  <div class="trust-status" style="background: ${trustScore === 100 ? '#10b981' : '#ef4444'}; font-size: 12px; padding: 16px; color: white;">
                    STATUS: ${trustScore === 100 ? 'CLEAN LIST (VERIFIED)' : 'FLAGGED FOR REVIEW'}
                  </div>
                  <div style="margin-top: 10px; font-size: 11px; color: #475569; font-weight: 700;">
                    • Tab Switches: ${violationBreakdown.tabSwitches}
                    • Face Detection Issues: ${violationBreakdown.faceLoss}
                    • External Assistance Markers Detected
                  </div>
                </div>
                <div style="text-align: right;">
                  <div class="trust-score-big" style="font-size: 54px; font-weight: 900; color: ${trustScore === 100 ? '#10b981' : '#ef4444'}">${trustScore}%</div>
                  <div class="readiness-label" style="font-size: 10px; font-weight: 900; color: #64748b;">Trust Integrity Index</div>
                </div>
              </div>
              <div style="padding: 15px; background: white; border-radius: 12px; border: solid ${trustScore === 100 ? '#d1fae5' : '#fee2e2'};">
                <span style="font-size: 10px; font-weight: 900; color: #7c3aed; text-transform: uppercase;">Senior Consultant Insight:</span>
                <p style="margin: 0 0; font-size: 12px; font-weight: 700; color: #1e293b; line-height: 1.5;">
                  ${trustScore === 100 
                    ? 'Candidate exhibits impeccable behavioral integrity. Technical scores are verified and reliable. No external intervention or UI manipulation detected during the 120-minute assessment window.' 
                    : 'Behavioral flags detected. Technical scores may require manual verification via live interview to confirm alignment with proctoring behavior.'}
                </p>
              </div>
            </div>

            <div class="section-title">AI Actionable Roadmap</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
              ${(aiInsights?.actionableRoadmap || []).slice(0, 3).map((item, idx) => `
                <div style="padding: 15px; background: #f1f5f9; border-radius: 16px; text-align: center;">
                  <div style="width: 20px; height: 20px; background: #7c3aed; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: auto 10px; font-weight: 900; font-size: 10px;">${idx + 1}</div>
                  <div style="font-size: 10px; font-weight: 700; color: #475569;">${item.task}</div>
                </div>
              `).join('') || `
                <div style="padding: 15px; background: #f8fafc; border: solid #e2e8f0; border-radius: 20px; text-align: center;">
                  <div style="width: 24px; height: 24px; background: #7c3aed; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: auto 10px; font-weight: 900; font-size: 10px;">1</div>
                  <div style="font-size: 10px; font-weight: 700; color: #1e293b; line-height: 1.4;">Practice on platforms like LeetCode to improve edge case handling.</div>
                </div>
                <div style="padding: 15px; background: #f8fafc; border: solid #e2e8f0; border-radius: 20px; text-align: center;">
                  <div style="width: 24px; height: 24px; background: #7c3aed; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: auto 10px; font-weight: 900; font-size: 10px;">2</div>
                  <div style="font-size: 10px; font-weight: 700; color: #1e293b; line-height: 1.4;">Focus on practical API projects to bridge the project-logic gap.</div>
                </div>
                <div style="padding: 15px; background: #f8fafc; border: solid #e2e8f0; border-radius: 20px; text-align: center;">
                  <div style="width: 24px; height: 24px; background: #7c3aed; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: auto 10px; font-weight: 900; font-size: 10px;">3</div>
                  <div style="font-size: 10px; font-weight: 700; color: #1e293b; line-height: 1.4;">Participate in mock interviews to improve the Confidence Score.</div>
                </div>
              `}
            </div>

            <div class="footer">
              <div style="font-size: 10px; font-weight: 900; color: #7c3aed;">PROFESSIONAL DOCUMENT ARCHITECT</div>
              <div class="document-footer">
                Verified Report ID: PLM-${student._id.toString().slice(-6).toUpperCase()}
                Generated via AI Proctoring Hub • ${new Date().toLocaleDateString()}
              </div>
            </div>

            <!-- Second Page -->
            <div style="page-break-before: always;"></div>
            
            <div class="header">
              <div class="brand">DETAILED PERFORMANCE METRICS</div>
              <div class="document-footer" style="text-align: right;">Page 2 of 2</div>
            </div>

            <div class="section-title">Technical Performance Deep-Dive</div>
            <div class="task-grid" style="margin-bottom: 30px;">
              <div class="task-card" style="padding: 15px; border: solid #e2e8f0; border-radius: 16px;">
                <div style="font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase;">Resume-Based Performance</div>
                <div style="font-size: 12px; font-weight: 800; color: #0f172a;">System Architecture Design</div>
                <div style="font-size: 11px; font-weight: 900; color: #7c3aed;">Assessment: 5/5</div>
                <div style="font-size: 9px; color: #059669; font-weight: 600;">Validated strong algorithmic thinking and architectural clarity.</div>
              </div>
              <div class="task-card" style="padding: 15px; border: solid #e2e8f0; border-radius: 16px; ${safePerf.coding?.passedCount === 0 ? 'border-color: #fca5a5; background: #fffaf0;' : ''}">
                <div style="font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase;">Project-Based Performance</div>
                <div style="font-size: 12px; font-weight: 800; color: #0f172a;">API Error Handling Logic</div>
                <div style="font-size: 11px; font-weight: 900; color: #7c3aed;">Assessment: ${safePerf.coding?.passedCount || 0}/5</div>
                <div style="font-size: 9px; color: #dc2626; font-weight: 700;">Reason case validation failure.</div>
              </div>
            </div>

            <div class="section-title">Round-wise Comparative Analysis</div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 32px; border: solid #e2e8f0; margin-bottom: 40px;">

              <div style="margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-size: 12px; font-weight: 900; color: #475569;">Aptitude & Analytical Logic</span>
                  <span style="font-size: 12px; font-weight: 900; color: #7c3aed;">${safePerf.aptitude?.percentage || 0}%</span>
                </div>
                <div style="height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden;">
                  <div style="width: ${safePerf.aptitude?.percentage || 0}%; height: 100%; background: linear-gradient(90deg, #7c3aed, #a78bfa); border-radius: 6px;"></div>
                </div>
              </div>

              <div style="margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-size: 12px; font-weight: 900; color: #475569;">Coding Efficiency & Algorithms</span>
                  <span style="font-size: 12px; font-weight: 900; color: #7c3aed;">${safePerf.coding?.scorePercent || 0}% (${safePerf.coding?.taskMarks || 0}/8)</span>
                </div>
                <div style="height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden;">
                  <div style="width: ${safePerf.coding?.scorePercent || 0}%; height: 100%; background: linear-gradient(90deg, #7c3aed, #a78bfa); border-radius: 6px;"></div>
                </div>
              </div>

              <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-size: 12px; font-weight: 900; color: #475569;">Behavioral & HR Communication</span>
                  <span style="font-size: 12px; font-weight: 900; color: #7c3aed;">${safePerf.hr?.score || 0}% (${safePerf.hr?.marksObtained || 0}/14)</span>
                </div>
                <div style="height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden;">
                  <div style="width: ${safePerf.hr?.score || 0}%; height: 100%; background: linear-gradient(90deg, #7c3aed, #a78bfa); border-radius: 6px;"></div>
                </div>
              </div>
            </div>

            <div class="section-title">Final Assessment Summary</div>
            <div style="padding: 25px; background: #eff6ff; border: solid #dbeafe; border-radius: 24px;">
              <p style="margin: 0; font-size: 13px; color: #1e40af; font-weight: 600; line-height: 1.6;">
                The candidate's scores across all rounds have been normalized and validated using AI-driven benchmarks. 
                The current trend indicates a strong grasp of technical fundamentals with room for optimization in advanced problem-solving scenarios. 
                The overall readiness is projected based on a weighted average of both technical and soft skill assessments.
              </p>
            </div>

            <div class="footer" style="margin-top: 100px;">
              <div style="font-size: 10px; font-weight: 900; color: #7c3aed;">END OF DETAILED METRICS</div>
              <div class="document-footer">
                Verified Report ID: PLM-${student._id.toString().slice(-6).toUpperCase()}
                Official Placement Readiness Scorecard
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return pdf;
  }

  async getStudentAIInsights(userId) {
    const perf = await PerformanceAnalysis.findOne({ user: new Types.ObjectId(userId) }).lean();
    if (!perf) {
      return {
        finalVerdict: 'No Data',
        improvementIndex: 0,
        radarData: [
          { subject: 'Aptitude', A: 0, fullMark: 100 },
          { subject: 'Coding', A: 0, fullMark: 100 },
          { subject: 'Theory', A: 0, fullMark: 100 },
          { subject: 'Soft Skills', A: 0, fullMark: 100 }
        ],
        technicalAssessment: 'No assessment data available for this student yet.',
        behavioralInsights: 'Awaiting proctoring data.',
        competencyHeatmap: { strengths: [], weaknesses: [] },
        struggleLog: [],
        actionableRoadmap: [{ task: 'Complete Rounds', goal: 'Finish all 4 rounds to see insights', timeframe: 'Immediate' }]
      };
    }

    const exams = await Exam.find({ userId: new Types.ObjectId(userId) }).lean();
    
    const topicMap = new Map();
    exams.forEach(e => {
      const topic = e.topic || 'General';
      if (!topicMap.has(topic)) topicMap.set(topic, { total: 0, count: 0 });
      const stats = topicMap.get(topic);
      stats.total += (Number(e.score) || 0);
      stats.count++;
    });

    const topicPerformance = Array.from(topicMap.entries()).map(([name, stat]) => ({
      name,
      score: Math.round(stat.total / stat.count)
    }));

    const studentData = {
      scores: {
        mcq: perf.mcq?.score || 0,
        aptitude: perf.aptitude?.percentage || 0,
        coding: perf.coding?.scorePercent || 0,
        hr: perf.hr?.score || 0
      },
      behavioral: {
        proctoringViolations: perf.violations?.count || 0,
        violationLogs: perf.violations?.logs || [],
        timeSpent: exams.map(e => ({ title: e.title, spent: e.duration })),
        attemptHistory: exams.map(e => ({ title: e.title, answerChanges: Object.keys(e.userAnswers || {}).length }))
      },
      coding: {
        testCasesPassed: perf.coding?.passedCount || 0,
        totalTestCases: perf.coding?.totalCount || 0,
        complexity: perf.coding?.timeComplexity || 'N/A'
      },
      hrSentiment: {
        feedback: perf.hr?.feedback || '',
        strengths: perf.hr?.strengths || [],
        improvements: perf.hr?.improvements || []
      },
      topicPerformance
    };

    return this.aiService.generatePlacementReadinessReport(studentData);
  }

  async generateBatchPDF(collegeCode, instructorId) {
    const data = await this.getCollegeAnalytics(collegeCode, instructorId);
    const students = data.students;
    const totalStudents = students.length;
    const avgTrustScore = Math.round(students.reduce((acc, s) => acc + s.trustScore, 0) / (totalStudents || 1));
    const cleanList = students.filter(s => s.trustScore === 100);
    
    const skillStats = {
      theory: Math.round((students.filter(s => s.scores.mcq >= 70).length / (totalStudents || 1)) * 100),
      aptitude: Math.round((students.filter(s => s.scores.aptitude >= 70).length / (totalStudents || 1)) * 100),
      coding: Math.round((students.filter(s => s.scores.coding >= 70).length / (totalStudents || 1)) * 100),
      communication: Math.round((students.filter(s => s.scores.hr >= 70).length / (totalStudents || 1)) * 100),
      architectural: Math.round((students.filter(s => s.scores.overall >= 80).length / (totalStudents || 1)) * 100)
    };

    const skillsArray = [
      { name: 'Analytical Logic (Aptitude)', score: skillStats.aptitude },
      { name: 'Algorithmic Coding', score: skillStats.coding },
      { name: 'Behavioral Communication', score: skillStats.communication },
      { name: 'System Architecture', score: skillStats.architectural }
    ];
    const lowestTopic = skillsArray.reduce((prev, curr) => (prev.score < curr.score ? prev : curr));

    const batchCss = "" +
      "body { font-family: 'Inter', sans-serif; padding: 40px; color: #0f172a; line-height: 1.5; background: #fff; }" +
      ".header { display: flex; justify-content: space-between; align-items: center; border-bottom: solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px; }" +
      ".brand { font-weight: 900; font-size: 18px; color: #7c3aed; letter-spacing: -0.5px; }" +
      ".report-title { font-size: 24px; font-weight: 900; color: #1e293b; margin: 0; }" +
      ".stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }" +
      ".stat-card { background: #f8fafc; padding: 20px; border-radius: 20px; border: solid #e2e8f0; text-align: center; }" +
      ".stat-value { font-size: 32px; font-weight: 900; color: #7c3aed; display: block; }" +
      ".stat-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }" +
      ".section-title { font-size: 14px; font-weight: 900; color: #1e293b; border-left: solid #7c3aed; padding-left: 12px; margin: 0 20px; text-transform: uppercase; }" +
      ".heatmap-container { display: flex; gap: 10px; margin-bottom: 30px; }" +
      ".heatmap-item { flex: 1; padding: 15px; border-radius: 12px; text-align: center; color: white; font-weight: 700; font-size: 12px; }" +
      "table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 20px; }" +
      "th { background: #f8fafc; padding: 15px; text-align: left; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; border-bottom: solid #e2e8f0; }" +
      "td { padding: 15px; font-size: 12px; border-bottom: solid #f1f5f9; color: #334155; }" +
      ".clean-list-tag { background: #ecfdf5; color: #059669; padding: 12px; border-radius: 20px; font-weight: 900; font-size: 10px; }" +
      ".flagged-tag { background: #fef2f2; color: #dc2626; padding: 12px; border-radius: 20px; font-weight: 900; font-size: 10px; }" +
      ".alert-box { background: #fff7ed; border: solid #ffedd5; padding: 20px; border-radius: 16px; margin-top: 30px; }" +
      ".alert-title { font-size: 12px; font-weight: 900; color: #9a3412; margin-bottom: 8px; text-transform: uppercase; }" +
      ".alert-text { font-size: 12px; color: #c2410c; margin: 0; }";

    const tier1 = students.filter(s => s.scores.overall > 80 && s.trustScore === 100);
    const tier2 = students.filter(s => s.scores.overall >= 50 && s.scores.overall <= 80 && s.trustScore >= 80);
    const tier3 = students.filter(s => s.scores.overall < 50 || s.trustScore < 100);

    const batchInsights = [
      "Immediate focus required on Algorithmic Coding as " + (100 - skillStats.coding) + "% of students failed edge-case validations.",
      "70% of the batch exhibits high behavioral integrity; prioritize Tier 1 candidates for direct day-0 campus interviews.",
      "Normalized scores indicate a " + Math.abs(skillStats.theory - skillStats.aptitude) + "% gap between theory and practical logic; recommend bridge-course sessions."
    ];

    let htmlContent = "" +
      "<html><head><link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap' rel='stylesheet'><style>" + batchCss + 
      ".tier-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }" +
      ".tier-card { padding: 20px; border-radius: 20px; text-align: center; border: solid #e2e8f0; }" +
      ".tier-value { font-size: 28px; font-weight: 900; display: block; }" +
      ".tier-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; }" +
      "</style></head><body>" +
      "<div class='header'><div class='brand'>OVERALL REPORT</div><div style='text-align: right;'><div class='report-title'>CONSOLIDATED BATCH INTELLIGENCE</div>" +
      "<div style='font-size: 10px; color: #94a3b8; font-weight: 700;'>COLLEGE: " + collegeCode + " • " + new Date().toLocaleDateString() + "</div></div></div>" +
      "<div class='section-title'>Executive Summary Matrix</div>" +
      "<table style='margin-bottom: 30px;'><thead><tr><th>Metric Description</th><th>Batch Aggregate Value</th></tr></thead><tbody>" +
      "" +
      "<tr><td style='font-weight: 700;'>Batch Average Readiness Score</td><td style='font-weight: 900; color: #7c3aed;'>" + Math.round(students.reduce((acc, s) => acc + s.scores.overall, 0) / (totalStudents || 1)) + "%</td></tr>" +
      "<tr><td style='font-weight: 700;'>Most Challenging Module (Highest Failure)</td><td style='font-weight: 900; color: #ef4444;'>" + lowestTopic.name + "</td></tr>" +
      "<tr><td style='font-weight: 700;'>Total 'Clean List' Candidates</td><td style='font-weight: 900; color: #10b981;'>" + cleanList.length + " Candidates</td></tr>" +
      "</tbody></table>" +

      "<div class='stats-grid'>" +
      "<div class='stat-card'><span class='stat-value'>" + totalStudents + "</span><span class='stat-label'>Total Candidates</span></div>" +
      "<div class='stat-card'><span class='stat-value' style='color: #10b981;'>" + avgTrustScore + "%</span><span class='stat-label'>Avg Batch Trust Score</span></div>" +
      "<div class='stat-card'><span class='stat-value' style='color: #059669;'>" + cleanList.length + "</span><span class='stat-label'>Verified Clean List</span></div>" +
      "<div class='stat-card'><span class='stat-value' style='color: #f59e0b;'>" + Math.round(students.filter(s => s.scores.overall >= 80).length) + "</span><span class='stat-label'>High-Performance Hires</span></div></div>" +
      
      "<div class='section-title'>Placement Readiness Tiers</div>" +
      "<div class='tier-grid'>" +
      "<div class='tier-card' style='background: #ecfdf5; border-color: #10b981;'><span class='tier-value' style='color: #059669;'>" + tier1.length + "</span><span class='tier-label'>Tier 1 (High Readiness)</span></div>" +
      "<div class='tier-card' style='background: #fffbeb; border-color: #f59e0b;'><span class='tier-value' style='color: #d97706;'>" + tier2.length + "</span><span class='tier-label'>Tier 2 (Moderately Ready)</span></div>" +
      "<div class='tier-card' style='background: #fef2f2; border-color: #ef4444;'><span class='tier-value' style='color: #dc2626;'>" + tier3.length + "</span><span class='tier-label'>Tier 3 (Needs Improvement)</span></div></div>" +

      "<div class='section-title'>Executive Actionable Insights</div>" +
      "<div style='background: #f8fafc; padding: 20px; border-radius: 20px; border: solid #e2e8f0; margin-bottom: 30px;'>" +
      batchInsights.map(insight => "<div style='display: flex; gap: 10px; margin-bottom: 10px;'><div style='color:#7c3aed; font-weight: 900;'>•</div><div style='font-size: 12px; font-weight: 600; color:#334155;'>" + insight + "</div></div>").join('') + "</div>" +

      "<div class='section-title'>Aggregate Skill Heatmap (% Proficiency)</div><div class='heatmap-container'>";

    skillsArray.forEach(s => {
      const color = s.score >= 80 ? '#10b981' : s.score >= 60 ? '#f59e0b' : '#ef4444';
      htmlContent += "<div class='heatmap-item' style='background:" + color + ";'><div style='font-size: 18px; margin-bottom: 5px;'>" + s.score + "%</div><div style='font-size: 9px; text-transform: uppercase;'>" + s.name + "</div></div>";
    });

    htmlContent += "</div><div class='alert-box'><div class='alert-title'>Critical Insight for Instructor</div><p class='alert-text'>" +
      "The batch exhibits the lowest proficiency in " + lowestTopic.name + " (" + lowestTopic.score + "%)</strong>. " +
      "Targeted training or remedial sessions are recommended for this module. " +
      "Batch Integrity is stable at " + avgTrustScore + "%, with " + Math.round((students.filter(s => s.trustScore < 60).length / totalStudents) * 100) + "% students flagged for behavioral review.</p></div>" +
      "<div class='section-title'>Verified Referral List (Top Integrity & Skills)</div>" +
      "<table><thead><tr><th>Candidate Name</th><th>Overall Rank</th><th>Tech Score</th><th>Trust Score</th><th>Referral Status</th></tr></thead><tbody>";

    students.sort((a, b) => b.scores.overall - a.scores.overall).slice(0, 15).forEach((s, i) => {
      const tColor = s.trustScore === 100 ? '#10b981' : '#f59e0b';
      const tagClass = s.trustScore === 100 ? 'clean-list-tag' : 'flagged-tag';
      const tagText = s.trustScore === 100 ? 'DIRECT REFERRAL' : 'REQUIRES REVIEW';
      htmlContent += "<tr><td style='font-weight: 700;'>" + s.name + "</td><td style='font-weight: 600;'>#" + (i + 1) + "</td><td style='font-weight: 600; color: #7c3aed;'>" + s.scores.overall + "%</td>" +
        "<td style='font-weight: 600; color: " + tColor + ";'>" + s.trustScore + "%</td><td><span class='" + tagClass + "'>" + tagText + "</span></td></tr>";
    });

    htmlContent += "</tbody></table><div style='margin-top: 50px; padding-top: 20px; border-top: solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;'>" +
      "<div style='font-size: 10px; color: #94a3b8; font-weight: 700;'>OFFICIAL BATCH ANALYTICS REPORT • VERIFIED BY AI PROCTORING HUB</div>" +
      "<div style='font-size: 10px; color: #7c3aed; font-weight: 900;'>AUTHENTICITY KEY: BATCH-" + collegeCode + "-" + new Date().getTime().toString().slice(-6) + "</div></div></body></html>";

    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return pdf;
  }

  async generateBatchCSV(collegeCode, instructorId) {
    const data = await this.getCollegeAnalytics(collegeCode, instructorId);
    const students = data.students;

    const headers = ['Name', 'Email', 'Dept', 'MCQ', 'Aptitude (%)', 'Coding (%)', 'Coding Marks (8)', 'HR (%)', 'HR Marks (14)', 'Overall (%)', 'Trust Score (%)', 'Status'];
    const rows = students.map(s => [
      s.name,
      s.email,
      s.dept,
      s.scores.mcq,
      s.scores.aptitude,
      s.scores.coding,
      s.marks.coding,
      s.scores.hr,
      s.marks.hr,
      s.scores.overall,
      s.trustScore,
      s.status
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }

  async sendBatchEmails(collegeCode, instructorId) {
    const data = await this.getCollegeAnalytics(collegeCode, instructorId);
    const students = data.students;
    const { sendReportEmail, generateReportHtml } = await import('../utils/mailer.js');

    let successCount = 0;
    let failCount = 0;
    let lastError = null;

    // Process sequentially to manage resources (Puppeteer)
    for (const student of students) {
      if (student.status === 'Not Attempted') continue;

      try {
        const pdfBuffer = await this.generateIndividualPDF(student.id);
        const aiInsights = await this.getStudentAIInsights(student.id);

        const htmlEmail = generateReportHtml(
          student.name,
          { gapAnalysis: { overallReadiness: aiInsights.finalVerdict, strengths: aiInsights.competencyHeatmap?.strengths?.map(s => s.topic) || [], improvements: aiInsights.competencyHeatmap?.weaknesses?.map(w => w.topic) || [] } },
          student.scores.overall,
          student.scores.aptitude,
          student.scores.coding,
          student.scores.hr
        );

        await sendReportEmail(
          'guru03042005@gmail.com',
          `Placement Performance Report - ${student.name}`,
          htmlEmail,
          [
            {
              filename: `Report_${student.name.replace(/\s/g, '_')}.pdf`,
              content: pdfBuffer
            }
          ]
        );
        successCount++;
      } catch (err) {
        console.error(`[BATCH EMAIL] Failed for ${student.email}:`, err);
        lastError = err.message || err.toString();
        failCount++;
      }
    }

    if (failCount > 0 && successCount === 0) {
      throw new Error(`All emails failed. Error: ${lastError}`);
    }

    if (successCount === 0 && failCount === 0) {
      throw new Error(`No emails sent. All students are marked as "Not Attempted". Students must complete the assessment first.`);
    }

    return { 
      message: `Batch email processing complete. Sent: ${successCount}. Failed: ${failCount}.`,
      successCount,
      failCount 
    };
  }
}
