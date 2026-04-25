/**
 * StreakShieldWidget — Shows streak shield status on the Dashboard
 *
 * Displays:
 * - Shield count (0-3) with Lucide Shield icon
 * - Current streak info
 * - Messages when a shield saved a streak
 * - Button to use a shield on an at-risk habit
 *
 * No emoji per DESIGN-RULES.md — uses Lucide icons only.
 * Dark theme: gold/amber for shields, green for streaks.
 */

import { useMemo, useCallback, useState } from 'react';
import { Shield, ShieldCheck, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { localDateStr } from '../../utils/date';
import {
  getShieldInfo,
  useShield,
  hasShieldAvailableForHabit,
  MAX_SHIELDS,
} from '../../lib/streak-shield';

export function StreakShieldWidget() {
  const habits = useHabitsStore(s => s.habits);
  const logs = useHabitsStore(s => s.logs);
  const [expanded, setExpanded] = useState(false);
  // Bump counter to force re-render after shield use
  const [refreshKey, setRefreshKey] = useState(0);

  const todayStr = localDateStr(new Date());

  const shieldInfo = useMemo(() => getShieldInfo(), [refreshKey]);

  // Find habits at risk (streak >= 3, not done today)
  const atRiskHabits = useMemo(() => {
    return habits.filter(h => {
      if (!h.is_active || h.is_deleted) return false;
      const streak = h.streak_current || 0;
      if (streak < 3) return false;
      // Check if already done today
      const dayLogs = logs.filter(l => l.habit_id === h.id && l.date === todayStr);
      const total = dayLogs.reduce((s, l) => s + (l.count || 1), 0);
      return total < (h.target_count || 1);
    });
  }, [habits, logs, todayStr]);

  // Find habits where a shield was used recently
  const shieldedHabits = useMemo(() => {
    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    const dayBefore = localDateStr(new Date(Date.now() - 2 * 86400000));
    return habits.filter(h => {
      const shieldedYesterday = hasShieldAvailableForHabit(h.id, yesterday);
      const shieldedDayBefore = hasShieldAvailableForHabit(h.id, dayBefore);
      return shieldedYesterday || shieldedDayBefore;
    });
  }, [habits, refreshKey]);

  // Don't show if no shields and no qualifying streaks
  const bestStreak = useMemo(() => {
    let best = 0;
    for (const h of habits) {
      if (h.is_active && !h.is_deleted && (h.streak_current || 0) > best) {
        best = h.streak_current || 0;
      }
    }
    return best;
  }, [habits]);

  if (shieldInfo.availableShields === 0 && bestStreak < 3 && shieldedHabits.length === 0) {
    return null;
  }

  const handleUseShield = useCallback((habitId: string) => {
    const dateStr = localDateStr(new Date(Date.now() - 86400000)); // Shield for yesterday
    const success = useShield(habitId, dateStr);
    if (success) {
      // Force re-render by bumping refresh key
      setRefreshKey(prev => prev + 1);
      // Also invalidate habits store to recalculate streaks with shield bridging
      useHabitsStore.getState().invalidate();
    }
  }, []);

  const shieldIcons = useMemo(() => {
    const icons = [];
    for (let i = 0; i < MAX_SHIELDS; i++) {
      icons.push(
        i < shieldInfo.availableShields ? (
          <ShieldCheck key={i} size={18} color="#F59E0B" style={{ flexShrink: 0 }} />
        ) : (
          <Shield key={i} size={18} color="rgba(245,158,11,0.2)" style={{ flexShrink: 0 }} />
        )
      );
    }
    return icons;
  }, [shieldInfo.availableShields, refreshKey]);

  return (
    <div
      className="glass-card"
      style={{
        padding: '14px 16px',
        marginBottom: 8,
        border: '1px solid rgba(245,158,11,0.15)',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(234,179,8,0.03) 100%)',
      }}
    >
      {/* Header row */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded(prev => !prev)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={20} color="#F59E0B" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Streak Shield
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {shieldInfo.availableShields} of {shieldInfo.maxShields} available
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', gap: 3 }}>{shieldIcons}</div>
          {expanded ? (
            <ChevronUp size={16} color="rgba(255,255,255,0.4)" />
          ) : (
            <ChevronDown size={16} color="rgba(255,255,255,0.4)" />
          )}
        </div>
      </div>

      {/* Streak count */}
      {bestStreak >= 3 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Flame size={14} color="#39FF14" />
          <span style={{ fontSize: 11, color: '#39FF14', fontWeight: 500 }}>
            Best active streak: {bestStreak} days
          </span>
        </div>
      )}

      {/* Shield saved message */}
      {shieldedHabits.length > 0 && (
        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.12)' }}>
          {shieldedHabits.slice(0, 2).map(h => (
            <div key={h.id} style={{ fontSize: 11, color: '#F59E0B', fontWeight: 500 }}>
              <ShieldCheck size={12} color="#F59E0B" style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
              Your shield saved a {(h.streak_current || 0)}-day streak on &quot;{h.title}&quot;
            </div>
          ))}
        </div>
      )}

      {/* Expanded: at-risk habits with use shield button */}
      {expanded && atRiskHabits.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
            Habits at risk — use a shield to preserve your streak:
          </div>
          {atRiskHabits.slice(0, 3).map(habit => (
            <div
              key={habit.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                marginBottom: 4,
                borderRadius: 6,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {habit.title}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                  {habit.streak_current}-day streak
                </div>
              </div>
              {shieldInfo.availableShields > 0 ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleUseShield(habit.id); }}
                  style={{
                    padding: '4px 10px',
                    marginLeft: 8,
                    borderRadius: 6,
                    border: '1px solid rgba(245,158,11,0.3)',
                    background: 'rgba(245,158,11,0.12)',
                    color: '#F59E0B',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                >
                  Use Shield
                </button>
              ) : (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>
                  No shields
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Earn progress hint */}
      {shieldInfo.availableShields < shieldInfo.maxShields && bestStreak < 7 && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 8, textAlign: 'center' }}>
          Maintain a 7-day streak to earn your next shield
        </div>
      )}
    </div>
  );
}