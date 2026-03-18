/**
 * ComboIndicator — Shows a pill when 2+ distinct XP action types occurred in the last 2 hours.
 * Derives data from recentXP in gamification context. No new queries needed.
 * Tappable to dismiss; resets when count changes. Passive actions excluded from counting.
 */

import { useState, useEffect, useMemo } from 'react';
import { useGamificationContext } from '../../lib/gamification/context';

const ACTION_LABELS: Record<string, string> = {
  task_complete: 'Task',
  habit_log: 'Habit',
  goal_complete: 'Goal',
  journal_entry: 'Journal',
  health_log: 'Health',
  financial_entry: 'Finance',
  schedule_event: 'Event',
  ai_message: 'AI',
  junction_practice: 'Sacred',
  page_visit: 'Explore',
};

const PASSIVE_ACTIONS = new Set(['page_visit']);

export function ComboIndicator() {
  const { recentXP } = useGamificationContext();
  const [dismissed, setDismissed] = useState(false);

  const { count, label } = useMemo(() => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const recent = recentXP.filter(e => new Date(e.createdAt).getTime() > twoHoursAgo);
    const distinctActions = [...new Set(recent.map(e => e.action))].filter(a => !PASSIVE_ACTIONS.has(a));
    const names = distinctActions.map(a => ACTION_LABELS[a] || a).join(' · ');
    return { count: distinctActions.length, label: names };
  }, [recentXP]);

  useEffect(() => {
    setDismissed(false);
  }, [count]);

  if (count < 2 || dismissed) return null;

  return (
    <div
      role="status"
      aria-label={`${count}x combo: ${label}`}
      onClick={() => setDismissed(true)}
      style={{
        position: 'fixed',
        bottom: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9990,
        background: 'rgba(10, 14, 26, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        borderRadius: 20,
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 600,
        color: '#00D4FF',
        whiteSpace: 'nowrap',
        animation: count >= 4 ? 'combo-pulse 1.5s ease-in-out infinite' : undefined,
        boxShadow: '0 4px 20px rgba(0, 212, 255, 0.15)',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 16 }}>⚡</span>
      <span>{count}x Combo</span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400, fontSize: 11 }}>{label}</span>
    </div>
  );
}
