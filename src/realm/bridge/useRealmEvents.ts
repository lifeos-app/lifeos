/**
 * useRealmEvents — Hook for pages to emit Realm events
 *
 * Thin wrapper around RealmEventBus for use in React components.
 * Import this in Habits, Goals, Journal, Health, Finance pages
 * to fire events when actions complete.
 */

import { useCallback } from 'react';
import { RealmEventBus } from './RealmEventBus';

export function useRealmEvents() {
  const habitLogged = useCallback((
    habitId: string,
    habitName: string,
    category: string,
    newStreak: number,
  ) => {
    RealmEventBus.emitHabitLogged(habitId, habitName, category, newStreak);
  }, []);

  const habitStreakBroken = useCallback((habitId: string, habitName: string) => {
    RealmEventBus.emitHabitStreakBroken(habitId, habitName);
  }, []);

  const goalCompleted = useCallback((goalId: string, goalTitle: string, category: string) => {
    RealmEventBus.emitGoalCompleted(goalId, goalTitle, category);
  }, []);

  const journalWritten = useCallback((entryId: string, title: string, totalEntries: number) => {
    RealmEventBus.emitJournalWritten(entryId, title, totalEntries);
  }, []);

  const healthLogged = useCallback(() => {
    RealmEventBus.emitHealthLogged();
  }, []);

  const financeLogged = useCallback((type: 'income' | 'expense', amount: number) => {
    RealmEventBus.emitFinanceLogged(type, amount);
  }, []);

  return {
    habitLogged,
    habitStreakBroken,
    goalCompleted,
    journalWritten,
    healthLogged,
    financeLogged,
  };
}
