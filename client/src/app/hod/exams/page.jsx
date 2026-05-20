'use client';

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import HodLayout from '@/components/layout/HodLayout';
import {
  Search,
  Clock,
  Target,
  FileText,
  Sparkles,
  Trash2,
  Eye,
  Activity,
  AlertTriangle,
  X
} from 'lucide-react';
import socket from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Skeleton from '@/components/ui/Skeleton';
import { toast } from 'react-hot-toast';
import { authFetch } from '@/lib/api';

const STATUS_FILTERS = ['All', 'Completed', 'Pending'];

function ExamBoardCard({ exam, index, onDelete }) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 hover:border-[#F97316]/30 transition-all group"
    >
      <div className="flex items-center gap-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
          exam.status === 'completed' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-orange-500'
        }`}>
          {exam.isAI ? <Sparkles size={24} /> : <FileText size={24} />}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-bold text-slate-900 group-hover:text-[#F97316] transition-colors">{exam.title}</h3>
            {exam.isAI && (
              <span className="text-[9px] font-black px-1.5 py-0.5 bg-orange-50 text-[#F97316] rounded uppercase tracking-widest border border-orange-100">
                AI GEN
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-slate-400 flex-wrap">
            <span className="flex items-center gap-1"><Clock size={12} /> {exam.duration}m</span>
            <span className="flex items-center gap-1"><Target size={12} /> {exam.questionCount} Items</span>
            <span className="text-slate-300">{new Date(exam.createdAt).toLocaleDateString()}</span>
            <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[10px] uppercase tracking-wider text-[#F97316]">{exam.topic}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-6">
        <div className="text-right">
          <div className="text-2xl font-black text-slate-900">{exam.score || '--'}<span className="text-sm text-slate-400">%</span></div>
          <div className={`text-[10px] font-black uppercase tracking-widest ${exam.status === 'completed' ? 'text-emerald-500' : 'text-slate-400'}`}>
            {exam.status}
          </div>
        </div>

        <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate(`/hod/analytics?examId=${exam._id}`)}
              className="h-10 w-10 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:text-[#F97316] hover:border-[#F97316] transition-all"
            >
                <Eye size={18} />
            </button>
            <button 
              onClick={() => onDelete(exam._id)}
              className="h-10 w-10 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:text-red-500 hover:border-red-200 transition-all"
            >
                <Trash2 size={18} />
            </button>
        </div>
      </div>
    </motion.div>
  );
}

const RepositorySkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="space-y-4">
        <div className="h-10 w-64 bg-slate-200 rounded-xl" />
        <div className="h-4 w-96 bg-slate-200 rounded-lg" />
      </div>
      <div className="h-12 w-48 bg-slate-200 rounded-2xl" />
    </div>
    <div className="flex gap-4">
      <div className="flex-1 h-12 bg-white border border-slate-100 rounded-2xl" />
      <div className="h-12 w-64 bg-white border border-slate-100 rounded-2xl" />
    </div>
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-28 bg-white border border-slate-100 rounded-2xl shadow-sm" />
      ))}
    </div>
  </div>
);

export default function InstructorExams() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });

  const fetchExams = async () => {
    try {
      const response = await authFetch('/exams');
      if (response.ok) {
        const data = await response.json();
        setExams(data);
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setTimeout(() => setLoading(false), 900);
    }
  };

  const handleDelete = (id) => {
    setDeleteModal({ open: true, id });
  };

  const confirmDelete = async () => {
    const id = deleteModal.id;
    if (!id) return;
    try {
        await authFetch(`/exams/${id}`, { method: 'DELETE' });
        setExams(exams.filter(e => e._id !== id));
        toast.success('Exam deleted successfully');
    } catch (err) {
        console.error(err);
        toast.error('Failed to delete exam');
    } finally {
        setDeleteModal({ open: false, id: null });
    }
  };

  React.useEffect(() => {
    fetchExams();

    socket.on('instructorStatsUpdated', (data) => {
      console.log('Instructor metrics updated, refreshing repo...');
      fetchExams();
    });

    socket.on('examCreated', (newExam) => {
      console.log('New exam detected, updating repo...');
      fetchExams();
    });

    socket.on('examDeleted', (examId) => {
      console.log('Exam deletion detected, updating repo...');
      fetchExams();
    });

    return () => {
      socket.off('instructorStatsUpdated');
      socket.off('examCreated');
      socket.off('examDeleted');
    };
  }, []);

  const filtered = React.useMemo(() => {
    const sorted = [...exams].sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    
    return sorted.filter((e) => {
      const matchSearch = (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
                          (e.topic || '').toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'All' ? true
        : filter === 'Completed' ? e.status === 'completed'
        : e.status === 'pending';
      return matchSearch && matchFilter;
    });
  }, [exams, search, filter]);

  if (loading) return <HodLayout><RepositorySkeleton /></HodLayout>;

  return (
    <HodLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Exam Repository</h1>
            <p className="text-slate-500 font-medium mt-1">Manage core assessment material and track performance metrics.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/hod/generate">
              <button className="h-12 px-6 bg-[#F97316] text-white rounded-2xl font-bold hover:bg-[#EA580C] transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20">
                <Sparkles size={18} /> New AI Generation
              </button>
            </Link>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search across all curriculums..."
              className="w-full h-12 pl-11 pr-4 bg-white border border-[#E2E8F0] rounded-2xl outline-none focus:border-[#F97316] text-sm font-medium text-slate-800 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center bg-white border border-[#E2E8F0] rounded-2xl p-1 shrink-0 shadow-sm">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2.5 text-xs font-black uppercase tracking-tighter rounded-xl transition-all ${
                  filter === f ? 'bg-[#F97316] text-white shadow-md' : 'text-slate-500 hover:text-[#F97316]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-20 flex flex-col items-center justify-center text-center gap-4">
              <FileText size={60} className="text-slate-100" />
              <p className="font-bold text-slate-400">No matching exams found in this repository.</p>
            </div>
          ) : (
            filtered.map((exam, i) => <ExamBoardCard key={exam._id} exam={exam} index={i} onDelete={handleDelete} />)
          )}
        </div>
      </div>

      <AnimatePresence>
        {deleteModal.open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteModal({ open: false, id: null })}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Delete Exam?</h3>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Moving this to archive will remove all associated student attempts. This action is irreversible.
                </p>
              </div>
              <div className="bg-slate-50 p-6 flex items-center gap-3">
                <button 
                  onClick={() => setDeleteModal({ open: false, id: null })}
                  className="flex-1 h-12 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
                >
                  Keep Exam
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </HodLayout>
  );
}


