/**
 * Schedule Store — Zustand
 *
 * Central store for events, tasks, and schedule data.
 * Avoids every page re-fetching from Supabase on mount.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { localDateStr, genId } from '../utils/date';
import { isOnline } from '../lib/offline';
import { showToast } from '../components/Toast';
import { localGetAll, localInsert, localUpdate, getLocalUserId, getEffectiveUserId } from '../lib/local-db';
import { syncNow, waitForInitialSync } from '../lib/sync-engine';
import { useUserStore } from './useUserStore';
import type { Task, ScheduleEvent } from '../types/database';
import { logger } from '../utils/logger';

interface ScheduleState {
  tasks: Task[];
  events: ScheduleEvent[];
  loading: boolean;
  lastFetched: number | null;
  isOffline: boolean;

  fetchAll: (options?: { skipSync?: boolean }) => Promise<void>;
  invalidate: () => void;

  // Task actions
  createTask: (userId: string, title: string, priority?: string, extra?: Partial<Task>) => Promise<boolean>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTask: (id: string, currentStatus: Task['status']) => Promise<void>;
  changeTaskStatus: (id: string, newStatus: Task['status']) => Promise<void>;
  changeTaskBoardPosition: (id: string, newPosition: number, newStatus: Task['status']) => Promise<void>;
  getSubtasks: (parentTaskId: string) => Task[];

  // Event fetchers (local-first, no direct Supabase)
  fetchEventsForDay: (date: string) => ScheduleEvent[];
  fetchEventsForWeek: (weekStart: Date) => ScheduleEvent[];
  fetchEventsForMonth: (year: number, month: number) => ScheduleEvent[];

  // Selectors
  getTasksForDate: (date: string) => Task[];
  getEventsForDate: (date: string) => ScheduleEvent[];
  getOverdueTasks: (referenceDate?: string) => Task[];
}

const STALE_MS = 2 * 60 * 1000; // 2 minutes

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  tasks: [],
  events: [],
  loading: false,
  lastFetched: null,
  isOffline: false,

  fetchAll: async (options?: { skipSync?: boolean }) => {
    const { lastFetched, loading } = get();
    // Skip if recently fetched or already loading
    if (loading) return;
    if (lastFetched && Date.now() - lastFetched < STALE_MS) return;

    set({ loading: true });

    try {
      // Wait for initial post-login sync before reading local DB
      await waitForInitialSync();

      // Load from local DB (now populated by sync)
      const [tasks, events] = await Promise.all([
        localGetAll<Task>('tasks'),
        localGetAll<ScheduleEvent>('events'),
      ]);

      // Filter out soft-deleted and apply local filters
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyStr = ninetyDaysAgo.toISOString().split('T')[0];

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const sixtyStr = sixtyDaysAgo.toISOString().split('T')[0];

      const filteredTasks = tasks
        .filter(t => !t.is_deleted && (t.status !== 'done' || (t.created_at && t.created_at >= ninetyStr)))
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 500);

      const filteredEvents = events
        .filter(e => !e.is_deleted && e.start_time && e.start_time >= sixtyStr)
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

      set({
        tasks: filteredTasks,
        events: filteredEvents,
        loading: false,
        lastFetched: Date.now(),
        isOffline: !isOnline(),
      });

      // Background sync if online + authenticated
      if (!options?.skipSync && isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          // Trigger sync in background (don't block UI)
          syncNow(session.user.id).catch(err => {
            logger.warn('[schedule] Background sync failed:', err);
          });
        }
      }
    } catch (err) {
      logger.error('[schedule] Failed to load from local DB:', err);
      set({ loading: false, isOffline: true });
    }
  },

  invalidate: () => {
    set({ lastFetched: null });
    get().fetchAll();
  },

  createTask: async (userId, title, priority = 'medium', extra = {}) => {
    try {
      const newTask = await localInsert('tasks', {
        id: genId(),
        user_id: userId || getEffectiveUserId(),
        title: title.trim(),
        status: 'todo',
        priority,
        is_deleted: false,
        created_at: new Date().toISOString(),
        ...extra,
      });
      
      // Optimistic update
      set({ tasks: [...get().tasks, newTask as Task] });
      
      // Background sync if online
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[schedule] sync failed:', e));
        }
      }
      
      return true;
    } catch (err) {
      logger.error('[schedule] Failed to create task:', err);
      return false;
    }
  },

  updateTask: async (id, updates) => {
    // Optimistic update
    const prev = get().tasks;
    set({
      tasks: prev.map(t => t.id === id ? { ...t, ...updates } as Task : t),
    });

    try {
      await localUpdate('tasks', id, updates);

      // Background sync if online
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[schedule] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[schedule] Failed to update task:', err);
      showToast('Failed to update task', '⚠️', '#F43F5E');
      set({ tasks: prev }); // rollback
    }
  },

  deleteTask: async (id) => {
    // Optimistic update — soft delete
    const prev = get().tasks;
    set({
      tasks: prev.filter(t => t.id !== id),
    });

    try {
      await localUpdate('tasks', id, { is_deleted: true });

      // Background sync if online
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[schedule] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[schedule] Failed to delete task:', err);
      showToast('Failed to delete task', '⚠️', '#F43F5E');
      set({ tasks: prev }); // rollback
    }
  },

  toggleTask: async (id, currentStatus) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    const updateData = {
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    };
    
    // Optimistic update
    const prev = get().tasks;
    set({
      tasks: prev.map(t => t.id === id ? { ...t, ...updateData } as Task : t),
    });
    
    try {
      await localUpdate('tasks', id, updateData);
      
      // Background sync if online
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[schedule] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[schedule] Failed to toggle task:', err);
      showToast('Failed to update task', '⚠️', '#F43F5E');
      set({ tasks: prev }); // rollback
    }
  },

  changeTaskStatus: async (id, newStatus) => {
    const updateData = {
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    };
    
    // Optimistic update
    const prev = get().tasks;
    set({
      tasks: prev.map(t => t.id === id ? { ...t, ...updateData } as Task : t),
    });
    
    try {
      await localUpdate('tasks', id, updateData);
      
      // Background sync if online
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[schedule] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[schedule] Failed to change task status:', err);
      showToast('Failed to update task', '⚠️', '#F43F5E');
      set({ tasks: prev }); // rollback
    }
  },

  changeTaskBoardPosition: async (id, newPosition, newStatus) => {
    const boardStatus = newStatus === 'pending' ? 'todo' :
                        newStatus === 'in_progress' ? 'in_progress' : 'done';

    const updateData = {
      board_status: boardStatus,
      board_position: newPosition,
      status: newStatus,  // Also update main status
      completed_at: newStatus === 'done' || newStatus === 'completed' ?
        new Date().toISOString() : null,
    };

    // Optimistic update
    const prev = get().tasks;
    set({
      tasks: prev.map(t => t.id === id ? { ...t, ...updateData } as Task : t),
    });

    try {
      await localUpdate('tasks', id, updateData);

      // Background sync if online
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[schedule] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[schedule] Failed to update board position:', err);
      showToast('Failed to reorder task', '⚠️', '#F43F5E');
      set({ tasks: prev }); // rollback
    }
  },

  getSubtasks: (parentTaskId) => {
    const { tasks } = get();
    return tasks
      .filter(t => t.parent_task_id === parentTaskId && !t.is_deleted)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  },

  // ── Event fetchers (local-first, work offline) ──

  fetchEventsForDay: (date) => {
    const { events } = get();
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;
    return events.filter(e =>
      e.start_time && e.start_time <= dayEnd && (e.end_time ? e.end_time > dayStart : e.start_time >= dayStart)
    ).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  },

  fetchEventsForWeek: (weekStart) => {
    const { events } = get();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const startStr = weekStart.toISOString();
    const endStr = weekEnd.toISOString();
    return events.filter(e =>
      e.start_time && e.start_time <= endStr && (e.end_time ? e.end_time >= startStr : e.start_time >= startStr)
    ).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  },

  fetchEventsForMonth: (year, month) => {
    const { events } = get();
    const monthStart = new Date(year, month, 1);
    monthStart.setHours(0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthEnd = new Date(year, month, lastDay);
    monthEnd.setHours(23, 59, 59, 999);
    const startStr = monthStart.toISOString();
    const endStr = monthEnd.toISOString();
    return events.filter(e =>
      e.start_time && e.start_time >= startStr && e.start_time <= endStr
    ).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  },

  getTasksForDate: (date) => {
    const { tasks } = get();
    return tasks.filter(t =>
      t.due_date === date ||
      (t.completed_at && t.completed_at.startsWith(date))
    );
  },

  getEventsForDate: (date) => {
    const { events } = get();
    const today = localDateStr();
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;
    return events.filter(e => {
      if (!e.start_time) return date === today;
      return e.start_time <= dayEnd && (e.end_time ? e.end_time > dayStart : e.start_time >= dayStart);
    });
  },

  getOverdueTasks: (referenceDate) => {
    const ref = referenceDate || localDateStr();
    const { tasks } = get();
    return tasks.filter(t =>
      t.due_date && t.due_date < ref && t.status !== 'done'
    );
  },
}));
