'use client';

import React, { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const ProgressDots = memo(({ total, current, answers, questions }) => {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {Array.from({ length: total }).map((_, i) => {
        const q = questions[i];
        const key = (q && q.id !== undefined) ? q.id : i;
        const isAnswered = answers[key] !== undefined;
        
        return (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? 'w-6 bg-[#2563EB]'
              : isAnswered ? 'w-2 bg-[#22C55E]'
              : 'w-2 bg-[#E2E8F0]'
            }`}
          />
        );
      })}
    </div>
  );
});

ProgressDots.displayName = 'ProgressDots';

const ExamFooter = ({ 
  currentIdx, 
  totalQuestions, 
  onNavigate, 
  onFinish, 
  isSubmitting, 
  answers, 
  questions 
}) => {
  return (
    <footer className="h-20 bg-white border-t border-[#E2E8F0] flex items-center justify-between px-6 md:px-12 shrink-0">
      <button
        onClick={() => onNavigate(currentIdx - 1)}
        disabled={currentIdx === 0}
        className="flex items-center gap-2 h-12 px-6 border-2 border-[#E2E8F0] rounded-2xl font-bold text-[#64748B] hover:border-slate-300 hover:text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft size={20} /> Previous
      </button>

      <div className="hidden md:block">
        <ProgressDots 
          total={totalQuestions} 
          current={currentIdx} 
          answers={answers} 
          questions={questions}
        />
      </div>

      {currentIdx < totalQuestions - 1 ? (
        <button
          onClick={() => onNavigate(currentIdx + 1)}
          className="flex items-center gap-2 h-12 px-8 bg-[#2563EB] text-white rounded-2xl font-bold hover:bg-[#1D4ED8] active:scale-95 transition-all shadow-md"
        >
          Next <ChevronRight size={20} />
        </button>
      ) : (
        <button
          onClick={() => onFinish(true)}
          disabled={isSubmitting}
          className={`flex items-center gap-2 h-12 px-8 rounded-2xl font-bold transition-all shadow-md ${
            isSubmitting ? 'bg-slate-100 text-slate-400' : 'bg-[#22C55E] text-white hover:bg-[#16A34A] active:scale-95'
          }`}
        >
          {isSubmitting ? 'Submitting...' : 'Finish Exam'} <ChevronRight size={20} />
        </button>
      )}
    </footer>
  );
};

export default memo(ExamFooter);

