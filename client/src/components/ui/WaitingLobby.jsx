import React from 'react';
import { motion } from 'framer-motion';
import { Hourglass, ShieldCheck, RefreshCw } from 'lucide-react';

const WaitingLobby = ({ onRefresh }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] p-10 text-center shadow-2xl space-y-8"
      >
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 bg-indigo-100 rounded-3xl rotate-12 animate-pulse" />
          <div className="absolute inset-0 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Hourglass size={40} className="text-white animate-spin-slow" />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Round Completed!</h2>
          <p className="text-slate-500 font-medium leading-relaxed">
            Your results have been submitted successfully. Please wait while the <span className="text-indigo-600 font-bold">Instructor validates your performance</span>.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex items-start gap-4 text-left">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100">
            <ShieldCheck size={20} className="text-indigo-600" />
          </div>
          <div className="space-y-1">
             <div className="text-xs font-black text-slate-900 uppercase tracking-widest">Next Step</div>
             <p className="text-[11px] text-slate-500 font-medium">Once approved, the "Next Round" button will appear on your dashboard automatically.</p>
          </div>
        </div>

        <button 
          onClick={onRefresh}
          className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
        >
          <RefreshCw size={20} />
          Check for Approval
        </button>
        
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Institutional Assessment Control</p>
      </motion.div>
    </div>
  );
};

export default WaitingLobby;
