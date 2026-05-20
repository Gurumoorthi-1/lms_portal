import express from 'express';
import { AptitudeService } from './aptitude.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { PerformanceAnalysisService } from '../interview/performance-analysis.service.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireStage } from '../middlewares/progress.middleware.js';
import { User } from '../auth/user.schema.js';
import { Exam } from '../exams/exam.schema.js';

import { ExamsService } from '../exams/exams.service.js';
import { examsGateway } from '../exams/exams.gateway.js';

const router = express.Router();
const aptitudeService = new AptitudeService();
const progressService = new ProgressService();
const perfService = new PerformanceAnalysisService();
const examsService = new ExamsService();

router.get('/config', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let instructorId = user.createdBy;
    if (!instructorId && user.institutionId) {
      const instructor = await User.findOne({ institutionId: user.institutionId, role: 'instructor' });
      if (instructor) instructorId = instructor._id;
    }

    // Search for the latest relevant exam/template
    // Prioritize exams explicitly marked as Aptitude and linked to this instructor
    let configExam = null;
    
    if (instructorId) {
      configExam = await Exam.findOne({ 
        $or: [
          { userId: instructorId, isAptitude: true },
          { userId: instructorId },
          { userId: { $exists: false }, isAptitude: true },
          { userId: null, isAptitude: true }
        ]
      }).sort({ createdAt: -1 });
    } else {
      // Fallback for non-institutional users: Latest AI exam or Aptitude template
      configExam = await Exam.findOne({ 
        $or: [
          { isAptitude: true },
          { isAI: true }
        ]
      }).sort({ createdAt: -1 });
    }

    console.log(`[AptitudeConfig] User: ${req.user.userId}, Instructor: ${instructorId}, Exam Found: ${configExam?._id}, Count: ${configExam?.aptitudeQuestionCount || configExam?.questionCount}`);

    res.json({
      id: configExam?._id,
      isInstitutional: !!instructorId,
      questionCount: configExam?.aptitudeQuestionCount || configExam?.questionCount || 10,
      scenario: configExam?.aptitudeScenario || 'General Aptitude',
      topic: configExam?.topic || '',
      title: configExam?.title || 'Aptitude Assessment'
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/generate', requireAuth, requireStage('APTITUDE'), async (req, res) => {
  try {
    const progress = await progressService.getUserProgress(req.user.userId);
    let skills = req.body.skills;
    
    if (!skills || skills.length === 0) {
      skills = progress.context?.resume?.skills || [];
    }

    if (!skills || skills.length === 0) {
      return res.status(400).json({ message: 'Skills are required to generate the aptitude test.' });
    }

    const skillsString = skills.slice(0, 8).join(', ');
    const result = await aptitudeService.generateTest(
      skillsString, 
      Number(req.body.totalQuestions) || 10,
      req.body.scenario || 'General Aptitude',
      req.body.instructorTopic || ''
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/submit', requireAuth, requireStage('APTITUDE'), async (req, res) => {
  try {
    let result;
    if (req.body.bypassPassed === true) {
      result = {
        score: 10,
        maxScore: 10,
        percentage: 100,
        passed: true,
        processedAnswers: []
      };
    } else {
      if (!req.body.answers || !req.body.questions) {
        return res.status(400).json({ message: 'Answers and original questions are required for evaluation.' });
      }
      result = aptitudeService.evaluateTest(req.body.answers, req.body.questions);
    }
    
    await progressService.updateContext(req.user.userId, 'aptitude', {
      score: result.score,
      percentage: result.percentage,
      maxScore: result.maxScore,
      passed: result.passed,
      submittedAt: new Date()
    });

    await perfService.recordAptitudePerformance(req.user.userId, {
      score: result.score,
      percentage: result.percentage,
      maxScore: result.maxScore,
      passed: result.passed,
      status: result.passed ? 'PASSED' : 'FAILED'
    });

    // Update the Exam model so it shows up in the Instructor Dashboard
    if (req.body.examId) {
      try {
        await examsService.updateResult(
          req.body.examId,
          result.percentage,
          req.user.userId,
          req.body.answers,
          0, // timeSpent
          'completed'
        );
      } catch (examErr) {
        console.error('[AptitudeSubmit] Failed to sync with ExamsService:', examErr.message);
      }
    }

    let newToken = null;
    if (result.passed) {
      const promo = await progressService.moveToNextStage(req.user.userId, 'APTITUDE', req.body.bypassPassed === true);
      newToken = promo.newToken;
    }

    // Trigger real-time update for instructor
    const user = await User.findById(req.user.userId).lean();
    if (user?.institutionId) {
      examsGateway.emitAnalyticsUpdate(user.institutionId);
    }

    res.json({
      ...result,
      newToken
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
