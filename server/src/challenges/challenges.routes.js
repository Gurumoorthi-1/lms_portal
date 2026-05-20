import express from 'express';
import { ChallengesService } from './challenges.service.js';
import { AiService } from '../ai/ai.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { CompilerService } from '../compiler/compiler.service.js';
import { PerformanceAnalysisService } from '../interview/performance-analysis.service.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireStage } from '../middlewares/progress.middleware.js';
import { OutputFormatter } from '../compiler/output-formatter.js';
import { examsGateway } from '../exams/exams.gateway.js';
import { User } from '../auth/user.schema.js';

const router = express.Router();
const challengesService = new ChallengesService();
const aiService = new AiService();
const progressService = new ProgressService();
const compilerService = new CompilerService();
const perfService = new PerformanceAnalysisService();

router.get('/', async (req, res) => {
  try {
    const result = await challengesService.findAll();
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.post('/generate-ai', requireAuth, requireStage('CODING'), async (req, res) => {
  const progress = await progressService.getUserProgress(req.user.userId);
  const resumeContext = progress.context?.resume || {};
  const lang = req.body.language || resumeContext.primaryProgrammingLanguage || 'javascript';

  try {
    const ctx = {
      skills: resumeContext.skills?.join(', ') || '',
      technologies: resumeContext.skills?.join(', ') || '',
      experience: resumeContext.experience?.join('. ') || '',
      projects: resumeContext.projects?.join('. ') || '',
      resumeText: resumeContext.summary || ''
    };

    console.log(`[AI] Generating resume-based problems for user ${req.user.userId}...`);
    const result = await aiService.generateCodingProblems(ctx, lang);
    res.json(result);
  } catch (error) {
    console.warn('🛡️ [FALLBACK] AI generation failed, using hardcoded resume-simulated problems:', error.message);
    
    const allChallenges = await challengesService.findAll();
    const fallback = allChallenges
      .filter(c => c.language === lang.toLowerCase())
      .slice(0, 5)
      .map((c, i) => ({
        ...c,
        id: `p${c.id}`,
        starterCode: c.starterCode,
        resumeRelevance: `Tailored based on your skills in ${lang}`,
        testCases: [
          { input: 'test1', expectedOutput: 'output1', difficulty: 'easy' },
          { input: 'test2', expectedOutput: 'output2', difficulty: 'easy' },
          { input: 'test3', expectedOutput: 'output3', difficulty: 'medium' },
          { input: 'test4', expectedOutput: 'output4', difficulty: 'medium' },
          { input: 'test5', expectedOutput: 'output5', difficulty: 'hard' }
        ]
      }));
    res.json(fallback);
  }
});

router.post('/evaluate-ai', requireAuth, requireStage('CODING'), async (req, res) => {
  try {
    const evaluation = await aiService.evaluateCodeSubmission(req.body.problem, req.body.language, req.body.code);
    
    const taskMarks = evaluation.passed ? 2 : (evaluation.passedCount > 0 ? 1 : 0);
    const scorePercent = (taskMarks / 2) * 100;
    const problemId = req.body.problem?.id || req.body.problem?._id || 'unknown';
    
    await progressService.updateContext(req.user.userId, `coding.tasks.${problemId}`, {
      problemTitle: req.body.problem?.title,
      passed: evaluation.passed,
      passedCount: evaluation.passedCount,
      totalCount: 5,
      taskMarks,
      scorePercent,
      timeComplexity: evaluation.timeComplexity || 'N/A',
      spaceComplexity: evaluation.spaceComplexity || 'N/A',
      feedback: evaluation.feedback || 'No feedback available',
      codeOriginScore: evaluation.codeOriginScore ?? 10,
      originClassification: evaluation.originClassification ?? 'HUMAN',
      originReason: evaluation.originReason ?? 'Standard human-like implementation style.',
      status: evaluation.passed ? 'PASSED' : 'FAILED',
      completedAt: new Date()
    });

    // Update summary for dashboard
    const prog = await progressService.getUserProgress(req.user.userId);
    const codingTasks = prog.context?.coding?.tasks || {};
    const totalMarks = Object.values(codingTasks).reduce((sum, t) => sum + (Number(t.taskMarks) || 0), 0);
    await progressService.updateContext(req.user.userId, 'coding.totalMarks', totalMarks);

    await perfService.recordCodingPerformance(req.user.userId, {
      scorePercent: Math.round((totalMarks / 8) * 100),
      taskMarks, // current
      marksObtained: totalMarks,
      passed: evaluation.passed,
      status: evaluation.passed ? 'PASSED' : 'FAILED'
    });

    if (evaluation.passed) {
      // Trigger real-time update for instructor
      const user = await User.findById(req.user.userId).lean();
      if (user?.institutionId) {
        examsGateway.emitAnalyticsUpdate(user.institutionId);
      }
    }

    return res.json(evaluation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/submit-tests', requireAuth, requireStage('CODING'), async (req, res) => {
  try {
    const results = [];
    let passedCount = 0;

    for (const tc of req.body.testCases) {
      let formattedInput = tc.input;
      if (typeof tc.input === 'object' && tc.input !== null) {
        formattedInput = Array.isArray(tc.input) ? tc.input.join('\n') : JSON.stringify(tc.input);
      }

      const exec = await compilerService.executeCode(req.body.language, req.body.code, formattedInput);
      const actualOutput = OutputFormatter.cleanOutput(exec.output || '');
      const expectedOutput = OutputFormatter.cleanOutput(tc.expectedOutput || '');
      
      const passed = exec.success && OutputFormatter.compareOutputs(actualOutput, expectedOutput);
      
      if (passed) passedCount++;

      results.push({
        input: formattedInput,
        expectedOutput,
        actualOutput,
        passed,
        logs: exec.output
      });
    }

    const totalCount = 5; 
    const allPassed = passedCount === totalCount;
    const taskMarks = allPassed ? 2 : (passedCount > 0 ? 1 : 0);
    const scorePercent = (taskMarks / 2) * 100;
    const problemId = req.body.problemId || 'unknown';

    await progressService.updateContext(req.user.userId, `coding.tasks.${problemId}`, {
      results,
      passedCount,
      totalCount,
      taskMarks,
      scorePercent,
      passed: allPassed,
      completedAt: new Date()
    });

    // Update summary for dashboard
    const prog = await progressService.getUserProgress(req.user.userId);
    const codingTasks = prog.context?.coding?.tasks || {};
    const totalMarks = Object.values(codingTasks).reduce((sum, t) => sum + (Number(t.taskMarks) || 0), 0);
    await progressService.updateContext(req.user.userId, 'coding.totalMarks', totalMarks);

    await perfService.recordCodingPerformance(req.user.userId, {
      scorePercent: Math.round((totalMarks / 8) * 100),
      taskMarks, // current
      marksObtained: totalMarks,
      passed: allPassed,
      status: allPassed ? 'PASSED' : 'FAILED'
    });

    res.json({
      success: true,
      results,
      passedCount,
      totalCount,
      scorePercent,
      passed: allPassed
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await challengesService.findOne(+req.params.id);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.post('/evaluate-custom', requireAuth, async (req, res) => {
  try {
    const result = await aiService.evaluateCustomInput(req.body.language, req.body.code, req.body.input, req.body.output);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

export default router;
