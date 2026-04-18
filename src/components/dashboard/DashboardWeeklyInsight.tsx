/**
 * DashboardWeeklyInsight — Compact "This Week" summary card.
 *
 * Shows: tasks completed, habits hit, XP gained this week.
 * Uses existing Zustand stores for data.
 */

import { useMemo } from 'react';
import { BarChart3, CheckCircle2, Flame, Zap } from 'lucide-react';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGamificationContext } from '../../lib/gamification/context';
import { localDateStr } from '../../utils/date';
import { useShallow } from 'zustand/react/shallow';

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(17, 24, 39, 0.5)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 16,
  padding: 16,
  position: 'relative',
  overflow: 'hidden',
};

const STAT_ITEM: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 0',
};

const STAT_ICON: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export function DashboardWeeklyInsight() {
  const tasks = useScheduleStore(s => s.tasks);
  const { habits, logs } = useHabitsStore(useShallow(s => ({ habits: s.habits, logs: s.logs })));
  const gam = useGamificationContext();

  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  const weeklyXP = useMemo(() => {
    if (!gam.recentXP) return 0;
    return gam.recentXP
      .filter(e => e.createdAt >= weekAgo)
      .reduce((s, e) => s + e.amount, 0);
  }, [gam.recentXP, weekAgo]);

  const { weeklyTasksDone, weeklyHabitsHit } = useMemo(() => {
    const doneTasks = tasks.filter(t =>
      t.status === 'done' && t.completed_at && t.completed_at >= weekAgo
    );

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    let habitCount = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = localDateStr(d);
      const dayLogs = logs.filter(l => l.date === dateStr);
      const dayHit = habits.filter(h => {
        const hLogs = dayLogs.filter(l => l.habit_id === h.id);
        return hLogs.reduce((s: number, l: any) => s + (l.count || 1), 0) >= (h.target_count || 1);
      }).length;
      habitCount += dayHit;
    }

    return {
      weeklyTasksDone: doneTasks.length,
      weeklyHabitsHit: habitCount,
    };
  }, [tasks, habits, logs, weekAgo]);

  return (
    <div className="dash-card" style={CARD_STYLE}>
      {/* Subtle glow */}
      <div style={{
        position: 'absolute', bottom: -20, left: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 10,
      }}>
        <BarChart3 size={14} color="#A855F7" />
        This Week
      </div>

      <div style={STAT_ITEM}>
        <div style={{ ...STAT_ICON, background: 'rgba(57,255,20,0.08)' }}>
          <CheckCircle2 size={15} color="#39FF14" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#E8F0FE', fontFamily: 'var(--font-display)' }}>
            {weeklyTasksDone}
          </div>
          <div style={{ fontSize: 10, color: '#8BA4BE' }}>Tasks completed</div>
        </div>
      </div>

      <div style={STAT_ITEM}>
        <div style={{ ...STAT_ICON, background: 'rgba(249,115,22,0.08)' }}>
          <Flame size={15} color="#F97316" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#E8F0FE', fontFamily: 'var(--font-display)' }}>
            {weeklyHabitsHit}
          </div>
          <div style={{ fontSize: 10, color: '#8BA4BE' }}>Habits hit</div>
        </div>
      </div>

      <div style={STAT_ITEM}>
        <div style={{ ...STAT_ICON, background: 'rgba(168,85,247,0.08)' }}>
          <Zap size={15} color="#A855F7" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#E8F0FE', fontFamily: 'var(--font-display)' }}>
            +{weeklyXP}
          </div>
          <div style={{ fontSize: 10, color: '#8BA4BE' }}>XP earned</div>
        </div>
      </div>

      {/* Subtle hermetic touch: "As above, so below" — weekly reflection */}
      <div style={{
        marginTop: 8, paddingTop: 8,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        fontSize: 9, color: 'rgba(255,255,255,0.2)',
        textAlign: 'center', fontStyle: 'italic',
      }}>
        What you do this week echoes in what you become
      </div>
    </div>
  );
}