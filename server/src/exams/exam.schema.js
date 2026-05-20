import mongoose from 'mongoose';

export const ExamSchema = new mongoose.Schema({
  title: { type: String, required: true },
  topic: { type: String, required: true },
  duration: { type: Number, required: true },
  questionCount: { type: Number, required: true },
  questions: { required: true, type: Array },
  score: { type: Number, default: 0 },
  status: { type: String, required: true, enum: ['pending', 'completed', 'disqualified'], default: 'pending' },
  isAI: { type: Boolean, default: false },
  isAptitude: { type: Boolean, default: false },
  aptitudeScenario: { type: Array, default: [] },
  aptitudeQuestionCount: { type: Number, default: 10 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  institutionId: { type: String },
  userAnswers: { type: Object, default: {} },
  timeSpent: { type: Number, default: 0 },
  baseExamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  violations: { type: Array, default: [] },
}, { timestamps: true });

export const Exam = mongoose.models.Exam || mongoose.model('Exam', ExamSchema);
export const PersonalExam = mongoose.models.PersonalExam || mongoose.model('PersonalExam', ExamSchema, 'personal_exams');

// Removed unique index to allow multiple attempts and templates with similar metadata
// ExamSchema.index({ title: 1, topic: 1, userId: 1, baseExamId: 1 }, { unique: true });
