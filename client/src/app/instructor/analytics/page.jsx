'use client';

import React from 'react';
import InstructorLayout from '@/components/layout/InstructorLayout';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target,
  ArrowUpRight,
  Shield,
  Zap,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '@/lib/socket';
import { authFetch } from '@/lib/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';

// Removed dummy mock arrays for real-time integration


const AnalyticsSkeleton = () => (
  <div className="space-y-10 animate-pulse">
    <div className="space-y-4">
      <div className="h-10 w-80 bg-slate-200 rounded-xl" />
      <div className="h-4 w-96 bg-slate-200 rounded-lg" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="h-96 bg-white border border-slate-100 rounded-3xl" />
      <div className="h-96 bg-white border border-slate-100 rounded-3xl" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 bg-white border border-slate-100 rounded-3xl" />
      ))}
    </div>
  </div>
);

export default function DeepAnalytics() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  const fetchDeepAnalytics = () => {
    authFetch('/exams/instructor/deep-analytics')
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
    setMounted(true);
    fetchDeepAnalytics();

    // Real-time listener
    socket.on('instructorStatsUpdated', () => {
       console.log('Deep analytics refreshing via real-time update...');
       fetchDeepAnalytics();
    });

    socket.on('userStatusChanged', () => {
       console.log('User status changed, refreshing engagement pulse...');
       fetchDeepAnalytics();
    });

    return () => {
      socket.off('instructorStatsUpdated');
      socket.off('userStatusChanged');
    };
  }, []);

  if (loading) return <InstructorLayout><AnalyticsSkeleton /></InstructorLayout>;

  return (
    <InstructorLayout>
      <div className="space-y-10 pb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Advanced Learning Intelligence</h1>
          <p className="text-slate-500 font-medium mt-1">Deep dive into student performance metrics and cohort engagement.</p>
        </div>

        {!data ? (
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-20 flex flex-col items-center justify-center text-center gap-4">
            <BarChart3 size={60} className="text-slate-100" />
            <p className="font-bold text-slate-400">Intelligence data is temporarily unavailable. Check back shortly.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Topic Performance */}
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-8 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                  <Target size={22} className="text-[#7C3AED]" />
                  Cohort Topic Mastery
                </h3>
                <div className="h-80 min-h-[320px]">
                  {mounted && data.topicMastery && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topicMastery} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                      <XAxis type="number" hide domain={[0, 100]} />
                      <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} width={80} />
                      <Tooltip 
                        cursor={{ fill: '#F8FAFC' }}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                        {data.topicMastery.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Engagement Chart */}
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-8 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                  <Activity size={22} className="text-blue-500" />
                  Weekly Engagement Pulse
                </h3>
                <div className="h-80 min-h-[320px]">
                  {mounted && data.engagementData && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.engagementData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="active" fill="#3B82F6" radius={[6, 6, 0, 0]} name="Active Students" />
                      <Bar dataKey="exams" fill="#7C3AED" radius={[6, 6, 0, 0]} name="Exams Taken" />
                    </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Intelligence Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Avg Time to Complete', value: data.avgTime || '--', icon: Zap, color: 'text-amber-500' },
                { label: 'Pass Rate (Threshold 70%)', value: data.passRate || '0%', icon: Shield, color: 'text-emerald-500' },
                { label: 'Engagement Score', value: data.engagementScore || '0/10', icon: TrendingUp, color: 'text-purple-500' },
              ].map(({ label, value, icon: Icon, color }, i) => (
                <div key={i} className="bg-white border border-[#E2E8F0] p-6 rounded-3xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 bg-slate-50 rounded-lg ${color}`}><Icon size={20} /></div>
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900">{value}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </InstructorLayout>
  );
}

