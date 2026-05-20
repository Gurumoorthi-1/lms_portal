import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../lib/api';

const STAGE_ROUTES = {
  MCQ: '/exam-player',
  RESUME_UPLOAD: '/student/resume',
  APTITUDE: '/student/aptitude',
  CODING: '/student/coding',
  HR_INTERVIEW: '/student/interview',
  FINISHED: '/student/dashboard',
};

const ProtectedRoute = ({ children, requiredStage }) => {
  const [isAuthorized, setIsAuthorized] = useState(null);
  const [redirectPath, setRedirectPath] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const token = getToken();

    if (!token) {
      setIsAuthorized(false);
      setRedirectPath('/auth');
      return;
    }

    try {
      // Basic decode to check stage
      const base64Payload = token.split('.')[1];
      const payload = JSON.parse(atob(base64Payload));
      const currentStage = payload.currentStage || 'MCQ';
      
      // Institutional users bypass stage-gating (MCQ is skipped for them)
      const isInstitutional = !!payload.institutionId;
      
      const sanctionedRoute = STAGE_ROUTES[currentStage];
      
      // Allow if:
      // 1. We are on the sanctioned route for this stage
      // 2. It's the dashboard
      // 3. It's the student base path
      // 4. User is institutional (they have a different flow)
      if (
        location.pathname === sanctionedRoute || 
        location.pathname.includes('dashboard') ||
        location.pathname === '/student' ||
        isInstitutional
      ) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        setRedirectPath(sanctionedRoute);
      }
    } catch (err) {
      console.error('Auth Error:', err);
      setIsAuthorized(false);
      setRedirectPath('/auth');
    }
  }, [location, requiredStage]);

  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#7C3AED]"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

export default ProtectedRoute;

