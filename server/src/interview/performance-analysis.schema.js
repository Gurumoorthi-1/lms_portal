import mongoose from 'mongoose';

export const PerformanceAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', unique: true },
  mcq: { type: Object, default: {} },
  resume: { type: Object, default: {} },
  aptitude: { type: Object, default: {} },
  coding: { type: Object, default: {} },
  hr: { type: Object, default: {} },
  violations: { type: Object, default: { count: 0, trustScore: 100, logs: [] } },
  gapAnalysis: { type: Object, default: {} },
}, { timestamps: true });

export const PerformanceAnalysis = mongoose.models.PerformanceAnalysis || mongoose.model('PerformanceAnalysis', PerformanceAnalysisSchema);
