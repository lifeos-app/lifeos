/**
 * QuickLogMood — 1-tap mood logging on a 1-5 scale.
 * Instant save via HealthService.logMood(). No form, just tap and done.
 * Closes automatically after selection for zero-friction UX.
 *
 * Includes Polarity transmutation card when mood is at extreme (1 or 5),
 * offering Hermetic guidance to transmute the polarized state.
 */

import { useEffect, useMemo } from 'react';
import { SmilePlus } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import { useHealthStore } from '../../../stores/useHealthStore';
import { HealthService } from '../../../lib/services/health-service';
import { HermeticPrincipleOverlay } from '../../shared/HermeticPrincipleOverlay';
import { showToast } from '../../Toast';
import { detectPolarityState, isExtremeValue } from '../../../lib/hermetic-polarity';
import type { PolarityState } from '../../../lib/hermetic-polarity';
import { type PrincipleInsight } from '../../../lib/hermetic-principle-insight';
import { SEVEN_PRINCIPLES } from '../../../lib/hermetic-integration';

interface Props {
  open: boolean;
  onClose: () => void;
}

const MOODS = [
  { value: 1, emoji: '😫', label: 'Awful', color: '#F43F5E' },
  { value: 2, emoji: '😕', label: 'Low', color: '#F97316' },
  { value: 3, emoji: '😐', label: 'Okay', color: '#FACC15' },
  { value: 4, emoji: '🙂', label: 'Good', color: '#00D4FF' },
  { value: 5, emoji: '😄', label: 'Great', color: '#39FF14' },
];

export function QuickLogMood({ open, onClose }: Props) {
  const todayMetrics = useHealthStore(s => s.todayMetrics);
  const currentMood = todayMetrics?.mood_score ?? null;

  useEffect(() => {
    // Auto-close is NOT done here — user might want to change
    // The tap handler below auto-closes after save
  }, [open]);

  // Detect polarity state for mood
  const polarityState: PolarityState | null = useMemo(() => {
    if (currentMood === null) return null;
    if (!isExtremeValue(currentMood)) return null;

    // Build recent mood values for detection
    // Start with current mood, then use today's data as context
    const recentValues = [currentMood];

    // Try to get recent mood data from store metrics
    // If the store has historical mood data, we could expand this
    // For now, use the single value with a day count of 1
    // The detectPolarityState function handles threshold logic
    const result = detectPolarityState('mood', recentValues);

    return result;
  }, [currentMood]);

  // Build a polarity-based PrincipleInsight from the current mood
  const moodInsight = useMemo<PrincipleInsight | null>(() => {
    const polarity = SEVEN_PRINCIPLES[3]; // POLARITY
    if (currentMood === null) return null;
    const isLow = currentMood <= 2;
    const isHigh = currentMood >= 4;
    const wisdomText = isLow
      ? `The Law of Polarity reveals: your current state is one pole of a spectrum. "Awful" and "Great" are the same force at different degrees. The pendulum that swings to "Low" must swing back — this is not hope, it is Law.`
      : isHigh
        ? `You are at the positive pole — this too is Polarity. The wise one does not cling to the peak but uses its energy to build momentum for the inevitable swing.`
        : `Balance is the midpoint of the pendulum — brief, but full of potential. Polarity teaches that from center, you can choose which pole to approach.`;
    return {
      principle: polarity,
      source: 'polarity',
      title: isLow ? 'The Pendulum Will Rise' : isHigh ? 'Riding the Positive Pole' : 'The Space Between Poles',
      wisdom: wisdomText,
      practice: isLow
        ? `Accept where you are. Then take one small action toward the opposite pole — a walk, a breath, a kind word.`
        : isHigh
          ? `Channel this positive energy into one task that matters. Invest the peak.`
          : `From center, choose your next direction with intention. One conscious action pushes the pendulum.`,
      miracle: `The miracle of Polarity: when you understand that your worst and best days are the same energy at different degrees, fear of the low pole dissolves. The pendulum swings — but the wise one learns to choose the swing.`,
      color: polarity.color,
      confidence: isLow || isHigh ? 0.85 : 0.6,
      data: { moodScore: currentMood },
    };
  }, [currentMood]);

  const handleMoodTap = async (value: number) => {
    try {
      await HealthService.logMood(value);
      const mood = MOODS.find(m => m.value === value);
      showToast(`Mood: ${mood?.emoji} ${mood?.label}`, '', mood?.color ?? '#00D4FF');
      onClose(); // Auto-close on tap — zero friction
    } catch {
      showToast('Failed to log mood', '', '#F43F5E');
    }
  };

  // Determine pole label for display
  const poleLabel = polarityState?.currentPole === 'negative' ? 'Low Pole' : 'High Pole';

  return (
    <BottomSheet open={open} onClose={onClose} title="How are you feeling?" icon={<SmilePlus size={18} />}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 12,
        padding: '8px 0 16px',
      }}>
        {MOODS.map(m => {
          const isSelected = currentMood === m.value;
          return (
            <button
              key={m.value}
              onClick={() => handleMoodTap(m.value)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '10px 8px 6px',
                background: isSelected ? `${m.color}20` : 'rgba(255,255,255,0.04)',
                border: isSelected ? `2px solid ${m.color}` : '2px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                minWidth: 52,
              }}
              title={m.label}
            >
              <span style={{ fontSize: 28, lineHeight: 1 }}>{m.emoji}</span>
              <span style={{
                fontSize: 9,
                fontWeight: isSelected ? 700 : 500,
                color: isSelected ? m.color : '#8BA4BE',
                letterSpacing: '0.3px',
              }}>
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Current mood indicator */}
      {currentMood !== null && (
        <div style={{
          textAlign: 'center',
          fontSize: 10,
          color: '#5A7A9A',
          marginBottom: 4,
        }}>
          Current: {MOODS.find(m => m.value === currentMood)?.emoji} {MOODS.find(m => m.value === currentMood)?.label}
        </div>
      )}

      {/* Polarity transmutation card — shown when mood is extreme */}
      {polarityState && isExtremeValue(currentMood ?? 0) && (
        <div style={{
          margin: '8px 0 4px',
          padding: '10px 12px',
          borderRadius: 10,
          background: 'linear-gradient(135deg, #FACC15 0%, #F97316 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Subtle radial overlay for depth */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: '#1a1a2e',
              marginBottom: 4,
            }}>
              Polarity — {poleLabel}
            </div>
            <div style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 11,
              fontWeight: 400,
              lineHeight: 1.5,
              color: '#1a1a2e',
              opacity: 0.85,
            }}>
              {polarityState.transmutationHint || 'The pendulum holds both poles within you. Transmutation begins with awareness.'}
            </div>
          </div>
        </div>
      )}

      {/* Hermetic principle — Polarity governs mood */}
      <HermeticPrincipleOverlay insight={moodInsight} />
    </BottomSheet>
  );
}