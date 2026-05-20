// src/components/emotion/EmotionPanel.js
// Feature 3: Live emotion metrics floating panel for HR interview
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function AnimatedBar({ value, color, label }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default function EmotionPanel({
  isLoaded,
  faceDetected,
  currentEmotion,
  emotionLabel,
  confidence,
  nervousness,
  emotionHistory,
}) {
  const recentHistory = emotionHistory.slice(-10);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2"
        style={{ background: 'linear-gradient(135deg, #0a0a5c08, #ff572208)' }}>
        <span className="text-base">🧠</span>
        <span className="text-xs font-bold text-gray-700" style={{ fontFamily: 'Syne, sans-serif' }}>
          Emotion Analytics
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${isLoaded ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`} />
          <span className="text-xs text-gray-400">{isLoaded ? 'Active' : 'Loading…'}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Face detection status */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${faceDetected ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <span className="text-base">{faceDetected ? '😊' : '👤'}</span>
          <span className={`text-xs font-semibold ${faceDetected ? 'text-green-700' : 'text-red-600'}`}>
            {faceDetected ? 'Face Detected' : 'Face Not Visible'}
          </span>
        </div>

        {/* Current emotion */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentEmotion}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-3 rounded-xl bg-gray-50 border border-gray-100"
          >
            <div className="text-2xl mb-1">{emotionLabel?.label?.split(' ')[1] || '😐'}</div>
            <div className="text-sm font-bold" style={{ color: emotionLabel?.color || '#6b7280' }}>
              {emotionLabel?.label?.split(' ')[0] || 'Neutral'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Current Emotion</div>
          </motion.div>
        </AnimatePresence>

        {/* Metrics bars */}
        <div className="space-y-3">
          <AnimatedBar value={confidence} color="#10b981" label="Confidence Level" />
          <AnimatedBar value={nervousness} color="#f59e0b" label="Nervousness Level" />
          <AnimatedBar value={Math.max(0, 100 - nervousness - (100 - confidence) / 2)} color="#3b82f6" label="Composure Score" />
        </div>

        {/* Micro emotion history dots */}
        {recentHistory.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">Recent trend (last 10 readings)</p>
            <div className="flex gap-1 items-end h-8">
              {recentHistory.map((h, i) => (
                <div key={i} className="flex-1 rounded-sm transition-all"
                  style={{
                    height: `${Math.max(20, h.confidence)}%`,
                    background: h.confidence > 60 ? '#10b981' : h.confidence > 40 ? '#f59e0b' : '#ef4444',
                    opacity: 0.5 + (i / recentHistory.length) * 0.5,
                  }}
                  title={`${h.emotion}: ${h.confidence}%`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tip */}
        <div className="text-xs text-gray-400 text-center italic border-t border-gray-100 pt-3">
          {confidence > 65
            ? '✨ You look confident!'
            : nervousness > 55
            ? '💙 Take a breath — you got this!'
            : '🎯 Keep going steadily!'}
        </div>
      </div>
    </div>
  );
}

