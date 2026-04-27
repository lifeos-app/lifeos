/**
 * sync-conflict.ts — Sync Conflict Detection & Logging
 *
 * Minimal conflict detection layer that runs BEFORE upserts in the sync engine.
 * Does NOT change sync behavior (LWW still wins). It only DETECTS and LOGS
 * when a sync overwrites newer remote data, so we can later surface it to the user.
 *
 * Storage: localStorage under 'lifeos:conflicts' (namespace-safe).
 * Keeps last 100 conflicts, most recent first.
 */

// ── Types ──────────────────────────────────────────────────────

export interface ConflictRecord {
  id: string;            // uuid
  tableName: string;     // e.g. 'tasks'
  recordId: string;      // the pk of the conflicted record
  localUpdatedAt: string;   // ISO timestamp of local version
  remoteUpdatedAt: string;  // ISO timestamp of remote version
  winner: 'local' | 'remote';
  resolvedAt: string;    // ISO timestamp when conflict was detected/logged
  fieldChanges: { field: string; localValue: unknown; remoteValue: unknown }[];
}

// ── Constants ──────────────────────────────────────────────────

const CONFLICTS_STORAGE_KEY = 'lifeos:conflicts';
const MAX_CONFLICTS = 100;

// ── Helpers ────────────────────────────────────────────────────

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Find fields whose values differ between local and remote records.
 * Skips metadata fields that aren't meaningful for conflict reporting.
 */
function diffFields(
  local: Record<string, unknown>,
  remote: Record<string, unknown>
): { field: string; localValue: unknown; remoteValue: unknown }[] {
  const skipFields = new Set(['updated_at', 'created_at', 'synced', 'sync_status']);
  const changes: { field: string; localValue: unknown; remoteValue: unknown }[] = [];

  // Check all fields from both records
  const allFields = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const field of allFields) {
    if (skipFields.has(field)) continue;
    const localVal = local[field];
    const remoteVal = remote[field];
    // Use JSON.stringify for deep comparison of objects/arrays
    if (JSON.stringify(localVal) !== JSON.stringify(remoteVal)) {
      changes.push({ field, localValue: localVal, remoteValue: remoteVal });
    }
  }

  return changes;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Detect a conflict between local and remote versions of a record.
 *
 * A conflict exists when:
 *   - remote.updated_at > local.updated_at (remote is newer)
 *   - AND at least one field value differs (not just a timestamp difference)
 *
 * When a conflict is detected, under LWW the remote would normally win on pull
 * and the local would win on push (since we upsert with onConflict). The `winner`
 * field indicates which version LWW would select:
 *   - 'remote': remote is newer, so its data takes precedence
 *   - 'local': local is newer, so its data takes precedence (unusual during push)
 *
 * Returns null if no meaningful conflict (timestamps match, remote is older, or data is identical).
 */
export function detectConflict(
  localRecord: Record<string, unknown>,
  remoteRecord: Record<string, unknown>,
  tableName: string
): ConflictRecord | null {
  const localUpdatedAt = localRecord.updated_at as string | undefined;
  const remoteUpdatedAt = remoteRecord.updated_at as string | undefined;

  // No timestamps to compare — can't detect conflict
  if (!localUpdatedAt || !remoteUpdatedAt) return null;

  const localTs = new Date(localUpdatedAt).getTime();
  const remoteTs = new Date(remoteUpdatedAt).getTime();

  // No conflict if timestamps are equal or remote is older
  if (isNaN(localTs) || isNaN(remoteTs)) return null;
  if (remoteTs <= localTs) return null;

  // Remote is newer — check if any field values actually differ
  const fieldChanges = diffFields(localRecord, remoteRecord);
  if (fieldChanges.length === 0) return null; // Data is identical despite timestamp difference

  // Conflict detected: remote is newer AND has different data
  // Under LWW, remote would win if we pulled, or local overwrites on push (with onConflict:pk)
  const winner: 'local' | 'remote' = remoteTs > localTs ? 'remote' : 'local';

  // Determine the record ID — try common pk fields
  const recordId = (remoteRecord.id ?? localRecord.id ?? remoteRecord.user_id ?? 'unknown') as string;

  return {
    id: generateId(),
    tableName,
    recordId,
    localUpdatedAt,
    remoteUpdatedAt,
    winner,
    resolvedAt: new Date().toISOString(),
    fieldChanges,
  };
}

/**
 * Log a conflict to localStorage and console.
 * Keeps the last MAX_CONFLICTS entries (most recent first).
 */
export function logConflict(conflict: ConflictRecord): void {
  console.warn(
    `[sync-conflict] ${conflict.tableName}#${conflict.recordId} — winner: ${conflict.winner}, ` +
    `local: ${conflict.localUpdatedAt}, remote: ${conflict.remoteUpdatedAt}, ` +
    `${conflict.fieldChanges.length} field(s) changed`
  );

  try {
    const existing = readConflictsFromStorage();
    // Prepend newest, cap at MAX_CONFLICTS
    const updated = [conflict, ...existing].slice(0, MAX_CONFLICTS);
    localStorage.setItem(CONFLICTS_STORAGE_KEY, JSON.stringify(updated));

    // Dispatch a custom event so hooks can react without polling
    window.dispatchEvent(new CustomEvent('lifeos:conflicts-updated'));
  } catch (e) {
    console.error('[sync-conflict] Failed to persist conflict:', e);
  }
}

/**
 * Get conflict records from localStorage, most recent first.
 * @param limit Max records to return (default: all)
 */
export function getConflicts(limit?: number): ConflictRecord[] {
  const all = readConflictsFromStorage();
  return limit ? all.slice(0, limit) : all;
}

/**
 * Clear all conflict records from localStorage.
 */
export function clearConflicts(): void {
  try {
    localStorage.removeItem(CONFLICTS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('lifeos:conflicts-updated'));
  } catch (e) {
    console.error('[sync-conflict] Failed to clear conflicts:', e);
  }
}

/**
 * Get the count of logged conflict records.
 */
export function getConflictCount(): number {
  return readConflictsFromStorage().length;
}

// ── Internal ───────────────────────────────────────────────────

function readConflictsFromStorage(): ConflictRecord[] {
  try {
    const raw = localStorage.getItem(CONFLICTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ConflictRecord[];
  } catch {
    return [];
  }
}