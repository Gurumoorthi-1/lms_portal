'use client';

import React, { useState, useEffect, useMemo } from 'react';
import HodLayout from '@/components/layout/HodLayout';
import { 
  BarChart as BarChartIcon, 
  PieChart as PieChartIcon, 
  Table as TableIcon, 
  Download, 
  FileText, 
  Search, 
  Filter, 
  ArrowUpDown, 
  ChevronRight, 
  AlertCircle,
  TrendingUp,
  Award,
  Users,
  Shield,
  ArrowRightCircle,
  XCircle,
  Hourglass,
  CheckCircle2,
  Sparkles,
  Mail
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Cell, 
  Pie,
  Legend,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { 
  useReactTable, 
  getCoreRowModel, 
  getFilteredRowModel, 
  getPaginationRowModel, 
  getSortedRowModel, 
  flexRender,
  createColumnHelper
} from '@tanstack/react-table';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { authFetch } from '@/lib/api';
import { useUser } from '@/hooks/useUser';
import socket from '@/lib/socket';

const COLORS = ['#F97316', '#10B981', '#F59E0B', '#EF4444', '#F97316', '#EC4899'];

const Card = ({ children, title, icon: Icon, className = "" }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white border border-slate-200 rounded-3xl p-6 shadow-sm ${className}`}
  >
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-black text-slate-900 tracking-tight">{title}</h3>
      {Icon && <Icon className="text-[#F97316]" size={20} />}
    </div>
    {children}
  </motion.div>
);

export default function PerformanceReports() {
  const { user } = useUser({ requireAuth: true });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [rejectingUser, setRejectingUser] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);
  const [hiringUser, setHiringUser] = useState(null);
  const [isSubmittingHire, setIsSubmittingHire] = useState(false);

  const collegeCode = user?.institutionId || 'self';

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Real-time socket listener for live analytics sync
  useEffect(() => {
    const handleUpdate = () => {
      console.log('[PerformanceReports] Real-time analytics update received');
      fetchData();
    };
    socket.on('analyticsUpdated', handleUpdate);
    return () => socket.off('analyticsUpdated', handleUpdate);
  }, [collegeCode]);

  const fetchData = async () => {
    try {
      const res = await authFetch(`/analytics/instructor/${collegeCode}/summary`);
      const json = await res.json();
      setData(json);
      setLoading(false);
    } catch (e) {
      toast.error("Failed to fetch analytics data");
      setLoading(false);
    }
  };

  const handleViewAnalysis = async (userId, name) => {
    setAnalysisLoading(true);
    setSelectedAnalysis({ name });
    try {
      const res = await authFetch(`/analytics/student/${userId}/ai-insights`);
      const json = await res.json();
      setSelectedAnalysis({ ...json, name });
    } catch (e) {
      toast.error("Failed to fetch AI insights");
      setSelectedAnalysis(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleDownloadIndividual = async (userId, name) => {
    toast.loading(`Generating report for ${name}...`);
    try {
      const res = await authFetch(`/analytics/student/${userId}/pdf`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_${name.replace(/\s/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.dismiss();
      toast.success("Report downloaded!");
    } catch (e) {
      toast.dismiss();
      toast.error("Failed to download report");
    }
  };

  const handleApproveNextRound = async (userId) => {
    try {
      const res = await authFetch('/progress/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const result = await res.json();
      if (res.ok) {
        toast.success("Candidate promoted to next round!");
        fetchData(); // Refresh table
      } else {
        toast.error(result.message || "Failed to promote candidate");
      }
    } catch (e) {
      toast.error("Network error during approval");
    }
  };

  const handleRejectCandidate = async () => {
    if (!rejectingUser || !rejectReason.trim()) return;
    
    setIsSubmittingReject(true);
    try {
      const res = await authFetch('/progress/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: rejectingUser.id, 
          reason: rejectReason 
        })
      });
      if (res.ok) {
        toast.success("Candidate rejected.");
        setRejectingUser(null);
        setRejectReason('');
        fetchData(); // Refresh table
      } else {
        toast.error("Failed to reject candidate");
      }
    } catch (e) {
      toast.error("Network error during rejection");
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const handleHireCandidate = async () => {
    if (!hiringUser) return;
    setIsSubmittingHire(true);
    try {
      const res = await authFetch('/progress/hire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: hiringUser.id })
      });
      if (res.ok) {
        toast.success('Candidate marked as Hired! 🎉');
        setHiringUser(null);
        fetchData();
      } else {
        toast.error('Failed to hire candidate');
      }
    } catch (e) {
      toast.error('Network error during hiring');
    } finally {
      setIsSubmittingHire(false);
    }
  };

  const handleBatchExport = async (type) => {
    const endpoint = type === 'pdf' ? 'batch-pdf' : 'batch-csv';
    toast.loading(`Exporting consolidated ${type.toUpperCase()}...`);
    try {
      const res = await authFetch(`/analytics/instructor/${collegeCode}/${endpoint}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Batch_Report_${collegeCode}.${type}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.dismiss();
      toast.success(`Consolidated ${type.toUpperCase()} exported!`);
    } catch (e) {
      toast.dismiss();
      toast.error(`Failed to export ${type.toUpperCase()}`);
    }
  };

  const handleEmailReportsBatch = async () => {
    toast.loading("Initiating batch email delivery. This may take a moment...", { duration: 5000 });
    try {
      const res = await authFetch(`/analytics/instructor/${collegeCode}/batch-email`, {
        method: 'POST'
      });
      const data = await res.json();
      toast.dismiss();
      if (res.ok) {
        toast.success(data.message || "Reports sent successfully!");
      } else {
        toast.error(data.message || "Failed to send emails");
      }
    } catch (e) {
      toast.dismiss();
      toast.error("Network error during email dispatch");
    }
  };

  const columnHelper = createColumnHelper();

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Student Name',
      cell: info => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{info.getValue()}</span>
          <span className="text-xs text-slate-500">{info.row.original.email}</span>
        </div>
      )
    }),
    columnHelper.accessor('scores.aptitude', {
      header: 'Aptitude',
      cell: info => (
        <div className="flex flex-col min-w-[80px]">
          <span className="text-sm font-black text-slate-900">{info.getValue()}%</span>
          <span className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${info.getValue() >= 60 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {info.getValue() >= 60 ? 'Passed' : 'Failed'}
          </span>
        </div>
      )
    }),
    columnHelper.accessor('scores.coding', {
      header: 'Coding',
      cell: info => (
        <div className="flex flex-col min-w-[80px]">
          <div className="flex items-end gap-1">
            <span className="text-sm font-black text-slate-900">{info.getValue()}%</span>
            <span className="text-[10px] text-slate-400 font-bold mb-0.5">({info.row.original.marks?.coding || 0}/8)</span>
          </div>
          <span className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${info.getValue() >= 50 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {info.getValue() >= 50 ? 'Passed' : 'Failed'}
          </span>
        </div>
      )
    }),
    columnHelper.accessor('scores.hr', {
      header: 'HR Interview',
      cell: info => (
        <div className="flex flex-col min-w-[100px]">
          <div className="flex items-end gap-1">
            <span className="text-sm font-black text-slate-900">{info.getValue()}%</span>
            <span className="text-[10px] text-slate-400 font-bold mb-0.5">({info.row.original.marks?.hr || 0}/14)</span>
          </div>
          <span className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${info.getValue() >= 70 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {info.getValue() >= 70 ? 'Ready' : 'Weak'}
          </span>
        </div>
      )
    }),
    columnHelper.accessor('scores.overall', {
      header: 'Overall Score',
      cell: info => (
        <div className="flex items-center gap-2 min-w-[100px]">
          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full ${info.getValue() >= 75 ? 'bg-emerald-500' : info.getValue() >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${info.getValue()}%` }}
            />
          </div>
          <span className="text-sm font-black whitespace-nowrap">{info.getValue()}%</span>
        </div>
      )
    }),
    columnHelper.accessor('trustScore', {
      header: 'Integrity Status',
      cell: info => {
        const score = info.getValue();
        let status = 'Clean';
        let color = 'text-emerald-600 bg-emerald-50 border-emerald-100';
        
        if (score < 70) {
          status = 'Flagged';
          color = 'text-rose-600 bg-rose-50 border-rose-100';
        } else if (score < 100) {
          status = 'Review';
          color = 'text-amber-600 bg-amber-50 border-amber-100';
        }

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap border ${color}`}>
                <Shield size={12} />
                {score}% {status}
              </span>
              {score < 50 && (
                <span className="px-2 py-1 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest rounded-lg animate-pulse">
                  High Risk
                </span>
              )}
            </div>
          </div>
        );
      }
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${
          info.getValue() === 'Pass' ? 'text-emerald-500' : 
          info.getValue() === 'Fail' ? 'text-rose-500' : 'text-slate-400'
        }`}>
          {info.getValue()}
        </span>
      )
    }),
    columnHelper.display({
      id: 'insights',
      header: 'Instructor Insights',
      cell: info => {
        const { integrityAlert, trustScore, matrixCategory, privateNote, status } = info.row.original;
        
        // Hide insights if test not attempted
        if (status === 'Not Attempted') {
          return <span className="text-slate-300 font-bold ml-4">-</span>;
        }

        return (
          <div className="flex flex-col gap-1.5 max-w-[220px]">
            {/* Matrix Badge */}
            <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
              matrixCategory === 'Perfect Hire' ? 'bg-emerald-500 text-white' :
              matrixCategory === 'Potential Malpractice (Verify)' ? 'bg-rose-500 text-white' :
              matrixCategory === 'Needs Training but Reliable' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {matrixCategory}
            </span>

            {privateNote && (
              <p className="text-[9px] font-black text-indigo-600 leading-tight italic bg-indigo-50 p-1.5 rounded-lg border border-indigo-100">
                " {privateNote} "
              </p>
            )}

            {integrityAlert && (
              <div className="flex items-start gap-1.5 p-1.5 bg-rose-50 border border-rose-100 rounded-lg">
                <AlertCircle size={10} className="text-rose-500 mt-0.5 shrink-0" />
                <p className="text-[9px] font-bold text-rose-600 leading-tight">{integrityAlert}</p>
              </div>
            )}
          </div>
        );
      }
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: info => {
        const student = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => handleViewAnalysis(student.id, student.name)}
              className="px-4 py-2 bg-orange-50 text-[#F97316] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#F97316] hover:text-white transition-all flex items-center gap-2 border border-orange-100"
            >
              <FileText size={14} />
              View Analysis
            </button>
            
            {student.isRejected ? (
              <span className="px-3 py-2 bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-200">
                Rejected
              </span>
            ) : student.isHired ? (
              <span className="px-3 py-2 bg-emerald-100 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Hired
              </span>
            ) : (student.currentStage === 'HR_INTERVIEW' && (student.isWaitingApproval || student.hrCompleted)) ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setHiringUser({ id: student.id, name: student.name })}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
                >
                  <CheckCircle2 size={14} />
                  Hired
                </button>
                <button 
                  onClick={() => setRejectingUser({ id: student.id, name: student.name })}
                  className="px-4 py-2 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all flex items-center gap-2 border border-rose-100"
                  title="Reject Candidate"
                >
                  <XCircle size={14} />
                  Reject
                </button>
              </div>
            ) : (student.currentStage !== 'HR_INTERVIEW' && student.status.toLowerCase() !== 'not attempted') ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleApproveNextRound(student.id)}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
                >
                  <ArrowRightCircle size={14} />
                  Next Round
                </button>
                <button 
                  onClick={() => setRejectingUser({ id: student.id, name: student.name })}
                  className="px-4 py-2 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all flex items-center gap-2 border border-rose-100"
                  title="Reject Candidate"
                >
                  <XCircle size={14} />
                  Reject
                </button>
              </div>
            ) : student.status.toLowerCase() !== 'not attempted' ? (
              <div className="flex items-center gap-1.5 text-slate-400">
                 <Hourglass size={12} className="animate-spin" />
                 <span className="text-[10px] font-bold uppercase tracking-widest">In Round</span>
              </div>
            ) : null}

            <button 
              onClick={() => handleDownloadIndividual(student.id, student.name)}
              className="p-2 text-slate-400 hover:text-[#F97316] transition-colors"
              title="Download PDF"
            >
              <Download size={18} />
            </button>
          </div>
        );
      }
    })
  ], [data]);

  const table = useReactTable({
    data: data?.students || [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const AnalysisModal = () => (
    <AnimatePresence>
      {selectedAnalysis && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAnalysis(null)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
          >
            <div className="p-10 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Placement Readiness Report</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Generated by Senior AI Career Consultant</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${
                    selectedAnalysis.finalVerdict === 'Ready' ? 'bg-emerald-500 text-white' : 
                    selectedAnalysis.finalVerdict === 'Needs Polish' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                  }`}>
                    {selectedAnalysis.finalVerdict || 'Analyzing...'}
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Readiness: {selectedAnalysis.improvementIndex}%
                  </div>
                </div>
              </div>

              {analysisLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 font-black text-xs uppercase tracking-widest">Running Advanced Diagnostics...</p>
                </div>
              ) : (
                <div className="space-y-10">
                  {/* Radar Chart & Assessment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={selectedAnalysis.radarData}>
                          <PolarGrid stroke="#f1f5f9" />
                          <PolarAngleAxis dataKey="subject" fontSize={10} fontWeight="bold" />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={8} tick={false} axisLine={false} />
                          <Radar
                            name="Student"
                            dataKey="A"
                            stroke="#F97316"
                            fill="#F97316"
                            fillOpacity={0.6}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-4">
                      <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                        <h4 className="font-black text-slate-900 text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2">
                          <TrendingUp size={14} className="text-[#F97316]" />
                          Technical Assessment
                        </h4>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">{selectedAnalysis.technicalAssessment}</p>
                      </div>
                      <div className="p-5 bg-orange-50/50 rounded-3xl border border-orange-100">
                        <h4 className="font-black text-slate-900 text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Award size={14} className="text-[#F97316]" />
                          Behavioral Insights
                        </h4>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">{selectedAnalysis.behavioralInsights}</p>
                      </div>
                    </div>
                  </div>

                  {/* Competency Heatmap */}
                  <div>
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-4">Competency Heatmap</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedAnalysis.competencyHeatmap?.strengths?.map((item, idx) => (
                        <div key={idx} className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                          <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">{item.topic}</div>
                          <div className="text-lg font-black text-emerald-700">{item.score}%</div>
                        </div>
                      ))}
                      {selectedAnalysis.competencyHeatmap?.weaknesses?.map((item, idx) => (
                        <div key={idx} className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                          <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">{item.topic}</div>
                          <div className="text-lg font-black text-rose-700">{item.score}%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Struggle Log */}
                  {selectedAnalysis.struggleLog?.length > 0 && (
                    <div>
                      <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                        <AlertCircle size={14} className="text-rose-500" />
                        The 'Struggle' Log
                      </h4>
                      <div className="space-y-3">
                        {selectedAnalysis.struggleLog.map((log, idx) => (
                          <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{log.round}</span>
                              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{log.issue}</span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium">{log.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Actionable Roadmap */}
                  <div>
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-4">AI Actionable Roadmap</h4>
                    <div className="space-y-4">
                      {selectedAnalysis.actionableRoadmap?.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-5 bg-white border border-slate-100 rounded-[32px] shadow-sm">
                          <div className="w-10 h-10 bg-[#F97316] text-white rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h5 className="font-black text-slate-900 text-sm">{item.task}</h5>
                              <span className="px-2 py-0.5 bg-orange-100 text-[#F97316] rounded text-[8px] font-black uppercase tracking-widest">{item.timeframe}</span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">Goal: {item.goal}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedAnalysis(null)}
                    className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all mt-4"
                  >
                    Close Analytical Report
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (loading || !data) return (
    <HodLayout>
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-bold animate-pulse">Aggregating Master Data...</p>
        </div>
      </div>
    </HodLayout>
  );

  return (
    <HodLayout>
      <AnalysisModal />
      <div className="space-y-10 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Performance Reports</h1>
            <p className="text-slate-500 font-medium mt-1">Macro insights and batch data exports.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => handleBatchExport('csv')}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
            >
              <TableIcon size={16} />
              Export CSV
            </button>
            <button 
              onClick={() => handleBatchExport('pdf')}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
            >
              <Download size={16} />
              Consolidated PDF
            </button>
            <button 
              onClick={handleEmailReportsBatch}
              className="flex items-center gap-2 px-6 py-3 bg-[#F97316] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95"
            >
              <Mail size={16} />
              Email to Report
            </button>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Top 10 Performers" icon={Award} className="lg:col-span-2">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.summary?.topPerformers || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="scores.overall" fill="#F97316" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="space-y-6">
            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 px-2">
              <Shield className="text-[#F97316]" size={24} />
              Integrity Dashboard
            </h3>
            
            <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm">
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Violation Breakdown</div>
               <div className="h-40 w-full mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Tab Switch', value: data?.summary?.globalViolationBreakdown?.tabSwitches || 0 },
                          { name: 'Face Loss', value: data?.summary?.globalViolationBreakdown?.faceLoss || 0 },
                          { name: 'Multi Face', value: data?.summary?.globalViolationBreakdown?.multipleFaces || 0 },
                          { name: 'Other', value: data?.summary?.globalViolationBreakdown?.other || 0 }
                        ].filter(v => v.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {COLORS.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
               </div>
               <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                     <div className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Clean</div>
                     <div className="text-xl font-black text-emerald-700">{(data?.students || []).filter(s => s.trustScore === 100).length}</div>
                  </div>
                  <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                     <div className="text-[8px] font-black text-rose-600 uppercase tracking-widest">Flagged</div>
                     <div className="text-xl font-black text-rose-700">{(data?.students || []).filter(s => s.trustScore < 70).length}</div>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl">
               <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="text-orange-400" size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Skill vs Honesty Matrix</span>
               </div>
               <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10">
                     <span className="text-[10px] font-bold text-slate-300">Perfect Hires</span>
                     <span className="text-lg font-black text-emerald-400">{(data?.students || []).filter(s => s.matrixCategory === 'Perfect Hire').length}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10">
                     <span className="text-[10px] font-bold text-slate-300">Potential Malpractice</span>
                     <span className="text-lg font-black text-rose-400">{(data?.students || []).filter(s => s.matrixCategory === 'Potential Malpractice (Verify)').length}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10">
                     <span className="text-[10px] font-bold text-slate-300">Reliable / Needs Training</span>
                     <span className="text-lg font-black text-blue-400">{(data?.students || []).filter(s => s.matrixCategory === 'Needs Training but Reliable').length}</span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Students Table */}
        <Card title="Student Performance & Integrity Matrix" icon={Users}>
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                value={globalFilter ?? ''}
                onChange={e => setGlobalFilter(e.target.value)}
                placeholder="Search by student, email, or department..."
                className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-2">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id} 
                        className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400"
                        onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                      >
                        <div className="flex items-center gap-1 cursor-pointer hover:text-[#F97316] transition-colors">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && <ArrowUpDown size={12} />}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <motion.tr 
                    layout
                    key={row.id} 
                    className="bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all group"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-4 text-sm border-y first:border-l last:border-r border-slate-100 first:rounded-l-2xl last:rounded-r-2xl">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-500">
              Showing {table.getRowModel().rows.length} of {data.students.length} students
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-4 py-2 bg-slate-50 rounded-xl text-xs font-black disabled:opacity-50"
              >
                Previous
              </button>
              <button 
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-4 py-2 bg-slate-50 rounded-xl text-xs font-black disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Rejection Modal */}
      <AnimatePresence>
        {rejectingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRejectingUser(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 border border-rose-100">
                  <AlertCircle size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reject Candidate</h2>
                  <p className="text-slate-500 text-sm font-medium mt-0.5">Rejecting: <span className="text-slate-900 font-bold">{rejectingUser.name}</span></p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Rejection</label>
                  <textarea 
                    autoFocus
                    placeholder="Provide a detailed reason why this candidate is being rejected..."
                    className="w-full h-32 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-700 font-bold placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:bg-white transition-all resize-none"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setRejectingUser(null)}
                    className="flex-1 h-14 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={!rejectReason.trim() || isSubmittingReject}
                    onClick={handleRejectCandidate}
                    className="flex-[2] h-14 bg-rose-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale shadow-xl shadow-rose-200"
                  >
                    {isSubmittingReject ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <XCircle size={20} />
                        Confirm Rejection
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hire Confirmation Modal */}
      <AnimatePresence>
        {hiringUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-100">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Confirm Hiring</h2>
                  <p className="text-slate-500 text-sm font-medium mt-0.5">Hiring: <span className="text-slate-900 font-bold">{hiringUser.name}</span></p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-3">
                  <p className="text-sm font-bold text-emerald-800 leading-relaxed">
                    This candidate will be marked as <span className="font-black text-emerald-600">HIRED</span> and promoted to a real HR interview round.
                  </p>
                  <div className="flex items-start gap-2 text-xs text-emerald-600 font-medium">
                    <Sparkles size={14} className="mt-0.5 shrink-0" />
                    <span>The student will see a congratulation screen with the next steps for in-person HR interview.</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setHiringUser(null)}
                    className="flex-1 h-14 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isSubmittingHire}
                    onClick={handleHireCandidate}
                    className="flex-[2] h-14 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-emerald-200"
                  >
                    {isSubmittingHire ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={20} />
                        Confirm Hired
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </HodLayout>
  );
}

