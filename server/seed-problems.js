import 'dotenv/config';
import mongoose from 'mongoose';
import { Course } from './src/courses/course.schema.js';
import { Topic } from './src/courses/topic.schema.js';
import { Problem } from './src/problems/problem.schema.js';

const MONGO_URI = process.env.MONGO_URI;

const seedProblems = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    await Problem.deleteMany({});
    console.log('Cleared existing problems');

    const topics = await Topic.find().populate('courseId');

    const problemsData = [];

    for (const topic of topics) {
      if (!topic.courseId) continue;
      const course = topic.courseId;
      
      let title = '';
      let description = '';
      let difficulty = topic.difficulty || 'Easy';
      let starterCode = {};
      let testCases = [];
      let examples = [];

      // MERN - React Basics
      if (topic.title === 'React Basics') {
        title = 'Build a Counter Component';
        description = 'Create a simple React Counter component that has an increment and decrement button. The initial state should be 0. The counter should not go below 0.';
        starterCode = {
          javascript: `import React, { useState } from 'react';\n\nexport default function Counter() {\n  // Your code here\n  return <div>Counter</div>;\n}`
        };
      } 
      // MERN - React State
      else if (topic.title === 'React State & Hooks') {
        title = 'To-Do List Manager';
        description = 'Implement a To-Do list using useState. You should be able to add a new task, mark it as completed, and delete it.';
        starterCode = {
          javascript: `import React, { useState } from 'react';\n\nexport default function TodoList() {\n  // Your code here\n  return <div>Todo</div>;\n}`
        };
      }
      // DSA - Arrays & Strings
      else if (topic.title === 'Arrays & Strings') {
        title = 'Two Sum';
        description = 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume that each input would have exactly one solution, and you may not use the same element twice.';
        starterCode = {
          javascript: `function twoSum(nums, target) {\n  // Your code here\n}`,
          cpp: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Your code here\n    }\n};`,
          python: `class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        # Your code here`
        };
        examples = [
          { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' }
        ];
        testCases = [
          { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', isHidden: false },
          { input: '[3,2,4]\n6', expectedOutput: '[1,2]', isHidden: false },
          { input: '[3,3]\n6', expectedOutput: '[0,1]', isHidden: true }
        ];
      }
      // DSA - Trees & Graphs
      else if (topic.title === 'Trees & Graphs') {
        title = 'Maximum Depth of Binary Tree';
        description = 'Given the root of a binary tree, return its maximum depth. A binary tree\'s maximum depth is the number of nodes along the longest path from the root node down to the farthest leaf node.';
        starterCode = {
          javascript: `function maxDepth(root) {\n  // Your code here\n}`,
          python: `class Solution:\n    def maxDepth(self, root: Optional[TreeNode]) -> int:\n        # Your code here`
        };
        examples = [
          { input: 'root = [3,9,20,null,null,15,7]', output: '3', explanation: 'The longest path is 3 -> 20 -> 15 or 3 -> 20 -> 7' }
        ];
        testCases = [
          { input: '[3,9,20,null,null,15,7]', expectedOutput: '3', isHidden: false }
        ];
      }
      // Python Basics
      else if (topic.title === 'Python Basics') {
        title = 'FizzBuzz';
        description = 'Write a program that outputs the string representation of numbers from 1 to n. But for multiples of three it should output "Fizz" instead of the number and for the multiples of five output "Buzz". For numbers which are multiples of both three and five output "FizzBuzz".';
        starterCode = {
          python: `def fizzBuzz(n):\n    # Your code here\n    pass`
        };
        examples = [
          { input: 'n = 3', output: '["1","2","Fizz"]', explanation: 'Standard FizzBuzz' }
        ];
        testCases = [
          { input: '3', expectedOutput: '["1","2","Fizz"]', isHidden: false },
          { input: '5', expectedOutput: '["1","2","Fizz","4","Buzz"]', isHidden: false }
        ];
      } else {
        // Fallback problem
        title = `Sample Problem for ${topic.title}`;
        description = `This is a sample problem description for the topic ${topic.title}.`;
        starterCode = {
          javascript: `function solve() {\n  // Your code here\n}`
        };
      }

      problemsData.push({
        title,
        description,
        topicId: topic._id,
        courseId: course._id,
        difficulty,
        language: course.defaultLanguage || 'javascript',
        allowedLanguages: course.allowedLanguages || ['javascript'],
        starterCode,
        examples,
        testCases,
        order: 1,
        tags: [topic.title.toLowerCase().replace(' ', '-')]
      });
      
      // Optionally add a second problem
      if (['Arrays & Strings', 'React State & Hooks'].includes(topic.title)) {
        problemsData.push({
          title: `Advanced ${title}`,
          description: `A slightly harder variation of the previous problem for ${topic.title}.`,
          topicId: topic._id,
          courseId: course._id,
          difficulty: 'Hard',
          language: course.defaultLanguage || 'javascript',
          allowedLanguages: course.allowedLanguages || ['javascript'],
          starterCode,
          examples,
          testCases,
          order: 2,
          tags: ['advanced', topic.title.toLowerCase().replace(' ', '-')]
        });
      }
    }

    const inserted = await Problem.insertMany(problemsData);
    console.log(`Inserted ${inserted.length} problems successfully.`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding problems:', error);
    process.exit(1);
  }
};

seedProblems();
