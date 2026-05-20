import { Types, Model } from 'mongoose';

import jwt from 'jsonwebtoken';
import { User } from '../auth/user.schema.js';
import { Progress, AssessmentStage, ProgressStatus } from '../progress/progress.schema.js';
import { Submission } from '../problems/submission.schema.js';
import { Problem } from '../problems/problem.schema.js';
import { Exam } from '../exams/exam.schema.js';
import { Topic } from '../courses/topic.schema.js';
import { Course } from '../courses/course.schema.js';
import { PerformanceAnalysis } from '../interview/performance-analysis.schema.js';
import { CompilerService } from '../compiler/compiler.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { OutputFormatter } from '../compiler/output-formatter.js';

export class ProblemsService {
  constructor() {
    this.compilerService = new CompilerService();
    this.progressService = new ProgressService();
  }

  async findAll() {
    return Problem.find().select('-testCases').exec();
  }

  async findByTopic(topicId) {
    return Problem.find({ topicId: new Types.ObjectId(topicId) }).select('-testCases').sort({ order: 1 }).exec();
  }

  async findOne(id) {
    const problem = await Problem.findById(id).exec();
    if (!problem) throw new Error('Problem not found');
    return problem;
  }

  async submitSolution(userId, problemId, code, language) {
    const problem = await this.findOne(problemId);
    
    let testCasesPassed = 0;
    const totalTestCases = problem.testCases.length;
    let finalStatus = 'Accepted';
    let firstError = '';
    let firstOutput = '';
    let totalExecTime = 0;
    const results = [];
    let passedCount = 0;

    for (const testCase of problem.testCases) {
      let formattedInput = testCase.input;
      if (typeof testCase.input === 'object' && testCase.input !== null) {
        formattedInput = Array.isArray(testCase.input) ? testCase.input.join('\n') : JSON.stringify(testCase.input);
      }
      
      const result = await this.compilerService.executeCode(language, code, formattedInput);
      totalExecTime += result.execTime;

      const normalizedActual = OutputFormatter.cleanOutput(result.output);
      const normalizedExpected = OutputFormatter.cleanOutput(testCase.expectedOutput);
      const passed = result.success && OutputFormatter.compareOutputs(normalizedActual, normalizedExpected);

      results.push({
        input: formattedInput,
        expected: testCase.expectedOutput,
        actual: result.output,
        passed,
        logs: result.output
      });

      if (!result.success) {
        finalStatus = result.error.includes('Time limit exceeded') ? 'Time Limit Exceeded' : 'Runtime Error';
        firstError = result.error;
        break;
      } else if (!passed) {
        finalStatus = 'Wrong Answer';
        firstOutput = normalizedActual;
        break;
      }
      
      testCasesPassed++;
    }

    const submission = await Submission.create({
      userId: new Types.ObjectId(userId),
      problemId: problem._id,
      courseId: problem.courseId,
      language,
      code,
      status: finalStatus,
      output: firstOutput,
      error: firstError,
      executionTime: totalExecTime,
      testCasesPassed,
      totalTestCases,
    });

    await Problem.findByIdAndUpdate(problemId, {
      $inc: { submissionCount: 1, [finalStatus === 'Accepted' ? 'successCount' : 'failureCount']: 1 },
    });

    if (finalStatus === 'Accepted') {
      await this.progressService.awardPointsForProblem(userId, problemId, problem.difficulty);
    }

    return submission;
  }

  async createProblem(data) {
    return Problem.create(data);
  }

  async findSubmissionsByUser(userId, problemId) {
    return Submission.find({ 
      userId: new Types.ObjectId(userId), 
      problemId: new Types.ObjectId(problemId) 
    }).sort({ createdAt: -1 }).limit(10).exec();
  }
}
