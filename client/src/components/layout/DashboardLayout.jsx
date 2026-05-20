'use client';

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { BarChart3, LayoutDashboard, FileText, Search, User, ChevronLeft, Menu, Code, X, Sparkles, Settings, LogOut, ArrowRight, Trophy, BookOpen, Binary, Cpu, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import GamificationHeader from './GamificationHeader';
import confetti from 'canvas-confetti';
import socket from '@/lib/socket';
import Modal from '@/components/ui/Modal';
import { useUser } from '@/hooks/useUser';
import { fetchUserFromDB, authFetch } from '@/lib/api';
import QuickAiCreator from '@/components/exam/QuickAiCreator';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const SidebarItem = ({ icon: Icon, label, href, active, collapsed, onClick }) => (
  <Link to={href} onClick={onClick}>
    <motion.div
      whileHover={{ backgroundColor: '#F1F5F9' }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer mb-2",
        active 
          ? "bg-[#2563EB] text-white shadow-sm" 
          : "text-[#334155] hover:text-[#2563EB]"
      )}
    >
      <Icon size={20} className="shrink-0" />
      {!collapsed && (
        <span className="font-semibold text-sm tracking-tight">{label}</span>
      )}
    </motion.div>
  </Link>
);

export default function DashboardLayout({ children }) {
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [reachedLevel, setReachedLevel] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const cached = localStorage.getItem('user');
    if (cached) {
      try { return JSON.parse(cached).level || 1; } catch (e) { return 1; }
    }
    return 1;
  });

  const [progressStatus, setProgressStatus] = useState('ACTIVE');
  const [showProgressModal, setShowProgressModal] = useState(false);

  // Always get user from DB — not stale localStorage
  const { user = { username: 'Student', level: 1 }, refetch: refetchUser } = useUser({ requireAuth: true, redirectIfNoAuth: true });

  const fetchProgress = async () => {
    try {
      const res = await authFetch('/progress/me');
      if (res.ok) {
        const data = await res.json();
        setProgressStatus(data.status);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchProgress();
    socket.on('statsUpdated', fetchProgress);
    socket.on('progressUpdated', fetchProgress);
    return () => {
      socket.off('statsUpdated', fetchProgress);
      socket.off('progressUpdated', fetchProgress);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Identity update for socket
    const userId = user.id || user._id;
    if (userId) {
      socket.emit('identify', { userId, role: 'student' });
      const handleReconnect = () => socket.emit('identify', { userId, role: 'student' });
      socket.on('connect', handleReconnect);
      return () => socket.off('connect', handleReconnect);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.level) return;
    
    // Check if we gained a level since last render or mount
    if (user.level > reachedLevel && reachedLevel > 0) {
      if (progressStatus === 'ACTIVE') {
         // Defer the level up celebration until the assessment is complete
         return;
      }
      
      setReachedLevel(user.level);
      
      // Delay slightly to ensure UI is ready (especially after navigation)
      setTimeout(() => {
        setShowLevelUp(true);
        triggerConfetti();
      }, 500);
    } else if (user.level !== reachedLevel && progressStatus !== 'ACTIVE') {
       // Keep in sync (first mount or manual update)
       setReachedLevel(user.level);
    }
  }, [user?.level, reachedLevel, progressStatus]);

  useEffect(() => {
    const handleStatsUpdate = (newStats) => {
      if (newStats && newStats.level > reachedLevel) {
        // The above useEffect will catch the actual user level change from refetchUser
        refetchUser();
      }
    };
    socket.on('statsUpdated', handleStatsUpdate);
    return () => socket.off('statsUpdated', handleStatsUpdate);
  }, [reachedLevel, refetchUser]);

  const triggerConfetti = () => {
    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 60 * (timeLeft / duration);
      
      // Multi-angle fireworks effect
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.4, 0.6), y: Math.random() - 0.3 } });
    }, 200);

    // Initial dramatic burst
    confetti({
      ...defaults,
      particleCount: 220,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#2563EB', '#7C3AED', '#F59E0B', '#22C55E', '#EF4444']
    });
    
    // Sides burst
    setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 120,
        angle: 60,
        spread: 65,
        origin: { x: 0, y: 0.8 },
        colors: ['#2563EB', '#22C55E']
      });
      confetti({
        ...defaults,
        particleCount: 120,
        angle: 120,
        spread: 65,
        origin: { x: 1, y: 0.8 },
        colors: ['#7C3AED', '#EF4444']
      });
    }, 400);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lms-interview-storage');
    localStorage.removeItem('dashboard_stats');
    localStorage.removeItem('dashboard_exams');
    localStorage.removeItem('exam-storage');
    // Also clear cookie
    document.cookie = 'token=; Max-Age=0; path=/;';
    toast.success('Logged out successfully');
    navigate('/auth');
  };

  const menuItems = [
    { type: 'header', label: 'Main Portal' },
    { icon: LayoutDashboard, label: 'Dashboard', href: '/student' },
    { icon: BarChart3, label: 'Performance Analytics', href: '/student/analytics' },
    // Only show for personal students (those without an institutionId)
    ...(!user?.institutionId ? [
      { icon: Code, label: 'Code Lab', href: '/codelab' },
      { icon: User, label: 'Personal Interview', href: '/exam-player' },
      { type: 'header', label: 'Code Path' },
      { icon: BookOpen, label: 'Learning Paths', href: '/courses' },
      { icon: Binary, label: 'Practice Arena', href: '/problems' },
    ] : []),
  ];

  const bottomItems = [];

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#0F172A] font-sans selection:bg-[#2563EB]/10 overflow-hidden">
      {/* Sidebar - Desktop */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 280 }}
        className="hidden md:flex flex-col bg-white border-r border-[#E2E8F0] shadow-sm relative z-30"
      >
        <div className="h-20 flex items-center px-6 gap-3 border-b border-[#E2E8F0]">
          <div className="w-10 h-10 bg-[#2563EB] rounded-lg flex items-center justify-center shrink-0">
            <Sparkles className="text-white" size={24} />
          </div>
          {!collapsed && (
            <span className="font-black text-xl tracking-tighter text-[#2563EB]">STUDENT PORTAL</span>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item, idx) => (
            item.type === 'header' ? (
              !collapsed && <div key={idx} className="px-4 pt-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</div>
            ) : (
              <SidebarItem
                key={item.href}
                {...item}
                active={pathname === item.href}
                collapsed={collapsed}
                onClick={(e) => {
                  if (item.label === 'Performance Analytics' && progressStatus !== 'COMPLETED') {
                    e.preventDefault();
                    setShowProgressModal(true);
                  }
                }}
              />
            )
          ))}

          {!user?.institutionId && (
            <QuickAiCreator collapsed={collapsed} />
          )}
        </nav>

        <div className="p-4 border-t border-[#E2E8F0]">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 px-4 py-3 text-[#334155] hover:bg-[#F8FAFC] rounded-lg transition-colors"
          >
            <ChevronLeft className={cn("transition-transform duration-300", collapsed && "rotate-180")} size={20} />
            {!collapsed && <span className="font-bold text-sm">Collapse View</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 md:h-20 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-4 md:px-10 shrink-0 z-20 gap-4">
          <div className="flex items-center gap-3 md:gap-6 flex-1 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-[#0F172A] p-2 hover:bg-slate-50 rounded-lg shrink-0 relative z-[60]"
            >
              <Menu size={24} />
            </button>
            <div className="md:hidden font-black text-lg text-[#2563EB] truncate">LMS PORTAL</div>
          </div>

          <div className="flex items-center gap-2 md:gap-6 shrink-0">
             <div className="hidden xl:flex">
               <GamificationHeader />
             </div>
             
             <div className="hidden sm:flex flex-col items-end border-l border-[#E2E8F0] pl-4 md:pl-6">
                <span className="text-xs md:text-sm font-bold text-[#0F172A] truncate max-w-[120px]">{user?.username || 'Student'}</span>
                <span className="text-[9px] md:text-[10px] uppercase font-black text-[#7C3AED] tracking-widest whitespace-nowrap">Premium</span>
             </div>
             <div onClick={handleLogout} className="w-9 h-9 md:w-11 md:h-11 bg-rose-50 border-2 border-rose-100 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white cursor-pointer transition-colors group shadow-sm shrink-0" title="Logout">
               <LogOut size={16} className="md:size-18 group-hover:scale-110 transition-transform" />
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto p-6 md:p-10">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-[2px] z-40 md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[300px] bg-white z-50 md:hidden flex flex-col"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-[#E2E8F0]">
                <span className="font-black text-xl text-[#2563EB]">STUDENT PORTAL</span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-[#94A3B8]">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-2 overflow-y-auto">
                {menuItems.map((item, idx) => (
                  item.type === 'header' ? (
                    <div key={idx} className="px-4 pt-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</div>
                  ) : (
                    <SidebarItem
                      key={item.href}
                      {...item}
                      active={pathname === item.href}
                      onClick={(e) => {
                        setMobileMenuOpen(false);
                        if (item.label === 'Performance Analytics' && progressStatus !== 'COMPLETED') {
                          e.preventDefault();
                          setShowProgressModal(true);
                        }
                      }}
                    />
                  )
                ))}

                {!user?.institutionId && (
                  <QuickAiCreator collapsed={false} />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Level Up Celebration Modal */}
      {/* Level Up Modal */}
      <Modal 
        isOpen={showLevelUp} 
        onClose={() => setShowLevelUp(false)}
        showClose={true}
      >
        <div className="text-center space-y-6">
          <div className="relative inline-block">
            <div className="w-24 h-24 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto rotate-12">
               <Trophy size={48} className="text-amber-500 -rotate-12" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white border-4 border-white"
            >
              <Sparkles size={14} />
            </motion.div>
          </div>
          
          <div className="space-y-1">
            <h2 className="text-4xl font-black text-[#0F172A] tracking-tight text-blue-600">LEVEL REACHED!</h2>
            <p className="text-[#64748B] font-medium text-lg">You've reached level <span className="text-blue-600 font-black">{reachedLevel}</span></p>
          </div>

          <div className="bg-[#F8FAFC] p-5 rounded-[24px] flex items-center justify-center gap-4 border border-[#E2E8F0]">
            <div className="text-center">
              <div className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Achievement Unlocked</div>
              <div className="text-base font-bold text-[#0F172A]">Advanced Skills Pathway</div>
            </div>
          </div>

          <button
            onClick={() => setShowLevelUp(false)}
            className="w-full h-14 bg-[#010101] text-white rounded-2xl font-black text-sm hover:translate-y-[-2px] active:scale-95 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 group"
          >
            Keep Pushing <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </Modal>

      {/* Assessment Incomplete Warning Modal */}
      <Modal 
        isOpen={showProgressModal} 
        onClose={() => setShowProgressModal(false)}
        showClose={true}
      >
        <div className="text-center space-y-6 py-4">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto border-2 border-amber-100">
             <Clock size={40} className="text-amber-500" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[#0F172A] tracking-tight">Assessment Incomplete</h2>
            <p className="text-[#64748B] font-medium leading-relaxed">
              You haven't finished the exam yet. Please complete all assessment stages to view your performance analytics.
            </p>
          </div>

          <button
            onClick={() => setShowProgressModal(false)}
            className="w-full h-14 bg-[#2563EB] text-white rounded-2xl font-black text-sm hover:translate-y-[-2px] active:scale-95 transition-all shadow-lg shadow-blue-200"
          >
            Return to Dashboard
          </button>
        </div>
      </Modal>
    </div>

  );
}

