'use client';

import React, { useState } from 'react';
import { Sparkles, Video, FileText, UploadCloud, Loader2, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/lib/api';

const SOURCE_MODES = [
  { id: 'topic', label: 'Topic', icon: FileText },
  { id: 'youtube', label: 'YouTube', icon: Video },
  { id: 'upload', label: 'PDF', icon: UploadCloud }
];

export default function QuickAiCreator({ collapsed }) {
  const [sourceMode, setSourceMode] = useState('topic');
  const [topic, setTopic] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  if (collapsed) {
    return (
      <div className="px-4 py-6 flex flex-col items-center gap-4">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
          <Sparkles size={20} />
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (status !== 'idle') return;
    setError('');
    
    try {
      setStatus('generating');
      let response;
      const payload = {
        difficulty: 'Intermediate',
        questionCount: 10,
        isAptitude: false
      };

      if (sourceMode === 'topic') {
        if (!topic.trim()) throw new Error('Please enter a topic');
        payload.topic = topic;
        payload.sourceMode = 'topic';
        payload.prompt = topic;
        response = await authFetch('/ai/generate', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else if (sourceMode === 'youtube') {
        if (!youtubeUrl.trim()) throw new Error('Please paste a YouTube URL');
        setStatus('scraping');
        payload.sourceMode = 'youtube';
        payload.youtubeUrl = youtubeUrl;
        response = await authFetch('/ai/generate', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else if (sourceMode === 'upload') {
        if (!file) throw new Error('Please select a PDF file');
        setStatus('uploading');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sourceMode', 'upload');
        formData.append('difficulty', payload.difficulty);
        formData.append('questionCount', payload.questionCount);
        formData.append('isAptitude', payload.isAptitude);
        formData.append('topic', file.name.replace(/\.[^/.]+$/, ""));
        
        response = await authFetch('/ai/generate', {
          method: 'POST',
          body: formData,
        });
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(response.ok ? 'Invalid server response' : `Server error (${response.status})`);
      }
      if (!response.ok) throw new Error(data.message || 'Generation failed');

      const questions = data.questions || [];
      if (questions.length === 0) throw new Error('No questions generated');

      const examTopic = data.topic || topic.trim();
      const examTitle = `${examTopic} - Assessment ${Math.floor(Date.now() / 1000)}`;
      const examPayload = {
        title: examTitle,
        topic: examTopic,
        duration: questions.length,
        questionCount: questions.length,
        questions: questions,
        isAI: true,
        status: 'pending'
        // userId is set by backend from JWT token (POST /exams route)
      };

      // Save to DB
      const saveRes = await authFetch('/exams', {
        method: 'POST',
        body: JSON.stringify(examPayload),
      });

      if (!saveRes.ok) throw new Error('Failed to save exam to repository');

      // Reset progress to MCQ so the student starts a new assessment cycle
      try {
        const resetRes = await authFetch('/progress/reset', { method: 'POST' });
        if (resetRes.ok) {
          const resetData = await resetRes.json();
          if (resetData.newToken) {
            localStorage.setItem('token', resetData.newToken);
            document.cookie = `token=${resetData.newToken}; path=/; max-age=86400; SameSite=Lax`;
          }
        }
      } catch (err) {
        console.warn('Failed to reset progress for new exam cycle', err);
      }

      setStatus('done');
      setTopic('');
      setYoutubeUrl('');
      
      // Force a background refresh in the dashboard if socket is slow
      window.dispatchEvent(new CustomEvent('refreshDashboard'));

      // Reset after 2 seconds
      setTimeout(() => setStatus('idle'), 2000);

    } catch (err) {
      console.error(err);
      setError(err.message);
      setStatus('idle');
    }
  };

  return (
    <div className="px-4 py-6 mt-4 border-t border-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-blue-600" />
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Exam Creator</span>
      </div>

      <div className="space-y-4">
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
          {SOURCE_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSourceMode(mode.id)}
              className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all ${
                sourceMode === mode.id ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400'
              }`}
            >
              <mode.icon size={14} />
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {sourceMode === 'topic' && (
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter topic..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-300 text-xs font-bold resize-none"
              rows={2}
            />
          )}

          {sourceMode === 'youtube' && (
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="YouTube URL..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-300 text-xs font-bold"
            />
          )}

          {sourceMode === 'upload' && (
            <div className="w-full">
              <label className="w-full p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center gap-2 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all">
                <UploadCloud size={20} className={file ? "text-blue-600" : "text-slate-400"} />
                <span className="text-[10px] font-bold text-slate-500 text-center px-2">
                  {file ? file.name : "Click to upload PDF"}
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected && selected.type === 'application/pdf') {
                      setFile(selected);
                      setError('');
                    } else if (selected) {
                      setError('Please select a valid PDF file');
                    }
                  }}
                />
              </label>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold">
            <AlertCircle size={12} className="shrink-0" />
            <span className="line-clamp-2">{error}</span>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={status !== 'idle'}
          className="w-full h-10 bg-[#010101] hover:bg-slate-900 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {status === 'idle' ? (
            <>
              <Play size={14} fill="currentColor" />
              <span>Generate & Start</span>
            </>
          ) : (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>{status === 'scraping' ? 'Scraping...' : status === 'uploading' ? 'Uploading...' : 'Working...'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
