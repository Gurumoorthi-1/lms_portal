import express from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireStage } from '../middlewares/progress.middleware.js';
import { ProgressService } from '../progress/progress.service.js';
import { PerformanceAnalysisService } from './performance-analysis.service.js';
import { examsGateway } from '../exams/exams.gateway.js';
import { User } from '../auth/user.schema.js';
import { InterviewSession } from './InterviewSession.schema.js';
import { sendReportEmail, generateReportHtml, generatePdfFromHtml } from '../utils/mailer.js';

const router = express.Router();
const progressService = new ProgressService();
const perfService = new PerformanceAnalysisService();

router.get('/performance', requireAuth, async (req, res) => {
  try {
    const profile = await perfService.getFullProfile(req.user.userId);
    res.json({ success: true, profile });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/email-report', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const profile = await perfService.getFullProfile(req.user.userId);

    // Dynamic metrics calculation identical to frontend
    const aptScore = profile?.aptitude?.percentage || 0;

    const codingMarksObtained = Number(profile?.coding?.marksObtained) || 0;
    const codingTotalMarks = 8;
    const codingScore = Math.round((codingMarksObtained / codingTotalMarks) * 100) || 0;

    const hrMarksObtained = Number(profile?.hr?.marksObtained) || 0;
    const hrTotalMarks = 14;
    const hrPercentage = Math.round((hrMarksObtained / hrTotalMarks) * 100) || 0;

    const overallScore = Math.round((aptScore + codingScore + hrPercentage) / 3) || 0;

    let recipientEmail = user.email;
    if (!recipientEmail || !recipientEmail.trim() || !recipientEmail.includes('@')) {
      console.warn(`[EmailReport] User ${user.username} has missing/invalid email: "${user.email}". Falling back to SMTP_USER.`);
      recipientEmail = process.env.SMTP_USER || 'guru707378@gmail.com';
    }

    const subject = `LMS Placement Readiness Report for ${user.username}`;
    
    // Generate gorgeous PDF report
    const reportHtml = generateReportHtml(user.username, profile, overallScore, aptScore, codingScore, hrPercentage);
    console.log('[EmailReport] Compiling high-fidelity PDF attachment via Puppeteer...');
    const pdfBuffer = await generatePdfFromHtml(reportHtml);

    // Dynamic premium descriptive welcome body for email
    const descriptionHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1F2937; max-width: 600px; margin: 20px auto; padding: 32px; border: 1px solid #E5E7EB; border-radius: 24px; background-color: #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #4F46E5; margin: 0; font-size: 24px; font-weight: 800;">LMS Institutional Placement</h2>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: #6B7280; text-transform: uppercase; letter-spacing: 1px;">Official Performance Suite</p>
        </div>
        <p style="font-size: 16px; font-weight: bold; color: #111827; margin-top: 0;">Dear ${user.username},</p>
        <p style="font-size: 14px; color: #4B5563;">
          We are pleased to inform you that your comprehensive placement evaluation has been successfully analyzed and processed. Your official <strong>Placement Readiness Report</strong> has been generated and is attached to this email as a high-fidelity PDF document.
        </p>
        <div style="background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); border-radius: 16px; padding: 20px; margin: 25px 0; border: 1px solid #E0E7FF;">
          <h3 style="margin-top: 0; color: #1E1B4B; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Evaluation Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #E5E7EB;">
              <td style="padding: 8px 0; font-size: 14px; color: #4B5563;">Aptitude Score</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: bold; text-align: right; color: #2563EB;">${aptScore}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #E5E7EB;">
              <td style="padding: 8px 0; font-size: 14px; color: #4B5563;">Coding Score</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: bold; text-align: right; color: #059669;">${codingScore}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #E5E7EB;">
              <td style="padding: 8px 0; font-size: 14px; color: #4B5563;">HR Interview Score</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: bold; text-align: right; color: #7C3AED;">${hrPercentage}%</td>
            </tr>
            <tr>
              <td style="padding: 10px 0 0 0; font-size: 15px; font-weight: bold; color: #1E1B4B;">Overall Performance</td>
              <td style="padding: 10px 0 0 0; font-size: 16px; font-weight: 800; text-align: right; color: #4F46E5;">${overallScore}%</td>
            </tr>
          </table>
        </div>
        <p style="font-size: 14px; color: #4B5563;">
          Your attached PDF report includes a complete gap analysis, your specific theory vs. practical balance rating, registered placement strengths, and tailored recommendation actions to strengthen your upcoming corporate placement interviews.
        </p>
        <p style="font-size: 14px; color: #4B5563;">
          Please review the attached PDF document for your detailed profile analysis.
        </p>
        <div style="border-top: 1px solid #E5E7EB; margin-top: 25px; padding-top: 20px; font-size: 12px; color: #9CA3AF; text-align: center;">
          <p>This message was automatically sent by the LMS Assessment Platform.</p>
          <p>&copy; 2026 LMS Inc. All rights reserved.</p>
        </div>
      </div>
    `;

    console.log(`[EmailReport] Dispatching real placement report email with PDF attachment to: ${recipientEmail}`);
    const info = await sendReportEmail(recipientEmail, subject, descriptionHtml, [
      {
        filename: `Placement_Readiness_Report_${user.username}.pdf`,
        content: pdfBuffer
      }
    ]);

    let message = `Performance report has been successfully emailed to ${recipientEmail} with PDF attachment!`;
    if (info.previewUrl) {
      message = `[TEST MODE] Performance report emailed successfully! Check backend console to view rendered preview.`;
    }

    res.json({
      success: true,
      message,
      previewUrl: info.previewUrl
    });
  } catch (error) {
    console.error('[EmailReport] Error occurred during SMTP dispatch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/start', requireAuth, requireStage('HR_INTERVIEW'), async (req, res) => {
  try {
    console.log("BACKEND: Starting new HR interview session for user:", req.user.userId);
    
    // Resume integration from LMS progress
    const progress = await progressService.getUserProgress(req.user.userId);
    const skills = progress.context?.resume?.skills || ['General'];
    
    const questions = [
      { questionText: "Tell me about yourself." },
      { questionText: `Explain your experience with ${skills[0] || 'your core technologies'}.` },
      { questionText: `How does ${skills[1] || 'backend architecture'} work in a modern application?` },
      { questionText: `Can you explain the difference between relational databases and NoSQL, in the context of ${skills[2] || 'your projects'}?` },
      { questionText: "What is your greatest strength?" },
      { questionText: "Why should we hire you?" },
      { questionText: "Are you ready to learn new technologies and adapt yourself?" },
    ];

    const session = await InterviewSession.create({
      user: req.user.userId,
      questions: questions,
      status: 'in-progress'
    });

    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/answer', requireAuth, requireStage('HR_INTERVIEW'), async (req, res) => {
  try {
    const { sessionId, questionIndex, answerText } = req.body;
    
    const session = await InterviewSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.questions[questionIndex]) {
      session.questions[questionIndex].answerText = answerText;
    }

    await session.save();
    
    // Simulate AI thinking and sending a professional HR response
    const responses = [
      "Good answer.", 
      "Interesting perspective.", 
      "That's a solid point.", 
      "I appreciate your detailed explanation.",
      "Very well explained."
    ];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    res.json({ message: 'Answer saved successfully', session, feedback: randomResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/finish', requireAuth, requireStage('HR_INTERVIEW'), async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await InterviewSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Mock Evaluation Logic based on transcript length
    let communication = 40, technical = 40, confidence = 40, resumeMatch = 40; // baseline for testing
    let answeredQuestions = 0;

    session.questions.forEach((q, index) => {
      if (q.answerText && q.answerText.trim().length > 0) {
        answeredQuestions++;
        communication += Math.min(10 + (q.answerText.length / 2), 60);
        if (index > 0 && index < 4) technical += Math.min(15 + (q.answerText.length / 2), 60);
        confidence += 10; 
      }
    });

    if (answeredQuestions > 0) {
      communication = Math.min(communication, 100);
      technical = Math.min(technical, 100);
      confidence = Math.min(confidence, 100);
      resumeMatch = Math.min(resumeMatch + (answeredQuestions * 5), 100);
    }

    session.scores = {
      communication,
      technical,
      confidence,
      resumeMatch,
      overall: Math.floor((communication + technical + confidence + resumeMatch) / 4)
    };
    
    session.status = 'completed';
    session.feedback = "Overall good performance. You communicated clearly but could go deeper into technical explanations.";
    await session.save();

    // Now INTEGRATE with LMS existing reports:
    const totalMarksObtained = Math.round((session.scores.overall / 100) * 14); // out of 14 for LMS compatibility
    const totalPossibleMarks = 14;
    const percentScore = session.scores.overall;

    await perfService.recordHRPerformance(req.user.userId, {
      score: percentScore,
      marksObtained: totalMarksObtained,
      totalMarks: totalPossibleMarks,
      feedback: session.feedback,
      strengths: ['Communication', 'Confidence'],
      improvements: ['Technical depth'],
      status: 'COMPLETED'
    });

    // Format responses for the LMS AI Report generator so it can generate Key Strengths
    const formattedResponses = {};
    session.questions.forEach((q, i) => {
      formattedResponses[`q${i}`] = {
        question: q.questionText,
        answer: q.answerText || 'No answer provided',
        score: (percentScore / 100) * 2
      };
    });

    await progressService.updateContext(req.user.userId, 'interview.responses', formattedResponses);
    await progressService.updateContext(req.user.userId, 'interview.percentScore', percentScore);
    await progressService.updateContext(req.user.userId, 'interview.status', 'completed');

    const stageResult = await progressService.moveToNextStage(req.user.userId, 'HR_INTERVIEW');

    // Trigger real-time update for instructor
    const user = await User.findById(req.user.userId).lean();
    if (user?.institutionId) {
      examsGateway.emitAnalyticsUpdate(user.institutionId);
    }

    res.json({
      success: true,
      message: 'Interview completed successfully!',
      session,
      percentScore,
      newToken: stageResult.newToken
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
