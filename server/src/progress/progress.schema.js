import mongoose from 'mongoose';

export const AssessmentStage = {
  MCQ: 'MCQ',
  RESUME_UPLOAD: 'RESUME_UPLOAD',
  APTITUDE: 'APTITUDE',
  CODING: 'CODING',
  HR_INTERVIEW: 'HR_INTERVIEW'
};

export const ProgressStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  INACTIVE: 'INACTIVE'
};

export const ProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', unique: true },
  currentStage: { type: String, enum: Object.values(AssessmentStage), default: AssessmentStage.MCQ },
  status: { type: String, enum: Object.values(ProgressStatus), default: ProgressStatus.ACTIVE },
  context: { type: Object, default: {} },
  points: { type: Number, default: 0 },
  freeRunCount: { type: Number, default: 0 },
  solvedChallenges: { type: [{ challengeId: String, solvedAt: Date }], default: [] },
  solvedProblems: { type: [{ problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }, solvedAt: Date }], default: [] },
  lastActivity: { type: Date, default: Date.now },
  isWaitingApproval: { type: Boolean, default: false },
  isRejected: { type: Boolean, default: false },
  isHired: { type: Boolean, default: false },
  rejectionReason: { type: String, default: '' },
  reports: { type: Object, default: {} },
}, { timestamps: true });

export const Progress = mongoose.models.Progress || mongoose.model('Progress', ProgressSchema);
