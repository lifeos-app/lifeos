/**
 * DashboardLifePulse — Quick mood/energy/water check-in widget for the Today tab.
 * Auto-saves on each interaction. Collapsed after first log of the day.
 */

import { useState, useRef, useMemo, useCallback } from 'react';
import { Frown, Meh, Smile, Droplets, Minus, Plus } from 'lucide-react';
import { useHealthMetrics } from '../../hooks/useHealthMetrics';
import { useGamificationContext } from '../../lib/gamification/context';
import { getUIState, setUIState } from '../../utils/ui-state';
import { showToast } from '../Toast';

const today = () => new Date().toISOString().split('T')[0];
const pulseKey = () => `life_pulse_today_${today()}`;

const MOOD_ICONS = [
  { icon: Frown, label: 'Awful', value: 1, color: '#F43F5E' },
  { icon: Frown, label: 'Bad', value: 2, color: '#F97316' },
  { icon: Meh, label: 'Okay', value: 3, color: '#EAB308' },
  { icon: Smile, label: 'Good', value: 4, color: '#39FF14' },
  { icon: Smile, label: 'Great', value: 5, color: '#00D4FF' },
];

const ENERGY_LEVELS = [
  { value: 1, color: '#F43F5E' },
  { value: 2, color: '#F97316' },
  { value: 3, color: '#EAB308' },
  { value: 4, color: '#39FF14' },
  { value: 5, color: '#00D4FF' },
];

export function DashboardLifePulse() {
  const { data, upsertToday } = useHealthMetrics();
  const { awardXP } = useGamificationContext();
  const xpRef = useRef(false);
  const [expanded, setExpanded] = useState(!getUIState(pulseKey()));

  const todayMetrics = useMemo(() => data.find(m => m.date === today()), [data]);
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [water, setWater] = useState<number>(0);

  // Sync from fetched data on first load
  const initialized = useRef(false);
  if (!initialized.current && todayMetrics) {
    initialized.current = true;
    if (todayMetrics.mood_score) setMood(todayMetrics.mood_score);
    if (todayMetrics.energy_score) setEnergy(todayMetrics.energy_score);
    if (todayMetrics.water_glasses) setWater(todayMetrics.water_glasses);
  }

  // Streak: consecutive days with at least one non-null metric
  const streak = useMemo(() => {
    let count = 0;
    const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
    const todayDate = new Date(today() + 'T00:00:00');
    for (let i = 0; i < sorted.length; i++) {
      const expected = new Date(todayDate);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split('T')[0];
      const entry = sorted.find(m => m.date === expectedStr);
      if (entry && (entry.mood_score || entry.energy_score || entry.water_glasses)) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [data]);

  const save = useCallback(async (updates: Record<string, unknown>) => {
    await upsertToday(updates as any);
    if (!xpRef.current) {
      awardXP('health_log', { description: 'Life Pulse check-in' });
      xpRef.current = true;
    }
    setUIState(pulseKey());
    showToast('Logged!', '✓', '#39FF14');
  }, [upsertToday, awardXP]);

  const handleMood = useCallback((val: number) => {
    setMood(val);
    save({ mood_score: val });
  }, [save]);

  const handleEnergy = useCallback((val: number) => {
    setEnergy(val);
    save({ energy_score: val });
  }, [save]);

  const handleWater = useCallback((delta: number) => {
    const next = Math.max(0, water + delta);
    setWater(next);
    save({ water_glasses: next });
  }, [save, water]);

  // Collapsed state
  if (!expanded) {
    return (
      <button
        className="glass-card"
        onClick={() => setExpanded(true)}
        style={{
          width: '100%', padding: '10px 16px', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 8,
          border: '1px solid rgba(57, 255, 20, 0.15)',
          background: 'rgba(57, 255, 20, 0.04)',
          cursor: 'pointer', fontSize: 13, color: '#39FF14', fontWeight: 500,
        }}
      >
        <span>✓</span>
        <span>Pulse logged</span>
        {streak > 1 && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>🔥 {streak} day streak</span>}
      </button>
    );
  }

  return (
    <div className="glass-card" style={{ padding: 16, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Life Pulse</span>
        {streak > 1 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔥 {streak} day streak</span>}
      </div>

      {/* Mood */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mood</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {MOOD_ICONS.map(m => {
            const Icon = m.icon;
            const active = mood === m.value;
            return (
              <button
                key={m.value}
                onClick={() => handleMood(m.value)}
                style={{
                  minWidth: 44, minHeight: 44,
                  borderRadius: 10,
                  border: `2px solid ${active ? m.color : 'rgba(26,58,92,0.2)'}`,
                  background: active ? m.color + '18' : 'none',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                  transform: active ? 'scale(1.1)' : undefined,
                }}
                aria-label={m.label}
              >
                <Icon size={20} color={active ? m.color : 'var(--text-muted)'} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Energy */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Energy</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {ENERGY_LEVELS.map(e => {
            const active = energy === e.value;
            return (
              <button
                key={e.value}
                onClick={() => handleEnergy(e.value)}
                style={{
                  minWidth: 44, minHeight: 44,
                  borderRadius: 10,
                  border: `2px solid ${active ? e.color : 'rgba(26,58,92,0.2)'}`,
                  background: active ? e.color + '18' : 'none',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700,
                  color: active ? e.color : 'var(--text-muted)',
                  transition: 'all 0.15s',
                  transform: active ? 'scale(1.1)' : undefined,
                }}
              >
                {e.value}
              </button>
            );
          })}
        </div>
      </div>

      {/* Water */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Water</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => handleWater(-1)}
            style={{
              minWidth: 44, minHeight: 44,
              borderRadius: 10,
              border: '2px solid rgba(26,58,92,0.2)',
              background: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <Minus size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 18, fontWeight: 700, color: '#00D4FF' }}>
            <Droplets size={18} />
            <span>{water}</span>
          </div>
          <button
            onClick={() => handleWater(1)}
            style={{
              minWidth: 44, minHeight: 44,
              borderRadius: 10,
              border: '2px solid rgba(26,58,92,0.2)',
              background: 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
