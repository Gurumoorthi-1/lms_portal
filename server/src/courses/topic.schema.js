import mongoose from 'mongoose';

export const TopicSchema = new mongoose.Schema({
  title: { type: String, required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  order: { type: Number, default: 0 },
  description: { type: String },
  language: { type: String },
  icon: { type: String, default: '📚' },
  totalProblems: { type: Number, default: 0 },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Easy' },
}, { timestamps: true });

export const Topic = mongoose.model('Topic', TopicSchema);
