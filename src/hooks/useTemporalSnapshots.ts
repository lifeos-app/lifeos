// ═══════════════════════════════════════════════════════════
// useTemporalSnapshots — Computes 7-day life score snapshots
// for the DashboardTemporalPlayback scrubber.
// Pulls from schedule, habits, health, and gamification stores.
// ═══════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useHealthStore } from '../stores/useHealthStore';
import { localDateStr } from '../utils/date';
import { computeLifeScore } from '../components/dashboard/DashboardLifeScore';
import type { DaySnapshot } from '../components/dashboard/DashboardTemporalPlayback';

function getDateRange(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function useTemporalSnapshots(days = 7): DaySnapshot[] {
  const tasks = useScheduleStore(s => s.tasks);
  const { habits, logs: habitLogs } = useHabitsStore(s => ({ habits: s.habits, logs: s.logs }));
  const healthMetrics = useHealthStore(s => s.todayMetrics);

  return useMemo(() => {
    const dates = getDateRange(days);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return dates.map(dateStr => {
      const d = new Date(dateStr + 'T00:00:00');
      const dayLabel = `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

      // Tasks for this day
      const dayTasks = tasks.filter(t => {
        if (!t.due_date && !t.completed_at) return dateStr === localDateStr();
        return (t.due_date && t.due_date.startsWith(dateStr)) ||
               (t.completed_at && t.completed_at.startsWith(dateStr));
      });
      const dayDoneTasks = dayTasks.filter(t => t.status === 'done');

      // Habits for this day
      const dayLogs = habitLogs.filter(l => l.logged_date?.startsWith(dateStr));
      const habitsCompleted = dayLogs.filter(l => l.completed).length;

      // Health — only have today's data from the store
      // For past days, we'd need to query Supabase, but this gives today's snapshot
      const isToday = dateStr === localDateStr();

      const habitCompletion = habits.length > 0 ? habitsCompleted / habits.length : 0;
      const taskCompletion = dayTasks.length > 0 ? dayDoneTasks.length / dayTasks.length : 0;

      // Compute life score for this day
      const { total: score } = computeLifeScore({
        habitCompletion,
        goalProgress: 0.5, // Default — would need goal store per day
        mood: isToday ? healthMetrics?.mood_score ?? null : null,
        energy: isToday ? healthMetrics?.energy_score ?? null : null,
        sleepHours: isToday ? healthMetrics?.sleep_hours ?? null : null,
        taskCompletion,
        netIncome: 0,
        overdueBills: 0,
        scheduleCompletion: 0,
        bestStreak: 0,
        yesterdayScore: null,
      });

      return {
        date: dateStr,
        dayLabel,
        mood: isToday ? healthMetrics?.mood_score ?? null : null,
        energy: isToday ? healthMetrics?.energy_score ?? null : null,
        sleepHours: isToday ? healthMetrics?.sleep_hours ?? null : null,
        habitsCompleted,
        habitsTotal: habits.length,
        tasksDone: dayDoneTasks.length,
        tasksTotal: dayTasks.length,
        xpEarned: dayDoneTasks.length * 10 + habitsCompleted * 5,
        score,
      };
    });
  }, [tasks, habits, habitLogs, healthMetrics, days]);
}