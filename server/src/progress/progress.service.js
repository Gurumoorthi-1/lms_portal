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
import { CompilerService } from '../compiler/compiler.service.js';
import { ChallengesService } from '../challenges/challenges.service.js';
import { AuthService } from '../auth/auth.service.js';
import { AiService } from '../ai/ai.service.js';

const ENABLE_TEST_BYPASS = true;

export class ProgressService {
  constructor() {
    this.compilerService = new CompilerService();
    this.challengesService = new ChallengesService();
    this.authService = new AuthService();
    this.aiService = new AiService();
  }

  async getUserProgress(userId) {
    let progress = await Progress.findOneAndUpdate(
      { user: new Types.ObjectId(userId) },
      { $setOnInsert: { currentStage: AssessmentStage.MCQ, status: ProgressStatus.ACTIVE, points: 0 } },
      { new: true, upsert: true }
    );

    // Auto-promote institutional users from MCQ to RESUME_UPLOAD
    if (progress.currentStage === 'MCQ') {
      const user = await User.findById(userId).lean();
      if (user?.institutionId) {
        progress.currentStage = 'RESUME_UPLOAD';
        progress.lastActivity = new Date();
        await Progress.updateOne({ _id: progress._id }, { $set: { currentStage: 'RESUME_UPLOAD', lastActivity: progress.lastActivity } });
        console.log(`[ProgressService] Auto-promoted institutional user ${userId} to RESUME_UPLOAD`);
      }
    }

    // Auto-recover missing HR reports for users who finished before the patch
    const hrReport = progress.reports?.hrInterview;
    const isMissingOrStuck = !hrReport || hrReport.status === 'PENDING';
    
    if (progress.currentStage === 'HR_INTERVIEW' && isMissingOrStuck) {
      const interviewContext = progress.context?.interview || {};
      const hasResponses = Object.keys(interviewContext.responses || {}).length > 0;
      
      if (interviewContext.status === 'completed' || hasResponses) {
        // Prevent concurrent generation loops by setting a temporary generating flag
        if (hrReport?.status !== 'GENERATING') {
          // Temporarily mark as generating to avoid duplicate calls during polling
          progress.reports = progress.reports || {};
          progress.reports.hrInterview = { status: 'GENERATING' };
          await Progress.findOneAndUpdate(
            { user: new Types.ObjectId(userId) },
            { $set: { 'reports.hrInterview': progress.reports.hrInterview } }
          );

          // Trigger report generation in the background so it will be ready soon
          this.generateInstitutionalReport(userId, 'hrInterview').catch(e => console.error('Auto-recovery report error:', e));
        }
        
        // Also ensure progress status is COMPLETED
        if (progress.status !== ProgressStatus.COMPLETED) {
          progress.status = ProgressStatus.COMPLETED;
          await Progress.findOneAndUpdate(
            { user: new Types.ObjectId(userId) },
            { $set: { status: ProgressStatus.COMPLETED } }
          );
        }
      }
    }

    return progress;
  }

  async getLeaderboard(limit = 10) {
    return Progress
      .find({})
      .sort({ points: -1 })
      .limit(limit)
      .populate('user', 'username email');
  }

  async incrementFreeRunCount(userId) {
    return Progress.findOneAndUpdate(
      { user: new Types.ObjectId(userId) },
      { $inc: { freeRunCount: 1 }, lastActivity: Date.now() },
      { upsert: true, new: true }
    );
  }

  async submitChallenge(userId, challengeId, code, language) {
    const challenge = await this.challengesService.findOne(challengeId);
    if (!challenge) throw new Error('Challenge not found');
    if (challenge.language !== language) throw new Error('Language mismatch');

    const result = await this.compilerService.executeCode(language, code);
    if (!result.success) return { ...result, success: false, passed: false };

    const validateFn = this.challengesService.getValidateFunction(challengeId);
    const passed = validateFn ? validateFn(result.output) : true;

    if (passed) {
      let pointsToAward = 10;
      if (challenge.difficulty === 'Medium') pointsToAward = 20;
      else if (challenge.difficulty === 'Hard') pointsToAward = 30;

      const progress = await this.getUserProgress(userId);
      const alreadySolved = progress.solvedChallenges.some(sc => sc.challengeId?.toString() === challengeId);

      if (!alreadySolved) {
        await Progress.findOneAndUpdate(
          { user: new Types.ObjectId(userId) },
          {
            $inc: { points: pointsToAward },
            $push: { solvedChallenges: { challengeId, solvedAt: new Date() } },
            lastActivity: Date.now()
          }
        );
      }
    }

    return {
      ...result,
      success: true,
      passed,
      expected: challenge.expectedOutput,
      message: passed ? 'Congratulations!' : 'Output did not match.'
    };
  }

  async awardPointsForProblem(userId, problemId, difficulty) {
    let pointsToAward = 10;
    if (difficulty === 'Medium') pointsToAward = 20;
    else if (difficulty === 'Hard') pointsToAward = 30;

    const progress = await this.getUserProgress(userId);
    const alreadySolved = progress.solvedProblems?.some(sp => sp.problemId.toString() === problemId);

    if (!alreadySolved) {
      return Progress.findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        {
          $inc: { points: pointsToAward },
          $push: { solvedProblems: { problemId: new Types.ObjectId(problemId), solvedAt: new Date() } },
          lastActivity: Date.now()
        },
        { new: true }
      );
    }
    return progress;
  }

  async moveToNextStage(userId, fromStage, isBypass = false) {
    const progress = await this.getUserProgress(userId);
    const stages = Object.values(AssessmentStage);
    const currentIndex = stages.indexOf(progress.currentStage);

    // Guard: If fromStage is missing or doesn't match current state, DO NOT promote.
    // This prevents accidental skips or double-promotions.
    if (!fromStage || progress.currentStage !== fromStage) {
      console.log(`[ProgressService] Stage mismatch or missing fromStage. Current: ${progress.currentStage}, Requested From: ${fromStage}. Refreshing token only.`);
      const currentToken = await this.authService.generateTokenFromUser(userId, progress.currentStage);
      return { progress, newToken: currentToken };
    }
    
    const reportKeyMap = {
      'MCQ': 'mcq',
      'RESUME_UPLOAD': 'resume',
      'APTITUDE': 'aptitude',
      'CODING': 'coding',
      'HR_INTERVIEW': 'hrInterview'
    };

    if (currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1];
      
      // Institutional Gating: Instead of promoting, wait for instructor approval
      const user = await User.findById(userId).lean();
      if (user?.institutionId && progress.currentStage !== 'RESUME_UPLOAD' && progress.currentStage !== 'MCQ' && !isBypass) {
        console.log(`[ProgressService] Gating institutional user ${userId} at ${progress.currentStage}. Waiting for instructor.`);
        progress.isWaitingApproval = true;
        progress.lastActivity = new Date();
        await progress.save();

        // Still generate the report for the stage they just finished
        const finishedStageKey = reportKeyMap[stages[currentIndex]];
        if (finishedStageKey) {
          this.generateInstitutionalReport(userId, finishedStageKey).catch(e => console.error(e));
        }

        return { progress, waitingApproval: true };
      }

      console.log(`[ProgressService] Promoting user ${userId} from ${progress.currentStage} to ${nextStage}`);
      progress.currentStage = nextStage;
      progress.lastActivity = new Date();
      await progress.save();

      const newToken = await this.authService.generateTokenFromUser(userId, nextStage);

      const finishedStageKey = reportKeyMap[stages[currentIndex]];
      if (finishedStageKey) {
        this.generateInstitutionalReport(userId, finishedStageKey).catch(e => console.error(e));
        
        // Sync to PerformanceAnalysis for Dashboard accuracy
        if (stages[currentIndex] === 'CODING') {
          const codingContext = progress.context?.coding || {};
          const perfService = new (await import('../interview/performance-analysis.service.js')).PerformanceAnalysisService();
          const total = 4;
          const solved = codingContext.passedCount || 0;
          const scorePercent = Math.round((solved / total) * 100);
          
          perfService.recordCodingPerformance(userId, {
            scorePercent,
            passedCount: solved,
            totalCount: total,
            status: solved >= 3 ? 'PASSED' : 'FAILED',
            passed: solved >= 3
          }).catch(e => console.error('Failed to sync coding performance:', e));
        }
      }

      return { progress, newToken };
    } else if (currentIndex === stages.length - 1 && progress.status !== ProgressStatus.COMPLETED) {
      // It's the final stage (HR Interview)
      // Institutional Gating: wait for instructor to Hire/Reject
      const user = await User.findById(userId).lean();
      if (user?.institutionId) {
        console.log(`[ProgressService] Gating institutional user ${userId} at final stage HR_INTERVIEW. Waiting for instructor Hire/Reject.`);
        progress.isWaitingApproval = true;
        progress.lastActivity = new Date();
        await progress.save();

        // Generate the HR report
        const finishedStageKey = reportKeyMap[stages[currentIndex]];
        if (finishedStageKey) {
          this.generateInstitutionalReport(userId, finishedStageKey).catch(e => console.error(e));
        }

        return { progress, waitingApproval: true };
      }

      progress.status = ProgressStatus.COMPLETED;
      progress.lastActivity = new Date();
      await progress.save();

      return { progress };
    }
    return { progress };
  }

  async approveNextRound(userId) {
    const progress = await Progress.findOne({ user: new Types.ObjectId(userId) });
    if (!progress) throw new Error('Progress not found');

    /* 
    if (!progress.isWaitingApproval) {
      throw new Error('User is not waiting for approval');
    }
    */

    const stages = Object.values(AssessmentStage);
    const currentIndex = stages.indexOf(progress.currentStage);

    if (currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1];
      console.log(`[ProgressService] Instructor APPROVED next round for ${userId}. Moving to ${nextStage}`);
      
      progress.currentStage = nextStage;
      progress.isWaitingApproval = false;
      progress.lastActivity = new Date();
      await progress.save();

      const newToken = await this.authService.generateTokenFromUser(userId, nextStage);
      return { success: true, nextStage, newToken };
    }
    
    return { success: false, message: 'No further stages' };
  }

  async rejectUser(userId, reason = '') {
    const progress = await Progress.findOne({ user: new Types.ObjectId(userId) });
    if (!progress) throw new Error('Progress not found');

    console.log(`[ProgressService] Instructor REJECTED user ${userId}. Reason: ${reason}`);
    progress.isRejected = true;
    progress.isWaitingApproval = false;
    progress.rejectionReason = reason;
    progress.status = ProgressStatus.INACTIVE;
    await progress.save();

    return { success: true };
  }

  async hireUser(userId) {
    const progress = await Progress.findOne({ user: new Types.ObjectId(userId) });
    if (!progress) throw new Error('Progress not found');

    console.log(`[ProgressService] Instructor HIRED user ${userId}`);
    progress.isHired = true;
    progress.isWaitingApproval = false;
    progress.status = ProgressStatus.COMPLETED;
    await progress.save();

    return { success: true };
  }

  async updateContext(userId, key, data) {
     return Progress.findOneAndUpdate(
       { user: new Types.ObjectId(userId) },
       { $set: { [`context.${key}`]: data }, lastActivity: Date.now() },
       { new: true }
     );
  }

  async getContext(userId) {
    const progress = await this.getUserProgress(userId);
    return progress.context || {};
  }

  async submitMcq(userId, answers, questions) {
    let correctCount = 0;
    const totalQuestions = questions ? questions.length : Object.keys(answers).length;
    const weakAreas = [];

    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const selectedIdx = answers[String(i)];
        const correctIdx = questions[i].answer;
        const isTesting = ENABLE_TEST_BYPASS;
        const isCorrect = isTesting ? (Number(selectedIdx) === correctIdx || Number(selectedIdx) === 0) : (Number(selectedIdx) === correctIdx);
        if (isCorrect) {
          correctCount++;
        } else {
          const topic = questions[i].category || `Question ${i + 1}`;
          weakAreas.push(topic);
        }
      }
    } else {
      correctCount = totalQuestions;
    }

    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = score >= 50;
    
    await this.updateContext(userId, 'mcq', {
      score,
      correctCount,
      totalQuestions,
      weakAreas,
      submittedAt: new Date(),
      status: passed ? 'PASSED' : 'FAILED'
    });

    if (passed) {
      this.generateInstitutionalReport(userId, 'mcq').catch(e => console.error(e));
      const result = await this.moveToNextStage(userId, AssessmentStage.MCQ);
      return {
        success: true,
        passed: true,
        score,
        correctCount,
        totalQuestions,
        nextRound: '/student/resume',
        newToken: result.newToken
      };
    }

    return {
      success: true,
      passed: false,
      score,
      correctCount,
      totalQuestions,
      message: `You scored ${score}%. Need 50% to pass.`
    };
  }

  async resetProgress(userId) {
    try {
      console.log(`[ProgressService] Resetting progress for user: ${userId}`);
      // Check if user is institutional to determine the starting stage
      const user = await this.authService.getProfile(userId);
      if (user.institutionId) {
        throw new Error('Institutional users cannot reset their own progress.');
      }
      const startStage = AssessmentStage.MCQ;
      
      const progress = await Progress.findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        { 
          $set: { 
            currentStage: startStage, 
            status: ProgressStatus.ACTIVE,
            context: {},
            reports: {},
            points: 0,
            solvedChallenges: [],
            solvedProblems: [],
            isWaitingApproval: false,
            isRejected: false,
            isHired: false
          } 
        },
        { new: true, upsert: true }
      ).populate('user');

      if (!progress) throw new Error('Progress not found');
      const newToken = await this.authService.generateTokenFromUser(userId, startStage);
      return { success: true, newToken, stage: startStage };
    } catch (error) {
      console.error('[ProgressService] Reset Progress Error:', error);
      throw error;
    }
  }

  async generateInstitutionalReport(userId, stage) {
    const user = await this.authService.getProfile(userId);
    if (!user.institutionId) return null;
    const progress = await Progress.findOne({ user: new Types.ObjectId(userId) }).lean();
    const context = progress.context || {};

    try {
      const dataToAnalyze = context[stage === 'hrInterview' ? 'interview' : stage] || {};
      let realScore = null;
      let realStatus = 'PENDING';
      
      if (stage === 'coding') {
        const codingTasks = context.coding?.tasks || {};
        const totalMarks = Object.values(codingTasks).reduce((sum, t) => sum + (Number(t.taskMarks) || 0), 0);
        realScore = Math.round((totalMarks / 8) * 100);
        realStatus = totalMarks >= 4 ? 'PASSED' : 'FAILED';
      } else if (stage === 'mcq') {
        realScore = context['mcq']?.score ?? null;
        realStatus = context['mcq']?.status || (realScore !== null && realScore >= 50 ? 'PASSED' : 'FAILED');
      } else if (stage === 'aptitude') {
        const aptData = context['aptitude'] || {};
        realScore = aptData.percentage ?? aptData.score ?? null;
        realStatus = aptData.passed ? 'PASSED' : 'FAILED';
      } else {
        const interviewData = context['interview'] || {};
        
        if (interviewData.percentScore !== undefined) {
          realScore = interviewData.percentScore;
        } else {
          const responses = interviewData.responses ? Object.values(interviewData.responses) : [];
          const totalMarks = responses.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
          realScore = Math.round((totalMarks / 14) * 100);
        }
        
        realStatus = interviewData.status === 'completed' ? 'COMPLETED' : 'PENDING';
      }
      
      const parsedReport = await this.aiService.generateInstitutionalReport(stage, dataToAnalyze, realScore ?? 0, realStatus);
      if (realScore !== null) parsedReport.score = realScore;
      parsedReport.status = realStatus;
      
      await Progress.findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        { $set: { [`reports.${stage}`]: parsedReport } }
      );
      return parsedReport;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  async getReports(userId) {
    const progress = await this.getUserProgress(userId);
    return progress.reports || {};
  }
}
