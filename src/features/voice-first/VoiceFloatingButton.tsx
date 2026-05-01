/**
 * VoiceFloatingButton — The always-visible FAB
 *
 * Microphone icon that expands into the voice panel.
 * Pulsing animation when listening.
 * Badge showing unrecognized commands.
 * Minimizable to just the mic icon.
 */

import { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, X, ChevronDown } from 'lucide-react';
import { useVoiceCommand, type VoiceState } from './useVoiceCommand';
import { VoiceWaveform } from './VoiceWaveform';
import type { VoiceCommandHistoryEntry } from './useVoiceCommand';

// ─── State → color mapping ────────────────────────────────────────

const STATE_COLORS: Record<VoiceState, { bg: string; border: string; icon: string; label: string }> = {
  idle:       { bg: 'rgba(0,212,255,0.15)', border: 'rgba(0,212,255,0.3)', icon: '#00D4FF', label: 'Tap to speak' },
  listening:  { bg: 'rgba(0,212,255,0.25)', border: 'rgba(0,212,255,0.5)', icon: '#00D4FF', label: 'Listening…' },
  processing: { bg: 'rgba(250,204,21,0.2)',  border: 'rgba(250,204,21,0.4)', icon: '#FACC15', label: 'Processing…' },
  confirming: { bg: 'rgba(192,132,252,0.2)', border: 'rgba(192,132,252,0.4)', icon: '#C084FC', label: 'Confirm?' },
  success:    { bg: 'rgba(16,185,129,0.2)',  border: 'rgba(16,185,129,0.4)', icon: '#10B981', label: 'Done!' },
  error:      { bg: 'rgba(239,68,68,0.2)',   border: 'rgba(239,68,68,0.4)',  icon: '#EF4444', label: 'Try again' },
};

// ─── Component ────────────────────────────────────────────────────

export function VoiceFloatingButton() {
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
  } = useVoiceCommand();

  const [expanded, setExpanded] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [unrecognizedCount, setUnrecognizedCount] = useState(0);

  // Track unrecognized commands for badge
  const lastHistoryLength = history.length;
  useEffect(() => {
    const latestEntry = history[history.length - 1];
    if (history.length > lastHistoryLength && latestEntry?.status === 'error') {
      setUnrecognizedCount(prev => prev + 1);
    }
  }, [history.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset badge when expanded
  useEffect(() => {
    if (expanded && unrecognizedCount > 0) {
      setUnrecognizedCount(0);
    }
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMicClick = useCallback(() => {
    if (!expanded) {
      setExpanded(true);
    }
    if (isListening) {
      const result = stopVoice();
    } else if (state === 'confirming') {
      // Don't restart if confirming
    } else {
      startVoice();
    }
  }, [expanded, isListening, state, startVoice, stopVoice]);

  const handleConfirm = useCallback(() => {
    confirmCommand();
  }, [confirmCommand]);

  const handleReject = useCallback(() => {
    rejectCommand();
  }, [rejectCommand]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;
    processText(textInput.trim());
    setTextInput('');
  }, [textInput, processText]);

  const handleMinimize = useCallback(() => {
    setExpanded(false);
    if (isListening) {
      cancelVoice();
    }
  }, [isListening, cancelVoice]);

  if (!isSupported) return null;

  const colors = STATE_COLORS[state] || STATE_COLORS.idle;
  const displayText = interimTranscript || transcript;

  return (
    <>
      {/* ── Expanded voice panel ── */}
      {expanded && (
        <div
          className="fixed inset-0 z-[9998] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={handleMinimize}
        >
          <div
            className="w-full max-w-md rounded-t-2xl overflow-hidden animate-slide-up"
            style={{
              background: '#0B1426',
              border: '1px solid rgba(30,58,91,0.4)',
              borderTop: `2px solid ${colors.border}`,
              maxHeight: '75vh',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center py-2" onClick={handleMinimize}>
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(30,58,91,0.6)' }} />
            </div>

            {/* Waveform visualization */}
            <div className="px-4 pb-2">
              <VoiceWaveform state={state} amplitude={amplitude} />
            </div>

            {/* Mic button */}
            <div className="flex justify-center py-3">
              <button
                onClick={handleMicClick}
                className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95"
                style={{
                  background: state === 'listening'
                    ? `radial-gradient(circle, ${colors.bg}, transparent)`
                    : colors.bg,
                  border: `2px solid ${colors.border}`,
                  boxShadow: state === 'listening' ? `0 0 30px ${colors.bg}, 0 0 60px ${colors.bg}` : 'none',
                  animation: state === 'listening' ? 'voicePulse 2s ease-in-out infinite' : undefined,
                }}
              >
                {state === 'listening' || state === 'processing' ? (
                  <Mic size={28} style={{ color: colors.icon }} className="animate-pulse" />
                ) : state === 'success' ? (
                  <span className="text-2xl">✓</span>
                ) : state === 'error' ? (
                  <span className="text-2xl">✗</span>
                ) : (
                  <Mic size={28} style={{ color: colors.icon }} />
                )}

                {/* Pulse ring when listening */}
                {state === 'listening' && (
                  <>
                    <div
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ border: `2px solid ${colors.border}`, opacity: 0.3 }}
                    />
                    <div
                      className="absolute -inset-2 rounded-full animate-pulse"
                      style={{ border: `1px solid ${colors.border}`, opacity: 0.15 }}
                    />
                  </>
                )}
              </button>
            </div>

            {/* Status text */}
            <div className="text-center px-4 pb-2">
              <p className="text-sm font-medium" style={{ color: colors.icon }}>
                {state === 'listening' ? (displayText || 'Listening…') : colors.label}
              </p>
              {error && (
                <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{error}</p>
              )}
            </div>

            {/* Intent preview / confirmation */}
            {currentResult && state === 'confirming' && (
              <div className="mx-4 mb-3 p-3 rounded-xl" style={{ background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: '#C084FC' }}>
                  Did you mean…
                </p>
                <p className="text-sm" style={{ color: '#E2E8F0' }}>
                  {currentResult.confirmation}
                </p>
                {currentResult.intent && (
                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded mt-1.5" style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF' }}>
                    {currentResult.intent}
                  </span>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)', color: '#070D1A' }}
                  >
                    ✓ Confirm
                  </button>
                  <button
                    onClick={handleReject}
                    className="flex-1 py-2 rounded-lg text-sm transition-colors"
                    style={{ background: 'rgba(30,58,91,0.4)', color: '#8BA4BE', border: '1px solid rgba(30,58,91,0.3)' }}
                  >
                    ✗ Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Success result */}
            {currentResult && state === 'success' && (
              <div className="mx-4 mb-3 p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <p className="text-sm" style={{ color: '#10B981' }}>
                  ✓ {currentResult.confirmation}
                </p>
              </div>
            )}

            {/* Text input fallback */}
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
                  placeholder="Or type a command…"
                  className="flex-1 text-sm rounded-lg px-3 py-2"
                  style={{
                    background: 'rgba(15,23,42,0.8)',
                    border: '1px solid rgba(30,58,91,0.4)',
                    color: '#E2E8F0',
                  }}
                />
                {textInput.trim() && (
                  <button
                    onClick={handleTextSubmit}
                    className="px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.3)' }}
                  >
                    Send
                  </button>
                )}
              </div>
            </div>

            {/* Minimize button */}
            <div className="flex justify-center pb-4">
              <button onClick={handleMinimize} className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                <ChevronDown size={14} />
                Minimize
              </button>
            </div>

            <style>{`
              @keyframes voicePulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
              }
              @keyframes slide-up {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
              .animate-slide-up {
                animation: slide-up 0.3s ease-out;
              }
            `}</style>
          </div>
        </div>
      )}

      {/* ── FAB (always visible) ── */}
      {!expanded && (
        <button
          onClick={handleMicClick}
          className="fixed bottom-20 right-4 z-[9999] w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95"
          style={{
            background: isListening
              ? 'linear-gradient(135deg, #00D4FF, #8B5CF6)'
              : state === 'success'
                ? 'linear-gradient(135deg, #10B981, #059669)'
                : state === 'error'
                  ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                  : 'linear-gradient(135deg, #00D4FF, #0074B8)',
            boxShadow: isListening
              ? '0 0 20px rgba(0,212,255,0.4), 0 4px 12px rgba(0,0,0,0.3)'
              : '0 4px 12px rgba(0,0,0,0.3)',
            animation: isListening ? 'voicePulse 2s ease-in-out infinite' : undefined,
          }}
          title="Voice command"
          aria-label="Open voice commands"
        >
          {isListening ? (
            <Mic size={24} className="text-white animate-pulse" />
          ) : (
            <Mic size={24} className="text-white" />
          )}

          {/* Badge for unrecognized */}
          {unrecognizedCount > 0 && (
            <div
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: '#EF4444' }}
            >
              {unrecognizedCount > 9 ? '9+' : unrecognizedCount}
            </div>
          )}

          {/* Pulse ring effect */}
          {isListening && (
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{ border: '2px solid rgba(0,212,255,0.4)' }}
            />
          )}

          <style>{`
            @keyframes voicePulse {
              0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(0,212,255,0.4), 0 4px 12px rgba(0,0,0,0.3); }
              50% { transform: scale(1.05); box-shadow: 0 0 30px rgba(0,212,255,0.6), 0 4px 12px rgba(0,0,0,0.3); }
            }
          `}</style>
        </button>
      )}
    </>
  );
}