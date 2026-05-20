
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from './user.schema.js';

export class AuthService {
  constructor() {
    // Dependencies injected directly or globally
  }

  async register(authDto) {
    const { username, email, password } = authDto;
    const normalizedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) throw new Error('User already exists');

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = normalizedEmail.includes('hod') ? 'hod' : (normalizedEmail.includes('instructor') ? 'instructor' : 'student');
    const user = new User({ username, email: normalizedEmail, password: hashedPassword, role });
    await user.save();

    return this.login(user);
  }

  async login(user, currentStage = 'MCQ') {
    const payload = { email: user.email, sub: user._id.toString(), role: user.role, institutionId: user.institutionId, currentStage };
    return {
      access_token: jwt.sign(payload, process.env.JWT_SECRET || 'secret'),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
        xp: user.xp,
        level: user.level,
        currentStage,
      },
    };
  }

  async generateTokenFromUser(userId, currentStage) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    const payload = { email: user.email, sub: user._id.toString(), role: user.role, institutionId: user.institutionId, currentStage };
    return jwt.sign(payload, process.env.JWT_SECRET || 'secret');
  }

  async validate(payload) {
    return { userId: payload.sub, email: payload.email, role: payload.role, institutionId: payload.institutionId, currentStage: payload.currentStage };
  }

  async validateUser(email, pass) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user && (await bcrypt.compare(pass, user.password))) {
      if (email.toLowerCase().includes('hod') && user.role !== 'hod') {
        user.role = 'hod';
        await user.save();
      }
      return user;
    }
    throw new Error('Invalid credentials');
  }

  async validateInstitutionalUser(institutionId, email, pass) {
    const query = { email: email.toLowerCase() };
    if (institutionId) query.institutionId = institutionId;
    
    const user = await User.findOne(query);
    if (user && (await bcrypt.compare(pass, user.password))) {
      if (email.toLowerCase().includes('hod') && user.role !== 'hod') {
        user.role = 'hod';
        await user.save();
      }
      return user;
    }
    throw new Error('Invalid institutional credentials');
  }

  async getProfile(userId) {
    const user = await User.findById(userId).lean().exec();
    if (!user) throw new Error('User not found');
    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      xp: user.xp || 0,
      level: user.level || 1,
      streak: user.streak || 0,
      institutionId: user.institutionId,
      preferences: user.preferences || {},
    };
  }

  async updateProfile(userId, data) {
    const allowedFields = {};
    if (data.username) allowedFields.username = data.username;
    if (data.preferences) allowedFields.preferences = data.preferences;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: allowedFields },
      { new: true, lean: true }
    ).exec();
    if (!user) throw new Error('User not found');
    return this.getProfile(userId);
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).exec();
    if (!user) throw new Error('User not found');
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new Error('Current password incorrect');
    const hashed = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(userId, { password: hashed }).exec();
    return { message: 'Success' };
  }
}
