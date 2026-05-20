'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BookOpen, Trophy, Target, ChevronRight, GraduationCap, ChevronLeft, Search, Filter } from 'lucide-react';
import { authFetch } from '@/lib/api';

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLevel, setActiveLevel] = useState('All');

  useEffect(() => {
    authFetch('/courses')
      .then(res => res.json())
      .then(data => {
        setCourses(data);
        setFilteredCourses(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch courses:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let result = courses;
    if (activeLevel !== 'All') {
      result = result.filter(c => c.level === activeLevel);
    }
    if (searchQuery.trim() !== '') {
      result = result.filter(c => 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredCourses(result);
  }, [searchQuery, activeLevel, courses]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const levels = ['All', 'Beginner', 'Intermediate', 'Hard'];

  return (
    <div className="min-h-screen bg-[#0F172A] text-white p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header Navigation */}
        <header className="mb-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <Link to="/student" 
              className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-2xl border border-white/10"
            >
              <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-bold uppercase tracking-widest">Back to Dashboard</span>
            </Link>
            
            <div className="flex items-center gap-3 text-blue-400 bg-blue-400/10 px-4 py-2 rounded-2xl border border-blue-400/20">
              <GraduationCap size={20} />
              <span className="text-xs font-black uppercase tracking-widest">Learning Paths</span>
            </div>
          </motion.div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent"
              >
                Choose Your Mastery
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-slate-400 text-lg max-w-2xl"
              >
                Structured, industry-aligned courses designed to take you from absolute beginner to a job-ready engineer.
              </motion.p>
            </div>
          </div>
        </header>

        {/* Search & Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col md:flex-row gap-4 mb-10 items-center"
        >
          {/* Search Bar */}
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search learning paths..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 shrink-0">
              {levels.map(level => (
                <button
                  key={level}
                  onClick={() => setActiveLevel(level)}
                  className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                    activeLevel === level 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Courses Grid */}
        {filteredCourses.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 bg-white/5 border border-white/10 rounded-[32px]"
          >
            <Filter size={48} className="mx-auto text-slate-500 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">No learning paths found</h3>
            <p className="text-slate-400">Try adjusting your search or filters.</p>
            <button 
              onClick={() => { setSearchQuery(''); setActiveLevel('All'); }}
              className="mt-6 px-6 py-2 bg-blue-600/20 text-blue-400 rounded-xl font-bold hover:bg-blue-600/30 transition-all"
            >
              Clear Filters
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredCourses.map((course, idx) => (
                <motion.div
                  key={course._id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                >
                  <Link to={`/courses/${course.slug}`}>
                    <motion.div
                      whileHover={{ scale: 1.02, translateY: -5 }}
                      className="group relative bg-white/5 border border-white/10 rounded-[32px] p-8 overflow-hidden cursor-pointer h-full flex flex-col"
                    >
                      {/* Background Gradient Effect */}
                      <div 
                        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500"
                        style={{ background: `radial-gradient(circle at top right, ${course.color || '#3B82F6'}, transparent)` }}
                      />

                      <div className="relative z-10 flex flex-col sm:flex-row gap-6 sm:gap-8 flex-1">
                        <div 
                          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-2xl shrink-0 transition-transform group-hover:scale-110 duration-300"
                          style={{ backgroundColor: `${course.color || '#3B82F6'}22`, border: `1px solid ${course.color || '#3B82F6'}44` }}
                        >
                          {course.icon || '🚀'}
                        </div>

                        <div className="flex-1 flex flex-col">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h2 className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors">
                              {course.title}
                            </h2>
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shrink-0 border ${
                              course.level === 'Beginner' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              course.level === 'Intermediate' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {course.level}
                            </span>
                          </div>
                          
                          <p className="text-slate-400 text-sm mb-6 line-clamp-2 flex-1">
                            {course.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-auto pt-4 border-t border-white/5">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-white/5 px-3 py-1.5 rounded-lg">
                              <BookOpen size={14} className="text-blue-400" />
                              {course.totalTopics || 0} Modules
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-white/5 px-3 py-1.5 rounded-lg">
                              <Target size={14} className="text-emerald-400" />
                              {course.totalProblems || 0} Challenges
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-white/5 px-3 py-1.5 rounded-lg">
                              <Trophy size={14} className="text-amber-400" />
                              {(course.totalProblems || 0) * 10} XP
                            </div>
                          </div>
                        </div>

                        {/* Hover Arrow */}
                        <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300 hidden sm:flex">
                          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                            <ChevronRight size={24} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Global Style for hiding scrollbar in filters */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}

