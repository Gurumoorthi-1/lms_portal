'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import ConceptGraph from '@/components/analytics/ConceptGraph';
import socket from '@/lib/socket';
import { useExamStore } from '@/store/useExamStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authFetch } from '@/lib/api';

// ─────────────────── DATA ──────────────────────────────────────────────────

const ACCURACY_HISTORY = [
  { label: 'W1', accuracy: 58, exams: 3 },
  { label: 'W2', accuracy: 64, exams: 4 },
  { label: 'W3', accuracy: 71, exams: 5 },
  { label: 'W4', accuracy: 68, exams: 3 },
  { label: 'W5', accuracy: 79, exams: 6 },
  { label: 'W6', accuracy: 84, exams: 5 },
  { label: 'W7', accuracy: 82, exams: 7 },
  { label: 'W8', accuracy: 91, exams: 4 },
];

const TOPIC_PERFORMANCE = [
  { topic: 'React Core', score: 91, fullMark: 100 },
  { topic: 'Next.js', score: 84, fullMark: 100 },
  { topic: 'Node.js', score: 76, fullMark: 100 },
  { topic: 'System Design', score: 69, fullMark: 100 },
  { topic: 'ML Basics', score: 58, fullMark: 100 },
  { topic: 'Databases', score: 72, fullMark: 100 },
];

const TOPIC_BARS = [
  { topic: 'React Core', correct: 46, wrong: 4, accuracy: 92 },
  { topic: 'Next.js', correct: 21, wrong: 4, accuracy: 84 },
  { topic: 'Node.js', correct: 19, wrong: 6, accuracy: 76 },
  { topic: 'Databases', correct: 18, wrong: 7, accuracy: 72 },
  { topic: 'System Design', correct: 14, wrong: 7, accuracy: 67 },
  { topic: 'ML Basics', correct: 12, wrong: 9, accuracy: 57 },
];

const WEAK_AREAS = [
  { topic: 'ML Basics', score: 57, tag: 'Neural Networks, Backpropagation', sessions: 4 },
  { topic: 'System Design', score: 67, tag: 'Distributed Systems, CAP Theorem', sessions: 7 },
  { topic: 'Node.js', score: 76, tag: 'Event Loop, Streams', sessions: 10 },
];

// ─────────────────── HOOKS ────────────────────────────────────────────────

function useCountUp(target, duration = 1400, delay = 200, active = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timeout = setTimeout(() => {
      let start = null;
      const step = (ts) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay, active]);
  return value;
}

// ─────────────────── SUB-COMPONENTS ──────────────────────────────────────

// Stat card with count-up
function StatCard({ label, value, suffix = '', icon: Icon, colorCls, bgCls, trend, trendPositive, delay }) {
  // Support decimal values for Study Hours
  const isTime = suffix === 'h';
  const numericValue = parseFloat(value) || 0;
  const countedValue = useCountUp(numericValue, 1400, delay * 200 + 300);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.45 }}
      className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-6 flex items-start gap-4"
    >
      <div className={`w-12 h-12 ${bgCls} rounded-xl flex items-center justify-center shrink-0`}>
        <Icon size={22} className={colorCls} />
      </div>
      <div className="flex-1">
        <div className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-1">{label}</div>
        <div className="text-3xl font-black text-[#0F172A] tabular-nums">
          {isTime ? Number(numericValue).toFixed(1) : countedValue}{suffix}
        </div>
        {trend !== undefined && (
          <div className={`text-xs font-bold flex items-center gap-1 mt-1 ${trendPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {trendPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}% vs last month
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Custom tooltip
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-lg px-4 py-3 text-xs min-w-[120px]">
      <div className="font-black text-[#0F172A] mb-2">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 font-bold" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span>{p.value}{p.name === 'Accuracy' ? '%' : ''}</span>
        </div>
      ))}
    </div>
  );
}

// Weak area card
function WeakAreaCard({ area, index }) {
  const barWidth = area.score;
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
      className="bg-white border-2 border-[#EF4444]/20 rounded-2xl p-5 space-y-3 hover:border-[#EF4444]/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-[#EF4444] shrink-0" />
            <h3 className="font-black text-[#0F172A]">{area.topic}</h3>
          </div>
          <p className="text-xs font-medium text-[#64748B]">{area.tag}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-black text-[#EF4444]">{area.score}%</div>
          <div className="text-[10px] uppercase font-black text-[#64748B]">{area.sessions} sessions</div>
        </div>
      </div>
      <div className="h-2 bg-[#FEF2F2] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 1.2, delay: 0.6 + index * 0.15, ease: 'easeOut' }}
          className="h-full bg-[#EF4444] rounded-full"
        />
      </div>
    </motion.div>
  );
}

// ─────────────────── MAIN PAGE ────────────────────────────────────────────

import Skeleton from '@/components/ui/Skeleton';

const AnalyticsSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-10 w-64" />
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>

    <Skeleton className="h-80 w-full" />

    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <Skeleton className="lg:col-span-3 h-72 w-full" />
      <Skeleton className="lg:col-span-2 h-72 w-full" />
    </div>

    <Skeleton className="h-96 w-full" />
  </div>
);

export default function Analytics() {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState('8w');
  const [stats, setStats] = useState(null);
  const [studyPlan, setStudyPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();
  const setExam = useExamStore((state) => state.setExam);

  const launchTargetedPractice = async () => {
    if (!stats?.weakAreas || stats.weakAreas.length === 0) {
      toast.error('No weak areas detected yet to target.');
      return;
    }
    
    setGenerating(true);
    const id = toast.loading('AI is crafting a targeted practice session...');
    
    try {
      const topicString = stats.weakAreas.map(a => a.topic).join(', ');
      const response = await authFetch('/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          sourceMode: 'topic',
          difficulty: 'Intermediate',
          questionCount: 10,
          prompt: topicString
        })
      });

      if (response.ok) {
        const data = await response.json();
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const userId = user?.id || user?._id;

        // 1. Save this AI-generated exam to the database so it's tracked everywhere
        const saveResp = await authFetch('/exams', {
          method: 'POST',
          body: JSON.stringify({
            title: `Adaptive Mastery: ${data.topic} #${Date.now().toString().slice(-4)}`,
            topic: data.topic,
            questions: data.questions,
            questionCount: data.questions.length, // Required by schema
            totalTime: 10 * 60,
            duration: 10,
            status: 'pending',
            userId: userId, // Link to student
            isAI: true,     // Match schema prop name
            description: 'AI-generated practice session targeting weak areas.'
          })
        });

        if (saveResp.ok) {
          const savedExam = await saveResp.json();
          setExam(savedExam); // Use the real DB object with ID
          toast.success('Practice session ready!', { id });
          navigate('/exam-player');
        } else {
          throw new Error('Persistence failed');
        }
      } else {
        throw new Error('Generation failed');
      }
    } catch (err) {
      console.error('Failed to generate targeted exam:', err);
      toast.error('AI generation failed. Please try again.', { id });
    } finally {
      setGenerating(false);
    }
  };

  const fetchStats = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?.id || user?._id;

      const url = userId ? `/exams/stats?userId=${userId}` : '/exams/stats';
      const resp = await authFetch(url);
      if (resp.ok) {
        const data = await resp.json();
        setStats(data);
        fetchAiPlan(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

  const fetchAiPlan = async (statsData) => {
    try {
      const resp = await authFetch('/ai/study-plan', {
        method: 'POST',
        body: JSON.stringify(statsData),
      });
      if (resp.ok) {
        const plan = await resp.json();
        setStudyPlan(plan);
      }
    } catch (err) {
      console.error('Failed to fetch AI plan:', err);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchStats();

    // Socket listener for real-time updates
    socket.on('statsUpdated', (newStats) => {
      console.log('Real-time stats update received:', newStats);
      setStats(newStats);
      fetchAiPlan(newStats);
      // Re-fetch everything to ensure charts and lists are stay fresh
      fetchStats();
    });

    return () => {
      socket.off('statsUpdated');
    };
  }, []);

  const overallAccuracy = useCountUp(stats?.overallAccuracy || 0, 1600, 400, !!stats);
  const totalQuestions = useCountUp(stats?.questionsDone || 0, 1400, 500, !!stats);
  const totalStudyHours = useCountUp(stats?.studyHours || 0, 1200, 600, !!stats);
  const totalStreak = useCountUp(stats?.streak || 0, 900, 700, !!stats);

  if (!mounted || loading) {
    return (
      <DashboardLayout>
        <AnalyticsSkeleton />
      </DashboardLayout>
    );
  }

  // Fallback for empty state
  const accuracyHistory = stats?.accuracyHistory?.length > 0 ? stats.accuracyHistory : ACCURACY_HISTORY;
  const topicPerformance = stats?.topicPerformance?.length > 0 ? stats.topicPerformance : TOPIC_PERFORMANCE;
  const topicBars = stats?.topicPerformance?.length > 0 ? stats.topicPerformance : TOPIC_BARS;
  const weakAreas = stats?.weakAreas?.length > 0 ? stats.weakAreas : WEAK_AREAS;
  const totalExams = stats?.totalExams || 0;
  const plan = studyPlan && studyPlan.length > 0 && typeof studyPlan[0] === 'object' ? studyPlan : [
    { day: 'Priority 1', tip: 'Focus on topics where accuracy is below 60% first.', urgency: 'high' },
    { day: 'Priority 2', tip: 'Take 2-3 mini-exams daily to build consistent streaks.', urgency: 'medium' },
    { day: 'Priority 3', tip: 'Review wrongly answered questions in the results panel.', urgency: 'low' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#0F172A]">Analytics Dashboard</h1>
            <p className="text-[#64748B] font-medium mt-1">Track accuracy, topic mastery, and identify weak areas.</p>
          </div>
          <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl p-1">
            {[['4w', '4 Weeks'], ['8w', '8 Weeks'], ['all', 'All Time']].map(([key, label]) => (
              <button key={key} onClick={() => setRange(key)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${range === key ? 'bg-[#2563EB] text-white shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Stat Cards — count-up ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Overall Accuracy" value={overallAccuracy} suffix="%" icon={Target}      colorCls="text-[#2563EB]" bgCls="bg-[#EFF6FF]" trend={6.4}  trendPositive delay={0} />
          <StatCard label="Questions Done"   value={totalQuestions}           icon={CheckCircle2} colorCls="text-[#22C55E]" bgCls="bg-[#F0FDF4]" trend={12.1} trendPositive delay={1} />
          <StatCard label="Study Hours"      value={totalStudyHours}   suffix="h" icon={Clock}       colorCls="text-[#F59E0B]" bgCls="bg-amber-50"  trend={8.3}  trendPositive delay={2} />
          <StatCard label="Day Streak"       value={totalStreak}             icon={Zap}          colorCls="text-[#7C3AED]" bgCls="bg-purple-50" trend={-2}   trendPositive={false} delay={3} />
        </div>

        {/* ── Accuracy Over Time ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-6 md:p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-black text-[#0F172A] text-lg">Accuracy Over Time</h2>
              <p className="text-xs text-[#64748B] font-medium mt-0.5">Weekly accuracy trend across all exams</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-black uppercase text-[#64748B]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#2563EB] inline-block" /> Accuracy</span>
            </div>
          </div>
          <div className="h-64">
            {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={accuracyHistory}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 700 }} dy={8} />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 700 }} dx={-8}
                  domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <defs>
                  <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="accuracy" name="Accuracy"
                  stroke="#2563EB" strokeWidth={3} fill="url(#accGrad)"
                  dot={{ r: 4, fill: '#2563EB', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#2563EB' }} />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* ── Topic Accuracy Bar + Radar row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="lg:col-span-3 bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-6"
          >
            <h2 className="font-black text-[#0F172A] mb-1">Topic Accuracy</h2>
            <p className="text-xs text-[#64748B] font-medium mb-6">Green = strong · Red = needs work</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicBars} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis dataKey="topic" type="category" axisLine={false} tickLine={false}
                    tick={{ fill: '#0F172A', fontSize: 11, fontWeight: 700 }} width={140} 
                    tickFormatter={(val) => val.length > 20 ? val.substring(0, 17) + '...' : val} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="accuracy" name="Accuracy" radius={[0, 6, 6, 0]}>
                    {topicBars.map((t) => (
                      <Cell key={t.topic}
                        fill={t.accuracy >= 80 ? '#22C55E' : t.accuracy >= 70 ? '#2563EB' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Radar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="lg:col-span-2 bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-6 flex flex-col"
          >
            <h2 className="font-black text-[#0F172A] mb-1">Skill Radar</h2>
            <p className="text-xs text-[#64748B] font-medium mb-4">Overall competency profile</p>
            <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={topicPerformance} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="topic"
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(val) => val.length > 12 ? val.substring(0, 10) + '...' : val} />
                  <Radar name="Score" dataKey="score" stroke="#2563EB"
                    fill="#2563EB" fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* ── Concept Graph ── */}
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.55, duration: 0.5 }}
           className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-6 md:p-8"
        >
          <div className="mb-6">
             <h2 className="font-black text-[#0F172A] text-lg">Knowledge Concept Graph</h2>
             <p className="text-xs text-[#64748B] font-medium mt-0.5">Visualize your topic mastery and unlock progress</p>
          </div>
          <ConceptGraph stats={stats} />
        </motion.div>

        {/* ── Remediation Sections (Only if accuracy < 70%) ── */}
        {(totalExams > 0 && (stats?.overallAccuracy || 0) < 70) && (
          <div className="space-y-12 pb-10">
            {/* ── Weak Areas ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="text-[#EF4444]" />
                <h2 className="text-xl font-black text-[#0F172A]">Weak Areas</h2>
                <span className="text-[10px] font-black uppercase tracking-widest bg-red-50 border border-red-100 text-[#EF4444] px-2 py-0.5 rounded">
                  Needs Attention
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {weakAreas.length > 0 ? weakAreas.map((area, i) => (
                  <WeakAreaCard key={area.topic} area={area} index={i} />
                )) : (
                  <div className="col-span-3 py-10 bg-[#F8FAFC] border border-dashed border-[#CBD5E1] rounded-2xl flex flex-col items-center justify-center text-center">
                    <CheckCircle2 size={32} className="text-[#22C55E] mb-2" />
                    <p className="font-bold text-[#64748B]">No weak areas detected yet. Keep it up!</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── AI Personalized Study Plan ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="bg-white border-2 border-[#7C3AED]/30 rounded-3xl overflow-hidden shadow-xl"
            >
              {/* Header */}
              <div className="bg-[#F5F3FF] border-b border-[#7C3AED]/20 p-6 md:p-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#7C3AED] rounded-2xl flex items-center justify-center shadow-lg shadow-[#7C3AED]/30">
                    <Sparkles size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-[#0F172A]">AI Personalized Study Plan</h2>
                    <p className="text-sm text-[#64748B] font-medium italic">"Custom roadmap to master your weak spots"</p>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-[#7C3AED]/20">
                  <span className="w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
                  <span className="text-[10px] font-black uppercase text-[#7C3AED]">AI Analysis Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1">
                
                {/* Main Focus Areas */}
                <div className="p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={18} className="text-[#EF4444]" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-[#64748B]">Personalized Learning Path (Addressing Weakness)</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {weakAreas.slice(0, 2).map((area, idx) => (
                      <div key={area.topic} className="group p-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-3xl hover:border-[#7C3AED]/40 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className="px-3 py-1 bg-[#EF4444]/10 text-[#EF4444] rounded-lg text-[10px] font-black uppercase tracking-widest border border-[#EF4444]/10">
                            Priority Focus #{idx+1}
                          </div>
                          <div className="text-xs font-black text-[#64748B]">{area.score}% Mastery</div>
                        </div>
                        <h4 className="text-xl font-black text-[#0F172A] mb-3">{area.topic}</h4>
                        <p className="text-sm text-[#334155] leading-relaxed font-medium">
                          {plan[idx]?.tip || `Improve your results in ${area.topic} by practicing ${area.tag?.toLowerCase() || 'core concepts'} specifically through targeted mock exams.`}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 flex justify-center">
                    <button 
                      onClick={launchTargetedPractice}
                      disabled={generating}
                      className="w-full md:w-auto min-w-[300px] h-14 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-2xl font-black text-sm hover:-translate-y-0.5 active:scale-[0.98] transition-all shadow-lg shadow-[#7C3AED]/25 flex items-center justify-center gap-3 px-10 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {generating ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generating Adaptive Quiz...
                        </>
                      ) : (
                        <>
                          <Zap size={20} className="fill-white" />
                          Launch Targeted Practice Session
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

