/**
 * DashboardStreakWarnings — Shows warning cards for habits with streak >= 7
 * that haven't been logged today. "Keep Alive" button logs the habit.
 */

import { useMemo, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { localDateStr } from '../../utils/date';

export function DashboardStreakWarnings() {
  const habits = useHabitsStore(s => s.habits);
  const isHabitDoneForDate = useHabitsStore(s => s.isHabitDoneForDate);
  const toggleHabit = useHabitsStore(s => s.toggleHabit);
  const todayStr = localDateStr(new Date());

  const atRiskHabits = useMemo(() => {
    return habits.filter(h =>
      (h.streak_current || 0) >= 7 && !isHabitDoneForDate(h.id, todayStr)
    );
  }, [habits, todayStr, isHabitDoneForDate]);

  const handleKeepAlive = useCallback((habitId: string) => {
    toggleHabit(habitId, todayStr);
  }, [toggleHabit, todayStr]);

  if (atRiskHabits.length === 0) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      {atRiskHabits.map(habit => (
        <div
          key={habit.id}
          className="glass-card"
          style={{
            padding: '12px 16px',
            marginBottom: 6,
            border: '1px solid rgba(249, 115, 22, 0.2)',
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(234, 179, 8, 0.04) 100%)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <AlertTriangle size={18} color="#F97316" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {habit.title}
            </div>
            <div style={{ fontSize: 11, color: '#F97316' }}>
              🔥 {habit.streak_current} day streak at risk!
            </div>
          </div>
          <button
            onClick={() => handleKeepAlive(habit.id)}
            style={{
              padding: '6px 14px',
              minHeight: 36,
              borderRadius: 8,
              border: '1px solid rgba(249, 115, 22, 0.3)',
              background: 'rgba(249, 115, 22, 0.12)',
              color: '#F97316',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            Keep Alive
          </button>
        </div>
      ))}
    </div>
  );
}
