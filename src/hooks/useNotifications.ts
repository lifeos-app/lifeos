import { useState, useMemo, useEffect, useCallback } from 'react';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { localDateStr } from '../utils/date';

export interface Notification {
  id: string;
  type: 'task' | 'event' | 'goal' | 'habit';
  title: string;
  subtitle: string;
  icon: string;
  timestamp: Date;
  read: boolean;
  route?: string;
}

const SS_DISMISSED_KEY = 'notif-dismissed';

export function useNotifications() {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem(SS_DISMISSED_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  // Persist dismissed to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(SS_DISMISSED_KEY, JSON.stringify([...dismissedIds]));
  }, [dismissedIds]);

  // ── Stable selectors ──
  const tasks = useScheduleStore(s => s.tasks);
  const events = useScheduleStore(s => s.events);
  const goals = useGoalsStore(s => s.goals);
  const habits = useHabitsStore(s => s.habits);
  const isHabitDoneForDate = useHabitsStore(s => s.isHabitDoneForDate);

  // NOTE: We intentionally do NOT call useCurrentEvent() here.
  // useCurrentEvent creates its own independent state + 10s interval +
  // Supabase realtime channel per call site. Calling it in both headers
  // (via this hook) AND in EventDrawer/FreeTimeSuggestions multiplied
  // instances and created cascading re-renders (React Error #185).
  // Instead, derive upcoming-event info from the schedule store's events.

  const today = localDateStr();

  const allNotifications = useMemo(() => {
    const items: Notification[] = [];
    const now = new Date();
    const nowMs = now.getTime();

    // 1. Overdue tasks — deep-link to schedule with date + highlight
    for (const task of tasks) {
      if (task.due_date && task.due_date < today && task.status !== 'done') {
        items.push({
          id: `task_${task.id}`,
          type: 'task',
          title: 'Overdue task',
          subtitle: task.title,
          icon: '⏰',
          timestamp: task.due_date ? new Date(task.due_date) : now,
          read: readIds.has(`task_${task.id}`),
          route: `/schedule?date=${task.due_date}&highlight=${task.id}`,
        });
      }
    }

    // 2. Upcoming event (within 30 min) — deep-link with date + highlight
    const upcomingEvent = events
      .filter(e => e.start_time && new Date(e.start_time).getTime() > nowMs)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))[0];

    if (upcomingEvent) {
      const minutesToStart = Math.floor((new Date(upcomingEvent.start_time).getTime() - nowMs) / 60000);
      if (minutesToStart >= 0 && minutesToStart <= 30) {
        const eventDate = upcomingEvent.start_time.split('T')[0];
        items.push({
          id: `event_${upcomingEvent.id}`,
          type: 'event',
          title: `In ${Math.round(minutesToStart)} min`,
          subtitle: upcomingEvent.title,
          icon: '📅',
          timestamp: now,
          read: readIds.has(`event_${upcomingEvent.id}`),
          route: `/schedule?date=${eventDate}&highlight=${upcomingEvent.id}`,
        });
      }
    }

    // 3. Goal milestones (progress >= 75%) — deep-link to goals with node param
    for (const goal of goals) {
      if (
        goal.status === 'active' || goal.status === 'in_progress'
      ) {
        if (goal.progress != null && goal.progress >= 75) {
          items.push({
            id: `goal_${goal.id}`,
            type: 'goal',
            title: `${Math.round(goal.progress)}% complete`,
            subtitle: goal.title,
            icon: '🎯',
            timestamp: goal.updated_at ? new Date(goal.updated_at) : now,
            read: readIds.has(`goal_${goal.id}`),
            route: `/goals?node=${goal.id}`,
          });
        }
      }
    }

    // 4. Habits at risk (streak >= 3 but not done today) — deep-link with highlight
    for (const habit of habits) {
      if (
        habit.is_active &&
        !habit.is_deleted &&
        habit.streak_current >= 3 &&
        !isHabitDoneForDate(habit.id, today)
      ) {
        items.push({
          id: `habit_${habit.id}`,
          type: 'habit',
          title: `${habit.streak_current}-day streak at risk`,
          subtitle: habit.title,
          icon: '🔥',
          timestamp: now,
          read: readIds.has(`habit_${habit.id}`),
          route: `/habits?highlight=${habit.id}`,
        });
      }
    }

    // Sort newest first, limit to 20
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items.slice(0, 20);
  }, [tasks, events, goals, habits, isHabitDoneForDate, today, readIds]);

  // Visible = all minus dismissed
  const notifications = useMemo(
    () => allNotifications.filter(n => !dismissedIds.has(n.id)),
    [allNotifications, dismissedIds],
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds(new Set(allNotifications.map(n => n.id)));
  }, [allNotifications]);

  const dismiss = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setDismissedIds(new Set(allNotifications.map(n => n.id)));
  }, [allNotifications]);

  // History: dismissed items (for the history panel)
  const history = useMemo(
    () => allNotifications.filter(n => dismissedIds.has(n.id)).slice(0, 20),
    [allNotifications, dismissedIds],
  );

  return { notifications, unreadCount, markRead, markAllRead, dismiss, clearAll, history, allNotifications };
}
