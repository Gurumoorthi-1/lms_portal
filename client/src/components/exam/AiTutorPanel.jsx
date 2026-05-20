'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, MessageSquare, Lightbulb, BookOpen, Send, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/lib/api';

// ── Simulated AI responses keyed by question id ─────────────────────────
const AI_RESPONSES = {
  hint: [
    "Think about what happens on the server vs the client. Which side has access to Node.js runtime, and which needs the browser?",
    "Consider the rendering pipeline — which hook tells React that a transition is non-urgent, yielding control to other updates?",
    "The 'key' prop is React's way of identifying DOM nodes. What happens when a key *changes* between renders?",
    "Next.js App Router has first-class async support. Think about where you'd naturally place an await without any special wrapper.",
    "Think about what each hook *returns*. One returns a value, the other returns a stable function reference.",
  ],
  explain: [
    "React Server Components (RSCs) run exclusively on the server. They eliminate client-side JavaScript for those components, which shrinks your bundle significantly. The browser receives pure HTML — no hydration needed for RSC subtrees. This is different from SSR, where hydration still happens.",
    "useTransition gives you [isPending, startTransition]. Wrapping a state update in startTransition tells React it is non-urgent. React can interrupt it to handle urgent updates like typing. useDeferredValue is similar but works on the value side, not the setter.",
    "When React sees the same component type at the same tree position, it reuses the existing instance. But if the key changes, React treats it as a completely different component — it unmounts the old one and mounts a fresh one. This is a powerful pattern to force state resets.",
    "Server Components in Next.js App Router are async by default. You simply write `async function Page()` and then `await fetch(...)` or any async operation directly in the function body. No useEffect, no loading state — Next.js handles caching and streaming.",
    "useMemo(() => compute(), deps) memoizes the *result* of a computation. useCallback(() => fn(), deps) memoizes the *function reference* itself. Use useMemo to skip expensive recalculations, and useCallback to guarantee referential stability for callbacks passed to child components.",
  ],
};

// ── Streaming text hook ──────────────────────────────────────────────────
function useStreamText(text, active, speed = 18) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active || !text) { setDisplayed(''); setDone(false); return; }
    setDisplayed('');
    setDone(false);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(iv); setDone(true); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, active, speed]);

  return { displayed, done };
}

// ── Typing Dots ──────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl rounded-tl-sm w-fit">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
          className="w-1.5 h-1.5 bg-[#94A3B8] rounded-full"
        />
      ))}
    </div>
  );
}

// ── StreamingMessage ─────────────────────────────────────────────────────
function StreamingMessage({ text }) {
  const { displayed, done } = useStreamText(text, true, 16);
  return (
    <span>
      {displayed}
      {!done && <span className="animate-pulse">▋</span>}
    </span>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      {!isUser && (
        <div className="w-7 h-7 bg-[#7C3AED] rounded-full flex items-center justify-center mr-2 mt-1 shrink-0">
          <Bot size={14} className="text-white" />
        </div>
      )}
      <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed ${
        isUser
          ? 'bg-[#2563EB] text-white rounded-tr-sm'
          : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-tl-sm'
      }`}>
        {msg.streaming ? <StreamingMessage text={msg.text} /> : msg.text}
      </div>
    </motion.div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────
export default function AiTutorPanel({ questionIdx = 0, questionText = '', onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'ai',
      text: "Hi! I'm your AI Tutor. Ask for a hint, a full explanation, or type your own question about this topic.",
      streaming: false,
    },
  ]);
  const [typingInput, setTypingInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef(null);

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const addAiMessage = (text) => {
    const id = Date.now();
    setMessages((prev) => [...prev, { id, role: 'ai', text, streaming: true }]);
    // After streaming completes, mark as done
    const est = text.length * 17 + 400;
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, streaming: false } : m))
      );
    }, est);
  };

  const sendMessage = async (userText, type, customInput) => {
    if (isThinking) return;

    // Push user bubble
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'user', text: userText, streaming: false },
    ]);
    setIsThinking(true);

    try {
      const response = await authFetch('/ai/tutor', {
        method: 'POST',
        body: JSON.stringify({
          question: questionText,
          type: type,
          userInput: customInput
        }),
      });

      if (!response.ok) throw new Error('Tutor unavailable');
      const data = await response.json();
      
      setIsThinking(false);
      addAiMessage(data.response);
    } catch (err) {
      console.error(err);
      setIsThinking(false);
      addAiMessage("I'm sorry, I'm having trouble connecting to my knowledge base right now.");
    }
  };

  const handleHint = () => {
    sendMessage('Give me a hint for this question.', 'hint');
  };

  const handleExplain = () => {
    sendMessage('Explain the concept behind this question.', 'explain');
  };

  const handleCustomSend = () => {
    if (!typingInput.trim() || isThinking) return;
    const userText = typingInput.trim();
    setTypingInput('');
    sendMessage(userText, 'custom', userText);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col bg-white border-l border-[#E2E8F0] h-full"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-[#E2E8F0] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#7C3AED] rounded-xl flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <div className="font-black text-sm text-[#0F172A]">AI Tutor</div>
            <div className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-widest">Online</div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="px-4 py-3 border-b border-[#E2E8F0] flex gap-2 shrink-0">
        <button
          onClick={handleHint}
          disabled={isThinking}
          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl border-2 border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:border-[#F59E0B] hover:text-[#F59E0B] hover:bg-amber-50 disabled:opacity-50 transition-all"
        >
          <Lightbulb size={14} /> Hint
        </button>
        <button
          onClick={handleExplain}
          disabled={isThinking}
          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl border-2 border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:border-[#7C3AED] hover:text-[#7C3AED] hover:bg-purple-50 disabled:opacity-50 transition-all"
        >
          <BookOpen size={14} /> Explain
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1 custom-scrollbar">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <AnimatePresence>
          {isThinking && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2 mb-3"
            >
              <div className="w-7 h-7 mt-1 bg-[#7C3AED] rounded-full flex items-center justify-center shrink-0">
                <Bot size={14} className="text-white" />
              </div>
              <TypingDots />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="px-4 py-4 border-t border-[#E2E8F0] shrink-0">
        <div className="flex items-center gap-2 bg-[#F8FAFC] border-2 border-[#E2E8F0] focus-within:border-[#7C3AED] rounded-2xl px-4 py-2 transition-colors">
          <MessageSquare size={16} className="text-[#94A3B8] shrink-0" />
          <input
            type="text"
            value={typingInput}
            onChange={(e) => setTypingInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomSend()}
            placeholder="Ask anything about this question..."
            className="flex-1 bg-transparent outline-none text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8]"
          />
          <button
            onClick={handleCustomSend}
            disabled={!typingInput.trim() || isThinking}
            className="w-8 h-8 bg-[#7C3AED] text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:bg-[#6D28D9] transition-colors shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[10px] text-[#94A3B8] font-medium mt-2 text-center">
          Powered by Mistral Large — Your personal adaptive learning assistant.
        </p>
      </div>
    </motion.div>
  );
}

