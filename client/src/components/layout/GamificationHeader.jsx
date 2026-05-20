import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Flame, Trophy, Star } from 'lucide-react';
import socket from '@/lib/socket';
import { authFetch } from '@/lib/api';

export default function GamificationHeader() {
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  
  const [showXpPopup, setShowXpPopup] = useState(false);

  const prevXp = useRef(null);
  const prevLevel = useRef(null);

  const updateStats = (data) => {
    if (!data) return;
    
    // Trigger XP gain popup only if it's not the initial load
    if (prevXp.current !== null && data.totalXP > prevXp.current) {
      setShowXpPopup(true);
      setTimeout(() => setShowXpPopup(false), 3000);
    }
    
    // Stats update from fetch or socket
    setXp(data.totalXP || 0);
    setLevel(data.level || 1);
    setStreak(data.streak || 0);
    
    prevXp.current = data.totalXP || 0;
    prevLevel.current = data.level || 1;
  };

  useEffect(() => {
    const fetchStats = () => {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?.id || user?._id;
      const statsUrl = userId ? `/exams/stats?userId=${userId}` : '/exams/stats';
      const progressUrl = '/progress/me';

      Promise.all([
        authFetch(statsUrl).then(res => res.json()),
        authFetch(progressUrl).then(res => res.json().catch(() => ({})))
      ])
        .then(([statsData, progressData]) => {
          if (statsData) {
            statsData.totalXP = (statsData.totalXP || 0) + (progressData?.points || 0);
            updateStats(statsData);
          }
        })
        .catch(err => console.error('Header fetch failed:', err));
    };

    // Initial fetch
    fetchStats();

    // Periodic refresh every 5 minutes (for streak day changes)
    const interval = setInterval(fetchStats, 5 * 60 * 1000);

    // Real-time listener
    socket.on('statsUpdated', (newStats) => {
      console.log('Header: Stats update received via socket');
      updateStats(newStats);
    });

    return () => {
      clearInterval(interval);
      socket.off('statsUpdated');
    };
  }, []);

  return (
    <div className="flex items-center gap-4 select-none">
      
      {/* Streak (Pulsing Flame) */}
      <motion.div 
        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-lg cursor-pointer"
        whileHover={{ scale: 1.05 }}
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        >
          <Flame size={18} className="text-orange-500 fill-orange-500" />
        </motion.div>
        <span className="font-black text-orange-600 text-sm tracking-tight">{streak} Day</span>
      </motion.div>

      {/* XP (Purple) & Popup */}
      <div className="relative">
        <motion.div 
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-lg cursor-pointer"
          whileHover={{ scale: 1.05 }}
        >
          <Zap size={18} className="text-purple-500 fill-purple-500" />
          <span className="font-black text-purple-600 text-sm tracking-tight">{xp} XP</span>
        </motion.div>
        
        {/* XP Popup Animation */}
        <AnimatePresence>
          {showXpPopup && (
            <motion.div
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: 1, y: -25, scale: 1.2 }}
              exit={{ opacity: 0, y: -40, scale: 0.8 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute left-1/2 -ml-6 -top-2 font-black text-sm text-purple-600 z-50 pointer-events-none drop-shadow-md"
            >
              +{xp - prevXp.current > 0 ? xp - prevXp.current : 0} XP
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
          <Trophy size={18} className="text-amber-500" />
          <span className="font-black text-amber-600 text-sm tracking-tight">Lvl {level}</span>
        </div>
      </div>

    </div>
  );
}

