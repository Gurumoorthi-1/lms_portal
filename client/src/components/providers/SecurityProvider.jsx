'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Maximize2, ShieldAlert } from 'lucide-react';
import { logProctoringEvent } from '@/lib/api';

const SecurityContext = createContext(null);

const TEST_MODE = false; // Proctoring active and copy/paste blocked

/**
 * SecurityProvider - The Unified Security Orchestrator (CSO)
 * Centralizes violation tracking, proctoring listeners, and backend sync.
 */
export const SecurityProvider = ({ children }) => {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const [violations, setViolations] = useState([]);
  const [violationCounts, setViolationCounts] = useState({ total: 0, camera: 0, tabSwitch: 0, fs: 0 });
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [isSystemAction, setIsSystemAction] = useState(false);
  const [showFsOverlay, setShowFsOverlay] = useState(false);
  const [showScreenshotOverlay, setShowScreenshotOverlay] = useState(false);
  const isSystemActionRef = useRef(false);

  const setSystemAction = useCallback((val) => {
    setIsSystemAction(val);
    isSystemActionRef.current = val;
  }, []);

  const [config, setConfig] = useState({
    sessionId: null,
    round: 'general',
    maxCameraViolations: 4,
    maxTabSwitchViolations: 2,
    maxFsViolations: 2,
    enabled: false
  });
  const lastToastTimeRef = useRef({});

  const startSecurity = useCallback((options) => {
    console.log('🛡️ Security Orchestrator: Starting session', options.sessionId);
    setConfig({
      sessionId: options.sessionId,
      round: options.round || 'general',
      maxCameraViolations: 4,
      maxTabSwitchViolations: 2,
      maxFsViolations: 2,
      enabled: true
    });
    setViolations([]);
    setViolationCounts({ total: 0, camera: 0, tabSwitch: 0, fs: 0 });
    setIsDisqualified(false);
    setShowFsOverlay(false);
    setSystemAction(false);

    // Auto-trigger Fullscreen on start
    setTimeout(() => {
      const el = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen().catch(() => {});
      }
    }, 500);
  }, [setSystemAction]);

  const stopSecurity = useCallback(() => {
    console.log('🛡️ Security Orchestrator: Stopping session');
    setConfig(prev => ({ ...prev, enabled: false }));
    setSystemAction(false);
    setShowFsOverlay(false);
  }, [setSystemAction]);

  const reportViolation = useCallback(async (type, message, severity = 'warning') => {
    if (!config.enabled || isDisqualified || isSystemActionRef.current) return;
    
    if (TEST_MODE) {
      console.log(`🛡️ [TEST MODE] Violation Suppressed: ${type} - ${message}`);
      return;
    }

    const now = Date.now();
    const isCamera = ['looking_away', 'face_hidden', 'multiple_faces', 'gadget_detected', 'head_movement', 'camera_error', 'face_missing'].includes(type);
    const isTab = ['tab_switch', 'window_blur', 'blur'].includes(type);
    const isFS = ['fullscreen_exit', 'screen_exit'].includes(type);

    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    const cachedUser = userStr ? JSON.parse(userStr) : null;
    const isInstitutional = !!cachedUser?.institutionId;
    const isAptitudeRound = config.round === 'aptitude';

    // Completely bypass violation registration for fullscreen exits in institutional aptitude exams!
    if (isFS && isInstitutional && isAptitudeRound) {
      console.log(`🛡️ [Bypass] Fullscreen violation count and toast suppressed for institutional student in aptitude round.`);
      return;
    }

    setViolationCounts(prev => {
      const newCounts = {
        total: prev.total + 1,
        camera: isCamera ? prev.camera + 1 : prev.camera,
        tabSwitch: isTab ? prev.tabSwitch + 1 : prev.tabSwitch,
        fs: isFS ? prev.fs + 1 : prev.fs
      };

      // Disqualification limits check
      const hasCameraBreached = newCounts.camera >= config.maxCameraViolations;
      const hasTabSwitchBreached = newCounts.tabSwitch >= config.maxTabSwitchViolations;
      
      // If institutional and aptitude round, disable fullscreen breach termination
      const hasFsBreached = (isInstitutional && isAptitudeRound) 
        ? false 
        : newCounts.fs >= config.maxFsViolations;

      if (
        hasCameraBreached ||
        hasTabSwitchBreached ||
        hasFsBreached ||
        type === 'tab_switch_timeout'
      ) {
        setIsDisqualified(true);
        setShowFsOverlay(false);
      }

      return newCounts;
    });

    const newViolation = {
      id: now,
      ts: now,
      type,
      message,
      severity,
      timestamp: new Date().toISOString()
    };

    setViolations(prev => [...prev, newViolation]);

    // Toast Notification (with 5s cooldown to prevent spam)
    const toastKey = `violation-${type}`;
    if (!lastToastTimeRef.current[type] || now - lastToastTimeRef.current[type] > 5000) {
      let warningText = message;
      if (isCamera) warningText += ` (Camera Attempts: ${violationCounts.camera + 1}/${config.maxCameraViolations})`;
      if (isTab) warningText += ` (Tab Attempts: ${violationCounts.tabSwitch + 1}/${config.maxTabSwitchViolations})`;
      if (isFS) {
        warningText += (isInstitutional && isAptitudeRound)
          ? ` (Please remain in fullscreen)`
          : ` (Fullscreen Attempts: ${violationCounts.fs + 1}/${config.maxFsViolations})`;
      }

      if (severity === 'critical' || isTab || isFS) {
        toast.error(warningText, { 
          id: toastKey,
          icon: '🚨', 
          duration: 5000,
          style: { border: '2px solid #ef4444', background: '#fef2f2' }
        });
      } else {
        toast.error(warningText, { id: toastKey, icon: '⚠️' });
      }
      lastToastTimeRef.current = { ...lastToastTimeRef.current, [type]: now };
    }

    // Backend Sync
    if (config.sessionId) {
      if (import.meta.env.VITE_TEST_MODE === 'true') {
        console.log('🛡️ [TEST MODE] Violation Detected but Not Logged:', type, message);
        return;
      }

      try {
        await logProctoringEvent(config.sessionId, type, message, severity, config.round);
      } catch (err) {
        console.error('Failed to sync violation to backend:', err);
      }
    }
  }, [config, isDisqualified, violationCounts]);

  const reenterFullscreen = useCallback(() => {
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (request) {
      request.call(el)
        .then(() => {
          setShowFsOverlay(false);
        })
        .catch(err => {
          console.error("Failed to re-enter fullscreen:", err);
          toast.error("Please re-enter fullscreen manually.");
        });
    }
  }, []);

  // Global Listeners (Tab/Fullscreen/Shortcuts/Deduplication)
  useEffect(() => {
    if (!config.enabled || isDisqualified) return;
    
    // Security should only be active on assessment pages
    const isCodingPage = pathname?.includes('/student/coding');
    const isAssessmentPage = isCodingPage || 
                             pathname?.includes('/student/aptitude') || 
                             pathname?.includes('/student/mcq') || 
                             pathname?.includes('/student/interview') ||
                             pathname?.includes('/exam-player');

    if (!isAssessmentPage) return;

    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    const cachedUser = userStr ? JSON.parse(userStr) : null;
    const isInstitutional = !!cachedUser?.institutionId;

    const isProtectedPage = pathname?.includes('/student/coding') || 
                            pathname?.includes('/student/aptitude') || 
                            pathname?.includes('/student/interview');

    const handleVisibility = () => {
      if (document.hidden && !isSystemActionRef.current) {
        reportViolation('tab_switch', 'Proctoring Alert: Tab switch detected.', 'critical');
      }
    };

    const handleFsChange = () => {
      if (isSystemActionRef.current) return;
      
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (!isFs) {
        reportViolation('fullscreen_exit', 'Violation: Fullscreen exited unexpectedly.', 'critical');
        setShowFsOverlay(true);
      } else {
        setShowFsOverlay(false);
      }
    };

    const handleKeydown = (e) => {
      if (isSystemActionRef.current) return;

      // Screenshot detection for institutional students on protected pages
      const isScreenshotKey = e.key === 'PrintScreen' || e.keyCode === 44;
      const isScreenshotShortcut = (e.metaKey && e.shiftKey && ['s', '3', '4', '5'].includes(e.key.toLowerCase())) || 
                                   ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p');

      if (isInstitutional && isProtectedPage && (isScreenshotKey || isScreenshotShortcut)) {
        e.preventDefault();
        try {
          navigator.clipboard?.writeText?.('🚫 Screenshots are strictly prohibited during the exam.');
        } catch (err) {}
        setShowScreenshotOverlay(true);
        reportViolation('screenshot_attempt', 'Violation: Screenshot or screen recording attempt detected.', 'warning');
        return;
      }

      const isClipboardAction = (e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase());
      
      // ALLOW copy/paste explicitly on the coding page
      if (isClipboardAction && isCodingPage) {
        return;
      }

      const forbiddenKeys = ['c', 'v', 'r', 't', 'w', 'f', 'p', 'x'];
      
      // Completely block Ctrl+C, Ctrl+V, Ctrl+X across other exam processes
      if (isClipboardAction) {
        e.preventDefault();
        toast.error('🚫 Copying/pasting is strictly prohibited during the exam!', { id: 'copy-paste-blocked' });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && forbiddenKeys.includes(e.key.toLowerCase())) {
        e.preventDefault();
        reportViolation('keyboard_shortcut', `Blocked restricted shortcut: Ctrl+${e.key.toUpperCase()}`, 'warning');
      }
      
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        reportViolation('devtools', 'DevTools access attempt detected.', 'critical');
      }
    };

    const handleKeyup = (e) => {
      if (isSystemActionRef.current) return;

      const isScreenshotKey = e.key === 'PrintScreen' || e.keyCode === 44;
      if (isInstitutional && isProtectedPage && isScreenshotKey) {
        e.preventDefault();
        try {
          navigator.clipboard?.writeText?.('🚫 Screenshots are strictly prohibited during the exam.');
        } catch (err) {}
        setShowScreenshotOverlay(true);
        reportViolation('screenshot_attempt', 'Violation: Screenshot attempt detected.', 'warning');
      }
    };

    const preventContext = (e) => {
      if (isCodingPage) return; // Allow on coding page
      e.preventDefault();
      toast.error('🚫 Copying/pasting is strictly prohibited during the exam!', { id: 'copy-paste-blocked' });
    };

    window.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('keyup', handleKeyup);
    window.addEventListener('contextmenu', preventContext);
    window.addEventListener('copy', preventContext);
    window.addEventListener('paste', preventContext);
    window.addEventListener('cut', preventContext);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('keyup', handleKeyup);
      window.removeEventListener('contextmenu', preventContext);
      window.removeEventListener('copy', preventContext);
      window.removeEventListener('paste', preventContext);
      window.removeEventListener('cut', preventContext);
    };
  }, [config.enabled, isDisqualified, reportViolation, pathname]);

  return (
    <SecurityContext.Provider value={{
      violations,
      totalViolations: violations.length,
      violationCounts,
      isDisqualified,
      isSystemAction,
      setSystemAction,
      startSecurity,
      stopSecurity,
      reportViolation,
      config,
      isTestMode: import.meta.env.VITE_TEST_MODE === 'true'
    }}>
      {children}
      {showFsOverlay && !isDisqualified && (
        <div className="fixed inset-0 bg-[#0F172A] z-[9999] flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20 animate-pulse">
              <Maximize2 size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">Fullscreen Required</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                You exited full-screen mode. Remaining in fullscreen is mandatory for assessment security.
              </p>
            </div>
            <button
              onClick={reenterFullscreen}
              className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all"
            >
              Re-enter Fullscreen
            </button>
          </div>
        </div>
      )}
      {showScreenshotOverlay && (
        <div className="fixed inset-0 bg-[#0F172A]/90 backdrop-blur-md z-[99999] flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
              <ShieldAlert size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">Screenshot Restricted</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Capturing screenshots or screen recordings is strictly prohibited during this assessment.
              </p>
            </div>
            <button
              onClick={() => setShowScreenshotOverlay(false)}
              className="w-full h-14 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl shadow-lg hover:shadow-red-500/20 active:scale-[0.98] transition-all"
            >
              Continue to Developer
            </button>
          </div>
        </div>
      )}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
