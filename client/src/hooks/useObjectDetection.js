// src/hooks/useObjectDetection.js
// Feature 1: Real-time object detection using COCO-SSD (TensorFlow.js)
import { useEffect, useRef, useState, useCallback } from 'react';
import { logProctoringEvent } from '@/lib/api';

// Classes we care about for proctoring
const PHONE_CLASSES = ['cell phone'];
const BOOK_CLASSES = ['book', 'laptop', 'remote', 'keyboard'];
const PERSON_CLASS = 'person';

// How long a violation must persist before logging (ms)
const VIOLATION_LOG_THRESHOLD = 5000;

export function useObjectDetection({ videoRef, canvasRef, sessionId, round, enabled = true }) {
  const [detectionWarnings, setDetectionWarnings] = useState([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const modelRef = useRef(null);
  const intervalRef = useRef(null);
  const violationTimersRef = useRef({}); // key -> { startTime, logged }
  const activeWarningsRef = useRef(new Set());

  // Load COCO-SSD model via CDN (no npm install needed)
  const loadModel = useCallback(async () => {
    if (modelRef.current) return;
    try {
      // Inject TF.js + COCO-SSD scripts if not already present
      if (!window.tf) {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');
      }
      if (!window.cocoSsd) {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
      }
      const model = await window.cocoSsd.load({ base: 'mobilenet_v2' });
      modelRef.current = model;
      setIsModelLoaded(true);
    } catch (err) {
      console.warn('COCO-SSD load failed:', err);
    }
  }, []);

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const addDetectionWarning = useCallback((key, message, severity = 'warning') => {
    const now = Date.now();

    // Track how long this violation has been active
    if (!violationTimersRef.current[key]) {
      violationTimersRef.current[key] = { startTime: now, logged: false };
    }

    const elapsed = now - violationTimersRef.current[key].startTime;

    // Log to backend after 5 seconds of continuous violation
    if (elapsed >= VIOLATION_LOG_THRESHOLD && !violationTimersRef.current[key].logged) {
      violationTimersRef.current[key].logged = true;
      if (sessionId) {
        logProctoringEvent(sessionId, key, message, 'critical', round).catch(() => {});
      }
    }

    if (!activeWarningsRef.current.has(key)) {
      activeWarningsRef.current.add(key);
      setDetectionWarnings(prev => {
        const filtered = prev.filter(w => w.key !== key);
        return [{ key, message, severity, time: new Date().toLocaleTimeString() }, ...filtered].slice(0, 10);
      });
    }
  }, [sessionId, round]);

  const clearDetectionWarning = useCallback((key) => {
    if (activeWarningsRef.current.has(key)) {
      activeWarningsRef.current.delete(key);
      // Reset violation timer
      delete violationTimersRef.current[key];
      setDetectionWarnings(prev => prev.filter(w => w.key !== key));
    }
  }, []);

  const runDetection = useCallback(async () => {
    if (!modelRef.current || !videoRef.current || !enabled) return;
    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    try {
      const predictions = await modelRef.current.detect(video);

      // Draw bounding boxes on canvas overlay
      if (canvasRef?.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        predictions.forEach(pred => {
          const [x, y, w, h] = pred.bbox;
          let color = '#00ff00';
          if (PHONE_CLASSES.includes(pred.class)) color = '#ff0000';
          else if (pred.class === PERSON_CLASS) color = '#ffaa00';
          else if (BOOK_CLASSES.includes(pred.class)) color = '#ff6600';

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = color;
          ctx.font = '12px monospace';
          ctx.fillText(`${pred.class} ${Math.round(pred.score * 100)}%`, x, y > 12 ? y - 4 : y + 16);
        });
      }

      // Analyze predictions for violations
      const persons = predictions.filter(p => p.class === PERSON_CLASS && p.score > 0.5);
      const phones = predictions.filter(p => PHONE_CLASSES.includes(p.class) && p.score > 0.5);
      const books = predictions.filter(p => BOOK_CLASSES.includes(p.class) && p.score > 0.45);

      // Multiple persons
      if (persons.length > 1) {
        addDetectionWarning('multi_person', '⚠ Multiple people detected', 'critical');
      } else {
        clearDetectionWarning('multi_person');
      }

      // No face / no person
      if (persons.length === 0) {
        addDetectionWarning('no_face', '⚠ Face not visible', 'warning');
      } else {
        clearDetectionWarning('no_face');
      }

      // Phone
      if (phones.length > 0) {
        addDetectionWarning('phone', '⚠ Mobile phone detected', 'critical');
      } else {
        clearDetectionWarning('phone');
      }

      // Suspicious object (book/paper etc)
      if (books.length > 0) {
        addDetectionWarning('book', '⚠ Suspicious object detected', 'warning');
      } else {
        clearDetectionWarning('book');
      }

    } catch (err) {
      // Silently ignore detection errors
    }
  }, [videoRef, canvasRef, enabled, addDetectionWarning, clearDetectionWarning]);

  // Load model and start detection
  useEffect(() => {
    if (!enabled) return;
    loadModel();
  }, [enabled, loadModel]);

  useEffect(() => {
    if (!enabled || !isModelLoaded) return;

    // Run detection every 1.5 seconds
    intervalRef.current = setInterval(runDetection, 1500);
    return () => {
      clearInterval(intervalRef.current);
    };
  }, [enabled, isModelLoaded, runDetection]);

  return { detectionWarnings, isModelLoaded };
}

