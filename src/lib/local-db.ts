/**
 * local-db.ts — Local-First IndexedDB Wrapper
 *
 * Complete offline database that mirrors ALL Supabase tables locally.
 * App reads from here FIRST, syncs to Supabase when online + authenticated.
 *
 * Schema: Each record includes:
 * - id (string): Primary key
 * - synced (boolean): Whether pushed to Supabase
 * - updated_at (string): ISO timestamp for conflict resolution
 * - deleted_at (string | null): Soft delete timestamp
 * - user_id (string): Local user ID (local UUID until account created)
 * - ...table-specific fields
 */

import { genId } from '../utils/date';
import { logger } from '../utils/logger';

const DB_NAME = 'lifeos-local';
const DB_VERSION = 8;

// All object stores (tables)
const STORES = {
  // Core data
  tasks: 'id',
  events: 'id',
  schedule_events: 'id',
  goals: 'id',
  habits: 'id',
  habit_logs: 'id',
  
  // Health
  health_metrics: 'id',
  workouts: 'id',
  workout_exercises: 'id',
  
  // Finance
  income: 'id',
  expenses: 'id',
  bills: 'id',
  businesses: 'id',
  clients: 'id',
  expense_categories: 'id',
  transactions: 'id',
  budgets: 'id',
  
  // Categories, Projects, Notes
  categories: 'id',
  projects: 'id',
  notes: 'id',

  // Journal & Reflect
  journal_entries: 'id',
  
  // User & Gamification
  user_profile: 'user_id',
  user_xp: 'user_id',
  xp_events: 'id',
  achievements: 'id',

  // Inventory & Character
  inventory_items: 'id',
  pet_profiles: 'id',

  // Parts Inventory (Digital Replicator)
  parts_inventory: 'id',

  // Assets
  assets: 'id',
  asset_maintenance: 'id',
  asset_bills: 'id',
  asset_documents: 'id',

  // Lessons
  lesson_progress: 'id',

  // Activity & Events
  unified_events: 'id',
  event_completions: 'id',

  // AI
  ai_insights: 'id',

  // Meta (sync state)
  sync_meta: 'table_name',
} as const;

/**
 * Get the IDB keyPath for a given table.
 * Most tables use 'id', but some (user_xp, user_profile, sync_meta) differ.
 */
export function getKeyPath(table: TableName): string {
  return STORES[table];
}

let _db: IDBDatabase | null = null;
let _dbPromise: Promise<IDBDatabase> | null = null;

// ══════════════════════════════════════════════════════════════
// Database Initialization
// ══════════════════════════════════════════════════════════════

export async function openLocalDB(): Promise<IDBDatabase> {
  if (_db) return _db;
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;
      
      // v3 → v4: Recreate user_xp with keyPath 'user_id' instead of 'id'
      if (oldVersion >= 3 && oldVersion < 4) {
        if (db.objectStoreNames.contains('user_xp')) {
          db.deleteObjectStore('user_xp');
        }
      }
      
      // Create all object stores (skips existing)
      for (const [storeName, keyPath] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath });
          
          // Add useful indices
          if (storeName !== 'sync_meta' && storeName !== 'user_profile') {
            store.createIndex('synced', 'synced', { unique: false });
            store.createIndex('updated_at', 'updated_at', { unique: false });
            if (storeName !== 'user_xp' && storeName !== 'xp_events' && storeName !== 'achievements') {
              store.createIndex('user_id', 'user_id', { unique: false });
            }
          }
          
          // Table-specific indices
          if (storeName === 'tasks' || storeName === 'events' || storeName === 'expenses' || storeName === 'income' || storeName === 'bills') {
            store.createIndex('date', storeName === 'tasks' ? 'due_date' : storeName === 'events' ? 'start_time' : storeName === 'bills' ? 'due_date' : 'date', { unique: false });
          }
          if (storeName === 'habit_logs') {
            store.createIndex('habit_id', 'habit_id', { unique: false });
            store.createIndex('date', 'date', { unique: false });
          }
          if (storeName === 'journal_entries') {
            store.createIndex('date', 'date', { unique: false });
          }
          if (storeName === 'health_metrics') {
            store.createIndex('date', 'date', { unique: false });
          }
          if (storeName === 'unified_events') {
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('type', 'type', { unique: false });
          }
          if (storeName === 'event_completions') {
            store.createIndex('completed_at', 'completed_at', { unique: false });
            store.createIndex('schedule_event_id', 'schedule_event_id', { unique: false });
          }
          if (storeName === 'ai_insights') {
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('created_at', 'created_at', { unique: false });
          }
        }
      }
      
      logger.log('[local-db] Database upgraded from v' + oldVersion + ' to v' + DB_VERSION);
    };

    request.onsuccess = () => {
      _db = request.result;
      _db.onclose = () => {
        _db = null;
        _dbPromise = null;
      };
      resolve(_db);
    };

    request.onerror = () => {
      _dbPromise = null;
      reject(request.error);
    };
  });

  return _dbPromise;
}

// ══════════════════════════════════════════════════════════════
// Local User ID Management
// ══════════════════════════════════════════════════════════════

const LOCAL_USER_KEY = 'lifeos_local_user_id';

/**
 * Get the current local user ID. Creates one if it doesn't exist.
 * This is used until the user creates a Supabase account.
 */
export function getLocalUserId(): string {
  let uid = localStorage.getItem(LOCAL_USER_KEY);
  if (!uid) {
    uid = genId();
    localStorage.setItem(LOCAL_USER_KEY, uid);
  }
  return uid;
}

/**
 * Get the effective user ID for data creation.
 * ALWAYS prefers the authenticated Supabase user ID (so records pass RLS).
 * Falls back to local user ID only when not authenticated.
 * 
 * This MUST be used for all record creation to ensure:
 * 1. Records are visible through RLS SELECT policies
 * 2. Tasks, goals, habits all share the same user_id
 * 3. Cross-table queries (e.g. tasks under goals) work correctly
 */
export function getEffectiveUserId(): string {
  // Check cached auth user first (sync import to avoid circular deps)
  try {
    const _ref = (import.meta.env.VITE_SUPABASE_URL || '').match(/\/\/([^.]+)\./)?.[1] || 'app';
    const stored = localStorage.getItem(`sb-${_ref}-auth-token`);
    if (stored) {
      const parsed = JSON.parse(stored);
      const userId = parsed?.user?.id;
      if (userId) return userId;
    }
  } catch { /* ignore parse errors */ }
  return getLocalUserId();
}

/**
 * Migrate ALL local records to the authenticated Supabase user ID.
 * Called on auth to ensure all local data uses the correct user_id.
 * 
 * This handles:
 * 1. Records created with a local UUID (pre-auth)
 * 2. Records from a previous auth session (different account)
 * 3. Records pulled from server with old user_id
 * 
 * All records in IndexedDB belong to the local user — if they're logged
 * in as user X, all local records should have user_id = X.
 */
export async function migrateLocalUserToSupabase(supabaseUserId: string): Promise<void> {
  const localUserId = getLocalUserId();

  const db = await openLocalDB();
  
  // Update ALL records that don't match the current auth user
  const tables = Object.keys(STORES).filter(t => t !== 'sync_meta' && t !== 'user_profile');
  
  for (const table of tables) {
    try {
      const tx = db.transaction(table, 'readwrite');
      const store = tx.objectStore(table);
      const allRecords = await new Promise<any[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      
      for (const record of allRecords) {
        if (record.user_id && record.user_id !== supabaseUserId) {
          record.user_id = supabaseUserId;
          record.synced = false; // Mark for re-sync with correct user_id
          record.updated_at = new Date().toISOString();
          store.put(record);
        }
      }
      
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      
      const migrated = allRecords.filter(r => r.user_id && r.user_id !== supabaseUserId).length;
      if (migrated > 0) {
        logger.log(`[local-db] Migrated ${migrated}/${allRecords.length} records in ${table} to auth user ${supabaseUserId.slice(0, 8)}`);
      }
    } catch (e) {
      logger.error(`[local-db] Failed to migrate ${table}:`, e);
    }
  }
  
  // Update stored user ID
  localStorage.setItem(LOCAL_USER_KEY, supabaseUserId);
}

// ══════════════════════════════════════════════════════════════
// CRUD Operations
// ══════════════════════════════════════════════════════════════

export type TableName = keyof typeof STORES;

interface BaseRecord {
  id: string;
  synced: boolean;
  updated_at: string;
  deleted_at?: string | null;
  user_id?: string;
  [key: string]: unknown;
}

/**
 * Insert a record into local DB. Auto-adds metadata fields.
 */
export async function localInsert<T extends Partial<BaseRecord>>(
  table: TableName,
  data: T
): Promise<T & BaseRecord> {
  const db = await openLocalDB();
  const tx = db.transaction(table, 'readwrite');
  const store = tx.objectStore(table);
  
  const record: BaseRecord = {
    id: data.id || genId(),
    synced: false,
    updated_at: new Date().toISOString(),
    deleted_at: null,
    user_id: data.user_id || getEffectiveUserId(),
    ...data,
  };
  
  try {
    store.add(record);
  } catch {
    // ConstraintError (duplicate key) — fall back to upsert
    store.put(record);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      // If .add() failed with ConstraintError, retry with .put() in a new tx
      if (tx.error?.name === 'ConstraintError') {
        const retryTx = db.transaction(table, 'readwrite');
        retryTx.objectStore(table).put(record);
        retryTx.oncomplete = () => resolve();
        retryTx.onerror = () => reject(retryTx.error);
      } else {
        reject(tx.error);
      }
    };
  });

  return record as T & BaseRecord;
}

/**
 * Update a record by ID. Marks as unsynced.
 */
export async function localUpdate<T extends Partial<BaseRecord>>(
  table: TableName,
  id: string,
  updates: T
): Promise<void> {
  const db = await openLocalDB();
  const tx = db.transaction(table, 'readwrite');
  const store = tx.objectStore(table);
  
  const existing = await new Promise<any>((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  
  if (!existing) {
    throw new Error(`Record not found: ${table}#${id}`);
  }
  
  const updated = {
    ...existing,
    ...updates,
    synced: false,
    updated_at: new Date().toISOString(),
  };
  
  store.put(updated);
  
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Soft delete (set deleted_at timestamp).
 */
export async function localDelete(table: TableName, id: string): Promise<void> {
  await localUpdate(table, id, {
    deleted_at: new Date().toISOString(),
    is_deleted: true,
  } as any);
}

/**
 * Hard delete (remove from local DB).
 */
export async function localHardDelete(table: TableName, id: string): Promise<void> {
  const db = await openLocalDB();
  const tx = db.transaction(table, 'readwrite');
  const store = tx.objectStore(table);
  
  store.delete(id);
  
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a single record by ID.
 */
export async function localGet<T = any>(table: TableName, id: string): Promise<T | null> {
  const db = await openLocalDB();
  const tx = db.transaction(table, 'readonly');
  const store = tx.objectStore(table);
  
  return new Promise<T | null>((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Query all records in a table.
 */
export async function localGetAll<T = any>(table: TableName): Promise<T[]> {
  const db = await openLocalDB();
  const tx = db.transaction(table, 'readonly');
  const store = tx.objectStore(table);
  const userId = getEffectiveUserId();

  return new Promise<T[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const results = req.result.filter((r: Record<string, unknown>) =>
        !r.user_id || r.user_id === userId
      );
      resolve(results as T[]);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Query records by index.
 */
export async function localQuery<T = any>(
  table: TableName,
  indexName: string,
  value: unknown
): Promise<T[]> {
  const db = await openLocalDB();
  const tx = db.transaction(table, 'readonly');
  const store = tx.objectStore(table);
  const index = store.index(indexName);
  
  return new Promise<T[]>((resolve, reject) => {
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all unsynced records for a table.
 * Note: We scan all records and filter because boolean `false` is not
 * a valid IndexedDB key — index.getAll(false) throws DataError.
 */
export async function localGetUnsynced<T = any>(table: TableName): Promise<T[]> {
  const db = await openLocalDB();
  const tx = db.transaction(table, 'readonly');
  const store = tx.objectStore(table);

  return new Promise<T[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      // Match both boolean false and numeric 0 for backwards compat
      const results = req.result.filter((r: Record<string, unknown>) => !r.synced);
      resolve(results as T[]);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Mark a record as synced.
 * Uses the store's keyPath to locate the record (handles tables where
 * the primary key is not 'id', e.g. user_xp uses 'user_id').
 */
export async function localMarkSynced(table: TableName, id: string): Promise<void> {
  const db = await openLocalDB();
  const tx = db.transaction(table, 'readwrite');
  const store = tx.objectStore(table);
  
  // Try fetching by the provided id first
  const record = await new Promise<any>((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null); // key mismatch won't throw, just returns undefined
  });
  
  if (record) {
    record.synced = true;
    store.put(record);
  }
  
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Bulk upsert records (used during sync pull from Supabase).
 */
export async function localBulkUpsert<T extends BaseRecord>(
  table: TableName,
  records: T[]
): Promise<void> {
  const db = await openLocalDB();
  const tx = db.transaction(table, 'readwrite');
  const store = tx.objectStore(table);
  
  for (const record of records) {
    // Ensure required metadata fields exist
    const fullRecord = {
      ...record,
      synced: record.synced ?? true, // Coming from server, so already synced
      updated_at: record.updated_at || new Date().toISOString(),
      deleted_at: record.deleted_at || null,
    };

    // Protect unsynced local edits: if local version has unpushed changes
    // AND is newer than the server record, merge fields instead of wholesale overwrite.
    const keyPath = store.keyPath as string;
    const key = (fullRecord as Record<string, unknown>)[keyPath];
    if (!key) {
      // Record missing the keyPath field — skip to avoid IDB DataError
      logger.warn(`[local-db] Skipping record in ${table} — missing keyPath '${keyPath}'`);
      continue;
    }
    const getReq = store.get(key);
    getReq.onsuccess = () => {
      const local = getReq.result;
      if (
        local &&
        local.synced === false &&
        local.updated_at &&
        fullRecord.updated_at &&
        local.updated_at > fullRecord.updated_at
      ) {
        // Local edit is newer and unsynced — perform field-level merge.
        // For each field, keep the local value if it differs from the last-known
        // server value, otherwise take the new server value.
        // In practice, the simple record-level check is: keep local since
        // local is newer. But we also merge in any server-only fields that
        // local doesn't have (e.g., new columns added server-side).
        const merged = { ...fullRecord };
        for (const [field, value] of Object.entries(local)) {
          // Always preserve local metadata and unsynced data
          if (field === 'synced') continue; // keep false from local
          if (value !== undefined && value !== null) {
            merged[field] = value;
          }
        }
        // Ensure local stays marked as unsynced
        merged.synced = false;
        merged.updated_at = local.updated_at;
        store.put(merged);
        return;
      }
      store.put(fullRecord);
    };
    getReq.onerror = () => {
      // No local record — safe to put
      store.put(fullRecord);
    };
  }
  
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ══════════════════════════════════════════════════════════════
// Sync Metadata
// ══════════════════════════════════════════════════════════════

interface SyncMeta {
  table_name: string;
  last_sync_at: string;
  last_pull_at: string;
}

/**
 * Get sync metadata for a table.
 */
export async function getSyncMeta(table: TableName): Promise<SyncMeta | null> {
  const db = await openLocalDB();
  const tx = db.transaction('sync_meta', 'readonly');
  const store = tx.objectStore('sync_meta');
  
  return new Promise<SyncMeta | null>((resolve, reject) => {
    const req = store.get(table);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update sync metadata for a table.
 */
export async function updateSyncMeta(table: TableName, updates: Partial<SyncMeta>): Promise<void> {
  const db = await openLocalDB();
  const tx = db.transaction('sync_meta', 'readwrite');
  const store = tx.objectStore('sync_meta');
  
  const existing = await new Promise<SyncMeta | null>((resolve, reject) => {
    const req = store.get(table);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  
  const meta: SyncMeta = {
    table_name: table,
    last_sync_at: existing?.last_sync_at || new Date().toISOString(),
    last_pull_at: existing?.last_pull_at || new Date().toISOString(),
    ...updates,
  };
  
  store.put(meta);
  
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ══════════════════════════════════════════════════════════════
// Helper: Get active user's records
// ══════════════════════════════════════════════════════════════

/**
 * Get all records for the current user (local or Supabase).
 */
export async function localGetForUser<T = any>(table: TableName, userId?: string): Promise<T[]> {
  const uid = userId || getLocalUserId();
  
  // Tables without user_id index
  if (table === 'sync_meta' || table === 'user_profile' || table === 'expense_categories') {
    return localGetAll<T>(table);
  }
  
  return localQuery<T>(table, 'user_id', uid);
}

/**
 * Count unsynced records across all tables.
 */
export async function getUnsyncedCount(): Promise<number> {
  const tables = Object.keys(STORES).filter(t => t !== 'sync_meta' && t !== 'user_profile') as TableName[];
  let total = 0;
  
  for (const table of tables) {
    const unsynced = await localGetUnsynced(table);
    total += unsynced.length;
  }
  
  return total;
}

// ══════════════════════════════════════════════════════════════
// Debugging / Dev Tools
// ══════════════════════════════════════════════════════════════

/**
 * Clear all data from local DB (for testing/reset).
 */
export async function clearLocalDB(): Promise<void> {
  const db = await openLocalDB();
  const tables = Object.keys(STORES) as TableName[];
  
  for (const table of tables) {
    const tx = db.transaction(table, 'readwrite');
    const store = tx.objectStore(table);
    store.clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  
  logger.log('[local-db] All local data cleared');
}

/**
 * Export all local data as JSON (for backup/debugging).
 */
export async function exportLocalData(): Promise<Record<string, any[]>> {
  const tables = Object.keys(STORES) as TableName[];
  const dump: Record<string, any[]> = {};
  
  for (const table of tables) {
    dump[table] = await localGetAll(table);
  }
  
  return dump;
}

/**
 * Get DB stats (record counts per table).
 */
export async function getDBStats(): Promise<Record<string, number>> {
  const tables = Object.keys(STORES) as TableName[];
  const stats: Record<string, number> = {};
  
  for (const table of tables) {
    const records = await localGetAll(table);
    stats[table] = records.length;
  }
  
  return stats;
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).localDB = {
    getStats: getDBStats,
    exportData: exportLocalData,
    clearAll: clearLocalDB,
    getUnsynced: getUnsyncedCount,
  };
}
