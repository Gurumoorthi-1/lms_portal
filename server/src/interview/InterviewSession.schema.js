import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  answerText: { type: String },
  audioUrl: { type: String },
});

const interviewSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questions: [questionSchema],
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
  scores: {
    communication: { type: Number, default: 0 },
    technical: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    resumeMatch: { type: Number, default: 0 },
    overall: { type: Number, default: 0 }
  },
  feedback: { type: String }
}, { timestamps: true });

export const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);
