'use client';

import React, { useState, useEffect, useRef } from 'react';
import InstructorLayout from '@/components/layout/InstructorLayout';
import {
  Sparkles,
  BookOpen,
  Target,
  Zap,
  Brain,
  ChevronDown,
  CheckCircle2,
  Loader2,
  ArrowRight,
  RotateCcw,
  Play,
  Video,
  UploadCloud,
  FileText,
  ListOrdered,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { useExamStore } from '@/store/useExamStore';
import FileUpload from '@/components/ui/file-upload';
import { authFetch, getToken, BASE_URL } from '@/lib/api';

const TOPICS = [
  'Frontend Development',
  'Backend Systems',
  'Machine Learning',
  'System Design',
  'DevOps & Cloud',
  'Database Design',
];

const APTITUDE_SCENARIOS = [
  "Quantitative Aptitude",
  "Logical Reasoning",
  "Verbal Ability / English",
  "Computer Science Aptitude",
  "Psychometric / Behavioral Test",
  "Communication Round"
];

const DIFFICULTIES = [
  { label: 'Beginner', icon: Zap, desc: 'Core concepts and fundamentals' },
  { label: 'Intermediate', icon: Brain, desc: 'Real-world patterns and design' },
  { label: 'Advanced', icon: Target, desc: 'Edge cases and deep internals' },
];

const QUESTION_COUNTS = [10, 30, 50];

const SOURCE_MODES = [
  { id: 'topic', label: 'Topic & Prompt', icon: BookOpen },
  { id: 'youtube', label: 'YouTube Video', icon: Video },
  { id: 'upload', label: 'Document', icon: UploadCloud },
];

function useTypingEffect(text, speed = 40, active = false) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!active) { setDisplayed(''); return; }
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, active, speed]);
  return displayed;
}

const SectionLabel = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon size={16} className="text-[#7C3AED]" />
    <span className="text-xs font-black uppercase tracking-widest text-slate-500">{children}</span>
  </div>
);

const QuestionRow = ({ question, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -16 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.12, duration: 0.4 }}
    className="flex items-start gap-4 p-5 bg-white border border-[#E2E8F0] shadow-sm rounded-2xl hover:border-[#7C3AED]/40 transition-colors group"
  >
    <div className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-xs font-black text-slate-500 shrink-0 group-hover:bg-[#7C3AED] group-hover:text-white group-hover:border-[#7C3AED] transition-all">
      {String(index + 1).padStart(2, '0')}
    </div>
    <div className="flex-1 min-w-0 overflow-hidden">
      <div className="font-semibold text-slate-800 leading-snug prose-sm max-w-none prose-p:my-0 prose-pre:my-2">
        <ReactMarkdown>{question.text}</ReactMarkdown>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase border ${
          question.difficulty === 'Hard' || question.difficulty === 'Advanced'
            ? 'bg-red-50 text-red-600 border-red-100'
            : question.difficulty === 'Intermediate' || question.difficulty === 'Medium'
              ? 'bg-orange-50 text-orange-600 border-orange-100'
              : 'bg-blue-50 text-blue-600 border-blue-100'
        }`}>
          {question.difficulty}
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{question.topic || 'Auto-Extracted'}</span>
      </div>
    </div>
    <CheckCircle2 size={18} className="text-emerald-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
  </motion.div>
);

const GenerateSkeleton = () => (
  <div className="max-w-4xl mx-auto space-y-10 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 bg-slate-200 rounded-xl" />
      <div className="space-y-2">
        <div className="h-8 w-64 bg-slate-200 rounded-lg" />
        <div className="h-4 w-96 bg-slate-200 rounded-md" />
      </div>
    </div>
    <div className="h-[500px] bg-white border border-slate-100 rounded-3xl" />
  </div>
);

export default function GenerateExam() {
  const navigate = useNavigate();
  const [sourceMode, setSourceMode] = useState('topic'); 
  const [prompt, setPrompt] = useState('');
  const [topic, setTopic] = useState('Frontend Development');
  const [examTitle, setExamTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [file, setFile] = useState(null);
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [questionCount, setQuestionCount] = useState(10);
  const [status, setStatus] = useState('idle'); // idle | scraping | generating | done
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAptitude, setIsAptitude] = useState(false);
  const [aptitudeScenario, setAptitudeScenario] = useState(['Quantitative Aptitude']);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [showMncFilter, setShowMncFilter] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);

  const scrapingText = useTypingEffect('Extracting Video Metadata & Captions...', 45, status === 'scraping');
  const typingText = useTypingEffect('AI Engine Generating Questions...', 45, status === 'generating');

  if (loading) return <InstructorLayout><GenerateSkeleton /></InstructorLayout>;

  const handleGenerate = async () => {
    if (status === 'generating' || status === 'scraping' || status === 'done') return;

    // Set initial status based on source mode
    if (sourceMode === 'youtube') {
      setStatus('scraping');
    } else {
      setStatus('generating');
    }
    setError('');

    try {
      let response;
      if (sourceMode === 'upload') {
        const formData = new FormData();
        formData.append('sourceMode', sourceMode);
        formData.append('difficulty', difficulty);
        formData.append('questionCount', questionCount.toString());
        formData.append('prompt', prompt);
        if (isAptitude) {
          formData.append('isAptitude', 'true');
          formData.append('aptitudeScenario', JSON.stringify(aptitudeScenario));
        }
        if (selectedCompanies.length) formData.append('selectedCompany', JSON.stringify(selectedCompanies));
        if (selectedPackages.length) formData.append('selectedPackage', JSON.stringify(selectedPackages));
        if (file) formData.append('file', file);
        // For multipart/form-data, don't set Content-Type (browser sets boundary automatically)
        const token = getToken();
        response = await fetch(`${BASE_URL}/ai/generate`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData
        });
      } else {
        // For YouTube mode, transition from 'scraping' → 'generating' after a brief moment
        // since the backend handles both steps (Apify scrape + AI generation) in one call
        if (sourceMode === 'youtube') {
          // Show scraping state briefly, then switch to generating
          // The backend handles the full pipeline, so we simulate the transition
          setTimeout(() => setStatus('generating'), 5000);
        }

        const payload = {
          sourceMode,
          difficulty,
          questionCount,
          prompt,
          topic: sourceMode === 'topic' ? topic : undefined,
          youtubeUrl: sourceMode === 'youtube' ? youtubeUrl : undefined,
          isAptitude,
          aptitudeScenario: isAptitude ? aptitudeScenario : undefined,
          selectedCompany: selectedCompanies.length ? selectedCompanies : 'All',
          selectedPackage: selectedPackages.length ? selectedPackages : 'All'
        };
        response = await authFetch('/ai/generate', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Server error ${response.status}`);
      }

      const generatedQuestions = data.questions || [];
      if (generatedQuestions.length === 0) {
        throw new Error('AI returned no questions. Try a different topic or prompt.');
      }

      setQuestions(generatedQuestions);

      const examTopic = data.topic || topic || (sourceMode === 'topic' ? prompt.substring(0, 20) : 'General');
      const finalExamTitle = examTitle.trim() || `${examTopic} – ${difficulty} Exam`;
      const examPayload = {
        title: finalExamTitle,
        topic: examTopic,
        duration: generatedQuestions.length,
        questionCount: generatedQuestions.length,
        questions: generatedQuestions,
        isAI: true,
        status: 'pending',
        isAptitude,
        aptitudeScenario: isAptitude ? aptitudeScenario : undefined,
        aptitudeQuestionCount: isAptitude ? questionCount : questionCount,
      };

      console.log('[InstructorGenerate] Deploying exam with payload:', examPayload);

      await authFetch('/exams', {
        method: 'POST',
        body: JSON.stringify(examPayload),
      });

      setStatus('done');
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'Generation failed. Please try again.');
      setStatus('idle');
    }
  };

  return (
    <InstructorLayout>
      <div className="max-w-4xl mx-auto space-y-10 pb-20">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <span className="w-10 h-10 bg-[#7C3AED] rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles size={22} className="text-white" />
            </span>
            AI Exam Creator
          </h1>
          <p className="text-slate-500 font-medium mt-2 ml-14">
            Leverage advanced AI to generate precision-engineered assessment material.
          </p>
        </div>

        <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-3xl p-6 md:p-8 space-y-8 relative overflow-hidden">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            {SOURCE_MODES.map((mode) => {
              const Icon = mode.icon;
              const isActive = sourceMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setSourceMode(mode.id)}
                  className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold transition-all ${
                    isActive ? 'bg-white text-[#7C3AED] shadow-sm border border-[#E2E8F0]' : 'text-slate-500 hover:text-[#7C3AED]'
                  }`}
                >
                  <Icon size={18} /> 
                  <span className="hidden sm:block">{mode.label}</span>
                </button>
              );
            })}
          </div>

          <div>
            <SectionLabel icon={FileText}>Exam Name</SectionLabel>
            <input
              type="text"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="Enter your custom Exam Title..."
              className="w-full h-14 px-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-purple-300 text-sm font-bold text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <AnimatePresence mode="wait">
            {sourceMode === 'topic' && (
              <motion.div key="topic" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div>
                  <SectionLabel icon={FileText}>What is this exam about? (Topic or Subject)</SectionLabel>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    placeholder="E.g. Advanced Frontend patterns using React Hooks and Server Components..."
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:border-purple-300 transition-colors resize-none text-lg font-bold text-slate-800 placeholder:text-slate-400"
                  />
                  <p className="text-[10px] font-black text-slate-400 uppercase mt-3 tracking-widest flex items-center gap-2">
                    <Sparkles size={12} className="text-[#7C3AED]" />
                    AI will automatically extract the title and subjects from your prompt
                  </p>
                </div>

                {/* Target MNC & Package Section */}
                <div className="pt-6 border-t border-slate-100">
                   <div className="flex items-center justify-between mb-4">
                      <div>
                         <SectionLabel icon={Target}>Target MNC & Placement Package (Optional)</SectionLabel>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Filter questions by specific company assessments and package brackets
                         </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMncFilter(prev => {
                            if (prev) { setSelectedCompanies([]); setSelectedPackages([]); }
                            return !prev;
                          });
                        }}
                        className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${
                          showMncFilter ? 'bg-purple-600' : 'bg-slate-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                          showMncFilter ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                   </div>

                   {showMncFilter && (
                   <motion.div
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: 'auto' }}
                     exit={{ opacity: 0, height: 0 }}
                     transition={{ duration: 0.3 }}
                     className="space-y-6 overflow-hidden"
                   >
                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Target MNC</label>
                         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {['TCS Digital','Infosys DSE','Wipro Turbo','Cognizant GenC Next','Capgemini Premier','Accenture AD','HCLTech Elite','Amazon SDE-I','Microsoft IDC','Adobe MTS','Zoho','Qualcomm','Intel','Mindtree','Persistent Systems','Cognizant GenC Pro'].map((company) => {
                              const isChecked = selectedCompanies.includes(company);
                              return (
                                <label
                                  key={company}
                                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all text-xs font-bold ${
                                    isChecked
                                      ? 'bg-purple-50 border-purple-300 text-purple-700'
                                      : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-purple-200 hover:bg-purple-50/50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setSelectedCompanies(prev =>
                                        prev.includes(company)
                                          ? prev.filter(c => c !== company)
                                          : [...prev, company]
                                      );
                                    }}
                                    className="accent-purple-600 w-3.5 h-3.5 rounded"
                                  />
                                  {company}
                                </label>
                              );
                            })}
                         </div>
                      </div>

                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Placement Bracket (Package)</label>
                         <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {['5.5 LPA','6.25 LPA','6.5 LPA','6.75 LPA','7.0 LPA','8.5 LPA','12 LPA','15 LPA','20 LPA','22 LPA','24 LPA','25 LPA'].map((pkg) => {
                              const isChecked = selectedPackages.includes(pkg);
                              return (
                                <label
                                  key={pkg}
                                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-xs font-bold ${
                                    isChecked
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                      : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setSelectedPackages(prev =>
                                        prev.includes(pkg)
                                          ? prev.filter(p => p !== pkg)
                                          : [...prev, pkg]
                                      );
                                    }}
                                    className="accent-emerald-600 w-3.5 h-3.5 rounded"
                                  />
                                  {pkg}
                                </label>
                              );
                            })}
                         </div>
                      </div>
                   </motion.div>
                   )}
                </div>

                <div className="pt-4 border-t border-slate-50">
                   <div className="flex items-center justify-between mb-6">
                      <div>
                         <SectionLabel icon={Brain}>For Aptitude ?</SectionLabel>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Configure this as a standard institutional aptitude round
                         </p>
                      </div>
                      <button 
                        onClick={() => setIsAptitude(!isAptitude)}
                        className={`w-14 h-8 rounded-full transition-all relative ${isAptitude ? 'bg-[#7C3AED]' : 'bg-slate-200'}`}
                      >
                         <motion.div 
                           animate={{ x: isAptitude ? 24 : 4 }}
                           className="absolute top-1 left-0 w-6 h-6 bg-white rounded-full shadow-sm"
                         />
                      </button>
                   </div>

                   <AnimatePresence>
                      {isAptitude && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4 overflow-hidden"
                        >
                           <SectionLabel icon={Target}>Select the scenario for aptitude</SectionLabel>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {/* Select All Button */}
                              <button
                                onClick={() => {
                                  if (aptitudeScenario.length === APTITUDE_SCENARIOS.length) {
                                    setAptitudeScenario([]);
                                  } else {
                                    setAptitudeScenario([...APTITUDE_SCENARIOS]);
                                  }
                                }}
                                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                                  aptitudeScenario.length === APTITUDE_SCENARIOS.length
                                    ? 'border-[#7C3AED] bg-purple-50 text-[#7C3AED]' 
                                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                }`}
                              >
                                 <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                   aptitudeScenario.length === APTITUDE_SCENARIOS.length ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-slate-300'
                                 }`}>
                                    {aptitudeScenario.length === APTITUDE_SCENARIOS.length && <CheckCircle2 size={12} className="text-white" />}
                                 </div>
                                 <span className="font-bold text-xs">Select All</span>
                              </button>

                              {APTITUDE_SCENARIOS.map((sc) => {
                                const isSelected = aptitudeScenario.includes(sc);
                                return (
                                  <button
                                    key={sc}
                                    onClick={() => {
                                      if (isSelected) {
                                        setAptitudeScenario(aptitudeScenario.filter(s => s !== sc));
                                      } else {
                                        setAptitudeScenario([...aptitudeScenario, sc]);
                                      }
                                    }}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                                      isSelected 
                                        ? 'border-[#7C3AED] bg-purple-50 text-[#7C3AED]' 
                                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                    }`}
                                  >
                                     <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                       isSelected ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-slate-300'
                                     }`}>
                                        {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                     </div>
                                     <span className="font-bold text-xs">{sc}</span>
                                  </button>
                                );
                              })}
                           </div>
                        </motion.div>
                      )}
                   </AnimatePresence>
                </div>
              </motion.div>
            )}

            {sourceMode === 'youtube' && (
              <motion.div key="youtube" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <SectionLabel icon={Video}>Lecture Video Feed</SectionLabel>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-red-500"><Video size={20} /></div>
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="Paste Video URL..."
                    className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-purple-300 text-sm font-medium text-slate-800"
                  />
                </div>
              </motion.div>
            )}

            {sourceMode === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <SectionLabel icon={UploadCloud}>Course material (PDF/Images)</SectionLabel>
                <FileUpload onFileSelect={(f) => setFile(f)} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
            <div>
              <SectionLabel icon={Target}>Exam Rigor</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                {DIFFICULTIES.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => setDifficulty(label)}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                      difficulty === label ? 'border-[#7C3AED] bg-purple-50 text-[#7C3AED]' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-bold text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel icon={ListOrdered}>Assessment Volume</SectionLabel>
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  {QUESTION_COUNTS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setQuestionCount(count)}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                        questionCount === count ? 'border-[#7C3AED] bg-purple-50 text-[#7C3AED]' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      <span className="font-black text-2xl">{count}</span>
                      <span className="font-bold text-[10px] uppercase tracking-wider">Items</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 mt-6"
              >
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-sm">Generation Failed</div>
                  <div className="text-xs font-medium mt-0.5 text-red-600">{error}</div>
                </div>
                <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {status !== 'done' ? (
            <button
              onClick={handleGenerate}
              disabled={status === 'generating' || status === 'scraping'}
              className="w-full h-16 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-purple-500/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all mt-4"
            >
              {(status === 'generating' || status === 'scraping') ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
              {status === 'scraping' ? 'Scraping Transcript...' : status === 'generating' ? 'Generating AI Questions...' : 'Deploy Smart Exam'}
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <button
                onClick={() => navigate('/instructor/exams')}
                className="flex-1 h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
              >
                <ArrowRight size={24} /> View in Repository
              </button>
              <button
                onClick={() => {
                  setStatus('idle');
                  setQuestions([]);
                  setPrompt('');
                }}
                className="h-16 px-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all"
              >
                <RotateCcw size={24} /> Reset
              </button>
            </div>
          )}

          {/* YouTube Pipeline Progress Steps */}
          <AnimatePresence>
            {(status === 'scraping' || status === 'generating') && sourceMode === 'youtube' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 p-5 bg-slate-50 border border-slate-100 rounded-2xl"
              >
                <div className="flex items-center gap-4">
                  {/* Step 1: Scraping */}
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      status === 'scraping' 
                        ? 'bg-[#7C3AED] text-white animate-pulse' 
                        : 'bg-emerald-500 text-white'
                    }`}>
                      {status === 'scraping' ? '1' : <CheckCircle2 size={16} />}
                    </div>
                    <div>
                      <div className={`text-xs font-black uppercase tracking-wider ${status === 'scraping' ? 'text-[#7C3AED]' : 'text-emerald-600'}`}>
                        {status === 'scraping' ? 'Scraping...' : 'Scraped'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">Video Data</div>
                    </div>
                  </div>

                  {/* Connector */}
                  <div className={`h-0.5 w-12 rounded-full transition-all ${status === 'generating' ? 'bg-[#7C3AED]' : 'bg-slate-200'}`} />

                  {/* Step 2: Generating */}
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      status === 'generating' 
                        ? 'bg-[#7C3AED] text-white animate-pulse' 
                        : 'bg-slate-200 text-slate-400'
                    }`}>
                      2
                    </div>
                    <div>
                      <div className={`text-xs font-black uppercase tracking-wider ${status === 'generating' ? 'text-[#7C3AED]' : 'text-slate-400'}`}>
                        {status === 'generating' ? 'Generating...' : 'Pending'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">AI Questions</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {status === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-500" size={24}/>
                    Generation Successful
                  </h2>
                  <p className="text-sm text-slate-500 font-medium">Exam successfully staged for deployment.</p>
                </div>
              </div>
              <div className="space-y-3">
                {questions.map((q, i) => <QuestionRow key={q.id} question={q} index={i} />)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </InstructorLayout>
  );
}

