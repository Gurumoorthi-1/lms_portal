import express from 'express';
import mongoose from 'mongoose';
import { AuthService } from './auth.service.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Progress } from '../progress/progress.schema.js';

const router = express.Router();
const authService = new AuthService();

router.post('/register', async (req, res) => {
  try {
    const result = await authService.register(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const user = await authService.validateUser(req.body.email, req.body.password);
    const result = await authService.login(user);
    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
});

router.post('/institution-login', async (req, res) => {
  try {
    const { institutionId, email, password } = req.body;
    const user = await authService.validateInstitutionalUser(institutionId, email, password);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid institutional credentials' });
    }

    // Institutional users skip the MCQ round — auto-promote to RESUME_UPLOAD
    // Use user._id directly (Mongoose handles casting)
    let progress = await Progress.findOne({ user: user._id });
    
    if (!progress) {
      // Create progress record starting at RESUME_UPLOAD (skip MCQ)
      progress = await Progress.create({
        user: user._id,
        currentStage: 'RESUME_UPLOAD',
        status: 'ACTIVE',
        points: 0,
        context: {},
        reports: {}
      });
    } else if (progress.currentStage === 'MCQ') {
      // Auto-promote from MCQ to RESUME_UPLOAD
      progress.currentStage = 'RESUME_UPLOAD';
      progress.lastActivity = new Date();
      await progress.save();
    }
    
    // Issue token with the correct (skipped) stage
    const currentStage = progress.currentStage;
    const result = await authService.login(user, currentStage);
    res.json(result);
  } catch (error) {
    console.error('Institutional Login Crash:', error);
    res.status(401).json({ message: error.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const profile = await authService.getProfile(req.user.userId);
    res.json(profile);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const result = await authService.updateProfile(req.user.userId, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/change-password', requireAuth, async (req, res) => {
  try {
    const result = await authService.changePassword(req.user.userId, req.body.currentPassword, req.body.newPassword);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
