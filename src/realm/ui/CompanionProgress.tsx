/**
 * CompanionProgress — Egg hatching progress widget
 *
 * Shows when user has no companion yet. Displays progress
 * toward the 7-day domain diversity requirement.
 */

import { useState, useMemo } from 'react';
import { useHabitsStore } from '../../stores/useHabitsStore';
import './CompanionProgress.css';

const SS_KEY = 'realm_companion_progress_dismissed';

export function CompanionProgress() {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(SS_KEY) === '1');
  const habits = useHabitsStore(s => s.habits);
  const logs = useHabitsStore(s => s.logs);

  const qualifyingDays = useMemo(() => {
    const activeHabits = habits.filter(h => !h.is_deleted);
    let count = 0;
    for (let d = 0; d < 7; d++) {
      const date = new Date(Date.now() - d * 86400000).toISOString().split('T')[0];
      const dayLogs = logs.filter(l => l.date === date);
      const categories = new Set(dayLogs.map(l => {
        const h = activeHabits.find(h2 => h2.id === l.habit_id);
        return h?.category || 'other';
      }));
      if (categories.size >= 3) count++;
    }
    return count;
  }, [habits, logs]);

  if (dismissed) return null;

  const isReady = qualifyingDays >= 7;
  const progress = qualifyingDays / 7;
  const circumference = 2 * Math.PI * 20;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className={`companion-progress ${isReady ? 'companion-progress--ready' : ''}`}>
      <div className="companion-progress__header">
        <span className="companion-progress__title">
          {isReady ? '✨ Ready to Hatch!' : '🥚 Companion Egg'}
        </span>
        <button
          className="companion-progress__close"
          onClick={() => { sessionStorage.setItem(SS_KEY, '1'); setDismissed(true); }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      <div className="companion-progress__ring">
        <svg width="50" height="50" viewBox="0 0 50 50">
          <circle
            cx="25" cy="25" r="20"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
          />
          <circle
            cx="25" cy="25" r="20"
            fill="none"
            stroke={isReady ? '#D4AF37' : 'rgba(212,175,55,0.6)'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 25 25)"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
          <text x="25" y="28" textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.7)">
            🥚
          </text>
        </svg>
        <div className="companion-progress__count">
          {qualifyingDays}<span>/7 days</span>
        </div>
      </div>

      <p className="companion-progress__desc">
        {isReady
          ? 'Your companion is ready! Re-enter the Realm to meet them.'
          : 'Log 3+ life domains daily for 7 days to hatch a companion.'}
      </p>
    </div>
  );
}
