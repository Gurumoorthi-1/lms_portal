import React from 'react';
import { motion } from 'framer-motion';
import { PartyPopper, LogOut, Sparkles, Trophy, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HiredState = ({ onReturn }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/auth/institution';
  };

  const handleReturnDashboard = () => {
    if (onReturn) onReturn();
    navigate('/student/dashboard');
  };

  return (
    <div className="fixed inset-0 z-[110] bg-white flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-8"
      >
        {/* Celebration Icon */}
        <div className="relative mx-auto w-28 h-28">
          <motion.div 
            animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="absolute inset-0 bg-emerald-100 rounded-[2.5rem] rotate-6"
          />
          <div className="absolute inset-0 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-emerald-200">
            <Trophy size={48} className="text-white" />
          </div>
        </div>

        {/* Floating particles */}
        <div className="relative">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -30, 0],
                x: [0, (i % 2 === 0 ? 15 : -15), 0],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{ repeat: Infinity, duration: 2 + i * 0.5, delay: i * 0.3 }}
              className="absolute"
              style={{ 
                left: `${15 + i * 14}%`, 
                top: `${-10 + (i % 3) * 10}px` 
              }}
            >
              <Sparkles size={14} className="text-amber-400" />
            </motion.div>
          ))}
        </div>

        <div className="space-y-4">
          <motion.h2 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="text-4xl font-black text-slate-900 tracking-tight"
          >
            Congratulations! 🎉
          </motion.h2>
          <p className="text-slate-500 font-medium leading-relaxed text-lg">
            You have been <span className="text-emerald-600 font-black">selected</span> by your instructor!
          </p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl text-left space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <PartyPopper size={20} className="text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Next Step</span>
              <p className="text-sm font-bold text-slate-800">You're being promoted to a real HR Interview!</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Your performance across all assessment rounds has been evaluated and approved. 
            Your institution will contact you with further details about the in-person HR interview process.
          </p>
        </motion.div>

        <div className="pt-2 space-y-3">
          <button 
            onClick={handleLogout}
            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
          >
            <LogOut size={20} />
            Exit Portal
          </button>
          
          <button 
            onClick={handleReturnDashboard}
            className="w-full h-14 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-50 transition-all active:scale-95"
          >
            <LayoutDashboard size={20} />
            Return Dashboard
          </button>
        </div>
        
        <p className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.2em]">Assessment Complete • Selected</p>
      </motion.div>
    </div>
  );
};

export default HiredState;
