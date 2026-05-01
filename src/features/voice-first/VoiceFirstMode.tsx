/**
 * VoiceFirstMode — Main page component for Voice-First Mode
 *
 * A full-screen voice interface with:
 * - Real-time waveform visualization
 * - Live transcript display
 * - Intent preview with confirmation
 * - "Did you mean?" ambiguity cards
 * - Quick action shortcuts
 * - Voice command history
 * - Settings panel
 *
 * Think driving between cleaning jobs and logging everything by voice.
 */

import { useState, useCallback } from 'react';
import { useVoiceCommand, type VoiceCommandResult, type VoiceState } from './useVoiceCommand';
import { VoiceWaveform } from './VoiceWaveform';
import { VoiceCommandHistory } from './VoiceCommandHistory';
import { VoiceQuickActions, type QuickAction } from './VoiceQuickActions';
import { VoiceSettings } from './VoiceSettings';
import { Mic, X, Settings, History, Zap, ChevronRight } from 'lucide-react';

// ─── Icons ────────────────────────────────────────────────────────

const VoiceIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
  </svg>
);

// ─── State → config ──────────────────────────────────────────────

const STATE_CONFIG: Record<VoiceState, {
  color: string; gradient: string; label: string; subtitle: string;
}> = {
  idle: {
    color: '#64748B',
    gradient: 'linear-gradient(135deg, rgba(100,116,139,0.2), rgba(30,58,91,0.2))',
    label: 'Ready',
    subtitle: 'Tap the mic or say a command',
  },
  listening: {
    color: '#00D4FF',
    gradient: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(139,92,246,0.1))',
    label: 'Listening',
    subtitle: 'Speak now…',
  },
  processing: {
    color: '#FACC15',
    gradient: 'linear-gradient(135deg, rgba(250,204,21,0.15), rgba(249,115,22,0.1))',
    label: 'Processing',
    subtitle: 'Understanding your command…',
  },
  confirming: {
    color: '#C084FC',
    gradient: 'linear-gradient(135deg, rgba(192,132,252,0.15), rgba(139,92,246,0.1))',
    label: 'Confirm',
    subtitle: 'Is this correct?',
  },
  success: {
    color: '#10B981',
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))',
    label: 'Done',
    subtitle: 'Command executed',
  },
  error: {
    color: '#EF4444',
    gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.1))',
    label: 'Error',
    subtitle: 'Something went wrong',
  },
};

type Tab = 'actions' | 'history' | 'settings';

// ─── Component ────────────────────────────────────────────────────

export function VoiceFirstMode() {
  const {
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
    startVoice,
    stopVoice,
    cancelVoice,
    confirmCommand,
    rejectCommand,
    processText,
    clearHistory,
    rerunCommand,
    setSettings,
    getAlternatives,
  } = useVoiceCommand();

  const [activeTab, setActiveTab] = useState<Tab>('actions');
  const [textInput, setTextInput] = useState('');
  const [alternatives, setAlternatives] = useState<VoiceCommandResult[]>([]);

  const config = STATE_CONFIG[state] || STATE_CONFIG.idle;
  const displayText = interimTranscript || transcript;

  // When a new result arrives, check for alternatives
  const handleConfirmClick = useCallback(() => {
    if (currentResult) {
      const alts = getAlternatives(currentResult);
      if (alts.length > 0 && state === 'confirming') {
        // Show alternatives alongside confirmation
        setAlternatives(alts);
      }
    }
    confirmCommand();
  }, [currentResult, confirmCommand, getAlternatives, state]);

  const handleRejectClick = useCallback(() => {
    // Check if there are alternatives to show
    if (currentResult) {
      const alts = getAlternatives(currentResult);
      if (alts.length > 0) {
        setAlternatives(alts);
        return;
      }
    }
    rejectCommand();
    setAlternatives([]);
  }, [currentResult, rejectCommand, getAlternatives]);

  const handleAlternativeSelect = useCallback((alt: VoiceCommandResult) => {
    // Use the alternative intent
    confirmCommand({ ...alt, action: currentResult?.action ?? null });
    setAlternatives([]);
  }, [confirmCommand, currentResult]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;
    processText(textInput.trim());
    setTextInput('');
  }, [textInput, processText]);

  const handleQuickAction = useCallback((text: string) => {
    processText(text);
  }, [processText]);

  const handleAddCustomAction = useCallback((action: QuickAction) => {
    // Store custom actions in localStorage
    try {
      const stored = localStorage.getItem('lifeos_custom_voice_actions');
      const actions: QuickAction[] = stored ? JSON.parse(stored) : [];
      actions.push(action);
      localStorage.setItem('lifeos_custom_voice_actions', JSON.stringify(actions));
    } catch { /* ignore */ }
  }, []);

  // Load custom actions
  const customActions: QuickAction[] = (() => {
    try {
      const stored = localStorage.getItem('lifeos_custom_voice_actions');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  })();

  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6" style={{ background: '#070D1A' }}>
        <div className="text-5xl mb-4">🔇</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: '#EF4444' }}>
          Voice Not Available
        </h2>
        <p className="text-sm text-center max-w-md" style={{ color: '#8BA4BE' }}>
          Speech recognition is not supported in this browser. Try Chrome or Edge for full voice features.
        </p>
        <p className="text-xs mt-3 text-center" style={{ color: '#475569' }}>
          You can still type commands using the text input below.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#070D1A', color: '#E2E8F0' }}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(30,58,91,0.4)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: config.gradient }}
          >
            <VoiceIcon />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: config.color }}>
              Voice Command
            </h1>
            <p className="text-xs" style={{ color: '#8BA4BE' }}>
              {config.subtitle}
            </p>
          </div>
        </div>

        {/* State indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: config.gradient, border: `1px solid ${config.color}30` }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: config.color,
              animation: state === 'listening' ? 'blink 1s ease-in-out infinite' : undefined,
            }}
          />
          <span className="text-xs font-medium" style={{ color: config.color }}>
            {config.label}
          </span>
        </div>
      </div>

      {/* ── Main content area ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {/* Waveform */}
        <div className="px-4 pt-4">
          <VoiceWaveform state={state} amplitude={amplitude} />
        </div>

        {/* Microphone button */}
        <div className="flex justify-center py-6">
          <button
            onClick={isListening ? stopVoice : startVoice}
            className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95"
            style={{
              background: state === 'listening'
                ? 'radial-gradient(circle, rgba(0,212,255,0.3), rgba(139,92,246,0.15))'
                : config.gradient,
              border: `2px solid ${config.color}60`,
              boxShadow: state === 'listening'
                ? `0 0 40px ${config.color}40, 0 0 80px ${config.color}20`
                : `0 0 15px ${config.color}20`,
            }}
          >
            {state === 'processing' ? (
              <div className="animate-spin text-2xl">⚙️</div>
            ) : state === 'success' ? (
              <span className="text-3xl">✓</span>
            ) : state === 'error' ? (
              <X size={32} style={{ color: config.color }} />
            ) : (
              <Mic size={32} style={{ color: config.color }} />
            )}

            {/* Pulse rings */}
            {state === 'listening' && (
              <>
                <div
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ border: `2px solid ${config.color}40` }}
                />
                <div
                  className="absolute -inset-3 rounded-full animate-pulse"
                  style={{ border: `1px solid ${config.color}15` }}
                />
              </>
            )}
          </button>
        </div>

        {/* Live transcript */}
        {(displayText || state === 'listening') && (
          <div className="px-4 pb-4">
            <div
              className="p-4 rounded-xl text-center min-h-[3rem]"
              style={{
                background: 'rgba(15,23,42,0.5)',
                border: `1px solid ${config.color}20`,
              }}
            >
              {displayText ? (
                <p className="text-base" style={{ color: '#E2E8F0' }}>
                  {displayText}
                </p>
              ) : (
                <p className="text-sm animate-pulse" style={{ color: '#64748B' }}>
                  Listening…
                </p>
              )}
            </div>
          </div>
        )}

        {/* Intent preview / Confirmation */}
        {currentResult && (state === 'confirming' || alternatives.length > 0) && (
          <div className="px-4 pb-4 space-y-2">
            {/* Main intent card */}
            <div
              className="p-4 rounded-xl"
              style={{
                background: 'rgba(192,132,252,0.08)',
                border: '1px solid rgba(192,132,252,0.2)',
                borderLeft: '3px solid #C084FC',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} style={{ color: '#C084FC' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C084FC' }}>
                  {currentResult.intent || 'Command'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF' }}>
                  {Math.round(currentResult.confidence * 100)}% confidence
                </span>
              </div>
              <p className="text-sm font-medium" style={{ color: '#E2E8F0' }}>
                {currentResult.confirmation}
              </p>
              {Object.keys(currentResult.entities).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(currentResult.entities).map(([key, value]) => (
                    value != null && (
                      <span key={key} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(15,23,42,0.5)', color: '#8BA4BE' }}>
                        {key}: {String(value)}
                      </span>
                    )
                  ))}
                </div>
              )}

              {/* Confirm / Reject buttons */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleConfirmClick}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)', color: '#070D1A' }}
                >
                  ✓ Confirm
                </button>
                <button
                  onClick={handleRejectClick}
                  className="flex-1 py-2.5 rounded-lg text-sm transition-all duration-200"
                  style={{ background: 'rgba(30,58,91,0.4)', color: '#8BA4BE', border: '1px solid rgba(30,58,91,0.3)' }}
                >
                  {alternatives.length > 0 ? 'Show alternatives' : '✗ Cancel'}
                </button>
              </div>
            </div>

            {/* Alternative interpretations */}
            {alternatives.map((alt, i) => (
              <button
                key={i}
                onClick={() => handleAlternativeSelect(alt)}
                className="w-full text-left p-3 rounded-xl transition-all duration-200 hover:brightness-110"
                style={{
                  background: 'rgba(15,23,42,0.5)',
                  border: '1px solid rgba(30,58,91,0.3)',
                }}
              >
                <div className="flex items-center gap-2">
                  <ChevronRight size={14} style={{ color: '#64748B' }} />
                  <span className="text-xs font-medium" style={{ color: '#FACC15' }}>
                    Did you mean…
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded ml-auto" style={{ background: 'rgba(250,204,21,0.1)', color: '#FACC15' }}>
                    {alt.intent}
                  </span>
                </div>
                <p className="text-sm mt-1" style={{ color: '#8BA4BE' }}>
                  {alt.confirmation}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Success message */}
        {currentResult && state === 'success' && (
          <div className="px-4 pb-4">
            <div
              className="p-4 rounded-xl text-center"
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
              }}
            >
              <span className="text-2xl">✅</span>
              <p className="text-sm mt-1 font-medium" style={{ color: '#10B981' }}>
                {currentResult.confirmation}
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="px-4 pb-4">
            <div
              className="p-4 rounded-xl text-center"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>
            </div>
          </div>
        )}

        {/* Text input fallback */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
              placeholder="Type a command…"
              className="flex-1 text-sm rounded-lg px-3 py-2.5"
              style={{
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(30,58,91,0.4)',
                color: '#E2E8F0',
              }}
            />
            {textInput.trim() && (
              <button
                onClick={handleTextSubmit}
                className="px-4 py-2.5 rounded-lg text-sm font-medium"
                style={{
                  background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)',
                  color: '#070D1A',
                }}
              >
                Send
              </button>
            )}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'actions' && (
          <VoiceQuickActions
            onTrigger={handleQuickAction}
            onSpeak={() => {}}
            customActions={customActions}
            onAddCustom={handleAddCustomAction}
          />
        )}

        {activeTab === 'history' && (
          <div className="flex-1" style={{ minHeight: '300px' }}>
            <VoiceCommandHistory
              history={history}
              onRerun={rerunCommand}
              onClear={clearHistory}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <VoiceSettings settings={settings} onChange={setSettings} />
        )}
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1 px-4 py-2"
        style={{ borderTop: '1px solid rgba(30,58,91,0.4)', background: 'rgba(7,13,26,0.9)' }}
      >
        {([
          { id: 'actions' as Tab, label: 'Actions', icon: <Zap size={14} /> },
          { id: 'history' as Tab, label: 'History', icon: <History size={14} /> },
          { id: 'settings' as Tab, label: 'Settings', icon: <Settings size={14} /> },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: activeTab === tab.id ? 'rgba(0,212,255,0.1)' : 'transparent',
              color: activeTab === tab.id ? '#00D4FF' : '#8BA4BE',
              border: `1px solid ${activeTab === tab.id ? 'rgba(0,212,255,0.2)' : 'transparent'}`,
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default VoiceFirstMode;