/**
 * useScheduleOptimizer — Hook for AI-powered schedule analysis
 * 
 * Fetches today's (and this week's) schedule events, computes free gaps,
 * detects conflicts, checks goal-time balance, and returns suggestions.
 * 
 * Results are cached in localStorage for the current day.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useGoalsStore, type GoalNode } from '../stores/useGoalsStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useSacredSchedule } from './useSacredSchedule';
import { localDateStr } from '../utils/date';
import { getRituals, type Ritual } from '../lib/rituals';
import { logger } from '../utils/logger';
import {
  detectGaps,
  detectConflicts,
  runAIOptimization,
  type OptimizerResult,
  type OptimizerSuggestion,
  type TimeGap,
  type ScheduleConflict,
  type BalanceInsight,
} from '../lib/llm/schedule-optimizer';

export type { OptimizerResult, OptimizerSuggestion, TimeGap, ScheduleConflict, BalanceInsight };

interface UseScheduleOptimizerReturn {
  result: OptimizerResult | null;
  loading: boolean;
  error: string | null;
  analyze: () => Promise<void>;
  acceptSuggestion: (suggestion: OptimizerSuggestion) => Promise<boolean>;
  dismissSuggestion: (suggestionId: string) => void;
  /** Quick stats without full AI analysis */
  quickStats: {
    totalFreeMinutes: number;
    freeHours: number;
    gapCount: number;
    conflictCount: number;
  };
}

const CACHE_KEY = 'lifeos-optimizer-cache';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getCachedResult(dateStr: string): OptimizerResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.date !== dateStr) return null;
    if (Date.now() - new Date(cached.result.analyzedAt).getTime() > CACHE_TTL_MS) return null;
    return cached.result;
  } catch {
    return null;
  }
}

function setCachedResult(dateStr: string, result: OptimizerResult) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ date: dateStr, result }));
  } catch { /* quota exceeded — ignore */ }
}

export function useScheduleOptimizer(selectedDate: Date): UseScheduleOptimizerReturn {
  const user = useUserStore(s => s.user);
  const tasks = useScheduleStore(s => s.tasks);
  const goals = useGoalsStore(s => s.goals) as GoalNode[];
  const habits = useHabitsStore(s => s.habits);
  const habitLogs = useHabitsStore(s => s.logs);
  const { sacredBlocks } = useSacredSchedule();

  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const dateStr = localDateStr(selectedDate);
  const todayStr = localDateStr(new Date());

  // Quick gap detection (local, no AI) — runs on every render
  const quickStats = useMemo(() => {
    const storeEvents = useScheduleStore.getState().events;
    const dayEvents = storeEvents.filter(e => {
      if (!e.start_time) return false;
      return e.start_time.startsWith(dateStr);
    });

    const sacredMins = sacredBlocks.map(sb => ({ startMin: sb.startMin, endMin: sb.endMin }));
    const gaps = detectGaps(dayEvents, dateStr, 6, 22, sacredMins);
    const conflicts = detectConflicts(
      dayEvents.filter(e => e.end_time) as { id: string; title: string; start_time: string; end_time: string }[]
    );

    const totalFreeMinutes = gaps.reduce((s, g) => s + g.durationMin, 0);

    return {
      totalFreeMinutes,
      freeHours: Math.round(totalFreeMinutes / 60 * 10) / 10,
      gapCount: gaps.length,
      conflictCount: conflicts.length,
    };
  }, [dateStr, sacredBlocks]);

  // Check cache on date change
  useEffect(() => {
    const cached = getCachedResult(dateStr);
    if (cached) {
      setResult(cached);
      setDismissedIds(new Set());
    } else {
      setResult(null);
    }
  }, [dateStr]);

  // Full analysis (with AI)
  const analyze = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch today's events directly (freshest data)
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: dayEvents } = await supabase
        .from('schedule_events')
        .select('id,title,start_time,end_time,event_type,schedule_layer')
        .eq('is_deleted', false)
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())
        .order('start_time');

      // Fetch this week's events for balance analysis
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const { data: weekEvents } = await supabase
        .from('schedule_events')
        .select('title,start_time,end_time,event_type')
        .eq('is_deleted', false)
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', weekEnd.toISOString())
        .order('start_time');

      // Fetch today's habit logs
      const todayLogs = habitLogs.filter(l => l.date === dateStr);
      const completedHabitIds = new Set(todayLogs.map(l => l.habit_id));

      // Sacred blocks to exclude from gap detection
      const sacredMins = sacredBlocks.map(sb => ({ startMin: sb.startMin, endMin: sb.endMin }));

      // Detect gaps and conflicts
      const events = dayEvents || [];
      const gaps = detectGaps(events, dateStr, 6, 22, sacredMins);
      const conflicts = detectConflicts(
        events.filter(e => e.end_time) as { id: string; title: string; start_time: string; end_time: string }[]
      );

      // Active goals (non-deleted, in-progress)
      const activeGoals = goals.filter(g =>
        g.status === 'active' && !g.is_deleted
      ).slice(0, 10);

      // Active habits
      const activeHabits = (habits as { id: string; title: string; icon: string | null; is_active: boolean }[])
        .filter(h => h.is_active)
        .map(h => ({
          id: h.id,
          title: h.title,
          icon: h.icon || undefined,
          completedToday: completedHabitIds.has(h.id),
        }));

      // Pending tasks (not done)
      const pendingTasks = tasks
        .filter(t => t.status !== 'done' && !t.is_deleted)
        .slice(0, 15)
        .map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority || 'medium',
          dueDate: t.due_date || undefined,
          goalId: t.goal_id || undefined,
        }));

      // Fetch user's rituals
      const allRituals = getRituals();
      const activeRituals = allRituals.filter(r => r.enabled).map(r => ({
        id: r.id,
        title: r.title,
        emoji: r.emoji,
        type: r.type,
        time: r.schedule?.startTime || '09:00',
        endTime: r.schedule?.endTime || undefined,
        days: r.schedule?.days || [1,2,3,4,5],
        enabled: r.enabled,
      }));

      const aiResult = await runAIOptimization({
        date: dateStr,
        events: events.map(e => ({
          id: e.id,
          title: e.title,
          start_time: e.start_time,
          end_time: e.end_time || '',
          event_type: e.event_type || 'general',
          schedule_layer: e.schedule_layer || undefined,
        })),
        weekEvents: (weekEvents || []).map(e => ({
          title: e.title,
          start_time: e.start_time,
          end_time: e.end_time || '',
          event_type: e.event_type || 'general',
        })),
        goals: activeGoals.map(g => ({
          id: g.id,
          title: g.title,
          category: g.category || '',
          priority: g.priority || 'medium',
          icon: g.icon || undefined,
          color: g.color || undefined,
          domain: g.domain || undefined,
        })),
        habits: activeHabits,
        tasks: pendingTasks,
        gaps,
        conflicts,
        sacredBlockMinutes: sacredBlocks.map(sb => sb.startMin),
        rituals: activeRituals,
      });

      setResult(aiResult);
      setCachedResult(dateStr, aiResult);
      setDismissedIds(new Set());
    } catch (err: any) {
      logger.error('[ScheduleOptimizer] Analysis failed:', err);
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedDate, dateStr, goals, habits, habitLogs, tasks, sacredBlocks]);

  // Accept a suggestion → create a schedule event
  const acceptSuggestion = useCallback(async (suggestion: OptimizerSuggestion): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { createScheduleEvent } = await import('../lib/schedule-events');

      await createScheduleEvent(supabase, {
        userId: user.id,
        title: suggestion.title,
        startTime: suggestion.startTime,
        endTime: suggestion.endTime,
        eventType: suggestion.eventType as any,
        scheduleLayer: suggestion.scheduleLayer as any,
        description: suggestion.description,
        source: 'system',
      });

      // Remove from suggestions list
      if (result) {
        const updated = {
          ...result,
          suggestions: result.suggestions.filter(s => s.id !== suggestion.id),
        };
        setResult(updated);
        setCachedResult(dateStr, updated);
      }

      // Trigger refresh
      window.dispatchEvent(new Event('lifeos-refresh'));
      useScheduleStore.getState().invalidate();

      return true;
    } catch (err) {
      logger.error('[ScheduleOptimizer] Accept failed:', err);
      return false;
    }
  }, [user?.id, result, dateStr]);

  // Dismiss a suggestion (hide it)
  const dismissSuggestion = useCallback((suggestionId: string) => {
    setDismissedIds(prev => new Set([...prev, suggestionId]));
  }, []);

  // Filter out dismissed suggestions
  const filteredResult = useMemo(() => {
    if (!result) return null;
    if (dismissedIds.size === 0) return result;
    return {
      ...result,
      suggestions: result.suggestions.filter(s => !dismissedIds.has(s.id)),
    };
  }, [result, dismissedIds]);

  return {
    result: filteredResult,
    loading,
    error,
    analyze,
    acceptSuggestion,
    dismissSuggestion,
    quickStats,
  };
}
