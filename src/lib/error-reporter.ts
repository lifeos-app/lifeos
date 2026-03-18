// Lightweight error reporting — logs to Supabase error_logs table
import { supabase } from './supabase';
import { logger } from '../utils/logger';

interface ErrorReport {
  error_message: string;
  error_stack?: string;
  component_stack?: string;
  url?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
}

let reportQueue: ErrorReport[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Report an error to the error_logs table */
export function reportError(report: ErrorReport) {
  reportQueue.push({
    ...report,
    url: report.url || window.location.href,
    user_agent: report.user_agent || navigator.userAgent,
  });

  // Debounce flush to batch rapid errors
  if (!flushTimer) {
    flushTimer = setTimeout(flushErrors, 2000);
  }
}

async function flushErrors() {
  flushTimer = null;
  if (reportQueue.length === 0) return;

  const batch = reportQueue.splice(0, 20); // Max 20 per flush
  const userId = (await supabase.auth.getUser()).data?.user?.id;

  try {
    await supabase.from('error_logs').insert(
      batch.map(e => ({
        user_id: userId || null,
        error_message: e.error_message?.slice(0, 2000) || 'Unknown',
        error_stack: e.error_stack?.slice(0, 5000) || null,
        component_stack: e.component_stack?.slice(0, 5000) || null,
        url: e.url?.slice(0, 500) || null,
        user_agent: e.user_agent?.slice(0, 500) || null,
        metadata: e.metadata || {},
      }))
    );
  } catch {
    // Silently fail — don't crash the app reporting an error
    logger.warn('[ErrorReporter] Failed to flush errors');
  }
}

/** Install global error handlers */
export function installGlobalErrorHandlers() {
  // Unhandled errors
  window.addEventListener('error', (event) => {
    reportError({
      error_message: event.message || 'Unhandled error',
      error_stack: event.error?.stack,
      metadata: { type: 'window.onerror', filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;

    // Suppress AbortError — fired by Supabase GoTrue client when requests are
    // cancelled during fast navigation or React StrictMode double-mount.
    // These are harmless and expected; no need to log or report them.
    if (reason?.name === 'AbortError' || reason?.message === 'The operation was aborted.') {
      event.preventDefault();
      return;
    }

    reportError({
      error_message: reason?.message || String(reason) || 'Unhandled promise rejection',
      error_stack: reason?.stack,
      metadata: { type: 'unhandledrejection' },
    });
  });
}
