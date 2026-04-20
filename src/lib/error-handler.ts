/**
 * error-handler.ts — Standardized Error Handling (VISION-v2-ori section 5.5)
 *
 * Network  -> OfflineBanner + auto-retry
 * Validation -> Inline error display
 * Save     -> Toast + retry button
 * Page     -> ErrorBoundary
 * Auth     -> Redirect to login
 * Permission -> Toast with explanation
 */

import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/error';

// ── Types ──────────────────────────────────────────────────────────

export type ErrorCategory = 'network' | 'validation' | 'save' | 'page' | 'auth' | 'permission' | 'unknown';

export interface HandledError {
  category: ErrorCategory;
  message: string;           // User-friendly (no emoji per DESIGN-RULES)
  detail?: string;           // Technical detail (dev only)
  retry?: () => Promise<void>;
  retryCount?: number;
  maxRetries?: number;
}

// ── Pattern Tables ─────────────────────────────────────────────────

const PATTERNS: Record<Exclude<ErrorCategory, 'page' | 'unknown'>, RegExp[]> = {
  network: [/failed to fetch/i, /network/i, /timeout|timed out/i, /connection/i, /offline/i, /net::err/i, /err_network/i, /load failed/i, /request failed/i],
  auth: [/unauthorized/i, /not authenticated/i, /session expired/i, /invalid token/i, /jwt.*(expired|invalid)/i, /not logged in/i],
  permission: [/forbidden/i, /permission denied/i, /not authorized/i, /insufficient/i, /row.level.security|rls/i, /access denied/i, /policy/i],
  validation: [/validation/i, /invalid input/i, /required field/i, /cannot be empty/i, /invalid format/i, /must be/i],
  save: [/save.*failed/i, /persist/i, /storage.*full/i, /write.*failed/i, /(insert|update).*failed/i],
};

const SUPABASE_CODES: Record<string, ErrorCategory> = {
  '42501': 'permission', '42502': 'permission',
  '23505': 'validation', '23503': 'validation', '23502': 'validation',
  'PGRST301': 'permission', 'P0001': 'permission',
};

const HTTP_STATUS: Record<number, ErrorCategory> = {
  401: 'auth', 403: 'permission',
  429: 'network', 500: 'network', 502: 'network', 503: 'network', 504: 'network',
};

const USER_MESSAGES: Record<ErrorCategory, string> = {
  network: 'Connection lost. Trying again automatically.',
  validation: 'Please check the highlighted fields.',
  save: 'Failed to save changes.',
  page: 'Something went wrong on this page.',
  auth: 'Session expired. Redirecting to login.',
  permission: 'You do not have permission for this action.',
  unknown: 'An unexpected error occurred.',
};

// ── Classification ─────────────────────────────────────────────────

function matchesAny(text: string, pats: RegExp[]): boolean {
  return pats.some(p => p.test(text));
}

function extractField(err: unknown, field: string): unknown | undefined {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (o[field] !== undefined) return o[field];
    if (o.error && typeof o.error === 'object') return (o.error as Record<string, unknown>)[field];
  }
  return undefined;
}

export function classifyError(error: unknown): HandledError {
  const message = getErrorMessage(error);
  const detail = error instanceof Error ? error.stack : undefined;
  const retryable = (cat: ErrorCategory): number => (cat === 'network' || cat === 'save' ? 3 : 0);

  // 1. TypeError likely means fetch/network
  if (error instanceof TypeError && matchesAny(message, PATTERNS.network)) {
    return { category: 'network', message: USER_MESSAGES.network, detail, retryCount: 0, maxRetries: 3 };
  }

  // 2. Supabase error code
  const code = extractField(error, 'code');
  if (typeof code === 'string' && code in SUPABASE_CODES) {
    const cat = SUPABASE_CODES[code];
    return { category: cat, message: USER_MESSAGES[cat], detail: detail ? `${detail} (${code})` : code, retryCount: 0, maxRetries: retryable(cat) };
  }

  // 3. HTTP status
  const status = extractField(error, 'status') ?? extractField(error, 'statusCode');
  if (typeof status === 'number' && status in HTTP_STATUS) {
    const cat = HTTP_STATUS[status];
    return { category: cat, message: USER_MESSAGES[cat], detail: detail ? `${detail} (${status})` : String(status), retryCount: 0, maxRetries: retryable(cat) };
  }

  // 4. Pattern match on message — priority order
  for (const cat of ['auth', 'permission', 'validation', 'save', 'network'] as const) {
    if (matchesAny(message, PATTERNS[cat])) {
      return { category: cat, message: USER_MESSAGES[cat], detail, retryCount: 0, maxRetries: retryable(cat) };
    }
  }

  // 5. Default
  return { category: 'unknown', message: USER_MESSAGES.unknown, detail };
}

// ── Core Handler ───────────────────────────────────────────────────

export function handleError(error: unknown, context?: string): HandledError {
  const handled = classifyError(error);
  const tag = context ? `[${context}]` : '[error-handler]';
  const log = handled.category === 'validation' ? logger.log.bind(logger) : logger.error.bind(logger);
  log(`${tag} ${handled.category}: ${handled.message}`, handled.detail ?? '');
  return handled;
}

// ── Retry with Exponential Backoff ──────────────────────────────────

const BASE_DELAY = 1000;

export async function handleErrorWithRetry(
  error: unknown,
  retryFn: () => Promise<void>,
  context?: string,
): Promise<HandledError> {
  const handled = handleError(error, context);
  const tag = context ? `[${context}]` : '[error-handler]';

  if (handled.category === 'validation') return handled;
  if (handled.category === 'page' || handled.category === 'unknown') return handled;

  if (handled.category === 'auth') {
    logger.warn(`${tag} Auth error — redirecting to login`);
    setTimeout(() => { window.location.href = '/login'; }, 100);
    return handled;
  }

  if (handled.category === 'permission') return handled;

  // Network / Save: exponential backoff 1s, 2s, 4s
  const maxRetries = handled.maxRetries ?? 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const ms = BASE_DELAY * Math.pow(2, attempt);
    logger.log(`${tag} Retry ${attempt + 1}/${maxRetries} in ${ms}ms...`);
    await new Promise(r => setTimeout(r, ms));
    try {
      await retryFn();
      logger.log(`${tag} Retry succeeded on attempt ${attempt + 1}`);
      return {
        ...handled,
        retryCount: attempt + 1,
        message: handled.category === 'network' ? 'Connection restored.' : 'Save succeeded on retry.',
      };
    } catch (retryErr) {
      const reclassified = classifyError(retryErr);
      if (reclassified.category === 'auth') {
        setTimeout(() => { window.location.href = '/login'; }, 100);
        return { ...handled, retryCount: attempt + 1, category: 'auth', message: USER_MESSAGES.auth };
      }
      if (reclassified.category === 'permission') {
        return { ...handled, retryCount: attempt + 1, category: 'permission', message: USER_MESSAGES.permission };
      }
      logger.warn(`${tag} Retry ${attempt + 1}/${maxRetries} failed: ${reclassified.message}`);
    }
  }

  logger.warn(`${tag} All ${maxRetries} retries exhausted`);
  return {
    ...handled,
    retryCount: maxRetries,
    message: handled.category === 'network'
      ? 'Could not reconnect. Please check your connection.'
      : 'Could not save changes. Please try again.',
    retry: retryFn,
  };
}

// ── React Hook ─────────────────────────────────────────────────────

export function useErrorHandler() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  const [currentError, setCurrentError] = React.useState<HandledError | null>(null);

  const handleErrorImpl = React.useCallback((error: unknown, context?: string): HandledError => {
    const handled = handleError(error, context);
    setCurrentError(handled);
    if (handled.category === 'save' || handled.category === 'permission') {
      import('../components/Toast').then(({ showToast }) => {
        const isSave = handled.category === 'save';
        showToast(handled.message, isSave ? 'save' : 'shield', isSave ? '#FF9500' : '#FF3B30',
          isSave ? { action: { label: 'Retry', onClick: () => setCurrentError(null) } } : undefined);
      });
    }
    return handled;
  }, []);

  const handleErrorWithRetryImpl = React.useCallback(
    async (error: unknown, retryFn: () => Promise<void>, context?: string): Promise<HandledError> => {
      const handled = await handleErrorWithRetry(error, retryFn, context);
      setCurrentError(handled);
      if (handled.category === 'network' || handled.category === 'save') {
        import('../components/Toast').then(({ showToast }) => {
          const success = handled.message.includes('restored') || handled.message.includes('succeeded');
          showToast(handled.message, success ? 'wifi' : 'wifi-off', success ? '#39FF14' : '#FF3B30',
            !success && handled.retry ? { action: { label: 'Retry', onClick: () => { handled.retry?.(); setCurrentError(null); } } } : undefined);
        });
      }
      return handled;
    }, []);

  const clearError = React.useCallback(() => setCurrentError(null), []);

  return { handleError: handleErrorImpl, handleErrorWithRetry: handleErrorWithRetryImpl, clearError, currentError };
}