/**
 * AuditLogViewer — Admin-only audit trail viewer (P7-005)
 *
 * Shows recent data changes in reverse chronological order.
 * Color-coded: green=INSERT, yellow=UPDATE, red=DELETE.
 * Expandable rows showing old_data vs new_data diff.
 * Glass card style matching AIUsageStats.
 */

import { useState } from 'react';
import { useUserStore } from '../stores/useUserStore';
import { useAuditLog } from '../hooks/useAuditLog';
import { Shield, Trash2, ChevronDown, ChevronRight, Filter } from 'lucide-react';

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email === 'tewedross12@gmail.com' || email.includes('teddyscleaning');
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: '#10b981',
  UPDATE: '#f59e0b',
  DELETE: '#ef4444',
};

const ACTION_BG: Record<string, string> = {
  INSERT: 'rgba(16,185,129,0.08)',
  UPDATE: 'rgba(245,158,11,0.08)',
  DELETE: 'rgba(239,68,68,0.08)',
};

export function AuditLogViewer() {
  const user = useUserStore(s => s.user);
  const [tableFilter, setTableFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { entries, count, clearAll } = useAuditLog({
    tableName: tableFilter || undefined,
    action: (actionFilter as 'INSERT' | 'UPDATE' | 'DELETE') || undefined,
    limit: 200,
  });

  if (!isAdmin(user?.email)) return null;

  // Derive unique table names from entries
  const tableNames = [...new Set(entries.map(e => e.table_name))].sort();

  return (
    <div style={{
      background: 'rgba(15,15,30,0.8)',
      borderRadius: 16,
      padding: 24,
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Shield size={20} style={{ color: '#a78bfa' }} />
        <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: 18 }}>Audit Log</h3>
        <span style={{ color: '#64748b', fontSize: 12, marginLeft: 4 }}>{count} entries</span>
        <button
          onClick={clearAll}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          title="Clear audit log"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} style={{ color: '#64748b' }} />
          <select
            value={tableFilter}
            onChange={e => setTableFilter(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              color: '#e2e8f0',
              padding: '4px 8px',
              fontSize: 13,
            }}
          >
            <option value="">All tables</option>
            {tableNames.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: '#e2e8f0',
            padding: '4px 8px',
            fontSize: 13,
          }}
        >
          <option value="">All actions</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      {/* Entries list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map(entry => {
          const isExpanded = expandedId === entry.id;
          return (
            <div key={entry.id} style={{
              background: ACTION_BG[entry.action] || 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.04)',
              overflow: 'hidden',
            }}>
              {/* Row header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#e2e8f0',
                  fontSize: 13,
                  textAlign: 'left',
                }}
              >
                {isExpanded ? <ChevronDown size={14} style={{ color: '#64748b' }} /> : <ChevronRight size={14} style={{ color: '#64748b' }} />}
                <span style={{
                  fontWeight: 600,
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 4,
                  color: ACTION_COLORS[entry.action],
                  background: `${ACTION_COLORS[entry.action]}18`,
                  letterSpacing: 0.5,
                }}>
                  {entry.action}
                </span>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{entry.table_name}</span>
                <span style={{ color: '#475569', fontSize: 11, fontFamily: 'monospace' }}>{entry.record_id.slice(0, 8)}</span>
                {entry.changed_fields && entry.changed_fields.length > 0 && (
                  <span style={{ color: '#64748b', fontSize: 11 }}>
                    [{entry.changed_fields.join(', ')}]
                  </span>
                )}
                <span style={{ marginLeft: 'auto', color: '#475569', fontSize: 11 }}>
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </button>

              {/* Expanded diff */}
              {isExpanded && (
                <div style={{
                  padding: '0 12px 10px 44px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  {entry.action === 'INSERT' && entry.new_data && (
                    <DataView label="New Data" data={entry.new_data} color="#10b981" />
                  )}
                  {entry.action === 'DELETE' && entry.old_data && (
                    <DataView label="Deleted Data" data={entry.old_data} color="#ef4444" />
                  )}
                  {entry.action === 'UPDATE' && (
                    <>
                      {entry.old_data && <DataView label="Before" data={entry.old_data} color="#f59e0b" />}
                      {entry.new_data && <DataView label="After" data={entry.new_data} color="#10b981" />}
                      {entry.changed_fields && entry.changed_fields.length > 0 && (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          Changed: <span style={{ color: '#f59e0b' }}>{entry.changed_fields.join(', ')}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {entries.length === 0 && (
        <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>
          No audit entries recorded yet. Changes to journals, goals, and habits will appear here.
        </p>
      )}
    </div>
  );
}

function DataView({ label, data, color }: { label: string; data: Record<string, any>; color: string }) {
  return (
    <div>
      <span style={{ color, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <pre style={{
        color: '#cbd5e1',
        fontSize: 12,
        margin: 0,
        marginTop: 4,
        padding: '6px 8px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 6,
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}