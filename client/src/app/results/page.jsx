'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  CheckCircle2,
  XCircle,
  Trophy,
  Clock,
  Target,
  TrendingUp,
  RotateCcw,
  ArrowRight,
  Sparkles,
  BarChart3,
  BookOpen,
  Download,
  Award,
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExamStore } from '@/store/useExamStore';
import jsPDF from 'jspdf';
import ReactMarkdown from 'react-markdown';
import Skeleton from '@/components/ui/Skeleton';

// ── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target, duration = 1200, delay = 300) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const startTimeout = setTimeout(() => {
      const startTime = performance.now();
      const tick = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(startTimeout);
  }, [target, duration, delay]);
  return value;
}

// ── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, colorClass, bgClass, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-6 flex items-center gap-5"
    >
      <div className={`w-14 h-14 ${bgClass} rounded-2xl flex items-center justify-center shrink-0`}>
        <Icon size={26} className={colorClass} />
      </div>
      <div>
        <div className="text-sm font-bold text-[#64748B] mb-0.5">{label}</div>
        <div className="text-2xl font-black text-[#0F172A]">{value}</div>
      </div>
    </motion.div>
  );
}

// ── Answer Row ────────────────────────────────────────────────────────────────
function AnswerRow({ q, userAnswer, index }) {
  const isCorrect = userAnswer !== undefined && String(userAnswer).toLowerCase() === String(q.correct).toLowerCase();
  const isSkipped = userAnswer === undefined || userAnswer === null || userAnswer === '';

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6 + index * 0.07, duration: 0.35 }}
      className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
        isCorrect
          ? 'border-[#22C55E] bg-[#F0FDF4]'
          : isSkipped
          ? 'border-[#94A3B8] bg-[#F8FAFC]'
          : 'border-[#EF4444] bg-[#FEF2F2]'
      }`}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isCorrect ? 'bg-[#22C55E]' : isSkipped ? 'bg-[#94A3B8]' : 'bg-[#EF4444]'
      }`}>
        {isCorrect ? (
          <CheckCircle2 size={16} className="text-white" />
        ) : isSkipped ? (
          <Clock size={16} className="text-white" />
        ) : (
          <XCircle size={16} className="text-white" />
        )}
      </div>
      <div className="flex-1">
        <div className={`text-sm font-semibold leading-snug ${
          isCorrect ? 'text-[#15803D]' : isSkipped ? 'text-[#475569]' : 'text-[#B91C1C]'
        }`}>
          <ReactMarkdown
            components={{
              code({node, inline, className, children, ...props}) {
                return (
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-[#2563EB] font-bold text-[10px]" {...props}>
                    {children}
                  </code>
                )
              },
              pre({node, children, ...props}) {
                return (
                  <pre className="bg-[#0F172A] text-white p-4 rounded-xl overflow-x-auto my-3 text-xs" {...props}>
                    {children}
                  </pre>
                )
              }
            }}
          >
            {q.text}
          </ReactMarkdown>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className={`text-[10px] font-black uppercase tracking-widest ${
            isCorrect ? 'text-[#22C55E]' : isSkipped ? 'text-[#64748B]' : 'text-[#EF4444]'
          }`}>
            {isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect'}
          </span>
          {!isCorrect && !isSkipped && (
            <span className="text-[10px] font-bold text-[#64748B]">
              Correct: {String(q.correct).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const ResultsSkeleton = () => (
  <div className="max-w-4xl mx-auto space-y-10 py-4 animate-pulse">
    <Skeleton className="h-64 w-full rounded-3xl" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3 space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="lg:col-span-2 space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  </div>
);

// ── Main Results Page ─────────────────────────────────────────────────────────
export default function Results() {
  const navigate = useNavigate();
  const examResults = useExamStore((state) => state.examResults);
  const [loading, setLoading] = useState(true);
  const [rehydrated, setRehydrated] = useState(false);

  // ── Calculate Metrics ──
  const metrics = useMemo(() => {
    if (!examResults) return { correct: 0, wrong: 0, skipped: 0, score: 0, topicBreakdown: [], topicStats: {} };
    const { questions: qs, userAnswers: ua } = examResults;
    let correct = 0, wrong = 0, skipped = 0;
    const topicStats = {};
    (qs || []).forEach((q, idx) => {
      const topic = q.topic || 'General';
      if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
      topicStats[topic].total += 1;

      // Extremely robust answer lookup: check ID (num/str) and Index (num/str)
      const ans = ua ? (ua[q.id] || ua[String(q.id)] || ua[idx] || ua[String(idx)]) : undefined;
      
      if (ans === undefined || ans === null || ans === '') {
        skipped += 1;
      } else if (String(ans).toLowerCase() === String(q.correct).toLowerCase()) {
        correct += 1;
        topicStats[topic].correct += 1;
      } else {
        wrong += 1;
      }
    });
    const calculatedScore = Math.round((correct / ((qs || []).length || 1)) * 100);
    const score = examResults.score !== undefined ? examResults.score : calculatedScore;
    const topicBreakdown = Object.entries(topicStats).map(([name, stats]) => ({ topic: name, ...stats }));
    return { correct, wrong, skipped, score, topicBreakdown, topicStats };
  }, [examResults]);

  const displayedScore = useCountUp(metrics.score, 1400, 400);

  useEffect(() => {
    // Wait for Zustand persistence to hydrate
    const checkHydration = setInterval(() => {
      if (useExamStore.persist?.hasHydrated()) {
        setRehydrated(true);
        setLoading(false);
        clearInterval(checkHydration);
      }
    }, 50);

    return () => clearInterval(checkHydration);
  }, []);

  if (loading || !rehydrated) {
    return (
      <DashboardLayout>
        <ResultsSkeleton />
      </DashboardLayout>
    );
  }

  // If no results, show empty state
  if (!examResults) {
    return (
      <DashboardLayout>
        <div className="h-[70vh] flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
            <Target size={32} className="text-slate-400" />
          </div>
          <h1 className="text-2xl font-black text-[#0F172A] mb-2">No results yet</h1>
          <p className="text-[#64748B] mb-8">Take an exam to see your performance here.</p>
          <Link to="/student">
            <button className="h-12 px-8 bg-[#2563EB] text-white rounded-2xl font-bold shadow-md hover:bg-[#1D4ED8]">
              Back to Dashboard
            </button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const { questions, userAnswers, title, timeSpent, totalTime } = examResults;
  const passed = metrics.score >= 70;

  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const downloadCertificate = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [800, 600]
    });

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 800, 15, 'F');
    doc.rect(0, 585, 800, 15, 'F');
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(2);
    doc.rect(40, 40, 720, 520);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(48);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICATE', 400, 150, { align: 'center' });
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'normal');
    doc.text('OF COMPLETION', 400, 185, { align: 'center' });

    doc.setFontSize(18);
    doc.text('This is to certify that you have successfully completed the exam', 400, 260, { align: 'center' });
    
    doc.setFontSize(28);
    doc.setTextColor(37, 99, 235);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), 400, 310, { align: 'center' });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'normal');
    doc.text(`With a score of ${metrics.score}%`, 400, 360, { align: 'center' });

    const dateStr = new Date().toLocaleDateString();
    doc.setFontSize(14);
    doc.text(`Date: ${dateStr}`, 150, 480);
    
    doc.setDrawColor(100);
    doc.line(500, 475, 700, 475);
    doc.text('AI Instructor', 600, 495, { align: 'center' });

    doc.setTextColor(37, 99, 235);
    doc.setFontSize(32);
    doc.text('A', 400, 520, { align: 'center' });
    doc.setFontSize(10);
    doc.text('AI EXAM PORTAL', 400, 535, { align: 'center' });

    doc.save(`${title}_Certificate.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-10 py-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white border border-[#E2E8F0] shadow-sm rounded-3xl overflow-hidden"
        >
          <div className="p-8 md:p-12 flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1 space-y-6 text-center md:text-left">
              <div className="inline-flex items-center gap-2">
                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border-2 ${
                  passed
                    ? 'bg-[#F0FDF4] border-[#22C55E] text-[#22C55E]'
                    : 'bg-[#FEF2F2] border-[#EF4444] text-[#EF4444]'
                }`}>
                  {passed ? '✓ Passed (70%+)' : '✗ Failed (< 70%)'}
                </span>
              </div>

              <div>
                <h1 className="text-4xl md:text-5xl font-black text-[#0F172A] leading-tight">
                  {passed ? 'Outstanding!' : 'Good Effort!'}
                </h1>
                <p className="text-[#64748B] text-lg font-medium mt-2">
                  {title}
                </p>
              </div>

              <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                {passed && (
                  <button 
                    onClick={downloadCertificate}
                    className="h-12 px-6 bg-[#22C55E] text-white rounded-2xl font-bold text-sm hover:bg-[#16A34A] active:scale-95 transition-all shadow-lg flex items-center gap-2"
                  >
                    <Award size={18} /> Download Certificate
                  </button>
                )}
                {!passed && (
                  <button 
                    onClick={() => navigate('/exam-player')}
                    className="h-12 px-6 bg-[#F59E0B] text-white rounded-2xl font-bold text-sm hover:bg-[#D97706] active:scale-95 transition-all shadow-md flex items-center gap-2"
                  >
                    <RotateCcw size={16} /> Retest
                  </button>
                )}
                <Link to="/student">
                  <button className="h-12 px-6 bg-[#2563EB] text-white rounded-2xl font-bold text-sm hover:bg-[#1D4ED8] active:scale-95 transition-all shadow-md flex items-center gap-2">
                    Back to Dashboard
                  </button>
                </Link>

                {/* Flow Navigation for Personal Students */}
                {(() => {
                  const uStr = localStorage.getItem('user');
                  const u = uStr ? JSON.parse(uStr) : null;
                  if (u && !u.institutionId) {
                    return (
                      <button 
                        onClick={() => navigate('/student/resume')}
                        className="h-12 px-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-sm hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2"
                      >
                        Continue to Career Path <ArrowRight size={18} />
                      </button>
                    );
                  }
                  return null;
                })()}
                
                <Link to="/analytics">
                  <button className="h-12 px-6 border-2 border-[#E2E8F0] text-[#64748B] rounded-2xl font-bold text-sm hover:border-slate-300 hover:text-[#0F172A] transition-all flex items-center gap-2">
                    View Analytics <ArrowRight size={16} />
                  </button>
                </Link>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-center gap-3">
              <div className={`w-48 h-48 rounded-full border-[12px] flex flex-col items-center justify-center shadow-xl ${
                passed ? 'border-[#22C55E]' : 'border-[#EF4444]'
              } bg-white ring-8 ring-slate-50`}>
                <Trophy size={32} className={passed ? 'text-[#F59E0B]' : 'text-[#64748B]'} />
                <span className="text-5xl font-black text-[#0F172A] tabular-nums leading-none mt-2">
                  {displayedScore}
                </span>
                <span className="text-sm font-black text-[#64748B]">/ 100</span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#E2E8F0] grid grid-cols-3 divide-x divide-[#E2E8F0] bg-[#F8FAFC]">
            {[
              { label: 'Time Spent', value: formatTime(timeSpent) },
              { label: 'Total Questions', value: questions?.length || 0 },
              { label: 'Completion Rate', value: examResults.score !== undefined ? '100%' : `${Math.round(( (metrics.correct + metrics.wrong) / (questions?.length || 1)) * 100)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="p-5 text-center">
                <div className="text-[10px] uppercase font-black tracking-widest text-[#64748B] mb-1">{label}</div>
                <div className="font-black text-[#0F172A] text-base">{value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={CheckCircle2}
            label="Correct"
            value={metrics.correct}
            colorClass="text-[#22C55E]"
            bgClass="bg-[#F0FDF4]"
            delay={0.2}
          />
          <SummaryCard
            icon={XCircle}
            label="Incorrect"
            value={metrics.wrong}
            colorClass="text-[#EF4444]"
            bgClass="bg-[#FEF2F2]"
            delay={0.3}
          />
          <SummaryCard
            icon={Target}
            label="Accuracy"
            value={`${metrics.score}%`}
            colorClass="text-[#2563EB]"
            bgClass="bg-[#EFF6FF]"
            delay={0.4}
          />
          <SummaryCard
            icon={TrendingUp}
            label="Skipped"
            value={metrics.skipped}
            colorClass="text-[#64748B]"
            bgClass="bg-[#F8FAFC]"
            delay={0.5}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2">
                <BookOpen size={20} className="text-[#2563EB]" />
                Detailed Analysis
              </h2>
            </div>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <AnswerRow 
                  key={q.id} 
                  q={q} 
                  userAnswer={userAnswers ? (userAnswers[q.id] || userAnswers[String(q.id)] || userAnswers[i] || userAnswers[String(i)]) : undefined} 
                  index={i} 
                />
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-6 space-y-5"
            >
              <h3 className="font-black text-[#0F172A] flex items-center gap-2">
                <BarChart3 size={18} className="text-[#2563EB]" />
                Topic Breakdown
              </h3>
              <div className="space-y-4">
                {metrics.topicBreakdown.map((t) => {
                  const pct = Math.round((t.correct / t.total) * 100);
                  return (
                    <div key={t.topic}>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-[#0F172A]">{t.topic}</span>
                        <span className={pct >= 70 ? 'text-[#22C55E]' : pct >= 40 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}>
                          {t.correct}/{t.total} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, delay: 0.7 }}
                          className={`h-full rounded-full ${
                            pct >= 70 ? 'bg-[#22C55E]' : pct >= 40 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.4 }}
              className="bg-slate-900 text-white rounded-2xl p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#2563EB] rounded-xl flex items-center justify-center shrink-0">
                  <Sparkles size={18} className="text-white" />
                </div>
                <h3 className="font-bold">AI Performance Insight</h3>
              </div>
              <p className="text-sm text-slate-300 font-medium leading-relaxed">
                {passed 
                  ? "Outstanding mastery! You've shown deep understanding of the topics. Download your certificate to showcase your achievement."
                  : "You're getting close! Your accuracy in some topics is good, but focusing on the weaker areas marked in red will help you cross the 70% threshold."}
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


