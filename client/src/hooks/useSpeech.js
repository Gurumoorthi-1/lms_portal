// src/hooks/useSpeech.js
import { useState, useCallback, useRef } from 'react';

export function useSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);

  // ── Text-to-Speech ────────────────────────────────────────────────────────
  const speak = useCallback((text, onEnd) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google') || v.name.includes('Natural') || v.lang.startsWith('en')
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const shouldListenRef = useRef(false);

  // ── Speech-to-Text ────────────────────────────────────────────────────────
  const startListening = useCallback((onResult) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Browser not supported');
      return;
    }

    setSpeechError(null);
    shouldListenRef.current = true;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Optimized for Indian English accents

    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += text + ' ';
          setTranscript(finalTranscript);
          if (onResult) onResult(finalTranscript);
        } else {
          interim += text;
        }
      }
    };

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      // Auto-restart logic if we are still supposed to be listening
      // Don't restart if there was a permission error
      if (shouldListenRef.current && !recognitionRef.current?.permissionDenied) {
        try {
          recognition.start();
        } catch (e) {
          console.error('Failed to restart speech recognition:', e);
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };
    
    recognition.onerror = (e) => {
      console.error('Speech recognition error:', e.error);
      setSpeechError(e.error);

      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        shouldListenRef.current = false; // Stop trying to restart
        if (recognitionRef.current) recognitionRef.current.permissionDenied = true;
      }

      if (e.error === 'no-speech') {
        return;
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setTranscript('');
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  return { speak, stopSpeaking, isSpeaking, startListening, stopListening, isListening, transcript, setTranscript, speechError };
}

