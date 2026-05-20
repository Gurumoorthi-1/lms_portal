import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load all pages
const Home = lazy(() => import('./app/page'));
const Auth = lazy(() => import('./app/auth/page'));
const InstitutionAuth = lazy(() => import('./app/auth/institution/page'));
const Analytics = lazy(() => import('./app/analytics/page'));
const Bank = lazy(() => import('./app/bank/page'));
const Challenges = lazy(() => import('./app/challenges/page'));
const CodeLab = lazy(() => import('./app/codelab/page'));
const Courses = lazy(() => import('./app/courses/page'));
const CourseDetail = lazy(() => import('./app/courses/[slug]/page'));
const Demo = lazy(() => import('./app/demo/page'));
const ExamPlayer = lazy(() => import('./app/exam-player/page'));
const Results = lazy(() => import('./app/results/page'));

// Instructor Routes
const InstructorDashboard = lazy(() => import('./app/instructor/page'));
const InstructorAnalytics = lazy(() => import('./app/instructor/analytics/page'));
const InstructorExams = lazy(() => import('./app/instructor/exams/page'));
const InstructorGenerate = lazy(() => import('./app/instructor/generate/page'));
const InstructorInstitutionUsers = lazy(() => import('./app/instructor/institution-users/page'));
const InstructorPerformanceReports = lazy(() => import('./app/instructor/performance-reports/page'));
const InstructorStudents = lazy(() => import('./app/instructor/students/page'));

// HOD Routes
const HodDashboard = lazy(() => import('./app/hod/page'));
const HodAnalytics = lazy(() => import('./app/hod/analytics/page'));
const HodExams = lazy(() => import('./app/hod/exams/page'));
const HodGenerate = lazy(() => import('./app/hod/generate/page'));
const HodInstitutionUsers = lazy(() => import('./app/hod/institution-users/page'));
const HodPerformanceReports = lazy(() => import('./app/hod/performance-reports/page'));
const HodStudents = lazy(() => import('./app/hod/students/page'));

// Student Routes
const StudentHome = lazy(() => import('./app/student/page'));
const StudentResume = lazy(() => import('./app/student/resume/page'));
const StudentAptitude = lazy(() => import('./app/student/aptitude/page'));
const StudentCoding = lazy(() => import('./app/student/coding/page'));
const StudentInterview = lazy(() => import('./app/student/interview/page'));
const StudentResults = lazy(() => import('./app/student/results/page'));
const StudentMCQ = lazy(() => import('./app/student/mcq/page'));
const StudentInstitutionalReport = lazy(() => import('./app/student/institutional-report/page'));
const StudentAnalytics = lazy(() => import('./app/student/analytics/page'));

// Problems
const Problems = lazy(() => import('./app/problems/page'));
const ProblemDetail = lazy(() => import('./app/problems/[id]/page'));

const Loading = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7C3AED]"></div>
  </div>
);

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/login" element={<Navigate to="/auth" replace />} />
        <Route path="/auth/institution" element={<InstitutionAuth />} />

        {/* Protected Common Routes */}
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/bank" element={<Bank />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/codelab" element={<CodeLab />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:slug" element={<CourseDetail />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/results" element={<Results />} />
        
        {/* Exam Player (Strictly Protected by Stage) */}
        <Route path="/exam-player" element={
          <ProtectedRoute requiredStage="MCQ">
            <ExamPlayer />
          </ProtectedRoute>
        } />

        {/* Instructor Routes */}
        <Route path="/instructor" element={<InstructorDashboard />} />
        <Route path="/instructor/analytics" element={<InstructorAnalytics />} />
        <Route path="/instructor/exams" element={<InstructorExams />} />
        <Route path="/instructor/generate" element={<InstructorGenerate />} />
        <Route path="/instructor/institution-users" element={<InstructorInstitutionUsers />} />
        <Route path="/instructor/performance-reports" element={<InstructorPerformanceReports />} />
        <Route path="/instructor/students" element={<InstructorStudents />} />

        {/* HOD Routes */}
        <Route path="/hod" element={<HodDashboard />} />
        <Route path="/hod/analytics" element={<HodAnalytics />} />
        <Route path="/hod/exams" element={<HodExams />} />
        <Route path="/hod/generate" element={<HodGenerate />} />
        <Route path="/hod/institution-users" element={<HodInstitutionUsers />} />
        <Route path="/hod/performance-reports" element={<HodPerformanceReports />} />
        <Route path="/hod/students" element={<HodStudents />} />

        {/* Student Routes */}
        <Route path="/student" element={<StudentHome />} />
        <Route path="/student/dashboard" element={<StudentHome />} />
        <Route path="/student/results" element={<StudentResults />} />
        <Route path="/student/mcq" element={<StudentMCQ />} />
        <Route path="/student/institutional-report" element={<StudentInstitutionalReport />} />
        <Route path="/student/analytics" element={<StudentAnalytics />} />
        
        {/* Student Assessment Stages (Protected by Stage) */}
        <Route path="/student/resume" element={
          <ProtectedRoute requiredStage="RESUME_UPLOAD">
            <StudentResume />
          </ProtectedRoute>
        } />
        <Route path="/student/aptitude" element={
          <ProtectedRoute requiredStage="APTITUDE">
            <StudentAptitude />
          </ProtectedRoute>
        } />
        <Route path="/student/coding" element={
          <ProtectedRoute requiredStage="CODING">
            <StudentCoding />
          </ProtectedRoute>
        } />
        <Route path="/student/interview" element={
          <ProtectedRoute requiredStage="HR_INTERVIEW">
            <StudentInterview />
          </ProtectedRoute>
        } />

        {/* Problems */}
        <Route path="/problems" element={<Problems />} />
        <Route path="/problems/:id" element={<ProblemDetail />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}


export default App;

