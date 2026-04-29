/**
 * sync-conflict.ts — Sync Conflict Detection, Logging & CRDT Resolution
 *
 * Detects conflicts between local and remote versions of records.
 * When USE_CRDT is true (default), conflicts are automatically resolved
 * using the CRDT engine for deterministic, type-aware merge instead of LWW.
 * Conflicts are still logged for audit purposes.
 *
 * Storage: localStorage under 'lifeos:conflicts' (namespace-safe).
 * Keeps last 100 conflicts, most recent first.
 */

import { CRDTEngine, type CRDTDocument } from './crdt-engine';

// ── Config ─────────────────────────────────────────────────────

/** Enable CRDT-based conflict resolution (default: true). Falls back to LWW when false. */
export let USE_CRDT = true;

/** Toggle CRDT resolution on/off. Useful for testing or emergency fallback. */
export function setUseCRDT(enabled: boolean): void {
  USE_CRDT = enabled;
}

// ── Types ──────────────────────────────────────────────────────

export interface ConflictRecord {
  id: string;            // uuid
  tableName: string;     // e.g. 'tasks'
  recordId: string;      // the pk of the conflicted record
  localUpdatedAt: string;   // ISO timestamp of local version
  remoteUpdatedAt: string;  // ISO timestamp of remote version
  winner: 'local' | 'remote' | 'crdt-merge';
  resolvedAt: string;    // ISO timestamp when conflict was detected/logged
  resolvedData?: Record<string, unknown> | null; // CRDT-merged data (when winner is 'crdt-merge')
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
 * When a conflict is detected, if USE_CRDT is true, the winner is set to
 * 'crdt-merge' and resolvedData is populated with the CRDT-merged result.
 * Otherwise, under LWW the remote would normally win on pull
 * and the local would win on push (since we upsert with onConflict). The `winner`
 * field indicates which version LWW would select:
 *   - 'remote': remote is newer, so its data takes precedence
 *   - 'local': local is newer, so its data takes precedence (unusual during push)
 *   - 'crdt-merge': CRDT merge was used to combine both versions
 *
 * Returns null if no meaningful conflict (timestamps match, remote is older, or data is identical).
 */
export function detectConflict(
  localRecord: Record<string, unknown>,
  remoteRecord: Record<string, unknown>,
  tableName: string,
  localCRDT?: CRDTDocument | null,
  remoteCRDT?: CRDTDocument | null
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
  const recordId = (remoteRecord.id ?? localRecord.id ?? remoteRecord.user_id ?? 'unknown') as string;

  // Resolve using CRDT if enabled
  let winner: ConflictRecord['winner'] = remoteTs > localTs ? 'remote' : 'local';
  let resolvedData: Record<string, unknown> | null = null;

  if (USE_CRDT) {
    try {
      const engine = CRDTEngine.getInstance();
      resolvedData = engine.resolveConflict(
        localRecord,
        remoteRecord,
        tableName,
        recordId,
        localCRDT,
        remoteCRDT
      );
      winner = 'crdt-merge';
    } catch (e) {
      // CRDT merge failed — fall back to LWW
      console.warn('[sync-conflict] CRDT merge failed, falling back to LWW:', e);
    }
  }

  return {
    id: generateId(),
    tableName,
    recordId,
    localUpdatedAt,
    remoteUpdatedAt,
    winner,
    resolvedAt: new Date().toISOString(),
    resolvedData,
    fieldChanges,
  };
}

/**
 * Log a conflict to localStorage and console.
 * Keeps the last MAX_CONFLICTS entries (most recent first).
 */
export function logConflict(conflict: ConflictRecord): void {
  const winnerLabel = conflict.winner === 'crdt-merge'
    ? `crdt-merge (${conflict.resolvedData ? 'resolved' : 'failed'})`
    : conflict.winner;

  console.warn(
    `[sync-conflict] ${conflict.tableName}#${conflict.recordId} — winner: ${winnerLabel}, ` +
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
 * Resolve a conflict between local and remote records using CRDT merge.
 * This is the primary entry point called by the sync engine when a conflict
 * is detected during push or pull.
 *
 * When USE_CRDT is true, creates CRDT documents from both sides and merges them,
 * returning the merged plain data. Falls back to LWW when USE_CRDT is false
 * or when CRDT state is unavailable.
 *
 * @returns The resolved record data that should be stored locally.
 */
export function resolveConflict(
  localRecord: Record<string, unknown>,
  remoteRecord: Record<string, unknown>,
  tableName: string,
  localCRDT?: CRDTDocument | null,
  remoteCRDT?: CRDTDocument | null
): Record<string, unknown> {
  if (USE_CRDT) {
    try {
      const engine = CRDTEngine.getInstance();
      const recordId = String(
        remoteRecord.id ?? localRecord.id ?? remoteRecord.user_id ?? 'unknown'
      );
      return engine.resolveConflict(
        localRecord,
        remoteRecord,
        tableName,
        recordId,
        localCRDT,
        remoteCRDT
      );
    } catch (e) {
      console.warn('[sync-conflict] CRDT resolution failed, falling back to LWW:', e);
    }
  }

  // LWW fallback: remote wins if newer, local wins otherwise
  const localTs = new Date(localRecord.updated_at as string || 0).getTime() || 0;
  const remoteTs = new Date(remoteRecord.updated_at as string || 0).getTime() || 0;
  return remoteTs > localTs ? { ...remoteRecord } : { ...localRecord };
}

/**
 * Given a ConflictRecord that was produced by detectConflict(),
 * extract the resolved data. If CRDT resolution was used, returns
 * the resolvedData; otherwise returns the LWW winner's data.
 */
export function getResolvedData(
  conflict: ConflictRecord,
  localRecord: Record<string, unknown>,
  remoteRecord: Record<string, unknown>
): Record<string, unknown> {
  if (conflict.winner === 'crdt-merge' && conflict.resolvedData) {
    return conflict.resolvedData;
  }
  return conflict.winner === 'remote' ? { ...remoteRecord } : { ...localRecord };
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