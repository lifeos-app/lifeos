/**
 * useOverdueItems — Hook to detect overdue tasks and missed schedule events.
 *
 * Reads from existing Zustand stores (useScheduleStore) so data stays in sync.
 * No duplicate Supabase calls — leverages the cached store data.
 */

import { useMemo, useRef } from 'react';
import { useScheduleStore } from '../stores/useScheduleStore';
import { localDateStr } from '../utils/date';
import type { Task } from '../types/database';

export interface OverdueTask {
  id: string;
  title: string;
  due_date: string;
  priority: Task['priority'];
  status: Task['status'];
  goal_id: string | null | undefined;
  daysOverdue: number;
}

export interface MissedEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  event_type?: string;
  daysMissed: number;
}

export interface OverdueItems {
  overdueTasks: OverdueTask[];
  missedEvents: MissedEvent[];
  totalCount: number;
  loading: boolean;
}

/**
 * Returns overdue tasks and missed events from the schedule store.
 * 
 * Philosophy: Past events are assumed COMPLETED by default.
 * Only tasks explicitly marked as incomplete (status = 'todo' with high/urgent priority
 * and overdue by 2+ days) are shown. Events are NOT shown as missed — they're
 * handled by the EventExpiryNudge at event end-time. The review/weekly brief
 * can ask about anything that might have been missed.
 * 
 * This prevents the "everything is overdue" problem where normal scheduled 
 * activities flood the overdue list.
 */
export function useOverdueItems(): OverdueItems {
  const tasks = useScheduleStore(s => s.tasks);
  const events = useScheduleStore(s => s.events);
  const storeLoading = useScheduleStore(s => s.loading);

  // Only show loading on first hydration — subsequent re-fetches keep stale data
  // visible to prevent the banner from blinking.
  const hasHydrated = useRef(false);
  if (!storeLoading && (tasks.length > 0 || events.length > 0)) {
    hasHydrated.current = true;
  }
  const loading = storeLoading && !hasHydrated.current;

  const today = localDateStr();
  const now = new Date();

  const overdueTasks = useMemo(() => {
    return tasks
      .filter(t => {
        if (!t.due_date || t.is_deleted) return false;
        if (t.due_date >= today) return false; // Not past due
        if (t.status === 'done') return false; // Completed
        // Only show tasks that are explicitly actionable:
        // - Status is 'todo' or 'in_progress' (not just any non-done status)
        // - Must be overdue by at least 1 day (grace period for today's tasks)
        if (t.status !== 'todo' && t.status !== 'in_progress') return false;
        return true;
      })
      .map(t => {
        const dueDate = new Date(t.due_date + 'T00:00:00');
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: t.id,
          title: t.title,
          due_date: t.due_date!,
          priority: t.priority || 'medium',
          status: t.status,
          goal_id: t.goal_id,
          daysOverdue,
        };
      })
      // Only show tasks overdue by 2+ days, OR urgent/high priority overdue by 1+ day
      .filter(t => {
        if (t.priority === 'urgent' || t.priority === 'high') return t.daysOverdue >= 1;
        return t.daysOverdue >= 2;
      })
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        const pa = priorityOrder[a.priority] ?? 2;
        const pb = priorityOrder[b.priority] ?? 2;
        if (pa !== pb) return pa - pb;
        return b.daysOverdue - a.daysOverdue;
      });
  }, [tasks, today]);

  // Events are NOT shown as "missed" — past events are assumed completed.
  // The EventExpiryNudge handles the "still going?" prompt at event end-time.
  // Weekly review can surface anything genuinely missed.
  const missedEvents: MissedEvent[] = useMemo(() => [], []);

  return {
    overdueTasks,
    missedEvents,
    totalCount: overdueTasks.length,
    loading,
  };
}
