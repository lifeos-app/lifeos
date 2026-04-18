/**
 * DashboardDailyProgress — Circular progress ring showing today's completion.
 *
 * Combines tasks + habits into a single satisfying fill indicator.
 * Uses ProgressRing component for rendering.
 */

import { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ProgressRing } from '../ui/ProgressRing';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { localDateStr } from '../../utils/date';
import { useShallow } from 'zustand/react/shallow';

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(17, 24, 39, 0.5)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 16,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
  minHeight: 140,
};

export function DashboardDailyProgress() {
  const tasks = useScheduleStore(s => s.tasks);
  const { habits, logs } = useHabitsStore(useShallow(s => ({ habits: s.habits, logs: s.logs })));
  const today = localDateStr();

  const { taskProgress, habitProgress, overallProgress, tasksDone, totalTasks, habitsDone, totalHabits } = useMemo(() => {
    const dayTasks = tasks.filter(t => t.due_date === today);
    const doneTasks = dayTasks.filter(t => t.status === 'done');
    const tPct = dayTasks.length > 0 ? doneTasks.length / dayTasks.length : 0;

    const dayHabitLogs = logs.filter(l => l.date === today);
    const hDone = habits.filter(h => {
      const hLogs = dayHabitLogs.filter(l => l.habit_id === h.id);
      return hLogs.reduce((s: number, l: any) => s + (l.count || 1), 0) >= (h.target_count || 1);
    }).length;
    const hPct = habits.length > 0 ? hDone / habits.length : 0;

    // Weighted: tasks 60%, habits 40%
    const totalItems = dayTasks.length + habits.length;
    const totalDone = doneTasks.length + hDone;
    const overall = totalItems > 0 ? totalDone / totalItems : 0;

    return {
      taskProgress: tPct,
      habitProgress: hPct,
      overallProgress: overall,
      tasksDone: doneTasks.length,
      totalTasks: dayTasks.length,
      habitsDone: hDone,
      totalHabits: habits.length,
    };
  }, [tasks, habits, logs, today]);

  const isComplete = overallProgress >= 1 && (totalTasks + totalHabits) > 0;
  const ringColor = isComplete ? '#39FF14' : overallProgress >= 0.5 ? '#00D4FF' : '#8BA4BE';

  return (
    <div className="dash-card" style={CARD_STYLE}>
      {/* Subtle glow behind ring */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 120, height: 120, borderRadius: '50%',
        background: `radial-gradient(circle, ${ringColor}10 0%, transparent 70%)`,
        pointerEvents: 'none',
        transition: 'background 0.5s',
      }} />

      <ProgressRing
        progress={overallProgress}
        size={90}
        strokeWidth={10}
        color={ringColor}
        glow
        animate
        centerContent={
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20, fontWeight: 700,
              color: ringColor, lineHeight: 1,
              transition: 'color 0.5s',
            }}>
              {isComplete ? '✓' : Math.round(overallProgress * 100)}
            </div>
            <div style={{
              fontSize: 8, color: 'rgba(255,255,255,0.4)',
              fontWeight: 600, letterSpacing: '0.04em',
              textTransform: 'uppercase', marginTop: 2,
            }}>
              {isComplete ? 'DONE' : 'TODAY'}
            </div>
          </div>
        }
      />

      {/* Mini breakdown */}
      <div style={{
        display: 'flex', gap: 16, marginTop: 12,
        fontSize: 10, color: '#8BA4BE',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <CheckCircle2 size={10} color="#39FF14" />
          {tasksDone}/{totalTasks} tasks
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          🔥 {habitsDone}/{totalHabits} habits
        </span>
      </div>
    </div>
  );
}