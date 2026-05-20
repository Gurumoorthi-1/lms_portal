import mongoose from 'mongoose';

export const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  icon: { type: String },
  color: { type: String },
  defaultLanguage: { type: String, default: 'javascript' },
  allowedLanguages: { type: [String] },
  totalTopics: { type: Number, default: 0 },
  totalProblems: { type: Number, default: 0 },
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Hard'], default: 'Beginner' },
}, { timestamps: true });

export const Course = mongoose.model('Course', CourseSchema);
