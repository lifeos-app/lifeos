// ═══ EventDrawer hooks — data-fetching hooks ═══

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useHealthStore } from '../../stores/useHealthStore';
import type { ScheduleEvent } from '../../hooks/useCurrentEvent';
import { resolveEventCategory } from './helpers';

// ═══ Types ═══
export interface WeeklyStats {
  sessionsThisWeek: number;
  totalMinutesThisWeek: number;
  categoryDistribution: Record<string, number>; // category -> minutes
}

export interface DailyPulse {
  tasksTotal: number;
  tasksDone: number;
  habitsTotal: number;
  habitsDone: number;
  todayIncome: number;
  energyLevel: number | null;
  healthScore: number | null;
}

// ═══ Constants ═══
const PULSE_CACHE_KEY = 'lifeos-daily-pulse-v3';
const PULSE_CACHE_TTL = 5 * 60 * 1000;

const defaultPulse: DailyPulse = {
  tasksTotal: 0, tasksDone: 0,
  habitsTotal: 0, habitsDone: 0,
  todayIncome: 0, energyLevel: null, healthScore: null,
};

// ═══ Weekly Stats Hook (reads from Zustand store) ═══
export function useWeeklyStats(event: ScheduleEvent | null, enabled: boolean): WeeklyStats {
  const storeEvents = useScheduleStore(s => s.events);

  const stats = useCallback((): WeeklyStats => {
    if (!enabled || !event) return { sessionsThisWeek: 0, totalMinutesThisWeek: 0, categoryDistribution: {} };

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartISO = weekStart.toISOString();
    const weekEndISO = weekEnd.toISOString();

    const weekEvents = storeEvents.filter(e =>
      e.start_time && e.start_time >= weekStartISO && e.start_time <= weekEndISO
    );

    if (weekEvents.length === 0) return { sessionsThisWeek: 0, totalMinutesThisWeek: 0, categoryDistribution: {} };

    // Sessions + time for similar events (fuzzy title match)
    const normalizedTitle = event.title.toLowerCase().trim();
    const similarEvents = weekEvents.filter(e => {
      const t = e.title.toLowerCase().trim();
      return t === normalizedTitle || t.includes(normalizedTitle) || normalizedTitle.includes(t);
    });

    const sessionsThisWeek = similarEvents.length;
    const totalMinutesThisWeek = similarEvents.reduce((sum, e) => {
      if (!e.start_time || !e.end_time) return sum;
      const dur = (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 60000;
      return sum + Math.max(0, dur);
    }, 0);

    // Category distribution for all week events
    const categoryDistribution: Record<string, number> = {};
    for (const e of weekEvents) {
      const cat = resolveEventCategory(e as any);
      if (!e.start_time || !e.end_time) continue;
      const dur = (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 60000;
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + Math.max(0, dur);
    }

    return { sessionsThisWeek, totalMinutesThisWeek, categoryDistribution };
  }, [event?.id, enabled, storeEvents]);

  return stats();
}

// ═══ Daily Pulse Hook (reads from Zustand stores) ═══
export function useDailyPulse(enabled: boolean): { pulse: DailyPulse; loading: boolean } {
  const storeTasks = useScheduleStore(s => s.tasks);
  const storeHabits = useHabitsStore(s => s.habits);
  const storeHabitLogs = useHabitsStore(s => s.logs);
  const storeIncome = useFinanceStore(s => s.income);
  const todayMetrics = useHealthStore(s => s.todayMetrics);

  const today = new Date().toISOString().slice(0, 10);

  const pulse: DailyPulse = enabled ? {
    tasksTotal: storeTasks.length,
    tasksDone: storeTasks.filter(t => t.status === 'done' || t.status === 'completed').length,
    habitsTotal: storeHabits.length,
    habitsDone: new Set(storeHabitLogs.filter(l => l.date === today).map(l => l.habit_id)).size,
    todayIncome: storeIncome.filter(i => i.date === today).reduce((s, r) => s + (Number(r.amount) || 0), 0),
    energyLevel: todayMetrics?.energy_score ?? null,
    healthScore: null,
  } : defaultPulse;

  return { pulse, loading: false };
}
