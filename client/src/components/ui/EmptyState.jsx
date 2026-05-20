import React from 'react';
import { motion } from 'framer-motion';
import { FileSearch } from 'lucide-react';

export default function EmptyState({ 
  icon: Icon = FileSearch, 
  title = "No data found", 
  description = "There is nothing here at the moment. Please check back later.",
  actionText,
  onAction
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white border border-[#E2E8F0] shadow-sm rounded-3xl"
    >
      <div className="w-20 h-20 bg-[#F1F5F9] rounded-[24px] flex items-center justify-center mb-6 shadow-inner ring-4 ring-[#F8FAFC]">
        <Icon size={32} className="text-[#94A3B8]" />
      </div>
      <h3 className="text-xl font-black text-[#0F172A] mb-2">{title}</h3>
      <p className="text-sm font-medium text-[#64748B] max-w-md mb-8 leading-relaxed">
        {description}
      </p>
      {actionText && onAction && (
        <button 
          onClick={onAction}
          className="h-12 px-8 bg-[#2563EB] text-white rounded-2xl font-bold shadow-md shadow-[#2563EB]/20 hover:bg-[#1D4ED8] hover:shadow-lg transition-all active:scale-95"
        >
          {actionText}
        </button>
      )}
    </motion.div>
  );
}

