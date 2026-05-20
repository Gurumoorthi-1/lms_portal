'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useInterviewStore } from '@/hooks/useInterviewStore';
import { ArrowLeft, Award, Code, Mic, BrainCircuit, Activity, Star, Mail, Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/api';
import Skeleton from '@/components/ui/Skeleton';
import DashboardLayout from '@/components/layout/DashboardLayout';
import toast from 'react-hot-toast';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [isDataLoading, setIsDataLoading] = React.useState(true);
  const [isEmailing, setIsEmailing] = useState(false);
  const { 
    resumeData, 
    aptitudeResults, 
    codingResults, 
    interviewResults, 
    performanceProfile,
    setPerformanceProfile 
  } = useInterviewStore();

  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const cachedUser = userStr ? JSON.parse(userStr) : null;
  const isInstitutional = !!cachedUser?.institutionId;

  const handleEmailReport = async () => {
    if (isEmailing) return;
    try {
      setIsEmailing(true);
      const res = await authFetch('/interview/email-report', {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Performance report successfully emailed!", {
          icon: '📧',
          style: {
            borderRadius: '16px',
            background: '#333',
            color: '#fff',
            fontWeight: 'bold'
          }
        });
      } else {
        throw new Error(data.message || "Failed to email report");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to email report. Please try again.");
    } finally {
      setIsEmailing(false);
    }
  };

  useEffect(() => {
    // If there's no data at all, redirect to dashboard
    if (!aptitudeResults && !codingResults && !interviewResults) {
      navigate('/student');
      return;
    }

    // Fetch performance profile if not already loaded
    const fetchPerf = async () => {
      try {
        setIsDataLoading(true);
        const res = await authFetch('/interview/performance');
        const data = await res.json();
        if (data.success) setPerformanceProfile(data.profile);
      } catch (err) {
        console.error('Failed to fetch performance profile:', err);
      } finally {
        // Add a slight delay for smoother transition
        setTimeout(() => setIsDataLoading(false), 800);
      }
    };
    fetchPerf();
  }, [aptitudeResults, codingResults, interviewResults, navigate, setPerformanceProfile]);

  // Derived Metrics
  const aptScore = aptitudeResults ? aptitudeResults.percentage : (performanceProfile?.aptitude?.percentage || 0);
  
  const codingTasks = codingResults ? (codingResults.tasks || {}) : (performanceProfile?.coding?.tasks || {});
  const codingMarksObtained = Object.keys(codingTasks).length > 0 
      ? Object.values(codingTasks).reduce((sum, t) => sum + (Number(t.taskMarks) || 0), 0)
      : (Number(performanceProfile?.coding?.marksObtained) || 0);
  const codingTotalMarks = 8;
  const codingScore = Math.round((codingMarksObtained / codingTotalMarks) * 100) || 0;

  const hrContext = interviewResults?.responses || performanceProfile?.hr?.responses || {};
  const hrAnalyses = Object.values(hrContext);
  const hrMarksObtained = hrAnalyses.reduce((sum, r) => sum + (Number(r.score) || 0), 0) || (Number(performanceProfile?.hr?.marksObtained) || 0);
  const hrTotalMarks = 14;
  const hrPercentage = Math.round((hrMarksObtained / hrTotalMarks) * 100) || 0;

  const overallScore = Math.round((aptScore + codingScore + hrPercentage) / 3);

  // Extract combined strengths and improvements
  const allStrengths = useMemo(() => {
    const list = new Set();
    // 1. Backend-derived strengths
    if (performanceProfile?.gapAnalysis?.strengths) {
      performanceProfile.gapAnalysis.strengths.forEach(s => list.add(s));
    }
    // 2. Interview-specific strengths
    hrAnalyses.forEach(a => (a.strengths || []).forEach(s => list.add(s)));
    return Array.from(list).slice(0, 6);
  }, [hrAnalyses, performanceProfile]);

  const allImprovements = useMemo(() => {
    const list = new Set();
    // 1. Backend-derived improvements
    if (performanceProfile?.gapAnalysis?.improvements) {
      performanceProfile.gapAnalysis.improvements.forEach(s => list.add(s));
    }
    // 2. Interview-specific improvements
    hrAnalyses.forEach(a => (a.improvements || []).forEach(s => list.add(s)));
    return Array.from(list).slice(0, 6);
  }, [hrAnalyses, performanceProfile]);

  const handleDownloadPDF = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('report-content');
      const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: 'LMS_Performance_Report.pdf',
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, windowWidth: 1024 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: '.pdf-no-break' }
      };
      
      // Temporary style adjustments for better PDF rendering
      element.style.padding = '20px';
      
      await html2pdf().from(element).set(opt).save();
      
      element.style.padding = ''; // Reset
    } catch (error) {
      console.error('PDF Generation Failed:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {isDataLoading ? (
          <div className="space-y-8">
            <div className="flex items-center justify-between bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
               <div className="flex items-center gap-4">
                  <Skeleton width="48px" height="48px" borderRadius="12px" />
                  <div className="space-y-2">
                    <Skeleton width="200px" height="24px" />
                    <Skeleton width="300px" height="16px" />
                  </div>
               </div>
               <div className="flex items-center gap-4 text-right">
                  <div className="space-y-2 flex flex-col items-end">
                    <Skeleton width="80px" height="12px" />
                    <Skeleton width="60px" height="32px" />
                  </div>
                  <Skeleton width="64px" height="64px" borderRadius="16px" />
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {[...Array(3)].map((_, i) => (
                 <div key={i} className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-4">
                    <Skeleton width="48px" height="48px" borderRadius="16px" />
                    <Skeleton width="120px" height="20px" />
                    <Skeleton width="80px" height="40px" />
                    <Skeleton width="100%" height="8px" />
                 </div>
               ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {[...Array(2)].map((_, i) => (
                 <div key={i} className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6">
                    <div className="flex gap-3"><Skeleton width="24px" height="24px" /><Skeleton width="180px" height="24px" /></div>
                    <div className="space-y-3">
                       <Skeleton width="100%" height="100px" borderRadius="20px" />
                       <Skeleton width="90%" height="16px" />
                       <Skeleton width="85%" height="16px" />
                    </div>
                 </div>
               ))}
            </div>
          </div>
        ) : (
          <div id="report-content" className="space-y-8 bg-gray-50">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/student')} data-html2canvas-ignore
                className="p-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-indigo-600 transition-all">
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-3xl font-black text-indigo-950">Performance Analytics</h1>
                <p className="text-gray-500 font-medium mt-1">Comprehensive breakdown of your interview process</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Overall Score</p>
                <p className="text-3xl font-black text-indigo-600">
                  {overallScore}%
                </p>
              </div>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${overallScore >= 70 ? 'bg-gradient-to-br from-green-400 to-emerald-600' : 'bg-gradient-to-br from-orange-400 to-red-500'}`}>
                <Award size={32} className="text-white" />
              </div>
            </div>
          </motion.div>

          {/* 3 Core Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Aptitude Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500" />
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-6">
                <BrainCircuit size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Aptitude Round</h2>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-4xl font-black text-blue-600">{aptScore}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${aptScore}%` }} />
              </div>
              {aptitudeResults ? (
                <p className="text-sm font-medium text-gray-500">
                  Correctly answered <span className="text-gray-800 font-bold">{aptitudeResults.score}</span> out of {aptitudeResults.maxScore} questions.
                </p>
              ) : <p className="text-sm text-gray-400">Round skipped or incomplete.</p>}
            </motion.div>

            {/* Coding Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500" />
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-6">
                <Code size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Coding Round</h2>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-4xl font-black text-orange-600">{codingMarksObtained}<span className="text-2xl text-gray-400">/{codingTotalMarks}</span></span>
                <span className="text-sm font-bold text-gray-400 mb-1">marks</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${codingScore}%` }} />
              </div>
              {codingResults ? (
                <p className="text-sm font-medium text-gray-500">
                  Successfully completed <span className="text-gray-800 font-bold">{Object.keys(codingTasks).length}</span> tasks.
                </p>
              ) : <p className="text-sm text-gray-400">Round skipped or incomplete.</p>}
            </motion.div>

            {/* HR Interview Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500" />
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-6">
                <Mic size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">HR Interview</h2>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-4xl font-black text-purple-600">{hrMarksObtained}<span className="text-2xl text-gray-400">/{hrTotalMarks}</span></span>
                <span className="text-sm font-bold text-gray-400 mb-1">marks</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${hrPercentage}%` }} />
              </div>
              {interviewResults ? (
                <p className="text-sm font-medium text-gray-500">
                  Answered {hrAnalyses.length} out of 7 questions.
                </p>
              ) : <p className="text-sm text-gray-400">Round skipped or incomplete.</p>}
            </motion.div>
          </div>

          {/* Detailed Insights */}
          {(interviewResults || performanceProfile) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="space-y-6">
              
              {/* Row 1: Qualitative Analysis & Emotional Intelligence */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Strengths & Weaknesses */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col h-fit">
                  <div className="flex items-center gap-3 mb-6">
                    <Star className="text-amber-500" size={24} />
                    <h3 className="text-xl font-black text-gray-800">AI Qualitative Analysis</h3>
                  </div>
                  
                  <div className="space-y-6 flex-1 pr-2">
                    {/* Real-time Metric Breakdown */}
                    <div className="flex flex-col gap-4 mb-2 bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50">
                      {performanceProfile?.gapAnalysis && (
                        <div className="grid grid-cols-2 gap-4 mb-2 pb-4 border-b border-indigo-100/50">
                          <div>
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Learning Profile</p>
                            <p className="text-sm font-bold text-indigo-900">{performanceProfile.gapAnalysis.theoryVsPractical}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Career Readiness</p>
                            <p className="text-sm font-bold text-indigo-900">{performanceProfile.gapAnalysis.overallReadiness}</p>
                          </div>
                        </div>
                      )}
                      
                      {hrAnalyses.length > 0 ? (
                        <>
                          <div className="pdf-no-break">
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Communication</p>
                            <p className="text-sm text-gray-700 font-medium leading-relaxed">{hrAnalyses[hrAnalyses.length - 1]?.communication || 'Clear and concise delivery observed during the session.'}</p>
                          </div>
                          <div className="pdf-no-break">
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Problem Solving</p>
                            <p className="text-sm text-gray-700 font-medium leading-relaxed">{hrAnalyses[hrAnalyses.length - 1]?.problemSolving || 'Demonstrated logical approach to presented scenarios.'}</p>
                          </div>
                          <div className="pdf-no-break">
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Actionable Advice</p>
                            <p className="text-sm text-indigo-900 font-bold leading-relaxed">{hrAnalyses[hrAnalyses.length - 1]?.actionableAdvice || 'Focus on providing more STAR-method examples.'}</p>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Complete the HR Interview round to see behavioral analysis.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Emotional Analysis */}
                {interviewResults?.emotionReport && (
                  <div className="pdf-no-break bg-gradient-to-br from-indigo-950 to-purple-950 rounded-3xl p-6 shadow-lg text-white h-fit">
                    <div className="flex items-center gap-3 mb-4">
                      <Activity className="text-indigo-400" size={24} />
                      <h3 className="text-xl font-black">Emotional Intelligence</h3>
                    </div>
                    
                    <p className="text-indigo-200 text-sm mb-5 leading-relaxed">
                      AI analyzed your facial expressions and tone to provide insights into your emotional presence.
                    </p>

                    <div className="space-y-4">
                      <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                        <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mb-1">Nervousness Level</p>
                        <div className="flex items-end gap-2 mb-2">
                          <span className="text-2xl font-black">{interviewResults.emotionReport?.overallNervousness || interviewResults.emotionReport?.avgNerv || 0}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-green-400 to-amber-500" style={{ width: `${interviewResults.emotionReport?.overallNervousness || interviewResults.emotionReport?.avgNerv || 0}%` }} />
                        </div>
                      </div>

                      <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                        <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mb-3">Dominant Emotions</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(interviewResults.emotionReport?.dominantEmotions || {})
                            .sort((a, b) => b[1] - a[1])
                            .map(([emotion, count]) => (
                              <div key={emotion} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-sm capitalize flex items-center gap-2">
                                <span>{emotion}</span>
                                <span className="text-xs text-indigo-300 bg-white/10 px-1.5 py-0.5 rounded-full">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Force Page Break for PDF */}
              <div className="html2pdf__page-break"></div>

              {/* Row 2: Strengths & Weaknesses (Horizontal Layout on Next Page) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mt-6 pt-6 border-t border-gray-200">
                <div className="bg-emerald-50/30 rounded-3xl p-6 border border-emerald-100 h-full">
                  <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-4">Top Strengths</h4>
                  {allStrengths.length > 0 ? (
                    <ul className="space-y-3">
                      {allStrengths.map((s, i) => (
                        <li key={i} className="flex gap-3 text-sm text-gray-700 font-medium leading-relaxed">
                          <span className="text-emerald-500 font-bold text-lg leading-none">✓</span> {s}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-gray-400">Not enough data.</p>}
                </div>

                <div className="bg-orange-50/30 rounded-3xl p-6 border border-orange-100 h-full">
                  <h4 className="text-sm font-bold text-orange-600 uppercase tracking-wider mb-4">Areas for Improvement</h4>
                  {allImprovements.length > 0 ? (
                    <ul className="space-y-3">
                      {allImprovements.map((s, i) => (
                        <li key={i} className="flex gap-3 text-sm text-gray-700 font-medium leading-relaxed">
                          <span className="text-orange-500 font-bold text-lg leading-none">↑</span> {s}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-gray-400">Not enough data.</p>}
                </div>
              </div>

            </motion.div>
          )}
        </div>
      )}

        {/* Final Action */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8 border-t border-gray-200">
          {isInstitutional && (
            <button 
              onClick={handleEmailReport}
              disabled={isEmailing}
              className="px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              {isEmailing ? <Loader2 size={20} className="animate-spin" /> : <Mail size={20} />}
              Email My Report
            </button>
          )}
          <button onClick={handleDownloadPDF}
            className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2">
            Download PDF Report
          </button>
          <button onClick={() => {
              // clear state if necessary and go home
              navigate('/student');
            }}
            className="px-8 py-4 rounded-2xl bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-black transition-all shadow-sm flex items-center justify-center">
            Return to Dashboard
          </button>
        </div>

      </div>
    </DashboardLayout>
  );
}


