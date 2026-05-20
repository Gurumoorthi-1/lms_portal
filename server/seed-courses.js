import 'dotenv/config';
import mongoose from 'mongoose';
import { Course } from './src/courses/course.schema.js';
import { Topic } from './src/courses/topic.schema.js';

const MONGO_URI = process.env.MONGO_URI;

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing courses and topics
    await Course.deleteMany({});
    await Topic.deleteMany({});
    console.log('Cleared existing courses and topics');

    const coursesData = [
      {
        title: 'Full Stack MERN',
        slug: 'full-stack-mern',
        description: 'Master MongoDB, Express, React, and Node.js. Build production-ready web applications from scratch.',
        icon: '⚛️',
        color: '#3B82F6',
        defaultLanguage: 'javascript',
        allowedLanguages: ['javascript', 'typescript'],
        totalTopics: 4,
        totalProblems: 20,
        level: 'Intermediate',
      },
      {
        title: 'Data Structures & Algorithms',
        slug: 'dsa-mastery',
        description: 'Crack coding interviews by mastering core algorithms, data structures, and problem-solving techniques.',
        icon: '🧠',
        color: '#10B981',
        defaultLanguage: 'cpp',
        allowedLanguages: ['cpp', 'java', 'python', 'javascript'],
        totalTopics: 3,
        totalProblems: 15,
        level: 'Hard',
      },
      {
        title: 'Python for Data Science',
        slug: 'python-data-science',
        description: 'Learn Python programming, pandas, numpy, and machine learning basics to analyze real-world data.',
        icon: '🐍',
        color: '#F59E0B',
        defaultLanguage: 'python',
        allowedLanguages: ['python'],
        totalTopics: 3,
        totalProblems: 12,
        level: 'Beginner',
      }
    ];

    const courses = await Course.insertMany(coursesData);
    console.log(`Inserted ${courses.length} courses`);

    const topicsData = [];

    // MERN Topics
    const mern = courses.find(c => c.slug === 'full-stack-mern');
    topicsData.push(
      { title: 'React Basics', courseId: mern._id, order: 1, description: 'Learn JSX, Components, and Props.', language: 'javascript', icon: '⚛️', totalProblems: 5, difficulty: 'Easy' },
      { title: 'React State & Hooks', courseId: mern._id, order: 2, description: 'Master useState, useEffect, and Context API.', language: 'javascript', icon: '🎣', totalProblems: 5, difficulty: 'Medium' },
      { title: 'Node & Express', courseId: mern._id, order: 3, description: 'Build REST APIs and middleware.', language: 'javascript', icon: '🌐', totalProblems: 5, difficulty: 'Medium' },
      { title: 'MongoDB & Mongoose', courseId: mern._id, order: 4, description: 'Database design and schema modeling.', language: 'javascript', icon: '🍃', totalProblems: 5, difficulty: 'Hard' }
    );

    // DSA Topics
    const dsa = courses.find(c => c.slug === 'dsa-mastery');
    topicsData.push(
      { title: 'Arrays & Strings', courseId: dsa._id, order: 1, description: 'Two pointers, sliding window, prefix sums.', language: 'cpp', icon: '📊', totalProblems: 5, difficulty: 'Medium' },
      { title: 'Trees & Graphs', courseId: dsa._id, order: 2, description: 'BFS, DFS, and topological sort.', language: 'cpp', icon: '🌳', totalProblems: 5, difficulty: 'Hard' },
      { title: 'Dynamic Programming', courseId: dsa._id, order: 3, description: 'Memoization and tabulation techniques.', language: 'cpp', icon: '🧠', totalProblems: 5, difficulty: 'Hard' }
    );

    // Python Topics
    const python = courses.find(c => c.slug === 'python-data-science');
    topicsData.push(
      { title: 'Python Basics', courseId: python._id, order: 1, description: 'Variables, loops, and functions.', language: 'python', icon: '📝', totalProblems: 4, difficulty: 'Easy' },
      { title: 'Pandas & Data Manipulation', courseId: python._id, order: 2, description: 'DataFrames and data cleaning.', language: 'python', icon: '🐼', totalProblems: 4, difficulty: 'Medium' },
      { title: 'Machine Learning Intro', courseId: python._id, order: 3, description: 'Scikit-learn and linear regression.', language: 'python', icon: '🤖', totalProblems: 4, difficulty: 'Hard' }
    );

    const topics = await Topic.insertMany(topicsData);
    console.log(`Inserted ${topics.length} topics`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seed();
