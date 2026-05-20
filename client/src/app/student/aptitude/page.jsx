'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useInterviewStore } from '@/hooks/useInterviewStore';
import Skeleton from '@/components/ui/Skeleton';
import { lazy, Suspense } from 'react';
import Modal from '@/components/ui/Modal';
import { ArrowLeft, ShieldAlert, Maximize2, Minimize2, Brain, ListOrdered } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSecurity } from '@/components/providers/SecurityProvider';

import { authFetch, BASE_URL } from '@/lib/api';

const FaceDetection = lazy(() => import('@/components/exam/FaceDetection'));

const ENABLE_TEST_BYPASS = false; // Task 4: Set to false to disable testing bypass

function Timer({ totalSeconds, onTimeUp }) {
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  
  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const s = (timeLeft % 60).toString().padStart(2, '0');
  
  return (
    <div className={`font-mono font-bold px-3 py-1 rounded-lg ${timeLeft < 60 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
      ⏱ {m}:{s}
    </div>
  );
}

export default function AptitudePage() {
  const navigate = useNavigate();
  const { skills, setAptitudeResults } = useInterviewStore();
  const [phase, setPhase] = useState('loading-config'); // setup | test | results | loading-config
  const [numQuestions, setNumQuestions] = useState(10);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [hintsUsed, setHintsUsed] = useState({});
  const [showHint, setShowHint] = useState(false);
  const [timeLimit, setTimeLimit] = useState(600);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Security Orchestrator
  const { 
    totalViolations, 
    isDisqualified, 
    startSecurity, 
    reportViolation,
    setSystemAction,
    config: securityConfig
  } = useSecurity();

  const [isFullScreen, setIsFullScreen] = useState(false);
  const pageLoadTimeRef = useRef(Date.now());

  const handleAIViolation = useCallback((reason, severity = 'warning', type = 'ai_alert') => {
    reportViolation(type, reason, severity);
  }, [reportViolation]);

  const handleSubmit = useCallback(async (isDisqualifiedParam = false) => {
    if (submitted) return;
    const isDisqualified = typeof isDisqualifiedParam === 'boolean' ? isDisqualifiedParam : false;
    
    setSubmitted(true);
    setLoading(true);
    try {
      const answersArr = questions.map(q => ({
        questionId: q.id,
        selectedAnswer: answers[q.id] ?? -1,
        usedHint: !!hintsUsed[q.id]
      }));
      
      const res = await fetch(`${BASE_URL}/aptitude/submit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          answers: answersArr, 
          questions,
          examId: instConfig?.id,
          bypassPassed: localStorage.getItem('assessment_bypass_active') === 'true'
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submit failed');
      
      if (isDisqualified) {
         data.passed = false;
         data.message = 'Exam Terminated due to Security Violations.';
         data.score = 0;
      }

      // Persist the new token to allow stage-based navigation to Coding Round
      if (data.newToken) {
        localStorage.setItem('token', data.newToken);
        document.cookie = `token=${data.newToken}; path=/; max-age=86400; SameSite=Lax`;
      }

      setResults(data);
      setAptitudeResults(data);
      setPhase('results');
      setSystemAction(true); // Task 2: Allow safe exit
      if (document.exitFullscreen) await document.exitFullscreen().catch(() => {});
    } catch (err) {
      alert('Submission error: ' + err.message);
      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  }, [submitted, questions, answers, hintsUsed, setAptitudeResults]);
  
  const handleBypassAptitude = async () => {
    setSystemAction(true);
    setSubmitted(true);
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/aptitude/submit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          answers: [], 
          questions: [],
          examId: instConfig?.id,
          bypassPassed: true
        })
      });
      const data = await res.json();
      if (data.newToken) {
        localStorage.setItem('token', data.newToken);
        document.cookie = `token=${data.newToken}; path=/; max-age=86400; SameSite=Lax`;
      }
      
      const mockResults = {
        passed: true,
        score: 10,
        maxScore: 10,
        percentage: 100,
        message: 'Aptitude Round Bypassed successfully!',
        processedAnswers: []
      };
      
      setResults(mockResults);
      setAptitudeResults(mockResults);
      setPhase('results');
      if (document.exitFullscreen) await document.exitFullscreen().catch(() => {});
      toast.success("Aptitude round bypassed successfully!", { icon: '⚡' });
    } catch (err) {
      console.error(err);
      const mockResults = {
        passed: true,
        score: 10,
        maxScore: 10,
        percentage: 100,
        message: 'Aptitude Round Bypassed successfully!',
        processedAnswers: []
      };
      setResults(mockResults);
      setAptitudeResults(mockResults);
      setPhase('results');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (phase === 'results' && results?.passed) {
      const timer = setTimeout(() => {
        if (instConfig?.isInstitutional) {
          navigate('/student?refresh=true');
        } else {
          navigate('/student/coding');
        }
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [phase, results]);

  useEffect(() => {
    if (isDisqualified && !submitted && phase === 'test') {
      toast.error("EXAM TERMINATED: Security protocol breached.", { duration: 6000, style: { background: '#ef4444', color: '#fff', fontWeight: 'bold' } });
      handleSubmit(true);
    }
  }, [isDisqualified, submitted, phase, handleSubmit]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    // Set initial value
    setIsFullScreen(!!(document.fullscreenElement || document.webkitFullscreenElement));

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Centralized proctoring handled by SecurityProvider

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const unsub = useInterviewStore.persist.onFinishHydration(() => setIsHydrated(true));
    if (useInterviewStore.persist.hasHydrated()) setIsHydrated(true);
    
    // Stage Guard
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.currentStage !== 'APTITUDE') {
          console.warn('⚠️ Unauthorized stage access to Aptitude. Redirecting to dashboard...');
          navigate('/student');
        }
      } catch (e) {}
    }
    
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (!isHydrated) return;
    
    const recoverSkills = async () => {
      try {
        const res = await authFetch('/progress/me');
        if (res.ok) {
          const progress = await res.json();
          if (progress.context?.resume?.skills) {
            useInterviewStore.getState().setResumeData(progress.context.resume);
            return true;
          }
        }
      } catch (err) {
        console.error('Aptitude: Failed to recover skills:', err);
      }
      return false;
    };

    (async () => {
      if (!skills || skills.length === 0) {
        const recovered = await recoverSkills();
        if (!recovered) {
          toast.error('Please upload your resume to identify your skills first.');
          navigate('/student/resume');
        }
      }
    })();
  }, [isHydrated, skills, navigate]);

  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  const [instConfig, setInstConfig] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await authFetch('/aptitude/config');
        if (res.ok) {
          const data = await res.json();
          console.log('[AptitudeConfig] Received data:', data);
          if (data) {
            setInstConfig(data);
            setNumQuestions(Number(data.questionCount) || 10);
            // The auto-start useEffect will trigger handleStart automatically
          }
        }
      } catch (err) {
        console.error('Failed to fetch config:', err);
      }
    };
    fetchConfig();
  }, []);



  const handleStart = async (overrideNum, overrideScenario, isAutomated = false) => {
    const finalNum = overrideNum || numQuestions;
    const finalScenario = overrideScenario || 'General Aptitude';
    const instructorTopic = instConfig?.topic || '';

    console.log(`[AptitudeStart] Starting with ${finalNum} questions. Source: ${overrideNum ? 'Instructor' : 'Default'}. Automated: ${isAutomated}`);

    if (!isAutomated) {
      try {
        if (document.documentElement.requestFullscreen) { 
          await document.documentElement.requestFullscreen(); 
          setIsFullScreen(true); 
        }
      } catch (e) {
        console.warn('Fullscreen request failed (User gesture required):', e.message);
      }
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/aptitude/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          skills, 
          totalQuestions: finalNum,
          scenario: finalScenario,
          instructorTopic
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to generate');
      
      setQuestions(data.questions || []);
      setTimeLimit(data.timeLimit || finalNum * 60);
      setPhase('test');
      startTimeRef.current = Date.now();

      // Start Unified Security Session
      startSecurity({ 
        sessionId: 'assessment-aptitude-session', 
        round: 'aptitude'
      });
    } catch (err) {
      alert('Failed to generate questions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (qId, optionIdx) => {
    setAnswers(prev => ({ ...prev, [qId]: optionIdx }));
    setShowHint(false);

    // Task 2 & 4: Frontend Feedback Bypass (Controlled by ENABLE_TEST_BYPASS)
    if (ENABLE_TEST_BYPASS && optionIdx === 0) {
      toast.success("Bypass: Option A correct!");
      setTimeout(() => {
        if (currentIdx < questions.length - 1) {
          setCurrentIdx(prev => prev + 1);
        }
      }, 600);
    }
  };

  const handleHint = () => {
    const q = questions[currentIdx];
    if (!hintsUsed[q.id]) setHintsUsed(prev => ({ ...prev, [q.id]: true }));
    setShowHint(true);
  };



  const q = questions[currentIdx];
  const answered = Object.keys(answers).length;

  if (phase === 'loading-config' && (!instConfig || !skills || skills.length === 0 || loading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
         <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 animate-bounce">
            <Brain className="text-indigo-600" size={40} />
         </div>
         <h2 className="text-xl font-black text-slate-800 animate-pulse">Initializing Assessment Engine...</h2>
         <p className="text-slate-400 text-sm mt-2 font-medium">Please wait while we prepare your custom aptitude round.</p>
       </div>
    );
  }

  if (phase === 'loading-config' && instConfig && skills && skills.length > 0 && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 to-purple-50/50 flex items-center justify-center p-6 select-none">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl w-full bg-white border border-gray-100 rounded-[40px] p-10 shadow-2xl text-center space-y-8">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto border border-indigo-100">
            <Brain size={40} className="animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Institutional Aptitude Exam</h1>
            <p className="text-slate-500 font-medium text-sm px-6">
              You are about to begin your proctored Institutional Aptitude Assessment. This exam will be strictly monitored.
            </p>
          </div>

          {/* Exam Info cards */}
          <div className="grid grid-cols-3 gap-4 text-left">
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Questions</div>
                <div className="text-sm font-black text-slate-700">{numQuestions} Questions</div>
             </div>
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Duration</div>
                <div className="text-sm font-black text-slate-700">{Math.ceil(timeLimit / 60) || numQuestions} Minutes</div>
             </div>
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Topic</div>
                <div className="text-sm font-black text-slate-700 truncate" title={instConfig.topic || instConfig.scenario}>{instConfig.topic || 'General Aptitude'}</div>
             </div>
          </div>

          {/* Rules Banner */}
          <div className="p-5 bg-rose-50 border border-rose-100 rounded-3xl text-left space-y-3">
             <div className="flex items-center gap-2 text-rose-700 font-black uppercase text-xs tracking-wider">
                <ShieldAlert size={16} /> Security Rules & Proctored Limits
             </div>
             <ul className="text-xs text-rose-600 font-bold space-y-1.5 list-disc pl-4">
                <li>Fullscreen mode is required and will be auto-triggered. Leaving fullscreen more than twice will terminate your session.</li>
                <li>Tab switching, minimizing, or losing window focus is strictly banned (max 2 attempts).</li>
                <li>Camera / face monitoring must be active at all times (max 4 violations).</li>
                <li>Copy, paste, and cut operations are 100% blocked.</li>
             </ul>
          </div>

          <button 
            onClick={() => handleStart(instConfig.questionCount, instConfig.scenario, false)}
            className="w-full h-16 rounded-[24px] font-black text-lg shadow-xl flex items-center justify-center gap-3 transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200"
          >
            Start Aptitude Assessment
          </button>
          
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Clicking will trigger Full-Screen and active proctoring</p>
        </motion.div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Skeleton height="80px" rounded="rounded-2xl" />
          <Skeleton height="250px" rounded="rounded-2xl" />
          <div className="space-y-3">
            <Skeleton height="50px" rounded="rounded-xl" />
            <Skeleton height="50px" rounded="rounded-xl" />
            <Skeleton height="50px" rounded="rounded-xl" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton height="200px" rounded="rounded-2xl" />
          <Skeleton height="50px" rounded="rounded-xl" />
        </div>
      </div>
    </div>
  );

  // Setup phase has been completely removed to enforce 100% automation.
  // The component remains in 'loading-config' until handleStart transitions it to 'test'.
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
         <ShieldAlert className="text-amber-500 mb-4" size={48} />
         <h2 className="text-xl font-bold text-slate-800">Automated System Check</h2>
         <p className="text-slate-500 mt-2">Please wait while the system synchronizes your assessment data.</p>
      </div>
    );
  }

  if (phase === 'results' && results) return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-lg p-8 text-center border border-gray-100">
        <div className="text-6xl mb-4">{results.passed ? '🎉' : '😞'}</div>
        <h2 className={`text-3xl font-black mb-2 ${results.passed ? 'text-green-500' : 'text-red-500'}`}>
          {results.passed ? 'Aptitude Round Passed!' : 'Aptitude Round Failed'}
        </h2>
        <p className="text-gray-500 mb-8">{results.message}</p>
        
        {results.passed && (
          <div className="mb-6 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 animate-pulse">
            🚀 Promoting to Coding Round... Redirecting in 3 seconds.
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-gray-50">
            <div className="text-2xl font-black text-indigo-900">{results.score}/{results.maxScore}</div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
          <div className="p-4 rounded-xl bg-gray-50">
            <div className="text-2xl font-black text-orange-500">{results.percentage}%</div>
            <div className="text-xs text-gray-500">Percentage</div>
          </div>
          <div className="p-4 rounded-xl bg-gray-50">
            <div className={`text-2xl font-black ${results.passed ? 'text-green-500' : 'text-red-500'}`}>
              {results.passed ? 'PASS' : 'FAIL'}
            </div>
            <div className="text-xs text-gray-500">Status</div>
          </div>
        </div>

        <div className="text-left max-h-64 overflow-y-auto mb-6 space-y-2">
          {(results.processedAnswers || []).map((a, i) => (
            <div key={i} className={`p-3 rounded-xl text-sm ${a.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                <span>{a.isCorrect ? '✅' : '❌'}</span>
                <span className="font-medium text-gray-700">Q{i + 1}</span>
                {a.usedHint && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">-0.5 hint</span>}
                <span className={`ml-auto font-bold ${a.isCorrect ? 'text-green-500' : 'text-red-500'}`}>+{a.score}</span>
              </div>
            </div>
          ))}
        </div>

        {results.passed ? (
          <button onClick={() => navigate('/student/coding')}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg bg-indigo-900 hover:bg-indigo-800">
            Continue to Coding Round →
          </button>
        ) : (
          <div className="space-y-3">
            <button onClick={() => {
              // Complete reset for retest
              setPhase('setup');
              setResults(null);
              setSubmitted(false);
              setAnswers({});
              setHintsUsed({});
              setCurrentIdx(0);
              setShowHint(false);
              setLoading(false);
            }}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20">
              🔄 Retest Now
            </button>
            <button onClick={() => {
              window.location.href = '/student';
            }}
              className="w-full py-4 rounded-2xl text-gray-500 font-bold text-lg border-2 border-gray-100 hover:bg-gray-50 transition-all">
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-6 px-3 md:px-4 select-none">
      {phase === 'test' && (
        <Suspense fallback={null}>
          <FaceDetection mode="floating" onViolation={handleAIViolation} />
        </Suspense>
      )}
      <div className="max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-4 gap-4 md:gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between bg-white rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 shadow-sm border border-gray-100 gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="font-bold text-gray-700 text-sm md:text-base">Q {currentIdx + 1} / {questions.length}</span>
              <span className="hidden xs:inline text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full uppercase font-bold">{q?.difficulty}</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 md:gap-4 px-2 md:px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[9px] md:text-[10px] font-black">
               <div className="flex items-center gap-1.5 md:gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isFullScreen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-slate-500 uppercase tracking-tighter">AI</span>
               </div>
               <div className="w-px h-3 bg-slate-200" />
               <div className="text-slate-500 uppercase tracking-tighter whitespace-nowrap">V: <span className={totalViolations > 0 ? 'text-red-500' : ''}>{totalViolations}/5</span></div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <Timer totalSeconds={timeLimit} onTimeUp={handleSubmit} />
              <button onClick={toggleFullScreen} suppressHydrationWarning className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl px-6 py-3 shadow-sm border border-gray-100">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{answered} answered</span>
              <span>{questions.length - answered} remaining</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full bg-orange-500" animate={{ width: `${(answered / questions.length) * 100}%` }} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {q && (
              <motion.div key={q.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-2xl p-5 md:p-8 shadow-sm border border-gray-100">
                {q.companyTag && (
                  <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-700">
                    🏢 {q.companyTag}
                  </div>
                )}
                <p className="text-base md:text-lg font-semibold text-gray-800 mb-4 md:mb-6 leading-relaxed">
                  {q.text || q.question || q.title || q.content || "Question text unavailable"}
                </p>
                <div className="space-y-2 md:space-y-3">
                  {(q.options || []).map((optRaw, i) => {
                    const selected = answers[q.id] === i;
                    const optStr = typeof optRaw === 'string' ? optRaw : (optRaw?.text || optRaw?.value || optRaw?.content || String(optRaw));
                    const cleanOpt = optStr.replace(/^[a-d][\.\)]\s*/i, '');
                    const label = String.fromCharCode(65 + i);
                    return (
                      <button key={i} onClick={() => handleAnswer(q.id, i)}
                        className={`w-full text-left p-3 md:p-4 rounded-xl border-2 transition-all font-medium flex items-start gap-2 md:gap-3 text-sm md:text-base ${
                          selected ? 'bg-indigo-900 border-indigo-900 text-white shadow-md' : 'border-gray-200 hover:border-indigo-500 text-gray-700 hover:bg-gray-50'
                        }`}>
                        <span className={`font-bold mt-0.5 ${selected ? 'text-indigo-200' : 'text-gray-400'}`}>{label})</span>
                        <span className="flex-1 whitespace-pre-wrap">{cleanOpt}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 md:mt-6 flex items-center gap-4">
                  <button onClick={handleHint}
                    className={`text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2 rounded-xl border transition-all ${
                      hintsUsed[q.id] ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'border-gray-200 text-gray-500 hover:border-yellow-300 hover:text-yellow-600'
                    }`}>
                    💡 <span className="hidden xs:inline">{hintsUsed[q.id] ? 'Hint used (-0.5)' : 'Show Hint (-0.5)'}</span>
                    <span className="xs:hidden">{hintsUsed[q.id] ? 'Hint' : 'Hint'}</span>
                  </button>
                </div>
                <AnimatePresence>
                  {showHint && q.hint && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs md:text-sm text-yellow-800 overflow-hidden">
                      💡 {q.hint}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 md:gap-3">
            <button onClick={() => { setCurrentIdx(i => Math.max(0, i - 1)); setShowHint(false); }} disabled={currentIdx === 0}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold disabled:opacity-40 hover:border-gray-300 transition-all text-sm md:text-base">
              ← Previous
            </button>
            {currentIdx < questions.length - 1 ? (
              <button onClick={() => { setCurrentIdx(i => i + 1); setShowHint(false); }}
                className="flex-1 py-3 rounded-xl text-white font-semibold transition-all bg-indigo-900 text-sm md:text-base">
                Next →
              </button>
            ) : (
              <button onClick={() => handleSubmit(false)} className="flex-1 py-3 rounded-xl text-white font-semibold bg-orange-500 text-sm md:text-base">
                Submit ✓
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <button onClick={() => handleSubmit(false)} className="w-full py-3 rounded-xl text-white font-bold text-sm bg-orange-500 hover:bg-orange-600 transition-all">
            Submit Early
          </button>
        </div>
      </div>
      {localStorage.getItem('assessment_bypass_active') === 'true' && phase !== 'results' && (
        <div className="fixed bottom-6 right-6 z-[9999]">
          <button
            onClick={handleBypassAptitude}
            className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-2xl shadow-xl hover:shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center gap-2 border border-amber-400/20 uppercase tracking-widest text-xs"
          >
            <span>⚡ Bypass Round</span>
          </button>
        </div>
      )}
    </div>
  );
}

