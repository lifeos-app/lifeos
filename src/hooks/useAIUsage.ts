/**
 * useAIUsage — React hook for AI usage stats (P7-006)
 *
 * Reactive: listens for 'lifeos:ai-usage-updated' and 'storage' events.
 * Returns { summary, records, clearAll } with date range filtering.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getAIUsageSummary,
  getAIUsageRecords,
  clearAIUsage,
} from '../lib/ai-cost-tracker';
import type { AIUsageSummary, AIUsageRecord } from '../types/ai-usage';

export function useAIUsage(days: number = 30) {
  const [summary, setSummary] = useState<AIUsageSummary>(() => getAIUsageSummary(days));
  const [records, setRecords] = useState<AIUsageRecord[]>(() => getAIUsageRecords(days));

  const refresh = useCallback(() => {
    setSummary(getAIUsageSummary(days));
    setRecords(getAIUsageRecords(days));
  }, [days]);

  useEffect(() => {
    // Refresh on custom event (same-tab)
    const handleCustom = () => refresh();
    // Refresh on storage event (cross-tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'lifeos:ai-usage' || e.key === null) {
        refresh();
      }
    };

    window.addEventListener('lifeos:ai-usage-updated', handleCustom);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('lifeos:ai-usage-updated', handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refresh]);

  // Re-fetch if days changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  const clearAll = useCallback(() => {
    clearAIUsage();
    refresh();
  }, [refresh]);

  return { summary, records, clearAll };
}