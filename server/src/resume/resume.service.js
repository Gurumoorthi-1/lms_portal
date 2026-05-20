import { Types } from 'mongoose';

import jwt from 'jsonwebtoken';
import { User } from '../auth/user.schema.js';
import { Progress, AssessmentStage, ProgressStatus } from '../progress/progress.schema.js';
import { Submission } from '../problems/submission.schema.js';
import { Problem } from '../problems/problem.schema.js';
import { Exam } from '../exams/exam.schema.js';
import { Topic } from '../courses/topic.schema.js';
import { Course } from '../courses/course.schema.js';
import { PerformanceAnalysis } from '../interview/performance-analysis.schema.js';
import { AiService } from '../ai/ai.service.js';
import pdfParse from "pdf-parse";

export class ResumeService {
  constructor() {
    this.aiService = new AiService();
  }

  async parseAndAnalyze(buffer, mimetype) {
    let text = '';
    if (mimetype === 'application/pdf') {
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;
    } else {
      text = buffer.toString('utf-8');
    }

    if (!text || text.length < 50) {
      throw new Error('Could not extract sufficient text from the resume.');
    }

    return this.aiService.analyzeResume(text);
  }
}
