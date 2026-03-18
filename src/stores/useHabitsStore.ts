/**
 * Habits Store — Zustand
 *
 * Central store for habits and habit logs.
 * Used by: Dashboard, Schedule, Habits page, Review, DashboardHabits, EventDrawer
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { localDateStr, genId } from '../utils/date';
import { isOnline } from '../lib/offline';
import { showToast } from '../components/Toast';
import { localGetAll, localInsert, localUpdate, localDelete, getLocalUserId, getEffectiveUserId } from '../lib/local-db';
import { syncNow, waitForInitialSync } from '../lib/sync-engine';
import { useUserStore } from './useUserStore';
import type { Habit, HabitLog } from '../types/database';
import { logger } from '../utils/logger';

// Re-export for backwards compatibility
export type { Habit, HabitLog };

interface HabitsState {
  habits: Habit[];
  logs: HabitLog[];
  loading: boolean;
  lastFetched: number | null;
  isOffline: boolean;

  fetchAll: (options?: { skipSync?: boolean }) => Promise<void>;
  invalidate: () => void;

  // Actions
  createHabit: (userId: string, data: Partial<Habit>) => Promise<boolean>;
  toggleHabit: (habitId: string, date: string) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;

  // Selectors
  getLogsForHabit: (habitId: string) => HabitLog[];
  getLogsForDate: (date: string) => HabitLog[];
  isHabitDoneForDate: (habitId: string, date: string) => boolean;
}

const STALE_MS = 2 * 60 * 1000;

/** Calculate current and best streak for a habit from its logs */
export function calculateStreak(habitId: string, logs: HabitLog[]): { current: number; best: number } {
  const habitLogs = logs.filter(l => l.habit_id === habitId);
  if (habitLogs.length === 0) return { current: 0, best: 0 };

  // Get unique sorted dates (descending)
  const dates = [...new Set(habitLogs.map(l => l.date))].sort().reverse();

  // Calculate current streak: consecutive days backward from today
  let current = 0;
  const today = new Date();
  for (let i = 0; i <= dates.length; i++) {
    const check = new Date(today);
    check.setDate(check.getDate() - i);
    const checkStr = localDateStr(check);
    if (dates.includes(checkStr)) {
      current++;
    } else if (i > 0) {
      break;
    }
    // i === 0 and not found: today not logged yet, keep checking from yesterday
  }

  // Calculate best streak from all sorted dates (ascending)
  const asc = [...dates].reverse();
  let best = 0;
  let run = 1;
  for (let i = 1; i < asc.length; i++) {
    const prev = new Date(asc[i - 1]);
    const curr = new Date(asc[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      run++;
    } else {
      best = Math.max(best, run);
      run = 1;
    }
  }
  best = Math.max(best, run, current);

  return { current, best };
}

// Guard against concurrent habit toggles (key: habitId:date)
const _togglingHabits = new Set<string>();

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  logs: [],
  loading: false,
  lastFetched: null,
  isOffline: false,

  fetchAll: async (options?: { skipSync?: boolean }) => {
    const { lastFetched, loading } = get();
    if (loading) return;
    if (lastFetched && Date.now() - lastFetched < STALE_MS) return;

    set({ loading: true });

    try {
      // Wait for initial post-login sync before reading local DB
      await waitForInitialSync();

      // Load from local DB (now populated by sync)
      const [habits, logs] = await Promise.all([
        localGetAll<Habit>('habits'),
        localGetAll<HabitLog>('habit_logs'),
      ]);

      // Filter out soft-deleted and inactive habits
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyStr = localDateStr(thirtyDaysAgo);

      const filteredHabits = habits
        .filter(h => !h.is_deleted && h.is_active)
        .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

      const filteredLogs = logs.filter(l => l.date >= thirtyStr);

      // Recalculate streaks for all habits from logs
      const recalculated = filteredHabits.map(h => {
        const { current, best } = calculateStreak(h.id, filteredLogs);
        const prevBest = h.streak_best || 0;
        return { ...h, streak_current: current, streak_best: Math.max(best, prevBest) };
      });

      set({
        habits: recalculated,
        logs: filteredLogs,
        loading: false,
        lastFetched: Date.now(),
        isOffline: !isOnline(),
      });

      // Background sync if online + authenticated
      if (!options?.skipSync && isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[habits] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[habits] Failed to load from local DB:', err);
      set({ loading: false, isOffline: true });
    }
  },

  invalidate: () => {
    set({ lastFetched: null });
    get().fetchAll();
  },

  createHabit: async (userId, data) => {
    try {
      const newHabit = await localInsert('habits', {
        id: genId(),
        user_id: userId || getEffectiveUserId(),
        title: data.title?.trim(),
        icon: data.icon || 'circle-dot',
        frequency: data.frequency || 'daily',
        is_active: true,
        target_count: data.target_count || 1,
        streak_current: 0,
        streak_best: 0,
        is_deleted: false,
        created_at: new Date().toISOString(),
        ...data,
      });
      
      // Optimistic update
      set({ habits: [...get().habits, newHabit as Habit] });
      
      // Background sync
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[habits] sync failed:', e));
        }
      }
      
      return true;
    } catch (err) {
      logger.error('[habits] Failed to create habit:', err);
      return false;
    }
  },

  toggleHabit: async (habitId, date) => {
    const toggleKey = `${habitId}:${date}`;
    if (_togglingHabits.has(toggleKey)) return; // Prevent concurrent toggles
    _togglingHabits.add(toggleKey);

    const { habits, logs } = get();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) { _togglingHabits.delete(toggleKey); return; }

    const dayLogs = logs.filter(l => l.habit_id === habitId && l.date === date);
    const total = dayLogs.reduce((s, l) => s + (l.count || 1), 0);
    const isDone = total >= (habit.target_count || 1);

    try {
      if (isDone) {
        // Undo — delete logs for this date
        for (const log of dayLogs) {
          await localDelete('habit_logs', log.id);
        }
        // Optimistic update
        set({ logs: get().logs.filter(l => !dayLogs.some(dl => dl.id === l.id)) });
      } else {
        // Mark done
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        const userId = getEffectiveUserId();
        const newLog = await localInsert('habit_logs', {
          id: genId(),
          user_id: userId,
          habit_id: habitId,
          date,
          count: 1,
          created_at: new Date().toISOString(),
        });
        set({ logs: [...get().logs, newLog as HabitLog] });
      }
      
      // Recalculate streaks for this habit
      const updatedLogs = get().logs;
      const { current, best } = calculateStreak(habitId, updatedLogs);
      const prevBest = habit.streak_best || 0;
      const newBest = Math.max(best, prevBest);
      const streakUpdates = { streak_current: current, streak_best: newBest };

      // Update local state
      set({
        habits: get().habits.map(h =>
          h.id === habitId ? { ...h, ...streakUpdates } : h
        ),
      });

      // Persist streak to local DB
      await localUpdate('habits', habitId, streakUpdates).catch(e =>
        logger.warn('[habits] streak persist failed:', e)
      );

      // Background sync
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[habits] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[habits] Failed to toggle habit:', err);
      showToast('Failed to update habit', '⚠️', '#F43F5E');
    } finally {
      _togglingHabits.delete(toggleKey);
    }
  },

  deleteHabit: async (id) => {
    // Optimistic
    const prev = get().habits;
    set({ habits: prev.filter(h => h.id !== id) });
    
    try {
      await localDelete('habits', id);
      
      // Background sync
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[habits] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[habits] Failed to delete habit:', err);
      showToast('Failed to delete habit', '⚠️', '#F43F5E');
      set({ habits: prev }); // rollback
    }
  },

  updateHabit: async (id, updates) => {
    // Optimistic
    const prev = get().habits;
    set({
      habits: prev.map(h => h.id === id ? { ...h, ...updates } : h),
    });
    
    try {
      await localUpdate('habits', id, updates);
      
      // Background sync
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[habits] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[habits] Failed to update habit:', err);
      showToast('Failed to update habit', '⚠️', '#F43F5E');
      set({ habits: prev }); // rollback
    }
  },

  getLogsForHabit: (habitId) => {
    return get().logs.filter(l => l.habit_id === habitId);
  },

  getLogsForDate: (date) => {
    return get().logs.filter(l => l.date === date);
  },

  isHabitDoneForDate: (habitId, date) => {
    const { habits, logs } = get();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return false;
    const dayLogs = logs.filter(l => l.habit_id === habitId && l.date === date);
    const total = dayLogs.reduce((s, l) => s + (l.count || 1), 0);
    return total >= (habit.target_count || 1);
  },
}));
