'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import EmptyState from '@/components/ui/EmptyState';
import Tooltip from '@/components/ui/Tooltip';
import {
  PlusCircle,
  Search,
  Trash2,
  Edit,
  Save,
  X,
  BookOpen,
  Brain,
  CheckCircle2,
  Target,
  Filter,
  Inbox
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Dummy question bank data ──────────────────────────────────────────────────
const INITIAL_QUESTIONS = [
  { id: 1, text: 'What is the primary benefit of React Server Components?', topic: 'React', difficulty: 'Hard', type: 'MCQ' },
  { id: 2, text: 'Explain the difference between useMemo and useCallback.', topic: 'React', difficulty: 'Medium', type: 'Short Answer' },
  { id: 3, text: 'What is CAP theorem in distributed systems?', topic: 'System Design', difficulty: 'Hard', type: 'MCQ' },
  { id: 4, text: 'How does the event loop work in Node.js?', topic: 'Node.js', difficulty: 'Intermediate', type: 'MCQ' },
  { id: 5, text: 'What is the purpose of database indexing?', topic: 'Databases', difficulty: 'Easy', type: 'MCQ' },
  { id: 6, text: 'Describe the difference between supervised and unsupervised learning.', topic: 'ML', difficulty: 'Medium', type: 'Short Answer' },
];

const TOPICS = ['All', 'React', 'Node.js', 'System Design', 'Databases', 'ML'];
const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Intermediate', 'Hard'];

function diffBadge(d) {
  if (d === 'Hard') return 'bg-red-50 text-red-600 border-red-100';
  if (d === 'Intermediate') return 'bg-orange-50 text-orange-600 border-orange-100';
  if (d === 'Medium') return 'bg-yellow-50 text-yellow-600 border-yellow-100';
  return 'bg-blue-50 text-[#2563EB] border-blue-100';
}

// ── Question Row ──────────────────────────────────────────────────────────────
function QuestionRow({ question, index, onEdit, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-white border border-[#E2E8F0] rounded-2xl p-5 flex items-start gap-4 group hover:border-[#2563EB] transition-all"
    >
      <div className="w-9 h-9 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-center text-xs font-black text-[#64748B] shrink-0 group-hover:bg-[#2563EB] group-hover:text-white group-hover:border-[#2563EB] transition-all">
        {String(index + 1).padStart(2, '0')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#0F172A] text-sm leading-snug mb-2">{question.text}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${diffBadge(question.difficulty)}`}>
            {question.difficulty}
          </span>
          <span className="text-[10px] font-black px-2 py-0.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] uppercase">
            {question.topic}
          </span>
          <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">
            {question.type}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Tooltip content="Edit Question" position="top">
          <button
            onClick={() => onEdit(question)}
            className="h-9 w-9 border-2 border-[#E2E8F0] text-[#64748B] rounded-xl flex items-center justify-center hover:border-[#2563EB] hover:text-[#2563EB] transition-all"
          >
            <Edit size={15} />
          </button>
        </Tooltip>
        <Tooltip content="Delete Question" position="top">
          <button
            onClick={() => onDelete(question.id)}
            className="h-9 w-9 border-2 border-[#E2E8F0] text-[#64748B] rounded-xl flex items-center justify-center hover:border-[#EF4444] hover:text-[#EF4444] transition-all"
          >
            <Trash2 size={15} />
          </button>
        </Tooltip>
      </div>
    </motion.div>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
function QuestionModal({ editing, onSave, onClose }) {
  const [text, setText] = useState(editing?.text || '');
  const [topic, setTopic] = useState(editing?.topic || 'React');
  const [difficulty, setDifficulty] = useState(editing?.difficulty || 'Medium');
  const [type, setType] = useState(editing?.type || 'MCQ');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#0F172A]/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xl w-full max-w-xl p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-[#0F172A]">{editing ? 'Edit Question' : 'Add Question'}</h3>
          <button onClick={onClose} className="p-2 text-[#94A3B8] hover:text-[#0F172A] rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-2 block">Question Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Enter your question here..."
            className="w-full px-4 py-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-xl outline-none focus:border-[#2563EB] text-sm font-medium text-[#0F172A] resize-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-2 block">Topic</label>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}
              className="w-full h-11 px-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-xl outline-none focus:border-[#2563EB] text-sm font-bold text-[#0F172A] transition-colors">
              {['React', 'Node.js', 'System Design', 'Databases', 'ML'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-2 block">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
              className="w-full h-11 px-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-xl outline-none focus:border-[#2563EB] text-sm font-bold text-[#0F172A] transition-colors">
              {['Easy', 'Medium', 'Intermediate', 'Hard'].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-2 block">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full h-11 px-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-xl outline-none focus:border-[#2563EB] text-sm font-bold text-[#0F172A] transition-colors">
              {['MCQ', 'Short Answer', 'True/False'].map((tp) => <option key={tp}>{tp}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onClose} className="h-11 px-6 border-2 border-[#E2E8F0] text-[#64748B] rounded-xl font-bold text-sm hover:border-slate-300 transition-colors">
            Cancel
          </button>
          <button
            disabled={!text.trim()}
            onClick={() => { onSave({ text, topic, difficulty, type }); onClose(); }}
            className="h-11 px-6 bg-[#2563EB] text-white rounded-xl font-bold text-sm hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors flex items-center gap-2 shadow-md"
          >
            <Save size={16} /> {editing ? 'Save Changes' : 'Add Question'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function QuestionBank() {
  const [questions, setQuestions] = useState(INITIAL_QUESTIONS);
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('All');
  const [diffFilter, setDiffFilter] = useState('All');
  const [modal, setModal] = useState(null); // null | 'add' | question object

  const filtered = questions.filter((q) => {
    const matchSearch = q.text.toLowerCase().includes(search.toLowerCase());
    const matchTopic = topicFilter === 'All' || q.topic === topicFilter;
    const matchDiff = diffFilter === 'All' || q.difficulty === diffFilter;
    return matchSearch && matchTopic && matchDiff;
  });

  const handleSave = ({ text, topic, difficulty, type }) => {
    if (typeof modal === 'object' && modal?.id) {
      setQuestions((prev) => prev.map((q) => q.id === modal.id ? { ...q, text, topic, difficulty, type } : q));
    } else {
      setQuestions((prev) => [...prev, { id: Date.now(), text, topic, difficulty, type }]);
    }
  };

  const handleDelete = (id) => setQuestions((prev) => prev.filter((q) => q.id !== id));

  return (
    <DashboardLayout>
      <div className="space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#0F172A] flex items-center gap-3">
              <BookOpen size={28} className="text-[#2563EB]" />
              Question Bank
            </h1>
            <p className="text-[#64748B] font-medium mt-1">{questions.length} questions · Manage and curate your exam content.</p>
          </div>
          <button
            onClick={() => setModal('add')}
            className="h-11 px-6 bg-[#2563EB] text-white rounded-2xl font-bold text-sm hover:bg-[#1D4ED8] active:scale-95 transition-all shadow-md flex items-center gap-2"
          >
            <PlusCircle size={18} /> Add Question
          </button>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: questions.length, icon: BookOpen, color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]' },
            { label: 'MCQ', value: questions.filter(q => q.type === 'MCQ').length, icon: CheckCircle2, color: 'text-[#22C55E]', bg: 'bg-[#F0FDF4]' },
            { label: 'Hard', value: questions.filter(q => q.difficulty === 'Hard').length, icon: Target, color: 'text-[#EF4444]', bg: 'bg-[#FEF2F2]' },
            { label: 'AI Gen', value: 0, icon: Brain, color: 'text-[#7C3AED]', bg: 'bg-purple-50' },
          ].map(({ label, value, icon: Icon, color, bg }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-5 flex items-center gap-4"
            >
              <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
                <Icon size={20} className={color} />
              </div>
              <div>
                 <div className="text-2xl font-black text-[#0F172A]">{value}</div>
                 <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="flex-1 w-full relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="w-full h-11 pl-11 pr-4 bg-white border-2 border-[#E2E8F0] rounded-xl outline-none focus:border-[#2563EB] text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-[#64748B] flex items-center gap-1"><Filter size={12} /> Topic:</span>
            {TOPICS.map((t) => (
              <button key={t} onClick={() => setTopicFilter(t)}
                className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all ${topicFilter === t ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]' : 'border-[#E2E8F0] text-[#64748B] hover:border-slate-300'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Question List ── */}
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmptyState 
                  icon={Inbox}
                  title="No questions found" 
                  description="We couldn't find any questions matching your current search filters. Try adjusting them."
                  actionText="Clear Filters"
                  onAction={() => { setSearch(''); setTopicFilter('All'); setDiffFilter('All'); }}
                />
              </motion.div>
            ) : (
              filtered.map((q, i) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  index={i}
                  onEdit={(q) => setModal(q)}
                  onDelete={handleDelete}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {modal && (
          <QuestionModal
            editing={typeof modal === 'object' ? modal : null}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

