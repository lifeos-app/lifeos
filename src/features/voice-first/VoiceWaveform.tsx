/**
 * VoiceWaveform — Animated waveform visualization
 *
 * Dynamic bars that respond to audio amplitude.
 * Color transitions: idle=gray, listening=blue, processing=yellow, success=green, error=red.
 * Pulse animation when actively listening.
 */

import { useMemo } from 'react';
import type { VoiceState } from './useVoiceCommand';

// ─── Color map ───────────────────────────────────────────────────

const STATE_COLORS: Record<VoiceState, { primary: string; glow: string; bg: string }> = {
  idle:       { primary: '#64748B', glow: 'rgba(100,116,139,0.2)', bg: 'rgba(100,116,139,0.05)' },
  listening:  { primary: '#00D4FF', glow: 'rgba(0,212,255,0.3)',   bg: 'rgba(0,212,255,0.08)' },
  processing: { primary: '#FACC15', glow: 'rgba(250,204,21,0.3)',  bg: 'rgba(250,204,21,0.08)' },
  confirming: { primary: '#C084FC', glow: 'rgba(192,132,252,0.3)',  bg: 'rgba(192,132,252,0.08)' },
  success:    { primary: '#10B981', glow: 'rgba(16,185,129,0.3)',   bg: 'rgba(16,185,129,0.08)' },
  error:      { primary: '#EF4444', glow: 'rgba(239,68,68,0.3)',   bg: 'rgba(239,68,68,0.08)' },
};

const BAR_COUNT = 28;

// ─── Component ────────────────────────────────────────────────────

interface VoiceWaveformProps {
  state: VoiceState;
  amplitude: number;       // 0–1
  barCount?: number;
  className?: string;
  compact?: boolean;       // shorter height for inline use
}

export function VoiceWaveform({
  state,
  amplitude,
  barCount = BAR_COUNT,
  className = '',
  compact = false,
}: VoiceWaveformProps) {
  const colors = STATE_COLORS[state] || STATE_COLORS.idle;
  const isListening = state === 'listening';

  // Generate bar heights: center bars taller, edges shorter
  const bars = useMemo(() => {
    const result: number[] = [];
    for (let i = 0; i < barCount; i++) {
      // Bell curve: center bars have higher base
      const center = barCount / 2;
      const distFromCenter = Math.abs(i - center) / center;
      const baseHeight = 0.15 + (1 - distFromCenter * 0.6);
      result.push(baseHeight);
    }
    return result;
  }, [barCount]);

  const height = compact ? 24 : 40;
  const maxHeight = compact ? 20 : 36;
  const minHeight = compact ? 2 : 3;

  return (
    <div
      className={`relative flex items-end justify-center gap-[2px] ${className}`}
      style={{
        height,
        padding: compact ? '2px 0' : '4px 0',
        background: colors.bg,
        borderRadius: compact ? 6 : 12,
        transition: 'background 0.5s ease',
      }}
    >
      {/* Glow effect behind bars when listening */}
      {isListening && (
        <div
          className="absolute inset-0 rounded-xl animate-pulse"
          style={{
            background: `radial-gradient(ellipse at center, ${colors.glow} 0%, transparent 70%)`,
            animation: 'voiceGlow 1.5s ease-in-out infinite',
          }}
        />
      )}

      {bars.map((baseHeight, i) => {
        // Apply amplitude — more to center bars
        const center = barCount / 2;
        const distFromCenter = Math.abs(i - center) / center;
        const amplitudeMultiplier = isListening
          ? amplitude * (0.5 + (1 - distFromCenter) * 0.8)
          : 0;
        const h = Math.max(
          minHeight,
          Math.min(maxHeight, baseHeight * minHeight + amplitudeMultiplier * maxHeight)
        );

        return (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: compact ? 2 : 3,
              height: h,
              background: isListening
                ? `linear-gradient(to top, ${colors.primary}, ${colors.primary}dd)`
                : state === 'success'
                  ? `linear-gradient(to top, ${colors.primary}, ${colors.primary}cc)`
                  : state === 'error'
                    ? `linear-gradient(to top, ${colors.primary}, ${colors.primary}cc)`
                    : colors.primary,
              opacity: isListening ? 0.5 + amplitude * 0.5 : 0.4 + (1 - distFromCenter) * 0.3,
              transition: isListening
                ? 'height 0.08s ease-out, opacity 0.08s ease-out'
                : 'height 0.5s ease, opacity 0.5s ease, background 0.5s ease',
              animation: isListening ? `voiceBarPulse ${0.8 + (i % 5) * 0.1}s ease-in-out infinite` : undefined,
              animationDelay: isListening ? `${(i * 0.02)}s` : undefined,
            }}
          />
        );
      })}

      <style>{`
        @keyframes voiceGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes voiceBarPulse {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.15); }
        }
      `}</style>
    </div>
  );
}