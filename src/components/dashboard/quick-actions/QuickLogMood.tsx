/**
 * QuickLogMood — 1-tap mood logging on a 1-5 scale.
 * Instant save via HealthService.logMood(). No form, just tap and done.
 * Closes automatically after selection for zero-friction UX.
 */

import { useEffect } from 'react';
import { SmilePlus } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import { useHealthStore } from '../../../stores/useHealthStore';
import { HealthService } from '../../../lib/services/health-service';
import { HermeticPrincipleBar } from '../../shared/HermeticPrincipleBar';
import { showToast } from '../../Toast';

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

      {/* Hermetic principle — Polarity governs mood */}
      <HermeticPrincipleBar domain="health" />
    </BottomSheet>
  );
}