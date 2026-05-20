'use client';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useInterviewStore } from '@/hooks/useInterviewStore';

const COLORS = { round1: '#0a0a5c', round2: '#ff5722', round3: '#10b981' };

function ScoreRing({ score, max = 100, color, label, size = 120 }) {
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * score) / max;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.5s ease-out' }} />
        <text x={size / 2} y={size / 2 + 6} textAnchor="middle" fontSize={size === 120 ? 22 : 16}
          fontWeight="bold" fill={color}>{score}%</text>
      </svg>
      <span className="text-xs font-semibold text-gray-600">{label}</span>
    </div>
  );
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const { resumeData, aptitudeResults, codingResults, interviewResults, clearSession } = useInterviewStore();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!resumeData) {
      navigate('/student/resume');
    }
  }, [resumeData, navigate]);

  if (!resumeData) return null;

  // Math.round handles NaN if any result is missing
  const r1Score = aptitudeResults?.percentage || 0;
  
  const codingTasks = codingResults ? (codingResults.tasks || {}) : {};
  const codingMarks = Object.values(codingTasks).reduce((sum, t) => sum + (Number(t.taskMarks) || 0), 0);
  const totalCodingMarks = 8;
  const r2Score = Math.round((codingMarks / totalCodingMarks) * 100) || 0;
  
  const hrResponses = interviewResults?.responses ? Object.values(interviewResults.responses) : [];
  const hrMarks = hrResponses.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
  const totalHrMarks = 14;
  const r3Score = Math.round((hrMarks / totalHrMarks) * 100) || 0;

  const atsScore = resumeData?.atsScore || 70;
  const overallScore = Math.round((r1Score + r2Score + r3Score + atsScore) / 4);
  const passed = overallScore >= 60;

  const barData = [
    { name: 'Aptitude', score: r1Score, fill: COLORS.round1 },
    { name: 'Coding', score: r2Score, fill: COLORS.round2 },
    { name: 'Interview', score: r3Score, fill: COLORS.round3 },
  ];

  const radarData = [
    { subject: 'Aptitude', value: r1Score },
    { subject: 'Coding', value: r2Score },
    { subject: 'Communication', value: r3Score },
    { subject: 'ATS Score', value: atsScore },
    { subject: 'Problem Solving', value: Math.round((r1Score + r2Score) / 2) },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="rounded-3xl p-8 text-white text-center shadow-2xl overflow-hidden relative"
          style={{ background: passed ? 'linear-gradient(135deg, #064e3b, #10b981)' : 'linear-gradient(135deg, #7f1d1d, #ef4444)' }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}
            className="text-7xl mb-4">{passed ? '🏆' : '📊'}</motion.div>
          <h1 className="text-4xl font-black mb-2">
            {passed ? 'Congratulations! You\'re Selected!' : 'Interview Complete'}
          </h1>
          <p className="text-lg opacity-90 mb-6">Overall Score: <strong>{overallScore}%</strong></p>
          <div className="flex flex-wrap justify-center gap-6">
            <div className="bg-white/20 backdrop-blur rounded-2xl px-6 py-4 text-center">
              <div className="text-2xl font-black">{r1Score}%</div>
              <div className="text-sm opacity-80">Aptitude</div>
              <div className="text-lg mt-1">{r1Score >= 60 ? '✅' : '❌'}</div>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-2xl px-6 py-4 text-center">
              <div className="text-2xl font-black">{codingMarks}/{totalCodingMarks}</div>
              <div className="text-sm opacity-80">Coding Marks</div>
              <div className="text-lg mt-1">{r2Score >= 60 ? '✅' : '❌'}</div>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-2xl px-6 py-4 text-center">
              <div className="text-2xl font-black">{hrMarks}/{totalHrMarks}</div>
              <div className="text-sm opacity-80">Interview Marks</div>
              <div className="text-lg mt-1">{r3Score >= 60 ? '✅' : '❌'}</div>
            </div>
          </div>
        </motion.div>

        <div className="flex gap-2 bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
          {['overview', 'charts', 'feedback'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${
                activeTab === tab ? 'bg-indigo-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-black text-gray-800 mb-6">Round Scores</h3>
              <div className="flex justify-around">
                <ScoreRing score={r1Score} color={COLORS.round1} label="Aptitude" />
                <ScoreRing score={r2Score} color={COLORS.round2} label="Coding" />
                <ScoreRing score={r3Score} color={COLORS.round3} label="Interview" />
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-4">
              <ScoreRing score={overallScore} color={passed ? '#10b981' : '#ef4444'} label="Overall Score" size={140} />
            </div>
          </motion.div>
        )}

        {activeTab === 'charts' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-black">
              <h3 className="font-bold text-gray-800 mb-4">📊 Round Performance</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Score']} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-black">
              <h3 className="font-bold text-gray-800 mb-4">🎯 Skill Radar</h3>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar name="Score" dataKey="value" stroke="#0a0a5c" fill="#0a0a5c" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {activeTab === 'feedback' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-black text-gray-800 mb-3">🤖 AI Performance Feedback</h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                Based on your resume, aptitude test, coding challenges, and HR interview, you demonstrated strong skills in {resumeData.skills?.slice(0, 3).join(', ')}. 
                {passed ? " Overall, you are a great fit." : " There are some areas you need to improve."}
              </p>
            </div>
            {interviewResults?.emotionReport && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-3">Emotion & Confidence</h3>
                <p className="text-sm text-gray-600">Average Confidence: {interviewResults.emotionReport.avgConf}%</p>
                <p className="text-sm text-gray-600">Average Nervousness: {interviewResults.emotionReport.avgNerv}%</p>
                <p className="text-sm text-gray-600 mt-2">Trend: {interviewResults.emotionReport.nervTrend}</p>
              </div>
            )}
          </motion.div>
        )}

        <div className="flex flex-wrap gap-4 justify-center pt-4">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => window.print()}
            className="px-8 py-3 rounded-2xl border-2 font-bold transition-all text-indigo-900 border-indigo-900">
            🖨️ Print Report
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => { clearSession(); navigate('/student'); }}
            className="px-8 py-3 rounded-2xl text-white font-bold shadow-lg bg-orange-500">
            🔄 Return to Home
          </motion.button>
        </div>
      </div>
    </div>
  );
}


