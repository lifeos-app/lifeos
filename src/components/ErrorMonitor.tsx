/**
 * ErrorMonitor — Collapsible error dashboard for LifeOS
 *
 * Glass card style matching existing design.
 * Visible only in development or to admin users.
 * Default collapsed, expands to full error list with stack traces.
 */

import { useState, useMemo } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Trash2, Bug } from 'lucide-react';
import { useErrorMonitor } from '../hooks/useErrorMonitor';
import { useUserStore } from '../stores/useUserStore';
import { captureError as captureErrorFn, addBreadcrumb as addBreadcrumbFn } from '../lib/error-monitor';
import type { Severity } from '../lib/error-monitor';

const ADMIN_EMAILS = ['tewedross12@gmail.com', 'teddyscleaning'];

function isAdminOrDev(): boolean {
  // Always visible in development
  if (import.meta.env?.DEV) return true;
  try {
    const user = useUserStore.getState().user;
    if (user?.email && ADMIN_EMAILS.some(e => user.email === e || user.email.toLowerCase().includes(e.toLowerCase()))) {
      return true;
    }
  } catch {
    // Must not throw
  }
  return false;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#F43F5E',
  error: '#FF6B35',
  warning: '#FACC15',
  info: '#00D4FF',
};

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

export function ErrorMonitor() {
  const [expanded, setExpanded] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const user = useUserStore(s => s.user);

  // Check visibility
  const visible = useMemo(() => {
    if (import.meta.env?.DEV) return true;
    if (user?.email && ADMIN_EMAILS.some(e => user.email === e || user.email.toLowerCase().includes(e.toLowerCase()))) {
      return true;
    }
    return false;
  }, [user?.email]);

  const { errors, count, clearAll } = useErrorMonitor(
    severityFilter === 'all' ? undefined : { severity: severityFilter }
  );

  // Severity breakdown
  const breakdown = useMemo(() => {
    const counts: Record<Severity, number> = { critical: 0, error: 0, warning: 0, info: 0 };
    for (const e of errors) {
      if (counts[e.severity] !== undefined) counts[e.severity]++;
    }
    return counts;
  }, [errors]);

  if (!visible) return null;

  if (!expanded) {
    // Collapsed: badge + count
    if (count === 0) return null;
    return (
      <div
        className="glass-card"
        onClick={() => setExpanded(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          position: 'relative',
        }}
      >
        <Bug size={16} color={count > 0 ? '#F43F5E' : '#6B7280'} />
        <span style={{ color: '#F9FAFB', fontSize: 13, fontWeight: 500 }}>
          Error Monitor
        </span>
        <span style={{
          background: count > 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(107, 114, 128, 0.15)',
          color: count > 0 ? '#F43F5E' : '#6B7280',
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 10,
        }}>
          {count}
        </span>
        <ChevronDown size={14} color="#6B7280" style={{ marginLeft: 'auto' }} />
      </div>
    );
  }

  // Expanded: full dashboard
  return (
    <div
      className="glass-card"
      style={{
        padding: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Bug size={18} color="#F43F5E" />
        <span style={{ color: '#F9FAFB', fontSize: 15, fontWeight: 600 }}>
          Error Monitor
        </span>
        <span style={{
          background: count > 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(107, 114, 128, 0.15)',
          color: count > 0 ? '#F43F5E' : '#6B7280',
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 10,
        }}>
          {count}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={clearAll}
            title="Clear all errors"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              background: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.15)',
              borderRadius: 8,
              color: '#F43F5E',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={12} /> Clear
          </button>
          <button
            onClick={() => setExpanded(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              color: '#6B7280',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 6px',
            }}
          >
            <ChevronUp size={14} />
          </button>
        </div>
      </div>

      {/* Severity breakdown */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSeverityFilter('all')}
          style={{
            padding: '3px 10px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            background: severityFilter === 'all' ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: severityFilter === 'all' ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)',
            color: severityFilter === 'all' ? '#F9FAFB' : '#6B7280',
          }}
        >
          All ({count})
        </button>
        {(Object.keys(SEVERITY_COLORS) as Severity[]).map(sev => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(sev)}
            style={{
              padding: '3px 10px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              background: severityFilter === sev
                ? `${SEVERITY_COLORS[sev]}15`
                : 'transparent',
              border: severityFilter === sev
                ? `1px solid ${SEVERITY_COLORS[sev]}30`
                : '1px solid rgba(255,255,255,0.06)',
              color: severityFilter === sev ? SEVERITY_COLORS[sev] : '#6B7280',
            }}
          >
            {SEVERITY_LABELS[sev]} ({breakdown[sev]})
          </button>
        ))}
      </div>

      {/* Error list */}
      <div style={{ maxHeight: 400, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {errors.length === 0 ? (
          <p style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No errors recorded
          </p>
        ) : (
          [...errors].reverse().map(err => (
            <ErrorItem key={err.id} error={err} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Individual error item ──────────────────────────────────────────────────

function ErrorItem({ error }: { error: import('../lib/error-monitor').ErrorRecord }) {
  const [showDetails, setShowDetails] = useState(false);

  const timeStr = new Date(error.timestamp).toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: 'numeric',
  });

  const sevColor = SEVERITY_COLORS[error.severity] || '#6B7280';

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${sevColor}15`,
        borderRadius: 8,
        padding: '8px 12px',
        cursor: 'pointer',
      }}
      onClick={() => setShowDetails(!showDetails)}
    >
      {/* Summary row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={12} color={sevColor} />
        <span style={{ color: sevColor, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
          {error.severity}
        </span>
        <span style={{ color: '#F9FAFB', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {error.message}
        </span>
        <span style={{ color: '#6B7280', fontSize: 10, whiteSpace: 'nowrap' }}>
          {timeStr}
        </span>
      </div>

      {/* Details (expandable) */}
      {showDetails && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${sevColor}10`, paddingTop: 8 }}>
          {/* Type + URL */}
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#6B7280', fontSize: 11 }}>Type: </span>
            <span style={{ color: '#8BA4BE', fontSize: 11 }}>{error.errorType}</span>
            {error.url && (
              <>
                <span style={{ color: '#6B7280', fontSize: 11, marginLeft: 12 }}>URL: </span>
                <span style={{ color: '#8BA4BE', fontSize: 11, wordBreak: 'break-all' }}>{error.url}</span>
              </>
            )}
          </div>

          {/* Stack trace */}
          {error.stack && (
            <details style={{ marginBottom: 6 }} open>
              <summary style={{ color: '#6B7280', fontSize: 11, cursor: 'pointer' }}>Stack trace</summary>
              <pre style={{
                fontSize: 10,
                color: '#F43F5E',
                marginTop: 4,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 120,
                overflow: 'auto',
                background: 'rgba(244, 63, 94, 0.04)',
                padding: 8,
                borderRadius: 6,
              }}>
                {error.stack.slice(0, 2000)}
              </pre>
            </details>
          )}

          {/* Component stack */}
          {error.componentStack && (
            <details style={{ marginBottom: 6 }}>
              <summary style={{ color: '#6B7280', fontSize: 11, cursor: 'pointer' }}>Component stack</summary>
              <pre style={{
                fontSize: 10,
                color: '#FACC15',
                marginTop: 4,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 80,
                overflow: 'auto',
                background: 'rgba(250, 204, 21, 0.04)',
                padding: 8,
                borderRadius: 6,
              }}>
                {error.componentStack.slice(0, 2000)}
              </pre>
            </details>
          )}

          {/* Breadcrumbs */}
          {error.breadcrumbs.length > 0 && (
            <details style={{ marginBottom: 6 }}>
              <summary style={{ color: '#6B7280', fontSize: 11, cursor: 'pointer' }}>
                Breadcrumbs ({error.breadcrumbs.length})
              </summary>
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {error.breadcrumbs.map((bc, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, fontSize: 10 }}>
                    <span style={{ color: '#6B7280' }}>
                      {new Date(bc.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ color: '#00D4FF' }}>[{bc.category}]</span>
                    <span style={{ color: '#8BA4BE' }}>{bc.message}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Metadata */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10, color: '#6B7280' }}>
            {error.userAgent && <span>UA: {error.userAgent.slice(0, 80)}...</span>}
            {error.userId && <span>User: {error.userId.slice(0, 8)}...</span>}
          </div>
        </div>
      )}
    </div>
  );
}