/**
 * useAuditLog — React hook for audit log entries (P7-005)
 *
 * Reactive: listens for 'lifeos:audit-updated' and 'storage' events.
 * Returns { entries, count, clearAll } with filtering support.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getAuditLog,
  clearAuditLog,
} from '../lib/audit-logger';
import type { AuditLogEntry, AuditLogFilter } from '../types/audit-log';

export function useAuditLog(filter?: AuditLogFilter) {
  const [entries, setEntries] = useState<AuditLogEntry[]>(() => getAuditLog(filter));

  const refresh = useCallback(() => {
    setEntries(getAuditLog(filter));
  }, [filter]);

  useEffect(() => {
    // Refresh on custom event (same-tab)
    const handleCustom = () => refresh();
    // Refresh on storage event (cross-tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'lifeos:audit-log' || e.key === null) {
        refresh();
      }
    };

    window.addEventListener('lifeos:audit-updated', handleCustom);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('lifeos:audit-updated', handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refresh]);

  const clearAll = useCallback(() => {
    clearAuditLog();
    refresh();
  }, [refresh]);

  return { entries, count: entries.length, clearAll };
}