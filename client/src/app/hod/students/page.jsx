'use client';

import React, { useState } from 'react';
import HodLayout from '@/components/layout/HodLayout';
import { 
  Users, 
  Search, 
  Mail, 
  TrendingUp, 
  Trophy, 
  Clock,
  ExternalLink,
  Filter,
  MoreVertical,
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import socket from '@/lib/socket';
import { authFetch } from '@/lib/api';

// Removed Static Dummy Data


function StudentRow({ student, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group bg-white border border-[#E2E8F0] hover:border-[#F97316]/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md cursor-pointer"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#F97316] font-black text-lg shadow-sm group-hover:bg-[#F97316] group-hover:text-white transition-all">
          {student.name.charAt(0)}
        </div>
        <div>
          <h3 className="font-bold text-slate-900 group-hover:text-[#F97316] transition-all flex items-center gap-2">
            {student.name}
            {student.active && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
          </h3>
          <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <Mail size={12} /> {student.email}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-8 sm:gap-12 text-center sm:text-left">
        <div className="space-y-1">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Performance</div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-black text-slate-800">{student.performance}%</div>
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${student.performance}%` }} />
            </div>
          </div>
        </div>
        <div className="hidden lg:block space-y-1">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Enrolled since</div>
          <div className="text-xs font-bold text-slate-600">{new Date(student.joinDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</div>
        </div>
        <button className="h-10 w-10 flex items-center justify-center text-slate-300 hover:text-[#F97316] transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>
    </motion.div>
  );
}

const StudentsSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="space-y-4">
        <div className="h-10 w-64 bg-slate-200 rounded-xl" />
        <div className="h-4 w-96 bg-slate-200 rounded-lg" />
      </div>
      <div className="flex gap-3">
        <div className="h-12 w-32 bg-slate-200 rounded-2xl" />
        <div className="h-12 w-40 bg-slate-200 rounded-2xl" />
      </div>
    </div>
    <div className="flex gap-4">
      <div className="flex-1 h-14 bg-white border border-slate-100 rounded-2xl" />
      <div className="h-14 w-32 bg-white border border-slate-100 rounded-2xl" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-28 bg-white border border-slate-100 rounded-3xl" />
      ))}
    </div>
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-20 bg-white border border-slate-100 rounded-2xl" />
      ))}
    </div>
  </div>
);

export default function StudentManagement() {
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('all'); // all, active, inactive
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ students: [], metrics: { completionRate: 0, avgPerformance: 0, churnRisk: 0 } });

  const fetchStudents = () => {
    authFetch('/exams/instructor/students')
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  React.useEffect(() => {
    fetchStudents();

    socket.on('userStatusChanged', () => {
      console.log('Online status changed, refreshing roster...');
      fetchStudents();
    });

    socket.on('instructorStatsUpdated', () => {
      console.log('Instructor stats updated, refreshing roster performance...');
      fetchStudents();
    });

    return () => {
      socket.off('userStatusChanged');
      socket.off('instructorStatsUpdated');
    };
  }, []);

  const filteredStudents = React.useMemo(() => {
    return data.students.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filterActive === 'all' ? true : filterActive === 'active' ? s.active : !s.active;
      return matchSearch && matchFilter;
    });
  }, [data.students, search, filterActive]);

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Performance (%)', 'Progress (%)', 'Status', 'Join Date'];
    const rows = filteredStudents.map(s => [
      s.name, s.email, s.performance, s.progress, s.active ? 'Active' : 'Inactive', new Date(s.joinDate).toLocaleDateString()
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'student_roster.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Roster exported successfully');
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.origin + '/auth?ref=instructor_123');
    toast.success('Invite link copied to clipboard!');
  };

  if (loading) return <HodLayout><StudentsSkeleton /></HodLayout>;

  return (
    <HodLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Student Directory</h1>
            <p className="text-slate-500 font-medium mt-1">Monitor enrollment, individual performance, and learner engagement.</p>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={exportCSV} className="h-12 px-6 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95">Export Records</button>
             <button onClick={copyInviteLink} className="h-12 px-6 bg-[#F97316] text-white rounded-2xl font-bold hover:bg-[#EA580C] transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2 active:scale-95">
               <Users size={18} /> Invite Student
             </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
           <div className="flex-1 w-full relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Search by name, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-14 pl-12 pr-4 bg-white border border-[#E2E8F0] rounded-2xl outline-none focus:border-[#F97316] transition-all text-sm font-medium text-slate-800 shadow-sm"
              />
           </div>
           <select 
             value={filterActive}
             onChange={(e) => setFilterActive(e.target.value)}
             className="h-14 px-4 bg-white border border-[#E2E8F0] rounded-2xl text-slate-500 font-bold text-sm w-full sm:w-auto outline-none focus:border-[#F97316] transition-all shadow-sm cursor-pointer hover:border-slate-300">
             <option value="all">All Students</option>
             <option value="active">Active Only</option>
             <option value="inactive">Inactive Only</option>
           </select>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white border border-[#E2E8F0] p-6 rounded-3xl shadow-sm">
              <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Completion Rate</div>
              <div className="text-3xl font-black text-slate-900">{data.metrics.completionRate}%</div>
              <div className="mt-2 text-xs font-bold text-emerald-500">Class Average</div>
           </div>
           <div className="bg-white border border-[#E2E8F0] p-6 rounded-3xl shadow-sm">
              <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Avg. Performance</div>
              <div className="text-3xl font-black text-slate-900">{data.metrics.avgPerformance}%</div>
              <div className="mt-2 text-xs font-bold text-emerald-500">Active Benchmark</div>
           </div>
           <div className="bg-white border border-[#E2E8F0] p-6 rounded-3xl shadow-sm">
              <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Churn Risk</div>
              <div className="text-3xl font-black text-slate-900">{data.metrics.churnRisk}%</div>
              <div className="mt-2 text-xs font-bold text-[#64748B]">Inactive student ratio</div>
           </div>
        </div>

        {/* Student List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Student Roster ({filteredStudents.length}/{data.students.length})</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
             {filteredStudents.length > 0 ? (
               filteredStudents.map((s, i) => <StudentRow key={s.id} student={s} index={i} />)
             ) : (
               <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                 No students found matching your criteria.
               </div>
             )}
          </div>
        </div>
      </div>
    </HodLayout>
  );
}

