import React from 'react';
import { motion } from 'framer-motion';
import { XCircle, LogOut, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const RejectedState = ({ reason, onReturn }) => {
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
        <div className="w-24 h-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center mx-auto border border-rose-100">
          <XCircle size={48} className="text-rose-500" />
        </div>

        <div className="space-y-3">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Assessment Stopped</h2>
          <p className="text-slate-500 font-medium leading-relaxed">
            Your application has been reviewed by the instructor and we will not be moving forward at this time.
          </p>
          {reason && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-left">
              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block mb-1">Instructor Feedback:</span>
              <p className="text-sm font-bold text-rose-800 italic">"{reason}"</p>
            </div>
          )}
        </div>

        <div className="pt-4 space-y-3">
          <button 
            onClick={handleLogout}
            className="w-full h-14 bg-rose-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-rose-700 transition-all active:scale-95 shadow-xl shadow-rose-200"
          >
            <LogOut size={20} />
            Exit Portal
          </button>

          <button 
            onClick={handleReturnDashboard}
            className="w-full h-14 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-50 transition-all active:scale-95 shadow-lg shadow-slate-100"
          >
            <LayoutDashboard size={20} />
            Return Dashboard
          </button>
        </div>
        
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Closed Assessment</p>
      </motion.div>
    </div>
  );
};

export default RejectedState;
