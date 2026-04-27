/**
 * Audit Logger — P7-005
 *
 * Lightweight fire-and-forget audit trail for data changes.
 * Persists to localStorage, optionally syncs to Supabase audit_log table.
 * Dispatches 'lifeos:audit-updated' custom event for reactive hooks.
 */

import type { AuditLogEntry, AuditLogFilter } from '../types/audit-log';

// Re-export for convenience
export type { AuditLogFilter } from '../types/audit-log';

const STORAGE_KEY = 'lifeos:audit-log';
const MAX_RECORDS = 500;

// ─── Helpers ─────────────────────────────────────────────────

function computeChangedFields(oldData: Record<string, any> | undefined, newData: Record<string, any> | undefined): string[] | undefined {
  if (!oldData || !newData) return undefined;
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changed.push(key);
    }
  }
  return changed.length > 0 ? changed : undefined;
}

function loadEntries(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AuditLogEntry[];
  } catch {
    return [];
  }
}

function saveEntries(entries: AuditLogEntry[]): void {
  // Cap at MAX_RECORDS, trimming oldest first
  const trimmed = entries.length > MAX_RECORDS
    ? entries.slice(entries.length - MAX_RECORDS)
    : entries;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — silently drop
  }
}

function notifyUpdate(): void {
  try {
    window.dispatchEvent(new CustomEvent('lifeos:audit-updated'));
  } catch {
    // SSR or non-browser env
  }
}

// ─── Supabase persistence (non-blocking) ─────────────────────

async function persistToSupabase(entry: AuditLogEntry): Promise<void> {
  try {
    const { db } = await import('../lib/data-access');
    await db.from('audit_log').insert({
      id: entry.id,
      user_id: entry.user_id || undefined,
      action: entry.action,
      table_name: entry.table_name,
      record_id: entry.record_id,
      old_data: entry.old_data || null,
      new_data: entry.new_data || null,
      changed_fields: entry.changed_fields || null,
      created_at: entry.created_at,
    });
  } catch {
    // Non-blocking — if Supabase is unavailable, local audit trail still works
  }
}

// ─── Public API ──────────────────────────────────────────────

export interface LogAuditEntryParams {
  userId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  tableName: string;
  recordId: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
}

/**
 * Log an audit entry. Fire-and-forget — synchronous localStorage write,
 * async Supabase write in background. Never blocks the caller.
 */
export function logAuditEntry(params: LogAuditEntryParams): void {
  const { userId, action, tableName, recordId, oldData, newData } = params;

  const entry: AuditLogEntry = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData,
    new_data: newData,
    changed_fields: computeChangedFields(oldData, newData),
    created_at: new Date().toISOString(),
  };

  const entries = loadEntries();
  entries.push(entry);
  saveEntries(entries);
  notifyUpdate();

  // Fire and forget to Supabase
  persistToSupabase(entry).catch(() => {});
}

/**
 * Get audit log entries with optional filtering.
 * Returns entries in reverse chronological order.
 */
export function getAuditLog(filter?: AuditLogFilter): AuditLogEntry[] {
  let entries = loadEntries();

  // Apply filters
  if (filter?.tableName) {
    entries = entries.filter(e => e.table_name === filter.tableName);
  }
  if (filter?.action) {
    entries = entries.filter(e => e.action === filter.action);
  }
  if (filter?.since) {
    entries = entries.filter(e => e.created_at >= filter.since!);
  }

  // Sort newest first
  entries.sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Apply limit
  if (filter?.limit && filter.limit > 0) {
    entries = entries.slice(0, filter.limit);
  }

  return entries;
}

/**
 * Clear all audit log entries from localStorage.
 */
export function clearAuditLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notifyUpdate();
}