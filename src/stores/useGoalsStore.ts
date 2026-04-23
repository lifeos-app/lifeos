/**
 * Goals Store — Zustand
 *
 * Central store for goals hierarchy (objectives, epics, goals).
 * Tasks are in useScheduleStore since they're shared more broadly.
 * Used by: Dashboard, Goals page, Schedule, Review, NodeDetail
 */

import { create } from 'zustand';
import { db as supabase } from '../lib/data-access';
import { showToast } from '../components/Toast';
import { isOnline } from '../lib/offline';
import { localGetAll, localInsert, localUpdate, localDelete, getLocalUserId, getEffectiveUserId } from '../lib/local-db';
import { syncNow, waitForInitialSync } from '../lib/sync-engine';
import { useUserStore } from './useUserStore';
import { genId } from '../utils/date';
import type { Goal, Business } from '../types/database';
import { logger } from '../utils/logger';
import type { HermeticForce } from '../lib/hermetic-gender-balance';
import { suggestForce } from '../lib/hermetic-gender-balance';

/**
 * GoalNode extends database Goal type with UI-specific fields
 */
export interface GoalNode extends Goal {
  type?: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  priority: string | null;
  /** Hermetic Gender principle classification — vision (feminine), action (masculine), or balanced */
  hermeticForce?: HermeticForce;
}

interface GoalsState {
  goals: GoalNode[];
  businesses: Business[];
  loading: boolean;
  lastFetched: number | null;

  fetchAll: (options?: { skipSync?: boolean }) => Promise<void>;
  invalidate: () => void;

  // Actions
  createGoal: (data: Partial<GoalNode>) => Promise<string | null>;
  createGoalBatch: (goals: Partial<GoalNode>[]) => Promise<string[]>;
  updateGoal: (id: string, updates: Partial<GoalNode>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  // Selectors
  getObjectives: () => GoalNode[];
  getChildren: (parentId: string) => GoalNode[];
  getGoalById: (id: string) => GoalNode | undefined;
}

const STALE_MS = 2 * 60 * 1000;

export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: [],
  businesses: [],
  loading: false,
  lastFetched: null,

  fetchAll: async (options?: { skipSync?: boolean }) => {
    const { lastFetched, loading } = get();
    if (loading) return;
    if (lastFetched && Date.now() - lastFetched < STALE_MS) return;

    set({ loading: true });

    try {
      // Wait for initial post-login sync to complete before reading local DB
      // This ensures Supabase data is pulled in after logout → login
      await waitForInitialSync();

      // Load from local DB (now populated by sync)
      const [goals, businesses] = await Promise.all([
        localGetAll<GoalNode>('goals'),
        localGetAll('businesses'),
      ]);

      const filteredGoals = goals
        .filter(g => !g.is_deleted)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      const filteredBusinesses = businesses
        .filter((b): b is Business => !b.is_deleted)
        .sort((a, b) => a.name.localeCompare(b.name));

      set({
        goals: filteredGoals,
        businesses: filteredBusinesses,
        loading: false,
        lastFetched: Date.now(),
      });

      // Background sync if online + authenticated
      if (!options?.skipSync && isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[goals] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[goals] Failed to load from local DB:', err);
      set({ loading: false });
    }
  },

  invalidate: () => {
    set({ lastFetched: null });
    get().fetchAll();
  },

  createGoal: async (data) => {
    try {
      // Auto-suggest hermeticForce from title/description if not explicitly set
      const hermeticForce: HermeticForce | undefined =
        data.hermeticForce ?? suggestForce(data.title ?? '', data.description);

      const newGoal = await localInsert('goals', {
        id: genId(),
        user_id: data.user_id || getEffectiveUserId(),
        is_deleted: false,
        created_at: new Date().toISOString(),
        ...data,
        hermeticForce,
      });
      
      // Optimistic
      set({ goals: [...get().goals, newGoal as GoalNode] });
      
      // Background sync
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[goals] sync failed:', e));
        }
      }
      
      return newGoal.id;
    } catch (err) {
      logger.error('[goals] Failed to create goal:', err);
      return null;
    }
  },

  createGoalBatch: async (goals) => {
    const ids: string[] = [];
    const created: GoalNode[] = [];

    try {
      for (const data of goals) {
        // Auto-suggest hermeticForce from title/description if not explicitly set
        const hermeticForce: HermeticForce | undefined =
          data.hermeticForce ?? suggestForce(data.title ?? '', data.description);

        const newGoal = await localInsert('goals', {
          id: data.id || genId(),
          user_id: data.user_id || getEffectiveUserId(),
          is_deleted: false,
          created_at: new Date().toISOString(),
          ...data,
          hermeticForce,
        });
        ids.push(newGoal.id);
        created.push(newGoal as GoalNode);
      }

      // Optimistic — add all at once
      set({ goals: [...get().goals, ...created] });

      // Single background sync
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[goals] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[goals] Failed to create goal batch:', err);
    }

    return ids;
  },

  updateGoal: async (id, updates) => {
    // Optimistic
    const prev = get().goals;
    set({
      goals: prev.map(g => g.id === id ? { ...g, ...updates } : g),
    });
    
    try {
      await localUpdate('goals', id, updates);
      
      // Background sync
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[goals] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[goals] Failed to update goal:', err);
      showToast('Failed to update goal', '⚠️', '#F43F5E');
      set({ goals: prev }); // rollback
    }
  },

  deleteGoal: async (id) => {
    // Optimistic
    const prev = get().goals;
    set({ goals: prev.filter(g => g.id !== id) });
    
    try {
      await localDelete('goals', id);
      
      // Background sync
      if (isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[goals] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[goals] Failed to delete goal:', err);
      showToast('Failed to delete goal', '⚠️', '#F43F5E');
      set({ goals: prev }); // rollback
    }
  },

  getObjectives: () => {
    return get().goals.filter(g => !g.parent_goal_id || g.category === 'objective');
  },

  getChildren: (parentId) => {
    return get().goals.filter(g => g.parent_goal_id === parentId);
  },

  getGoalById: (id) => {
    return get().goals.find(g => g.id === id);
  },
}));
