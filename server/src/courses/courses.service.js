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

export class CoursesService {
  constructor() {
    // Dependencies injected directly or globally
  }

  async findAll() {
    return Course.find().exec();
  }

  async findOne(id) {
    return Course.findById(id).exec();
  }

  async findBySlug(slug) {
    return Course.findOne({ slug }).exec();
  }

  async findTopicsByCourse(courseId) {
    return Topic.find({ courseId: new Types.ObjectId(courseId) }).sort({ order: 1 }).exec();
  }

  async createCourse(data) {
    return Course.create(data);
  }

  async createTopic(data) {
    return Topic.create(data);
  }
}
