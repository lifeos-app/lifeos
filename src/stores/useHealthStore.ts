/**
 * Health Store — Zustand
 *
 * Central store for health metrics and workout data.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { localDateStr } from '../utils/date';
import { isOnline } from '../lib/offline';
import { localQuery } from '../lib/local-db';
import { syncNow, waitForInitialSync } from '../lib/sync-engine';
import { useUserStore } from './useUserStore';
import type { HealthMetric } from '../types/database';
import { logger } from '../utils/logger';

interface HealthState {
  todayMetrics: HealthMetric | null;
  loading: boolean;
  lastFetched: number | null;
  isOffline: boolean;

  fetchToday: (options?: { skipSync?: boolean }) => Promise<void>;
  invalidate: () => void;
}

const STALE_MS = 2 * 60 * 1000;

export const useHealthStore = create<HealthState>((set, get) => ({
  todayMetrics: null,
  loading: false,
  lastFetched: null,
  isOffline: false,

  fetchToday: async (options?: { skipSync?: boolean }) => {
    const { lastFetched, loading } = get();
    if (loading) return;
    if (lastFetched && Date.now() - lastFetched < STALE_MS) return;

    set({ loading: true });

    try {
      // Wait for initial post-login sync before reading local DB
      await waitForInitialSync();

      // Load from local DB (indexed query by date)
      const today = localDateStr();
      const todayResults = await localQuery<HealthMetric>('health_metrics', 'date', today);
      const todayMetrics = todayResults[0] || null;

      set({
        todayMetrics,
        loading: false,
        lastFetched: Date.now(),
        isOffline: !isOnline(),
      });

      // Background sync if online + authenticated
      if (!options?.skipSync && isOnline()) {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[health] sync failed:', e));
        }
      }
    } catch (err) {
      logger.error('[health] Failed to load from local DB:', err);
      set({ loading: false, isOffline: true });
    }
  },

  invalidate: () => {
    set({ lastFetched: null });
    get().fetchToday();
  },
}));
