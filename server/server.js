import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import morgan from 'morgan';

import authRoutes from './src/auth/auth.routes.js';
import aiRoutes from './src/ai/ai.routes.js';
import analyticsRoutes from './src/analytics/analytics.routes.js';
import aptitudeRoutes from './src/aptitude/aptitude.routes.js';
import challengesRoutes from './src/challenges/challenges.routes.js';
import compilerRoutes from './src/compiler/compiler.routes.js';
import coursesRoutes from './src/courses/courses.routes.js';
import examsRoutes from './src/exams/exams.routes.js';
import institutionRoutes from './src/institution/institution.routes.js';
import interviewRoutes from './src/interview/interview.routes.js';
import problemsRoutes from './src/problems/problems.routes.js';
import progressRoutes from './src/progress/progress.routes.js';
import resumeRoutes from './src/resume/resume.routes.js';

import { examsGateway } from './src/exams/exams.gateway.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

examsGateway.init(io);

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/auth', authRoutes);
app.use('/ai', aiRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/aptitude', aptitudeRoutes);
app.use('/challenges', challengesRoutes);
app.use('/compiler', compilerRoutes);
app.use('/courses', coursesRoutes);
app.use('/exams', examsRoutes);
app.use('/institution', institutionRoutes);
app.use('/interview', interviewRoutes);
app.use('/problems', problemsRoutes);
app.use('/progress', progressRoutes);
app.use('/resume', resumeRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔥 [Server Error]:', err);
  res.status(500).json({
    message: err.message || 'Internal Server Error',
    stack: err.stack,
  });
});

// Socket.io for Interview Chat and Proctoring Events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lms';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    httpServer.timeout = 120000; // 2 minutes for long AI requests
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
  });

// Server initialized 
