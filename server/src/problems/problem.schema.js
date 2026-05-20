import mongoose from 'mongoose';

const TestCaseSchema = new mongoose.Schema({
  input: { type: String },
  expectedOutput: { type: String, required: true },
  isHidden: { type: Boolean, default: false },
});

const ExampleSchema = new mongoose.Schema({
  input: { type: String },
  output: { type: String },
  explanation: { type: String },
});

export const ProblemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  description: { type: String, required: true },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Easy' },
  language: { type: String, required: true },
  allowedLanguages: { type: [String] },
  starterCode: { type: Map, of: String },
  hints: { type: [String] },
  examples: { type: [ExampleSchema] },
  testCases: { type: [TestCaseSchema] },
  submissionCount: { type: Number, default: 0 },
  successRate: { type: Number, default: 0 },
  order: { type: Number, default: 0 },
  tags: { type: [String] },
}, { timestamps: true });

export const Problem = mongoose.model('Problem', ProblemSchema);
