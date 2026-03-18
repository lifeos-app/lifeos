import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance;
}

// ─── Feature Detection ───────────────────────────────────────────

function getSpeechRecognitionClass(): SpeechRecognitionConstructor | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// ─── Hook Options ────────────────────────────────────────────────

export interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  onFinalTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
}

// ─── Hook ────────────────────────────────────────────────────────

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    lang = 'en-AU',
    continuous = false,
    onFinalTranscript,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isSupported = !!getSpeechRecognitionClass();

  // Store callbacks in refs so they don't cause re-creates
  const onFinalRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);
  useEffect(() => { onFinalRef.current = onFinalTranscript; }, [onFinalTranscript]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionClass();
    if (!SpeechRecognition) {
      const msg = 'Speech recognition not supported in this browser';
      setError(msg);
      onErrorRef.current?.(msg);
      return;
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setTranscript('');
      setInterimTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interimText = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      if (finalText) {
        setTranscript(finalText);
        setInterimTranscript('');
        onFinalRef.current?.(finalText);
      } else {
        setInterimTranscript(interimText);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are normal — don't treat as errors
      if (event.error === 'no-speech' || event.error === 'aborted') {
        setIsListening(false);
        return;
      }

      let msg = 'Speech recognition error';
      switch (event.error) {
        case 'not-allowed':
          msg = 'Microphone access denied. Please allow microphone permission.';
          break;
        case 'audio-capture':
          msg = 'No microphone found. Please connect a microphone.';
          break;
        case 'network':
          msg = 'Network error. Speech recognition requires internet.';
          break;
        default:
          msg = `Speech error: ${event.error}`;
      }

      setError(msg);
      setIsListening(false);
      onErrorRef.current?.(msg);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start speech recognition';
      setError(msg);
      onErrorRef.current?.(msg);
    }
  }, [lang, continuous]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { /* ignore */ }
    }
  }, []);

  const abort = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    start,
    stop,
    abort,
  };
}
