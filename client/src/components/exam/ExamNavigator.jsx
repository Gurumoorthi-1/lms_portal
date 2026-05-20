'use client';

import React, { memo } from 'react';
import { Flag } from 'lucide-react';

const ExamNavigator = ({ questions, currentIdx, answers, onNavigate, onFinish, isSubmitting }) => {
  const answeredCount = Object.keys(answers).length;

  return (
    <aside className="hidden lg:flex w-72 flex-col bg-white border-l border-[#E2E8F0] p-6 shrink-0">
      <h3 className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-4">Navigator</h3>
      <div className="grid grid-cols-5 gap-2 mb-6">
        {questions.map((q, i) => (
          <button
            key={q.id || i}
            onClick={() => onNavigate(i)}
            className={`h-11 rounded-xl text-xs font-black border-2 transition-all ${
              i === currentIdx
                ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-md scale-110'
                : answers[q.id] !== undefined
                  ? 'border-[#22C55E] bg-[#F0FDF4] text-[#15803D]'
                  : 'border-[#E2E8F0] text-[#64748B] hover:border-slate-300'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="space-y-3 text-xs font-bold">
        {[['#2563EB', 'Current'], ['#22C55E', 'Answered'], ['#E2E8F0', 'Unanswered']].map(([c, l]) => (
          <div key={l} className="flex items-center gap-2 text-[#64748B]">
            <div className="w-3 h-3 rounded-sm" style={{ background: c }} /> {l}
          </div>
        ))}
      </div>
      <div className="mt-auto pt-6 border-t border-[#E2E8F0] space-y-3">
        <button className="w-full h-11 flex items-center justify-center gap-2 border-2 border-[#E2E8F0] text-[#64748B] rounded-xl text-xs font-bold hover:border-red-200 hover:text-red-500 transition-colors">
          <Flag size={16} /> Flag Question
        </button>
        {answeredCount === questions.length && (
          <button
            onClick={() => onFinish(true)}
            disabled={isSubmitting}
            className={`w-full h-12 rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
              isSubmitting ? 'bg-slate-100 text-slate-400' : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
            }`}
          >
            {isSubmitting ? <span className="animate-spin">◌</span> : 'Finish Exam →'}
          </button>
        )}
      </div>
    </aside>
  );
};

export default memo(ExamNavigator);

