import express from 'express';
import multer from 'multer';
import { AiService } from './ai.service.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();
const upload = multer();
const aiService = new AiService();

router.post('/generate', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const result = await aiService.generateQuestions(req.body, req.file);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/tutor', requireAuth, async (req, res) => {
  try {
    const result = await aiService.getTutorResponse(req.body.question, req.body.type, req.body.userInput);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/study-plan', requireAuth, async (req, res) => {
  try {
    const result = await aiService.generateStudyPlan(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/review', requireAuth, async (req, res) => {
  try {
    if (!req.body.language || !req.body.code) {
      return res.json({ review: 'Missing code or language.' });
    }
    const review = await aiService.analyzeCode(req.body.language, req.body.code);
    res.json({ review });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/detect-ai', requireAuth, async (req, res) => {
  try {
    if (!req.body.language || !req.body.code) {
      return res.status(400).json({ message: 'Missing code or language.' });
    }
    const result = await aiService.detectAiCode(req.body.language, req.body.code);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
