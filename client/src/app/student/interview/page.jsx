import 'regenerator-runtime/runtime';
import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Video, AlertCircle, CheckCircle, Play, ShieldAlert, Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSecurity } from '@/components/providers/SecurityProvider';
import Modal from '@/components/ui/Modal';
import { toast } from 'react-hot-toast';

const FaceDetection = lazy(() => import('@/components/exam/FaceDetection'));

export default function StudentInterview() {
  const navigate = useNavigate();
  
  const [session, setSession] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [aiState, setAiState] = useState('idle'); // idle, thinking, speaking
  const [aiMessage, setAiMessage] = useState('Connecting to HR Server...');
  const [isAnswering, setIsAnswering] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [showGate, setShowGate] = useState(true);

  // Security Orchestrator
  const { 
    totalViolations, 
    isDisqualified, 
    startSecurity, 
    reportViolation,
    setSystemAction,
    violationCounts
  } = useSecurity();

  const handleAIViolation = React.useCallback((reason, severity = 'warning', type = 'ai_alert') => {
    reportViolation(type, reason, severity);
  }, [reportViolation]);
  
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  useEffect(() => {
    // Start interview session on mount
    const startInterviewSession = async () => {
      try {
        const res = await authFetch('/interview/start', { method: 'POST' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to start interview');
        }
        const data = await res.json();
        setSession(data);
        setLoading(false);
        setAiMessage("Welcome! I'll be your HR interviewer today.");
      } catch (err) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    };
    startInterviewSession();
  }, []);

  const enterProctoredSession = async () => {
    try {
      // Proactively request camera and microphone permissions before entering fullscreen
      // to avoid permission prompt suppression in fullscreen mode.
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (err) {
      console.warn("Media permissions denied or failed:", err);
      toast.error("Microphone and Camera permissions are required to start the HR Interview.", {
        position: 'top-center',
        style: { border: '2px solid #ef4444', background: '#0F172A', color: '#fff' }
      });
      return;
    }

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {}
    setShowGate(false);
    startSecurity({
      sessionId: 'assessment-interview-session',
      round: 'interview'
    });
    
    // Trigger welcome and first question
    setAiState('speaking');
    speakText("Welcome! I'll be your HR interviewer today. Let's begin.", () => {
      if (session?.questions?.[0]?.questionText) {
        askQuestion(session.questions[0].questionText);
      }
    });
  };

  const askQuestion = (qText) => {
    if (!qText) return;
    setAiState('speaking');
    setAiMessage(qText);
    speakText(qText, () => {
      setAiState('idle');
    });
  };

  const speakText = (text, onEndCallback) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Samantha') || v.lang === 'en-US');
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.pitch = 1;
      utterance.rate = 0.9;
      
      utterance.onend = () => {
        clearTimeout(safetyTimeout);
        if (onEndCallback) onEndCallback();
      };

      utterance.onerror = (err) => {
        console.error("Speech Error:", err);
        clearTimeout(safetyTimeout);
        if (onEndCallback) onEndCallback();
      }

      const safetyTimeout = setTimeout(() => {
        console.warn("Speech onend safety timeout fired.");
        window.speechSynthesis.cancel();
        if (onEndCallback) onEndCallback();
      }, text.length * 100 + 3000); 
      
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => { if (onEndCallback) onEndCallback(); }, 2000);
    }
  };

  const handleStartAnswer = () => {
    resetTranscript();
    setIsAnswering(true);
    SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
  };

  const handleStopAnswer = async () => {
    SpeechRecognition.stopListening();
    setIsAnswering(false);
    
    if (transcript.length > 5) {
      setAiState('thinking');
      setAiMessage("Analyzing your response...");

      try {
        const res = await authFetch('/interview/answer', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: session._id,
            questionIndex: currentQuestionIndex,
            answerText: transcript
          })
        });

        if (!res.ok) throw new Error('Failed to submit answer');
        const data = await res.json();
        
        // Give feedback
        setAiState('speaking');
        setAiMessage(data.feedback || "Good point. Let's move on.");
        speakText(data.feedback || "Good point. Let's move on.", async () => {
          if (currentQuestionIndex < session.questions.length - 1) {
            const nextIndex = currentQuestionIndex + 1;
            setCurrentQuestionIndex(nextIndex);
            askQuestion(session.questions[nextIndex].questionText);
          } else {
            // Finish interview
            setAiState('thinking');
            setAiMessage("Concluding interview...");
            const finishRes = await authFetch('/interview/finish', { 
              method: 'POST',
              body: JSON.stringify({ sessionId: session._id })
            });
            if (finishRes.ok) {
              const finishData = await finishRes.json();
              setAiState('speaking');
              setAiMessage("Thank you for your time. The interview is complete.");
              speakText("Thank you for your time. The interview is complete.", () => {
                if (finishData.newToken) {
                  localStorage.setItem('token', finishData.newToken);
                  document.cookie = `token=${finishData.newToken}; path=/; max-age=86400; SameSite=Lax`;
                }
                setSystemAction(true);
                if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                navigate('/student/analytics');
              });
            }
          }
        });
      } catch (err) {
        console.error(err);
        setAiState('speaking');
        setAiMessage("There was an error saving your response. Let's continue.");
        speakText("There was an error saving your response. Let's continue.", () => {
          if (currentQuestionIndex < session.questions.length - 1) {
            const nextIndex = currentQuestionIndex + 1;
            setCurrentQuestionIndex(nextIndex);
            askQuestion(session.questions[nextIndex].questionText);
          } else {
             setSystemAction(true);
             if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
             navigate('/student');
          }
        });
      }

    } else {
      toast.error("Response too short, please try again.", {
        icon: '🎙️',
        position: 'bottom-center'
      });
    }
  };

  const handleBypassInterview = async () => {
    setSystemAction(true);
    if (document.exitFullscreen) await document.exitFullscreen().catch(() => {});
    toast.success('Bypassing HR Interview... Finalizing assessment...', { icon: '🚀' });

    let finalSessionId = session?._id;
    if (!finalSessionId) {
      try {
        const startRes = await authFetch('/interview/start', { method: 'POST' });
        if (startRes.ok) {
          const startData = await startRes.json();
          finalSessionId = startData._id;
        }
      } catch (err) {
        console.error('Failed to auto-start session for bypass:', err);
      }
    }

    try {
      const finishRes = await authFetch('/interview/finish', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: finalSessionId || 'mock-session-id' })
      });
      if (finishRes.ok) {
        const finishData = await finishRes.json();
        if (finishData.newToken) {
          localStorage.setItem('token', finishData.newToken);
          document.cookie = `token=${finishData.newToken}; path=/; max-age=86400; SameSite=Lax`;
        }
      }
    } catch (err) {
      console.error(err);
    }
    
    navigate('/student/analytics');
  };

  if (!browserSupportsSpeechRecognition) {
    return <DashboardLayout><div className="p-8 text-center text-red-500">Browser doesn't support speech recognition. Please use Chrome.</div></DashboardLayout>;
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col h-full items-center justify-center text-red-500">
          <AlertCircle size={48} className="mb-4" />
          <h2 className="text-xl font-bold">Failed to load interview</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl">Retry</button>
        </div>
      </DashboardLayout>
    );
  }

  if (showGate) {
    return (
      <div className="h-screen bg-[#0F172A] flex items-center justify-center p-6 select-none">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl w-full bg-white/5 border border-white/10 rounded-[40px] p-10 backdrop-blur-xl text-center space-y-8">
          <div className="w-20 h-20 bg-blue-500/10 text-blue-400 rounded-3xl flex items-center justify-center mx-auto border border-blue-500/20">
            <Mic size={40} className="animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-white tracking-tight">AI HR Interview Gate</h1>
            <p className="text-slate-400 font-medium text-sm px-6">
              You are about to enter the final round: Live AI HR Interview. Full-screen mode, webcam, and microphone are required for security.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left">
             <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Attempt Limits</div>
                <div className="text-xs font-bold text-slate-300">Camera (4) | Tabs (2) | FS (2)</div>
             </div>
             <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Requirement</div>
                <div className="text-xs font-bold text-white">Active Mic & Camera</div>
             </div>
          </div>

          <button 
            onClick={enterProctoredSession}
            className="w-full h-16 rounded-[24px] font-black text-lg shadow-xl flex items-center justify-center gap-3 transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40"
          >
            Start HR Interview <Play size={20} className="ml-1" />
          </button>
          
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Clicking will trigger Full-Screen and Proctoring</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0F172A] text-white p-4 font-sans flex flex-col overflow-hidden">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col min-h-0">
        {/* Top Header */}
        <div className="shrink-0 flex justify-between items-center mb-4 px-6 bg-white/5 py-3 rounded-2xl border border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
            <span className="text-slate-300 font-bold tracking-widest uppercase text-sm">Live HR Interview</span>
          </div>
          
          {/* Security indicators */}
          <div className="flex items-center gap-4 bg-gray-900/50 border border-gray-700 rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-tighter">
            <div className="text-gray-400">FS Exits: <span className={violationCounts?.fs > 0 ? 'text-red-500' : ''}>{violationCounts?.fs || 0}/2</span></div>
            <div className="w-px h-3 bg-gray-700" />
            <div className="text-gray-400">Tabs: <span className={violationCounts?.tabSwitch > 0 ? 'text-red-500' : ''}>{violationCounts?.tabSwitch || 0}/2</span></div>
            <div className="w-px h-3 bg-gray-700" />
            <div className="text-gray-400">Camera: <span className={violationCounts?.camera > 0 ? 'text-red-500' : ''}>{violationCounts?.camera || 0}/4</span></div>
          </div>

          <div className="text-blue-400 font-black tracking-wider uppercase text-sm">
            Question {currentQuestionIndex + 1} of {session?.questions?.length || 7}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 pb-2">
          
          {/* Left: AI HR View */}
          <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-[32px] border border-blue-500/20 relative overflow-hidden flex flex-col items-center justify-center p-6 min-h-0 h-full">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
            
            {/* AI Avatar / Visualization */}
            <div className="relative z-10 w-40 h-40 mb-6">
              <div className={`absolute inset-0 rounded-full border-4 border-blue-500/50 transition-all duration-300 ${aiState === 'speaking' ? 'animate-ping opacity-30' : 'opacity-0'}`} />
              <div className={`absolute inset-2 rounded-full border-2 border-blue-400 transition-all duration-300 ${aiState === 'thinking' ? 'animate-spin border-t-transparent' : ''}`} />
              <div className="absolute inset-6 bg-[#0F172A] rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.3)] border border-blue-500/30 overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 opacity-80" />
              </div>
              {aiState === 'speaking' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full flex items-center justify-center gap-1.5 opacity-80">
                  {[1,2,3,4,5].map(i => (
                    <motion.div key={i} animate={{ height: [15, 50, 15] }} transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }} className="w-1.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                  ))}
                </div>
              )}
            </div>

            <div className="z-10 text-center w-full max-w-md">
              <h3 className="text-xl font-black text-blue-400 mb-1">Aura AI HR</h3>
              <p className="text-[10px] text-blue-300/60 uppercase font-bold tracking-[0.3em] mb-4">{aiState}</p>
              
              <AnimatePresence mode="wait">
                <motion.div 
                  key={aiMessage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl"
                >
                  <p className="text-base text-white font-medium leading-relaxed">"{aiMessage}"</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Right: User Webcam & Mic View */}
          <div className="flex flex-col gap-4 min-h-0 h-full">
            <div className="flex-1 bg-black rounded-[32px] border border-white/10 relative overflow-hidden shadow-2xl group min-h-0">
              <div className="absolute top-6 right-6 z-20 flex space-x-2">
                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest flex items-center border border-white/10 text-white shadow-lg">
                  <Video className="w-4 h-4 mr-2 text-emerald-400" /> Camera Active
                </div>
              </div>

              {!isDisqualified && (
                <Suspense fallback={
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-2">
                    <Loader2 size={32} className="animate-spin text-blue-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading AI Proctor...</span>
                  </div>
                }>
                  <FaceDetection 
                    mode="panel-hr" 
                    enabled={true} 
                    isActive={!showGate} 
                    onViolation={handleAIViolation} 
                  />
                </Suspense>
              )}

              {/* Transcript Overlay */}
              <div className="absolute bottom-0 w-full p-4 pt-16 bg-gradient-to-t from-black via-black/80 to-transparent z-20">
                <div className="min-h-[40px] max-h-[80px] overflow-y-auto">
                  {isAnswering ? (
                    <p className="text-white text-base md:text-lg font-medium drop-shadow-md">
                      {transcript || <span className="text-slate-400 italic">Listening to your response...</span>}
                    </p>
                  ) : (
                    <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest">
                      {transcript ? "Response recorded successfully." : "Ready for your answer."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="shrink-0 bg-white/5 backdrop-blur-xl p-4 px-6 rounded-[32px] border border-white/10 flex justify-between items-center shadow-xl">
              <div>
                <p className="text-sm font-black text-white uppercase tracking-widest mb-1">Your Turn</p>
                <p className="text-xs text-slate-400 font-medium">Click the microphone to begin answering</p>
              </div>
              
              <div className="flex gap-4 items-center">
                {aiState === 'idle' ? (
                  <button
                    onClick={isAnswering ? handleStopAnswer : handleStartAnswer}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isAnswering 
                        ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_30px_rgba(239,68,68,0.6)] scale-110' 
                        : 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:scale-105'
                    }`}
                  >
                    {isAnswering ? <Mic className="w-6 h-6 text-white animate-pulse" /> : <MicOff className="w-6 h-6 text-white" />}
                  </button>
                ) : (
                  <button disabled className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 text-slate-500 flex items-center justify-center cursor-not-allowed">
                    <MicOff className="w-6 h-6" />
                  </button>
                )}
                
                {isAnswering && (
                  <motion.button 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={handleStopAnswer}
                    className="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" /> Submit
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Manual Fallback for AI if it gets stuck */}
        {aiState === 'idle' && !isAnswering && currentQuestionIndex === 0 && !transcript && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 opacity-50 hover:opacity-100 transition-opacity">
            <button 
              onClick={() => askQuestion(session?.questions[currentQuestionIndex]?.questionText)}
              className="px-4 py-2 bg-white/10 backdrop-blur-md text-white text-xs font-medium rounded-full shadow-lg flex items-center gap-2 border border-white/20 hover:bg-white/20 transition-all"
            >
              <Play className="w-3 h-3" /> Replay Question
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={isDisqualified} onClose={() => navigate('/student')} showClose={false} className="bg-rose-950 border-rose-500">
         <div className="text-center p-6 space-y-4">
           <div className="w-20 h-20 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto">
             <ShieldAlert size={40} />
           </div>
           <h2 className="text-3xl font-black text-rose-500 uppercase tracking-widest">Disqualified</h2>
           <p className="text-rose-200 font-bold text-lg">Your session has been terminated due to repeated security protocol breaches.</p>
           <button onClick={() => window.location.href = '/student'} className="w-full h-14 bg-rose-600 text-white rounded-xl font-black mt-4 hover:bg-rose-500 transition-all">Exit Assessment</button>
         </div>
      </Modal>
      {localStorage.getItem('assessment_bypass_active') === 'true' && (
        <div className="fixed bottom-6 right-6 z-[9999]">
          <button
            onClick={handleBypassInterview}
            className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-2xl shadow-xl hover:shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center gap-2 border border-amber-400/20 uppercase tracking-widest text-xs"
          >
            <span>⚡ Bypass Round</span>
          </button>
        </div>
      )}
    </div>
  );
}
