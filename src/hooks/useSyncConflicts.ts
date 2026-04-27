import { useState, useEffect, useCallback } from 'react';
import {
  getConflicts,
  getConflictCount,
  clearConflicts,
  type ConflictRecord,
} from '../lib/sync-conflict';

/**
 * useSyncConflicts — React hook for displaying sync conflict records.
 *
 * Reads from localStorage on mount and listens for:
 *   - 'storage' events (cross-tab updates to lifeos:conflicts)
 *   - 'lifeos:conflicts-updated' custom events (same-tab updates)
 *
 * Returns:
 *   conflicts — array of ConflictRecord, most recent first
 *   count     — number of conflict records
 *   clearAll  — function to clear all conflict records
 */
export function useSyncConflicts() {
  const [conflicts, setConflicts] = useState<ConflictRecord[]>(() => getConflicts());
  const [count, setCount] = useState<number>(() => getConflictCount());

  const refresh = useCallback(() => {
    setConflicts(getConflicts());
    setCount(getConflictCount());
  }, []);

  useEffect(() => {
    // Listen for cross-tab localStorage changes
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'lifeos:conflicts') {
        refresh();
      }
    };

    // Listen for same-tab updates dispatched by logConflict/clearConflicts
    const onCustomEvent = () => {
      refresh();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('lifeos:conflicts-updated', onCustomEvent);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('lifeos:conflicts-updated', onCustomEvent);
    };
  }, [refresh]);

  const clearAll = useCallback(() => {
    clearConflicts();
    refresh();
  }, [refresh]);

  return { conflicts, count, clearAll };
}