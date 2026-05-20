import express from 'express';
import { ProgressService } from './progress.service.js';
import { PerformanceAnalysisService } from '../interview/performance-analysis.service.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { examsGateway } from '../exams/exams.gateway.js';

const router = express.Router();
const progressService = new ProgressService();
const perfService = new PerformanceAnalysisService();

router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const progress = await progressService.getUserProgress(userId);
    const authService = new (await import('../auth/auth.service.js')).AuthService();
    const token = await authService.generateTokenFromUser(userId, progress.currentStage);
    res.json({ ...progress.toObject(), newToken: token });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const result = await progressService.getLeaderboard(10);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/next-stage', requireAuth, async (req, res) => {
  try {
    const result = await progressService.moveToNextStage(req.user.userId, req.body.fromStage, req.body.isBypass);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/submit', requireAuth, async (req, res) => {
  try {
    const { challengeId, code, language } = req.body;
    const result = await progressService.submitChallenge(req.user.userId, challengeId, code, language);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/mcq/submit', requireAuth, async (req, res) => {
  try {
    const result = await progressService.submitMcq(req.user.userId, req.body.answers, req.body.questions);
    
    if (result.success) {
      const progress = await progressService.getUserProgress(req.user.userId);
      await perfService.recordMcqPerformance(req.user.userId, {
        score: result.score,
        correctCount: result.correctCount,
        totalQuestions: result.totalQuestions,
        weakAreas: progress.context?.mcq?.weakAreas || [],
        status: result.passed ? 'PASSED' : 'FAILED'
      });
    }
    
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/reset', requireAuth, async (req, res) => {
  try {
    await perfService.resetPerformance(req.user.userId);
    const result = await progressService.resetProgress(req.user.userId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/reports', requireAuth, async (req, res) => {
  try {
    const result = await progressService.getReports(req.user.userId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/approve', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'hod') {
      return res.status(403).json({ message: 'Only instructors can approve next rounds' });
    }
    const result = await progressService.approveNextRound(req.body.userId);
    examsGateway.emitProgressUpdate(req.body.userId, 'approved');
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/reject', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'hod') {
      return res.status(403).json({ message: 'Only instructors can reject candidates' });
    }
    const result = await progressService.rejectUser(req.body.userId, req.body.reason);
    examsGateway.emitProgressUpdate(req.body.userId, 'rejected');
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/hire', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'hod') {
      return res.status(403).json({ message: 'Only instructors can hire candidates' });
    }
    const result = await progressService.hireUser(req.body.userId);
    examsGateway.emitProgressUpdate(req.body.userId, 'hired');
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
