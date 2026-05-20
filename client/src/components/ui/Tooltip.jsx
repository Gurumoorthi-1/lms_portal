'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Tooltip({ children, content, position = 'top', delay = 0.2 }) {
  const [isVisible, setIsVisible] = useState(false);

  let posClasses = '';
  switch (position) {
    case 'top': posClasses = 'bottom-full left-1/2 -translate-x-1/2 mb-2'; break;
    case 'bottom': posClasses = 'top-full left-1/2 -translate-x-1/2 mt-2'; break;
    case 'left': posClasses = 'right-full top-1/2 -translate-y-1/2 mr-2'; break;
    case 'right': posClasses = 'left-full top-1/2 -translate-y-1/2 ml-2'; break;
    default: posClasses = 'bottom-full left-1/2 -translate-x-1/2 mb-2';
  }

  return (
    <div 
      className="relative flex items-center justify-center group"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: position === 'top' ? 5 : position === 'bottom' ? -5 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15, delay }}
            className={`absolute z-50 px-2 py-1 bg-[#0F172A] text-white text-[11px] font-bold rounded-lg shadow-xl whitespace-nowrap pointer-events-none ${posClasses}`}
          >
            {content}
            {position === 'top' && <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-[#0F172A]"></div>}
            {position === 'bottom' && <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-[#0F172A]"></div>}
            {position === 'left' && <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-[#0F172A]"></div>}
            {position === 'right' && <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-[#0F172A]"></div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

