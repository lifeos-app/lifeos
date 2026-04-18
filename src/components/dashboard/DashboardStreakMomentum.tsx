/**
 * DashboardStreakMomentum — Visual streak indicator with flame ladder.
 *
 * Shows top habit streaks as a horizontal ladder with flame intensity.
 * Uses useHabitsStore to get streak data.
 */

import { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { localDateStr } from '../../utils/date';

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(17, 24, 39, 0.5)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 16,
  padding: 16,
  position: 'relative',
  overflow: 'hidden',
};

const HEADER_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'rgba(255, 255, 255, 0.85)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 12,
};

function getFlameIntensity(streak: number): { color: string; glow: string; label: string } {
  if (streak >= 30) return { color: '#FF4500', glow: 'rgba(255,69,0,0.3)', label: 'Legendary' };
  if (streak >= 21) return { color: '#FF6B00', glow: 'rgba(255,107,0,0.25)', label: 'Blazing' };
  if (streak >= 14) return { color: '#F97316', glow: 'rgba(249,115,22,0.2)', label: 'On Fire' };
  if (streak >= 7) return { color: '#EAB308', glow: 'rgba(234,179,8,0.15)', label: 'Hot' };
  if (streak >= 3) return { color: '#FACC15', glow: 'rgba(250,204,21,0.1)', label: 'Warming' };
  return { color: '#8BA4BE', glow: 'transparent', label: 'Starting' };
}

function StreakBar({ streak, maxStreak, title, icon }: {
  streak: number; maxStreak: number; title: string; icon?: string;
}) {
  const pct = maxStreak > 0 ? Math.min(streak / maxStreak, 1) : 0;
  const { color, glow, label } = getFlameIntensity(streak);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: `${color}15`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, flexShrink: 0,
      }}>
        {icon || '🔥'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 4,
        }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color, marginLeft: 4, flexShrink: 0 }}>
            {streak}d · {label}
          </span>
        </div>
        {/* Flame ladder bar */}
        <div style={{
          height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.04)',
          overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.max(pct * 100, 4)}%`,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
            borderRadius: 3,
            boxShadow: `0 0 8px ${glow}`,
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
      </div>
    </div>
  );
}

export function DashboardStreakMomentum() {
  const habits = useHabitsStore(s => s.habits);
  const logs = useHabitsStore(s => s.logs);

  const streakData = useMemo(() => {
    if (habits.length === 0) return [];

    const today = new Date();
    const habitStreaks = habits.map(h => {
      const hLogs = logs.filter(l => l.habit_id === h.id);
      const dates = [...new Set(hLogs.map(l => l.date))].sort().reverse();
      let streak = 0;
      for (let i = 0; i <= dates.length; i++) {
        const check = new Date(today);
        check.setDate(check.getDate() - i);
        if (dates.includes(localDateStr(check))) streak++;
        else if (i > 0) break;
      }
      return { id: h.id, title: h.title, streak, icon: h.icon };
    });

    // Sort by streak descending, take top 5
    return habitStreaks
      .filter(h => h.streak > 0)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 5);
  }, [habits, logs]);

  if (streakData.length === 0) return null;

  const maxStreak = Math.max(streakData[0]?.streak || 1, 1);

  return (
    <div className="dash-card" style={CARD_STYLE}>
      {/* Subtle glow */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(249,115,22,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={HEADER_STYLE}>
        <Flame size={14} color="#F97316" />
        Streak Momentum
      </div>

      {streakData.map(h => (
        <StreakBar
          key={h.id}
          streak={h.streak}
          maxStreak={maxStreak}
          title={h.title}
          icon={h.icon || undefined}
        />
      ))}

      {/* Total momentum */}
      <div style={{
        marginTop: 8, paddingTop: 8,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', justifyContent: 'center', gap: 2,
      }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = streakData.length > i;
          return (
            <Flame
              key={i}
              size={14}
              color={filled ? ['#FACC15', '#F97316', '#FF6B00', '#FF4500', '#FF0000'][i] : 'rgba(255,255,255,0.08)'}
              style={{ filter: filled ? `drop-shadow(0 0 3px ${['rgba(250,204,21,0.4)', 'rgba(249,115,22,0.4)', 'rgba(255,107,0,0.4)', 'rgba(255,69,0,0.4)', 'rgba(255,0,0,0.3)'][i]})` : 'none' }}
            />
          );
        })}
      </div>
    </div>
  );
}