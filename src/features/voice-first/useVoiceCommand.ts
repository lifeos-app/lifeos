/**
 * useVoiceCommand — Core hook for Voice-First Mode
 *
 * Manages speech recognition (Web Speech API with offline fallback),
 * feeds transcripts to the Intent Engine for parsing, and returns
 * structured VoiceCommandResults with actions the UI can execute.
 *
 * Think driving between cleaning jobs and logging everything by voice.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import {
  callIntentEngine,
  executeActions,
  loadIntentContext,
  parseShorthand,
  getAISettings,
  type IntentContext,
  type IntentResult,
} from '../../lib/intent-engine';
import { useUserStore } from '../../stores/useUserStore';

// ─── Types ───────────────────────────────────────────────────────

export type VoiceState = 'idle' | 'listening' | 'processing' | 'confirming' | 'success' | 'error';

export interface VoiceCommandResult {
  transcript: string;
  confidence: number;
  intent: string | null;
  entities: Record<string, unknown>;
  action: (() => Promise<void>) | null;
  confirmation: string;
}

export interface VoiceCommandHistoryEntry {
  id: string;
  timestamp: number;
  transcript: string;
  intent: string | null;
  entities: Record<string, unknown>;
  confirmation: string;
  status: 'success' | 'error' | 'pending';
  actionDescription: string;
}

export interface VoiceSettings {
  language: string;
  autoConfirm: boolean;
  autoConfirmThreshold: number;
  alwaysOn: boolean;
  noiseThreshold: number;
  voiceSpeed: number;
  wakeWord: string;
  offlineSupport: boolean;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  language: 'en-AU',
  autoConfirm: false,
  autoConfirmThreshold: 0.85,
  alwaysOn: false,
  noiseThreshold: 0.3,
  voiceSpeed: 1.0,
  wakeWord: '',
  offlineSupport: true,
};

// ─── Voice Command Patterns (offline fallback) ───────────────────

const VOICE_COMMAND_PATTERNS: {
  pattern: RegExp;
  intent: string;
  entityExtractor: (match: RegExpMatchArray) => Record<string, unknown>;
  confirmation: (entities: Record<string, unknown>) => string;
}[] = [
  {
    pattern: /^log\s+(\d+\.?\d*)\s*hours?\s+(?:of\s+)?work(?:\s+at\s+(.+?))?(?:,|\s+mood\s+(?:is\s+)?(\w+))?(?:,|\s+energy\s+(\d+))?$/i,
    intent: 'log_work',
    entityExtractor: (m) => ({ hours: parseFloat(m[1]), location: m[2] || null, mood: m[3] || null, energy: m[4] ? parseInt(m[4]) : null }),
    confirmation: (e) => `Log ${e.hours}h work${e.location ? ` at ${e.location}` : ''}${e.mood ? `, mood: ${e.mood}` : ''}${e.energy ? `, energy: ${e.energy}` : ''}?`,
  },
  {
    pattern: /^log\s+(?:a\s+)?(\w+)\s+(?:for\s+)?(?:today|this\s+morning|this\s+evening)?\s*$/i,
    intent: 'log_habit',
    entityExtractor: (m) => ({ habit: m[1] }),
    confirmation: (e) => `Log habit: "${e.habit}"?`,
  },
  {
    pattern: /^log\s+(?:expense|spent?)\s+\$?(\d+(?:\.\d{1,2})?)\s+(?:on\s+|for\s+)?(.+)$/i,
    intent: 'log_expense',
    entityExtractor: (m) => ({ amount: parseFloat(m[1]), description: m[2] }),
    confirmation: (e) => `Log expense: $${e.amount} on ${e.description}?`,
  },
  {
    pattern: /^log\s+(?:income|earned?)\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:from\s+(.+))?$/i,
    intent: 'log_income',
    entityExtractor: (m) => ({ amount: parseFloat(m[1]), source: m[2] || null }),
    confirmation: (e) => `Log income: $${e.amount}${e.source ? ` from ${e.source}` : ''}?`,
  },
  {
    pattern: /^mood\s+(?:is\s+)?(\w+)(?:,?\s*energy\s+(\d+))?/i,
    intent: 'log_mood',
    entityExtractor: (m) => ({ mood: m[1], energy: m[2] ? parseInt(m[2]) : null }),
    confirmation: (e) => `Log mood: ${e.mood}${e.energy ? `, energy: ${e.energy}` : ''}?`,
  },
  {
    pattern: /^log\s+(?:health|check(?:in|-in)?)\s+(.+)/i,
    intent: 'log_health',
    entityExtractor: (m) => ({ details: m[1] }),
    confirmation: (e) => `Log health: ${e.details}?`,
  },
  {
    pattern: /^log\s+(?:workout|exercise|gym)\s+(.+)/i,
    intent: 'log_workout',
    entityExtractor: (m) => ({ workout: m[1] }),
    confirmation: (e) => `Log workout: ${e.workout}?`,
  },
  {
    pattern: /^log\s+(?:meal|food|ate?)\s+(.+)/i,
    intent: 'log_meal',
    entityExtractor: (m) => ({ meal: m[1] }),
    confirmation: (e) => `Log meal: ${e.meal}?`,
  },
  {
    pattern: /^log\s+(?:sleep|slept?)\s+(\d+(?:\.\d+)?)\s*hours?/i,
    intent: 'log_sleep',
    entityExtractor: (m) => ({ hours: parseFloat(m[1]) }),
    confirmation: (e) => `Log sleep: ${e.hours}h?`,
  },
  {
    pattern: /^log\s+(?:journal|entry|note)\s+(.+)/i,
    intent: 'log_journal',
    entityExtractor: (m) => ({ content: m[1] }),
    confirmation: (e) => `Log journal entry: "${(e.content as string).slice(0, 50)}..."?`,
  },
  {
    pattern: /^show\s+(dashboard|schedule|goals|habits|finances|health)/i,
    intent: 'show_view',
    entityExtractor: (m) => ({ view: m[1].toLowerCase() }),
    confirmation: (e) => `Navigate to ${e.view}?`,
  },
  {
    pattern: /^(?:what'?s?\s+(?:is\s+)?(?:my\s+)?)?(streak|balance|progress|schedule|mood)/i,
    intent: 'query_status',
    entityExtractor: (m) => ({ query: m[1].toLowerCase() }),
    confirmation: (e) => `Show your ${e.query}?`,
  },
  {
    pattern: /^start\s+(focus\s+block|activity|timer)\s*(?:(?:for\s+|lasting?\s+)?(\d+)\s*min(?:utes?)?)?/i,
    intent: 'start_activity',
    entityExtractor: (m) => ({ activity: m[1].toLowerCase(), duration: m[2] ? parseInt(m[2]) : null }),
    confirmation: (e) => `Start ${e.activity}${e.duration ? ` for ${e.duration} min` : ''}?`,
  },
  {
    pattern: /^set\s+(?:a\s+)?reminder\s+(?:for\s+)?(.+)/i,
    intent: 'set_reminder',
    entityExtractor: (m) => ({ reminder: m[1] }),
    confirmation: (e) => `Set reminder: "${e.reminder}"?`,
  },
  // Catch-all "log" pattern for freeform
  {
    pattern: /^log\s+(.+)/i,
    intent: 'log_generic',
    entityExtractor: (m) => ({ content: m[1] }),
    confirmation: (e) => `Log: "${e.content}"?`,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────

function generateId(): string {
  return `vc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadSettings(): VoiceSettings {
  try {
    const stored = localStorage.getItem('lifeos_voice_settings');
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem('lifeos_voice_settings', JSON.stringify(settings));
  } catch { /* ignore */ }
}

// ─── The Hook ────────────────────────────────────────────────────

export function useVoiceCommand() {
  const user = useUserStore(s => s.user);
  const [settings, setSettingsState] = useState<VoiceSettings>(loadSettings);
  const [state, setState] = useState<VoiceState>('idle');
  const [currentResult, setCurrentResult] = useState<VoiceCommandResult | null>(null);
  const [history, setHistory] = useState<VoiceCommandHistoryEntry[]>(() => {
    try {
      const stored = localStorage.getItem('lifeos_voice_history');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return [];
  });
  const [error, setError] = useState<string | null>(null);
  const [amplitude, setAmplitude] = useState(0);

  const contextRef = useRef<IntentContext | null>(null);
  const historyRef = useRef(history);
  historyRef.current = history;

  const setSettings = useCallback((updater: Partial<VoiceSettings> | ((prev: VoiceSettings) => VoiceSettings)) => {
    setSettingsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      saveSettings(next);
      return next;
    });
  }, []);

  // ── Load intent context ────────────────────────────────────────
  useEffect(() => {
    if (user?.id && !contextRef.current) {
      loadIntentContext(user.id).then(ctx => {
        contextRef.current = ctx;
      }).catch(() => { /* retry on demand */ });
    }
  }, [user?.id]);

  // ── Persist history to localStorage ────────────────────────────
  useEffect(() => {
    try {
      // Keep last 100 entries
      const trimmed = history.slice(-100);
      localStorage.setItem('lifeos_voice_history', JSON.stringify(trimmed));
    } catch { /* ignore */ }
  }, [history]);

  // ── Speech recognition ─────────────────────────────────────────
  const handleFinalTranscript = useCallback((transcript: string) => {
    // Will be processed in processCommand
  }, []);

  const handleError = useCallback((err: string) => {
    setState('error');
    setError(err);
    // Auto-clear error after 5s
    setTimeout(() => {
      setError(prev => prev === err ? null : prev);
      setState(prev => prev === 'error' ? 'idle' : prev);
    }, 5000);
  }, []);

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    start: startListening,
    stop: stopListening,
    abort: abortListening,
  } = useSpeechRecognition({
    lang: settings.language,
    continuous: true,
    onFinalTranscript: handleFinalTranscript,
    onError: handleError,
  });

  // ── Offline parsing (fast, no LLM) ─────────────────────────────
  const parseOffline = useCallback((text: string): VoiceCommandResult | null => {
    const trimmed = text.trim();
    for (const cmd of VOICE_COMMAND_PATTERNS) {
      const match = trimmed.match(cmd.pattern);
      if (match) {
        const entities = cmd.entityExtractor(match);
        return {
          transcript: trimmed,
          confidence: 0.7, // Offline is less confident
          intent: cmd.intent,
          entities,
          action: null, // Will be populated by engine parse
          confirmation: cmd.confirmation(entities),
        };
      }
    }
    return null;
  }, []);

  // ── Process transcript through Intent Engine ────────────────────
  const processCommand = useCallback(async (text: string): Promise<VoiceCommandResult | null> => {
    if (!text.trim()) return null;

    setState('processing');
    setError(null);

    try {
      // Try offline parse first for speed
      let result: VoiceCommandResult | null = null;
      const offlineResult = settings.offlineSupport ? parseOffline(text) : null;

      // Try shorthand parser (no LLM, fast)
      if (!user?.id) {
        setError('Not authenticated');
        setState('error');
        return null;
      }

      // Load context if needed
      if (!contextRef.current) {
        contextRef.current = await loadIntentContext(user.id);
      }

      const shorthandResult = parseShorthand(text, contextRef.current);
      if (shorthandResult) {
        // Shorthand matched — high confidence
        const actions = shorthandResult.actions;
        result = {
          transcript: text,
          confidence: 0.9,
          intent: actions[0]?.type || 'shorthand',
          entities: actions[0]?.data || {},
          action: async () => {
            const execResult = await executeActions(actions);
            window.dispatchEvent(new Event('lifeos-refresh'));
            if (execResult.failures.length > 0) {
              throw new Error(execResult.failures[0]);
            }
          },
          confirmation: shorthandResult.reply || (actions[0]?.summary ?? 'Confirm action?'),
        };
      } else {
        // Full Intent Engine call (LLM)
        const aiSettings = getAISettings();
        const intentResult: IntentResult = await callIntentEngine(
          text,
          contextRef.current,
          [],
          { provider: aiSettings.provider, model: aiSettings.model, proxyUrl: aiSettings.proxyUrl },
        );

        const dbActions = intentResult.actions.filter(a => !['navigate', 'info'].includes(a.type));
        const primaryAction = dbActions[0];

        result = {
          transcript: text,
          confidence: primaryAction?.confidence ?? 0.6,
          intent: primaryAction?.type ?? intentResult.reply ? 'info' : null,
          entities: primaryAction?.data ?? {},
          action: dbActions.length > 0 ? async () => {
            const execResult = await executeActions(dbActions);
            window.dispatchEvent(new Event('lifeos-refresh'));
            if (execResult.failures.length > 0) {
              throw new Error(execResult.failures[0]);
            }
          } : null,
          confirmation: intentResult.reply || 'Confirm?',
        };

        // If needs confirmation, show it
        if (intentResult.needs_confirmation) {
          result.confirmation = intentResult.reply || 'This action needs confirmation. Proceed?';
        }
      }

      // If offline result exists and engine didn't provide action, use offline confirmation
      if (offlineResult && !result?.action) {
        result = {
          ...offlineResult,
          confirmation: result?.confirmation ?? offlineResult.confirmation,
          intent: result?.intent ?? offlineResult.intent,
          entities: result?.entities ?? offlineResult.entities,
          confidence: Math.max(result?.confidence ?? 0, offlineResult.confidence),
        };
      }

      setCurrentResult(result);

      // Auto-confirm if enabled and confidence high enough
      if (settings.autoConfirm && result && result.confidence >= settings.autoConfirmThreshold && result.action) {
        await confirmCommand(result);
        return result;
      }

      setState(result ? 'confirming' : 'idle');
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to process command';
      setError(msg);
      setState('error');

      // Add to history as failed
      addToHistory({
        transcript: text,
        intent: null,
        entities: {},
        confirmation: msg,
        status: 'error',
        actionDescription: msg,
      });

      setTimeout(() => setState('idle'), 5000);
      return null;
    }
  }, [user?.id, settings.autoConfirm, settings.autoConfirmThreshold, settings.offlineSupport, parseOffline]);

  // ── Confirm & execute a parsed command ──────────────────────────
  const confirmCommand = useCallback(async (result?: VoiceCommandResult) => {
    const cmd = result || currentResult;
    if (!cmd) return;

    setState('processing');
    try {
      if (cmd.action) {
        await cmd.action();
      }

      addToHistory({
        transcript: cmd.transcript,
        intent: cmd.intent,
        entities: cmd.entities,
        confirmation: cmd.confirmation,
        status: 'success',
        actionDescription: cmd.confirmation,
      });

      setState('success');
      // Speak confirmation if TTS available
      speakConfirmation(cmd.confirmation);

      setTimeout(() => {
        setState('idle');
        setCurrentResult(null);
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
      setState('error');

      addToHistory({
        transcript: cmd.transcript,
        intent: cmd.intent,
        entities: cmd.entities,
        confirmation: msg,
        status: 'error',
        actionDescription: msg,
      });

      setTimeout(() => {
        setState('idle');
        setCurrentResult(null);
      }, 3000);
    }
  }, [currentResult]);

  // ── Reject a command ───────────────────────────────────────────
  const rejectCommand = useCallback(() => {
    if (currentResult) {
      addToHistory({
        transcript: currentResult.transcript,
        intent: currentResult.intent,
        entities: currentResult.entities,
        confirmation: currentResult.confirmation,
        status: 'error',
        actionDescription: 'Cancelled',
      });
    }
    setState('idle');
    setCurrentResult(null);
  }, [currentResult]);

  // ── Start / Stop helpers ────────────────────────────────────────
  const startVoice = useCallback(() => {
    setError(null);
    setCurrentResult(null);
    startListening();
    setState('listening');
  }, [startListening]);

  const stopVoice = useCallback(() => {
    stopListening();
    // Process whatever we have
    const text = transcript || interimTranscript;
    if (text.trim()) {
      return processCommand(text.trim());
    }
    setState('idle');
    return null;
  }, [stopListening, transcript, interimTranscript, processCommand]);

  const cancelVoice = useCallback(() => {
    abortListening();
    setState('idle');
    setCurrentResult(null);
  }, [abortListening]);

  // ── Text Input (for manual entry or testing) ──────────────────
  const processText = useCallback((text: string) => {
    return processCommand(text.trim());
  }, [processCommand]);

  // ── TTS Confirmation ────────────────────────────────────────────
  const speakConfirmation = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.voiceSpeed;
    utterance.lang = settings.language;
    window.speechSynthesis.speak(utterance);
  }, [settings.voiceSpeed, settings.language]);

  // ── Amplitude simulation ───────────────────────────────────────
  // Use a simple amplitude estimate based on listening state
  useEffect(() => {
    if (!isListening) {
      setAmplitude(0);
      return;
    }
    // Simulate amplitude changes while listening
    const interval = setInterval(() => {
      setAmplitude(0.2 + Math.random() * 0.6);
    }, 100);
    return () => clearInterval(interval);
  }, [isListening]);

  // ── History management ──────────────────────────────────────────
  const addToHistory = useCallback((entry: Omit<VoiceCommandHistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: VoiceCommandHistoryEntry = {
      ...entry,
      id: generateId(),
      timestamp: Date.now(),
    };
    setHistory(prev => [...prev, newEntry]);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try { localStorage.removeItem('lifeos_voice_history'); } catch { /* ignore */ }
  }, []);

  const rerunCommand = useCallback((entry: VoiceCommandHistoryEntry) => {
    return processCommand(entry.transcript);
  }, [processCommand]);

  // ── Ambiguity detection ────────────────────────────────────────
  const getAlternatives = useCallback((result: VoiceCommandResult): VoiceCommandResult[] => {
    if (!result.transcript) return [];
    const alternatives: VoiceCommandResult[] = [];
    // Try to find other pattern matches for the same transcript
    for (const cmd of VOICE_COMMAND_PATTERNS) {
      const match = result.transcript.match(cmd.pattern);
      if (match && cmd.intent !== result.intent) {
        const entities = cmd.entityExtractor(match);
        alternatives.push({
          transcript: result.transcript,
          confidence: 0.5,
          intent: cmd.intent,
          entities,
          action: null,
          confirmation: cmd.confirmation(entities),
        });
      }
    }
    return alternatives;
  }, []);

  return {
    // State
    state,
    error,
    currentResult,
    history,
    settings,
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    amplitude,

    // Actions
    startVoice,
    stopVoice,
    cancelVoice,
    processText,
    confirmCommand,
    rejectCommand,
    rerunCommand,
    clearHistory,
    setSettings,
    getAlternatives,
    speakConfirmation,
  };
}

export type UseVoiceCommandReturn = ReturnType<typeof useVoiceCommand>;