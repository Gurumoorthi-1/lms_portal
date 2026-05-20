import express from 'express';
import { AnalyticsService } from './analytics.service.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();
const analyticsService = new AnalyticsService();

router.post('/report', async (req, res) => {
  try {
    const result = await analyticsService.generateReport(req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.post('/proctoring', requireAuth, async (req, res) => {
  try {
    const result = await analyticsService.logProctoringEvent({ ...req.body, userId: req.user.userId });
    res.json(result);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.post('/emotion', requireAuth, async (req, res) => {
  try {
    const result = await analyticsService.saveEmotionReport({ ...req.body, userId: req.user.userId });
    res.json(result);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.get('/instructor/:college_code/summary', requireAuth, async (req, res) => {
  try {
    const result = await analyticsService.getCollegeAnalytics(req.params.college_code, req.user.userId);
    res.json(result);
  } catch (e) { 
    console.error('[ANALYTICS] Summary Fetch Error:', e);
    res.status(400).json({ message: e.message }); 
  }
});

router.get('/student/:userId/pdf', async (req, res) => {
  try {
    const buffer = await analyticsService.generateIndividualPDF(req.params.userId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=report_${req.params.userId}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  } catch (e) {
    console.error('[ANALYTICS] PDF Generation Error:', e);
    res.status(400).json({ message: 'Failed to generate PDF' });
  }
});

router.get('/student/:userId/ai-insights', requireAuth, async (req, res) => {
  try {
    const result = await analyticsService.getStudentAIInsights(req.params.userId);
    res.json(result);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.get('/instructor/:college_code/batch-pdf', requireAuth, async (req, res) => {
  try {
    const buffer = await analyticsService.generateBatchPDF(req.params.college_code, req.user.userId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=batch_report_${req.params.college_code}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  } catch (e) {
    console.error('[ANALYTICS] Batch PDF Generation Error:', e);
    res.status(400).json({ message: 'Failed to generate batch PDF' });
  }
});

router.get('/instructor/:college_code/batch-csv', requireAuth, async (req, res) => {
  try {
    const csv = await analyticsService.generateBatchCSV(req.params.college_code, req.user.userId);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=performance_${req.params.college_code}.csv`,
    });
    res.status(200).send(csv);
  } catch (e) {
    console.error('[ANALYTICS] Batch CSV Generation Error:', e);
    res.status(400).json({ message: 'Failed to generate CSV' });
  }
});

router.post('/instructor/:college_code/batch-email', requireAuth, async (req, res) => {
  try {
    const result = await analyticsService.sendBatchEmails(req.params.college_code, req.user.userId);
    res.json(result);
  } catch (e) {
    console.error('[ANALYTICS] Batch Email Error:', e);
    res.status(400).json({ message: e.message });
  }
});

export default router;
