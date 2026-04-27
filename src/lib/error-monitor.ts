/**
 * error-monitor.ts — Local-first error monitoring for LifeOS
 *
 * No Sentry dependency. Captures errors to localStorage, provides breadcrumbs,
 * auto-captures unhandled errors/rejections, and exposes a React error boundary HOC.
 * Dispatches 'lifeos:errors-updated' custom event for reactive UI updates.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'error' | 'warning' | 'info';

export interface Breadcrumb {
  message: string;
  category: string;
  timestamp: number;
}

export interface ErrorRecord {
  id: string;
  timestamp: number;
  errorType: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  userAgent?: string;
  userId?: string;
  breadcrumbs: Breadcrumb[];
  severity: Severity;
}

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lifeos:errors';
const MAX_ERRORS = 500;
const MAX_BREADCRUMBS = 50;

// ── Internal State ─────────────────────────────────────────────────────────

let currentBreadcrumbs: Breadcrumb[] = [];
let currentUserId: string | undefined;
let initialized = false;

// ── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function dispatchUpdate(): void {
  try {
    window.dispatchEvent(new CustomEvent('lifeos:errors-updated'));
  } catch {
    // Must not throw
  }
}

function readStoredErrors(): ErrorRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ErrorRecord[];
  } catch {
    return [];
  }
}

function writeStoredErrors(errors: ErrorRecord[]): void {
  try {
    // Cap at MAX_ERRORS, dropping oldest
    const trimmed = errors.length > MAX_ERRORS ? errors.slice(-MAX_ERRORS) : errors;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage could be full or unavailable — silently fail
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function captureError(error: Error, context?: Partial<ErrorRecord>): void {
  try {
    const record: ErrorRecord = {
      id: generateId(),
      timestamp: Date.now(),
      errorType: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack || undefined,
      componentStack: context?.componentStack || undefined,
      url: context?.url || window.location.href,
      userAgent: context?.userAgent || navigator.userAgent,
      userId: context?.userId || currentUserId,
      breadcrumbs: [...currentBreadcrumbs],
      severity: context?.severity || 'error',
    };

    const errors = readStoredErrors();
    errors.push(record);
    writeStoredErrors(errors);
    dispatchUpdate();
  } catch {
    // Must not throw
  }
}

export function captureMessage(message: string, severity: Severity = 'info', context?: Partial<ErrorRecord>): void {
  try {
    const record: ErrorRecord = {
      id: generateId(),
      timestamp: Date.now(),
      errorType: context?.errorType || 'Message',
      message,
      stack: context?.stack || undefined,
      componentStack: context?.componentStack || undefined,
      url: context?.url || window.location.href,
      userAgent: context?.userAgent || navigator.userAgent,
      userId: context?.userId || currentUserId,
      breadcrumbs: [...currentBreadcrumbs],
      severity,
    };

    const errors = readStoredErrors();
    errors.push(record);
    writeStoredErrors(errors);
    dispatchUpdate();
  } catch {
    // Must not throw
  }
}

export function addBreadcrumb(message: string, category: string = 'general'): void {
  try {
    currentBreadcrumbs.push({
      message,
      category,
      timestamp: Date.now(),
    });
    // Keep only last MAX_BREADCRUMBS
    if (currentBreadcrumbs.length > MAX_BREADCRUMBS) {
      currentBreadcrumbs = currentBreadcrumbs.slice(-MAX_BREADCRUMBS);
    }
  } catch {
    // Must not throw
  }
}

export function getErrors(filter?: { severity?: Severity; since?: Date; component?: string; limit?: number }): ErrorRecord[] {
  try {
    let errors = readStoredErrors();

    if (filter?.severity) {
      errors = errors.filter(e => e.severity === filter.severity);
    }
    if (filter?.since) {
      const sinceTs = filter.since.getTime();
      errors = errors.filter(e => e.timestamp >= sinceTs);
    }
    if (filter?.component) {
      const comp = filter.component.toLowerCase();
      errors = errors.filter(e =>
        (e.componentStack && e.componentStack.toLowerCase().includes(comp)) ||
        (e.message && e.message.toLowerCase().includes(comp)) ||
        (e.stack && e.stack.toLowerCase().includes(comp))
      );
    }
    if (filter?.limit) {
      errors = errors.slice(-filter.limit);
    }

    return errors;
  } catch {
    return [];
  }
}

export function getErrorCount(since?: Date): number {
  try {
    const errors = readStoredErrors();
    if (since) {
      const sinceTs = since.getTime();
      return errors.filter(e => e.timestamp >= sinceTs).length;
    }
    return errors.length;
  } catch {
    return 0;
  }
}

export function clearErrors(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    dispatchUpdate();
  } catch {
    // Must not throw
  }
}

export function setErrorUserId(userId: string): void {
  currentUserId = userId;
}

// ── Auto-capture ───────────────────────────────────────────────────────────

function handleWindowError(event: ErrorEvent): void {
  try {
    // Skip AbortError — same suppression as error-reporter.ts
    if (event.error?.name === 'AbortError' || event.message?.includes('The operation was aborted')) {
      return;
    }
    captureError(event.error || new Error(event.message || 'Unhandled error'), {
      severity: 'critical',
    });
  } catch {
    // Must not throw
  }
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  try {
    const reason = event.reason;
    // Skip AbortError
    if (reason?.name === 'AbortError' || reason?.message === 'The operation was aborted.') {
      event.preventDefault();
      return;
    }
    const error = reason instanceof Error ? reason : new Error(String(reason) || 'Unhandled promise rejection');
    captureError(error, { severity: 'critical' });
  } catch {
    // Must not throw
  }
}

// ── Initialization ──────────────────────────────────────────────────────────

export function initErrorMonitor(): () => void {
  if (initialized) return () => {};
  initialized = true;

  try {
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
  } catch {
    // Must not throw
  }

  return () => {
    try {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    } catch {
      // Must not throw
    }
  };
}

// ── React Error Boundary HOC ──────────────────────────────────────────────

import { Component, type ReactNode, createElement } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

/**
 * withErrorBoundary — wraps a component with an error boundary that
 * captures errors into the local error monitor.
 *
 * Usage:
 *   const SafeComponent = withErrorBoundary(MyComponent);
 *   <SafeComponent /> or <SafeComponent fallback={<div>Oops</div>} />
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
): React.ComponentType<P & { fallback?: ReactNode }> {
  return class ErrorMonitorBoundary extends Component<P & { fallback?: ReactNode }, ErrorBoundaryState> {
    constructor(props: P & { fallback?: ReactNode }) {
      super(props);
      this.state = { hasError: false, error: null, errorInfo: '' };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
      this.setState({ errorInfo: errorInfo.componentStack || '' });
      captureError(error, {
        componentStack: errorInfo.componentStack || undefined,
        severity: 'error',
      });
    }

    render(): ReactNode {
      if (this.state.hasError) {
        if (this.props.fallback) return this.props.fallback;

        return createElement('div', {
          style: {
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            minHeight: '50vh',
            padding: '24px',
            textAlign: 'center' as const,
            fontFamily: "'Poppins', sans-serif",
          },
        },
          createElement('div', {
            style: {
              width: 72, height: 72, borderRadius: 20,
              background: 'rgba(244, 63, 94, 0.1)',
              display: 'flex', alignItems: 'center' as const, justifyContent: 'center' as const,
              marginBottom: 20,
            },
          }, '⚠️'),
          createElement('h2', {
            style: { fontSize: 20, fontWeight: 600, color: '#F9FAFB', marginBottom: 8 },
          }, 'Something went wrong'),
          createElement('p', {
            style: { fontSize: 14, color: '#9CA3AF', maxWidth: 400, lineHeight: 1.6, marginBottom: 24 },
          }, this.state.error?.message || 'An unexpected error occurred.'),
          createElement('button', {
            onClick: () => this.setState({ hasError: false, error: null, errorInfo: '' }),
            style: {
              padding: '10px 24px', background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: 10,
              color: '#00D4FF', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            },
          }, 'Try Again'),
        );
      }
      return createElement(WrappedComponent, this.props as P);
    }
  };
}