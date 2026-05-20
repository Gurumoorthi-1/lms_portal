import express from 'express';
import multer from 'multer';
import { ResumeService } from './resume.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { PerformanceAnalysisService } from '../interview/performance-analysis.service.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();
const upload = multer();
const resumeService = new ResumeService();
const progressService = new ProgressService();
const perfService = new PerformanceAnalysisService();

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const allowedMimeTypes = [
      'application/pdf', 
      'text/plain', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({ message: `File type ${file.mimetype} is not supported.` });
    }

    const analysis = await resumeService.parseAndAnalyze(file.buffer, file.mimetype);
    
    await progressService.updateContext(req.user.userId, 'resume', analysis);
    
    await perfService.recordResumeAnalysis(req.user.userId, {
      skills: analysis.skills,
      experience: analysis.experience,
      summary: analysis.summary || '',
      primaryProgrammingLanguage: analysis.primaryProgrammingLanguage,
      educationLevel: analysis.education,
    });
    
    const result = await progressService.moveToNextStage(req.user.userId, 'RESUME_UPLOAD');
    
    res.json({
      success: true,
      analysis,
      newToken: result.newToken,
      message: 'Resume analyzed and promoted to Aptitude stage'
    });
  } catch (error) {
    console.error('❌ Resume Upload Error:', error);
    res.status(400).json({ message: error.message || 'Error analyzing resume' });
  }
});

export default router;
