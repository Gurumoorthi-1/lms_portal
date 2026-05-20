'use client';

import React, { memo } from 'react';
import { Clock } from 'lucide-react';

const ExamTimer = ({ timeLeft, urgentThreshold = 300 }) => {
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const isUrgent = timeLeft < urgentThreshold;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black tabular-nums text-sm border-2 transition-colors ${
      isUrgent ? 'bg-red-50 border-red-200 text-[#EF4444]' : 'bg-[#EFF6FF] border-blue-100 text-[#2563EB]'
    }`}>
      <Clock size={16} className={isUrgent ? 'animate-pulse' : ''} />
      {formatTime(timeLeft)}
    </div>
  );
};

export default memo(ExamTimer);

