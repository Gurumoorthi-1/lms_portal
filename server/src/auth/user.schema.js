import mongoose from 'mongoose';

export const UserSchema = new mongoose.Schema({
  username: { required: true, type: String },
  email: { type: String, required: true, unique: true },
  password: { required: true, type: String },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  role: { default: 'student', type: String },
  streak: { type: Number, default: 0 },
  preferences: { type: Object, default: {} },
  institutionId: { type: String },
  institutionName: { type: String },
  displayPassword: { type: String }, // Plain text for institutional reference
  createdBy: { type: String },
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
