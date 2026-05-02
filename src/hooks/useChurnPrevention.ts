/**
 * useChurnPrevention.ts — React hook for churn detection & re-engagement
 *
 * Called on app mount (Layout.tsx). Checks churn signals on mount,
 * shows a re-engagement modal for returning users, and tracks
 * 'last active' timestamp with debounced updates.
 *
 * Rules:
 *   - Show re-engagement at most once per day
 *   - Debounce last_active updates (5 min)
 *   - Don't re-check within the same session
 *   - Auto-update last_active on every route change
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  scheduleChurnCheck,
  setLastActive,
  markChurnShownToday,
  buildUserActivityFromStores,
  type ChurnSignal,
} from '../lib/churn-prevention';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useJournalStore } from '../stores/useJournalStore';
import { useGoalsStore } from '../stores/useGoalsStore';

// Debounce interval for last_active updates
const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

export interface UseChurnPreventionReturn {
  churnSignal: ChurnSignal | null;
  dismissChurn: () => void;
}

export function useChurnPrevention(): UseChurnPreventionReturn {
  const [churnSignal, setChurnSignal] = useState<ChurnSignal | null>(null);
  const checkedRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);
  const location = useLocation();

  // Dismiss the churn modal
  const dismissChurn = useCallback(() => {
    setChurnSignal(null);
    markChurnShownToday();
  }, []);

  // Check churn on mount — once per session
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const habitsState = useHabitsStore.getState();
    const journalState = useJournalStore.getState();
    const goalsState = useGoalsStore.getState();

    // Find most recent habit log date
    let lastHabitLog: string | null = null;
    const allLogs = habitsState.logs ?? [];
    if (allLogs.length > 0) {
      const sorted = [...allLogs].sort((a, b) =>
        (b.date ?? '').localeCompare(a.date ?? '')
      );
      lastHabitLog = sorted[0]?.date ?? null;
    }

    // Find most recent journal entry date
    let lastJournalDate: string | null = null;
    const journalEntries = journalState.entries ?? [];
    if (journalEntries.length > 0) {
      const sorted = [...journalEntries].sort((a, b) =>
        (b.created_at ?? '').localeCompare(a.created_at ?? '')
      );
      lastJournalDate = sorted[0]?.created_at ?? null;
    }

    // Count habits with active streaks (2+ days)
    const habitsWithStreaks = (habitsState.habits ?? []).filter(
      (h) => h.is_active && !h.is_deleted && (h.streak_current ?? 0) >= 2
    ).length;

    // Count stalled goals (active but no progress update in 7+ days)
    const stalledGoals = (goalsState.goals ?? []).filter((g) => {
      if (g.is_deleted || ['completed', 'done', 'archived'].includes(g.status)) return false;
      if (!g.updated_at) return false;
      const daysSinceUpdate = (Date.now() - new Date(g.updated_at).getTime()) / (24 * 60 * 60 * 1000);
      return daysSinceUpdate >= 7;
    }).length;

    const activity = buildUserActivityFromStores({
      lastHabitLog,
      lastJournalDate,
      habitsWithStreaks,
      stalledGoals,
    });

    const signal = scheduleChurnCheck(activity);
    if (signal) {
      setChurnSignal(signal);
    }

    // Update last_active immediately on mount
    setLastActive();
    lastUpdateRef.current = Date.now();
  }, []);

  // Track last_active on route changes (debounced)
  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current >= DEBOUNCE_MS) {
      setLastActive();
      lastUpdateRef.current = now;
    }
  }, [location.pathname]);

  // Track user activity via visibility and interaction events
  useEffect(() => {
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdateRef.current >= DEBOUNCE_MS) {
        setLastActive();
        lastUpdateRef.current = now;
      }
    };

    // When the user returns to the tab, update last_active
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleActivity);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleActivity);
    };
  }, []);

  return { churnSignal, dismissChurn };
}