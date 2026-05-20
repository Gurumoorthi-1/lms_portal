import express from 'express';
import { ProblemsService } from './problems.service.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();
const problemsService = new ProblemsService();

router.get('/', async (req, res) => {
  try {
    const { topicId } = req.query;
    if (topicId) {
      const result = await problemsService.findByTopic(topicId);
      return res.json(result);
    }
    const result = await problemsService.findAll();
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await problemsService.findOne(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/:id/submit', requireAuth, async (req, res) => {
  try {
    const { code, language } = req.body;
    const result = await problemsService.submitSolution(req.user.userId, req.params.id, code, language);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id/submissions', requireAuth, async (req, res) => {
  try {
    const result = await problemsService.findSubmissionsByUser(req.user.userId, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
