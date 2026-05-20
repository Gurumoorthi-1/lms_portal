'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BookOpen, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RevisionSystem({ weakTopics = [] }) {
  const navigate = useNavigate();

  if (!weakTopics || weakTopics.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
        <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
          Recommended Revision
          <span className="text-[10px] bg-red-50/50 border border-red-100 px-2 py-0.5 rounded text-red-600 uppercase font-black tracking-wider">
            Action Required
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {weakTopics.map((item, index) => (
          <motion.div
            key={item.topic}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.15 }}
            whileHover={{ scale: 1.02 }}
            className="group bg-white border-2 border-red-50 hover:border-red-200 shadow-sm rounded-2xl p-5 flex flex-col justify-between transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] leading-tight">{item.topic}</h3>
                  <p className="text-xs font-bold text-red-500 mt-0.5">Current Accuracy: {item.accuracy}%</p>
                </div>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 mb-5">
               <p className="text-xs font-semibold text-[#475569] flex flex-col gap-1.5">
                 <span className="flex items-center gap-1.5 text-[#2563EB]">
                   <Zap size={14} className="fill-[#2563EB]" /> 
                   AI Analysis
                 </span>
                 Based on past mistakes, we suggest refocusing on {item.topic} where you have {item.wrong} incorrect answers across recent tests.
               </p>
            </div>

            <button 
              onClick={() => navigate('/analytics')}
              className="w-full h-[42px] bg-white border border-[#E2E8F0] text-[#0F172A] group-hover:border-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <BookOpen size={16} /> View Analytics
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

