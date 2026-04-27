import { useState, useEffect, useCallback, useRef } from 'react';
import {
  speak as ttsSpeak,
  stop as ttsStop,
  isSpeaking as ttsIsSpeaking,
  getVoices,
  setPreferredVoice as ttsSetPreferredVoice,
  getPreferredVoice,
  isTTSEnabled,
  isTTSAvailable,
} from '../lib/text-to-speech';

export interface UseTTSReturn {
  speak: (text: string, options?: { rate?: number; pitch?: number; volume?: number }) => void;
  stop: () => void;
  isSpeaking: boolean;
  voices: SpeechSynthesisVoice[];
  preferredVoice: SpeechSynthesisVoice | null;
  setPreferredVoice: (name: string) => void;
  isAvailable: boolean;
  autoSpeak: boolean;
  setAutoSpeak: (enabled: boolean) => void;
}

/**
 * React hook for Text-to-Speech using browser SpeechSynthesis API.
 *
 * - Reactive `isSpeaking` updates on speechSynthesis events
 * - Auto-loads voices on mount via onvoiceschanged
 * - Persists preferred voice and auto-speak setting in localStorage
 */
export function useTTS(): UseTTSReturn {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferredVoice, setPreferredVoiceState] = useState<SpeechSynthesisVoice | null>(null);
  const [autoSpeak, setAutoSpeakState] = useState(isTTSEnabled());
  const mountedRef = useRef(true);

  // Load voices (async on some browsers)
  const loadAllVoices = useCallback(() => {
    const available = getVoices();
    if (available.length > 0) {
      setVoices(available);
      setPreferredVoiceState(getPreferredVoice());
    }
  }, []);

  useEffect(() => {
    if (!isTTSAvailable()) return;

    loadAllVoices();

    // Some browsers load voices async — listen for the event
    const onVoicesChanged = () => {
      loadAllVoices();
    };

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = onVoicesChanged;
    }

    return () => {
      mountedRef.current = false;
      // Clean up voices changed handler
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [loadAllVoices]);

  // Reactive speaking state via speechSynthesis events
  useEffect(() => {
    if (!isTTSAvailable()) return;

    const onStart = () => { if (mountedRef.current) setSpeaking(true); };
    const onEnd = () => { if (mountedRef.current) setSpeaking(false); };
    const onPause = () => { if (mountedRef.current) setSpeaking(false); };
    const onResume = () => { if (mountedRef.current) setSpeaking(true); };

    // Poll-based fallback for browsers that don't fire events consistently
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (mountedRef.current) {
          setSpeaking(window.speechSynthesis.speaking);
        }
      }, 300);
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    // Use utterance-level events where possible
    // We add global start/end detection via polling as a reliable fallback
    startPolling();

    return () => {
      stopPolling();
    };
  }, []);

  const speak = useCallback((text: string, options?: { rate?: number; pitch?: number; volume?: number }) => {
    const voice = preferredVoice || undefined;
    ttsSpeak(text, { ...options, voice });
  }, [preferredVoice]);

  const stop = useCallback(() => {
    ttsStop();
    setSpeaking(false);
  }, []);

  const setPreferredVoice = useCallback((name: string) => {
    ttsSetPreferredVoice(name);
    setPreferredVoiceState(getPreferredVoice());
  }, []);

  const setAutoSpeak = useCallback((enabled: boolean) => {
    setAutoSpeakState(enabled);
    try {
      localStorage.setItem('lifeos:tts-enabled', enabled ? 'true' : 'false');
    } catch { /* ignore */ }
    if (!enabled) {
      ttsStop();
    }
  }, []);

  return {
    speak,
    stop,
    isSpeaking: speaking,
    voices,
    preferredVoice,
    setPreferredVoice,
    isAvailable: isTTSAvailable(),
    autoSpeak,
    setAutoSpeak,
  };
}