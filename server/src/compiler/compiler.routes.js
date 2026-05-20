import express from 'express';
import { CompilerService } from './compiler.service.js';

const router = express.Router();
const compilerService = new CompilerService();

router.post('/run', async (req, res) => {
  try {
    const { language, code, input } = req.body;
    if (!language || !code) {
      return res.status(400).json({ message: 'Missing language or code' });
    }
    const result = await compilerService.executeCode(language, code, input || '');
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/execute', async (req, res) => {
  try {
    if (!req.body.language || !req.body.code) {
      return res.status(400).json({ message: 'Missing language or code' });
    }
    const result = await compilerService.executeCode(req.body.language, req.body.code, req.body.input_data || '');
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
