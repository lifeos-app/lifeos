/**
 * useErrorMonitor — React hook for error monitoring
 *
 * Reactive: listens for 'lifeos:errors-updated' and 'storage' events.
 * Returns live error list, count, and control functions.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getErrors,
  getErrorCount,
  clearErrors,
  captureError,
  captureMessage,
  addBreadcrumb,
  type ErrorRecord,
  type Severity,
} from '../lib/error-monitor';

export interface UseErrorMonitorReturn {
  errors: ErrorRecord[];
  count: number;
  clearAll: () => void;
  captureError: (error: Error, context?: Partial<ErrorRecord>) => void;
  captureMessage: (message: string, severity?: Severity, context?: Partial<ErrorRecord>) => void;
  addBreadcrumb: (message: string, category?: string) => void;
}

export function useErrorMonitor(filter?: { severity?: Severity; since?: Date; limit?: number }): UseErrorMonitorReturn {
  const [errors, setErrors] = useState<ErrorRecord[]>(() => getErrors(filter));
  const [count, setCount] = useState<number>(() => getErrorCount(filter?.since));

  const refresh = useCallback(() => {
    setErrors(getErrors(filter));
    setCount(getErrorCount(filter?.since));
  }, [filter?.severity, filter?.since, filter?.limit]);

  useEffect(() => {
    // Listen for custom event from error-monitor
    const onUpdated = () => refresh();
    window.addEventListener('lifeos:errors-updated', onUpdated);

    // Listen for storage events (cross-tab sync)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'lifeos:errors') refresh();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('lifeos:errors-updated', onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  const clearAll = useCallback(() => {
    clearErrors();
    refresh();
  }, [refresh]);

  const wrapCaptureError = useCallback((error: Error, context?: Partial<ErrorRecord>) => {
    captureError(error, context);
    refresh();
  }, [refresh]);

  const wrapCaptureMessage = useCallback((message: string, severity?: Severity, context?: Partial<ErrorRecord>) => {
    captureMessage(message, severity, context);
    refresh();
  }, [refresh]);

  const wrapAddBreadcrumb = useCallback((message: string, category?: string) => {
    addBreadcrumb(message, category);
  }, []);

  return {
    errors,
    count,
    clearAll,
    captureError: wrapCaptureError,
    captureMessage: wrapCaptureMessage,
    addBreadcrumb: wrapAddBreadcrumb,
  };
}