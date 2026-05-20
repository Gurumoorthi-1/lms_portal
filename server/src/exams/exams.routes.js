import express from 'express';
import { ExamsService } from './exams.service.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();
const examsService = new ExamsService();

router.post('/', requireAuth, async (req, res) => {
  try {
    if (!req.body.userId) req.body.userId = req.user.userId;
    if (req.user.institutionId) req.body.institutionId = req.user.institutionId;
    const result = await examsService.create(req.body);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.post('/reset', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await examsService.resetUserExams(userId);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await examsService.getAnalytics(userId);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.get('/instructor/stats', requireAuth, async (req, res) => {
  try {
    const result = await examsService.getInstructorStats(req.query.filter, req.user.userId);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.get('/instructor/students', requireAuth, async (req, res) => {
  try {
    const result = await examsService.getInstructorStudents(req.user.userId);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.get('/instructor/deep-analytics', requireAuth, async (req, res) => {
  try {
    const result = await examsService.getInstructorDeepAnalytics(req.user.userId);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.get('/debug', async (req, res) => {
  try {
    const result = await examsService.findAll();
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const query = { ...req.query, requestUserId: req.user.userId, role: req.user.role, institutionId: req.user.institutionId };
    const result = await examsService.findAll(query);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await examsService.findOne(req.params.id);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.patch('/:id/submit', requireAuth, async (req, res) => {
  try {
    const { score, userAnswers, timeSpent, status } = req.body;
    const userId = req.user.userId;
    const result = await examsService.updateResult(req.params.id, score, userId, userAnswers, timeSpent, status);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await examsService.delete(req.params.id);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.post('/:id/violation', async (req, res) => {
  try {
    const result = await examsService.logViolation(req.params.id, req.body);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

export default router;
