import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorState({ 
  title = "Something went wrong", 
  description = "We encountered an unexpected error while fetching this data. Please try again.",
  onRetry
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-6 text-center bg-white border-2 border-red-100 shadow-sm rounded-3xl"
    >
      <div className="w-16 h-16 bg-red-50 rounded-[20px] flex items-center justify-center mb-5 ring-4 ring-red-50/50">
        <AlertCircle size={28} className="text-red-500" />
      </div>
      <h3 className="text-lg font-black text-[#0F172A] mb-2">{title}</h3>
      <p className="text-sm font-medium text-[#64748B] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="h-11 px-6 bg-white border-2 border-[#E2E8F0] text-[#0F172A] hover:border-red-200 hover:bg-red-50 hover:text-red-600 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95"
        >
          <RefreshCw size={16} /> Try Again
        </button>
      )}
    </motion.div>
  );
}

