/**
 * useNLQuery — React hook for the Natural Language Query Engine
 *
 * Provides a simple interface to ask data questions and get structured results.
 * Automatically accesses current Zustand store state.
 */

import { useState, useCallback } from 'react';
import { useJournalStore } from '../stores/useJournalStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useHealthStore } from '../stores/useHealthStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { processQuery, type QueryResult, type StoreAccess } from '../lib/nl-query-engine';

export function useNLQuery() {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (question: string): Promise<QueryResult> => {
    setLoading(true);
    setError(null);

    try {
      // Gather current store state (synchronous reads from Zustand)
      const stores: StoreAccess = {
        journal: useJournalStore.getState(),
        habits: useHabitsStore.getState(),
        health: useHealthStore.getState(),
        goals: useGoalsStore.getState(),
        finance: useFinanceStore.getState(),
        schedule: useScheduleStore.getState(),
      };

      const queryResult = await processQuery(question, stores);
      setResult(queryResult);
      setLoading(false);
      return queryResult;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLoading(false);
      const fallback: QueryResult = {
        answer: `Something went wrong processing your query: ${msg}`,
        question,
        confidence: 0,
      };
      setResult(fallback);
      return fallback;
    }
  }, []);

  return { ask, result, loading, error };
}