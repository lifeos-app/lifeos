/**
 * sync-engine.ts — Bidirectional Sync Between Local DB and Supabase
 *
 * Handles:
 * 1. Push: Upload unsynced local records to Supabase
 * 2. Pull: Download server changes newer than last_sync_at
 * 3. Conflict resolution: Last-write-wins based on updated_at
 * 4. First-time sync: User creates local data → signs up → all data syncs up
 *
 * Sync is triggered:
 * - On auth (user logs in / signs up)
 * - On online event (network reconnected)
 * - Periodically in background (every 5 minutes when online + authed)
 * - Manually (user clicks "Sync Now" button)
 */

import { db as supabase, getEnvironment } from './data-access';
import { useUserStore } from '../stores/useUserStore';
import { logger } from '../utils/logger';
import { getTabCoordinator, initTabCoordinator } from './tab-coordinator';
import type { TableName } from './local-db';
import { detectConflict, logConflict } from './sync-conflict';

// ── Cloud Sync for Electron ──
// In Electron, `db` routes to local SQLite. When a cloud session exists
// (user logged in via Google OAuth), we need the cloud Supabase client
// for push/pull operations.
let _cloudSupabase: any = null;

/**
 * Get the appropriate Supabase client for sync operations.
 * - Web: returns the standard db adapter (already cloud)
 * - Electron + cloud session: returns the cloud Supabase client
 * - Electron + local mode: returns the db adapter (SQLite)
 * - Tauri: returns the db adapter (local)
 */
async function getSyncClient(): Promise<any> {
  const env = getEnvironment();
  if (env === 'electron') {
    const mode = useUserStore.getState().mode;
    if (mode === 'synced') {
      // Cloud session active — use cloud Supabase for data sync
      if (!_cloudSupabase) {
        const { supabase: cloud } = await import('./supabase');
        _cloudSupabase = cloud;
      }
      return _cloudSupabase;
    }
  }
  // Web, Tauri, or Electron local mode: use the standard db adapter
  return supabase;
}
import {
  localGetUnsynced,
  localMarkSynced,
  localBulkUpsert,
  getSyncMeta,
  updateSyncMeta,
  getKeyPath,
  type TableName,
} from './local-db';

// Tables to sync (excludes meta tables)
// SYNC ORDER MATTERS — parent tables MUST sync before child tables.
// Foreign key constraints mean children fail (409) if parents don't exist yet.
//
// Dependency graph:
//   businesses → (standalone)
//   expense_categories → (standalone)
//   categories → (standalone, self-referential parent_id)
//   goals → businesses (FK)
//   projects → goals (FK)
//   notes → categories (FK)
//   tasks → goals, categories, projects, expense_categories (FK)
//   events → categories, expense_categories (FK)
//   habit_logs → habits (FK via habit_id)
//
// 'events' maps to Supabase 'schedule_events' via TABLE_MAP.
// Do NOT also list 'schedule_events' — that would cause double-sync.
const SYNC_TABLES: TableName[] = [
  // Tier 0: No FK dependencies (safe to sync first)
  'lesson_progress',
  'parts_inventory',
  'user_xp',
  'user_profile',      // Singleton per user (keyPath: user_id → Supabase: user_profiles)
  'businesses',
  'clients',
  'expense_categories',
  'categories',
  'budgets',
  'journal_entries',
  'health_metrics',
  'workouts',
  'workout_exercises',
  'income',
  'expenses',
  'bills',
  'xp_events',
  'achievements',
  'inventory_items',
  'pet_profiles',
  'assets',
  'asset_maintenance',
  'asset_bills',
  'asset_documents',

  // Tier 1: Depend on Tier 0
  'goals',         // FK → businesses
  'habits',        // standalone but before habit_logs
  'projects',      // FK → goals
  'notes',         // FK → categories

  // Tier 2: Depend on Tier 1
  'tasks',         // FK → goals, categories, projects, expense_categories
  'events',        // FK → expense_categories (maps to schedule_events)
  'habit_logs',    // FK → habits
  'transactions',  // FK → businesses, clients, tasks, events

  // Tier 3: Activity & AI
  'unified_events',    // Activity log entries
  'event_completions', // XP award records for live activity
  'ai_insights',       // AI-generated insights
];

// Tables that were previously synced but no longer are — clean up their retry queue entries
const REMOVED_SYNC_TABLES: string[] = [];

// Supabase table name mapping (local → remote, if different)
const TABLE_MAP: Record<string, string> = {
  events: 'schedule_events',
  user_profile: 'user_profiles',
  // Add any other mappings here if local/remote names differ
};

function getSupabaseTable(localTable: string): string {
  return TABLE_MAP[localTable] || localTable;
}

/**
 * STATIC FALLBACK: Exact columns that exist in each Supabase table.
 * Used as fallback when runtime schema introspection is unavailable.
 * Runtime introspection (via get_table_columns RPC) is the primary source.
 *
 * To update: query Supabase schema and regenerate this map.
 * This eliminates 400 errors from local-only fields leaking into API calls.
 */
const STATIC_COLUMNS: Record<string, Set<string>> = {
  tasks: new Set(['id','user_id','title','description','status','priority','due_date','due_time','estimated_minutes','actual_minutes','category_id','project_id','goal_id','parent_task_id','sort_order','completed_at','created_at','updated_at','is_deleted','sync_status','financial_amount','financial_type','financial_category_id','board_status','board_position','depth_level','depends_on_task_id','scheduled_start','scheduled_end','energy_level','domain','suggested_week','auto_scheduled']),
  schedule_events: new Set(['id','user_id','title','description','start_time','end_time','all_day','category_id','recurrence_rule','location','color','is_template','day_type','created_at','updated_at','is_deleted','sync_status','financial_amount','financial_type','financial_category_id','event_type','workout_template_id','status','metadata','is_live','schedule_layer','source']),
  goals: new Set(['id','user_id','title','description','category','parent_goal_id','status','target_date','progress','color','icon','sort_order','created_at','updated_at','is_deleted','sync_status','budget_allocated','financial_type','expected_return','business_id','domain','priority','estimated_hours','deadline_type','success_criteria','key_results','resources','decomposition_source','health_status']),
  habits: new Set(['id','user_id','title','description','frequency','target_count','category_id','color','icon','streak_current','streak_best','is_active','created_at','updated_at','is_deleted','sync_status','source','category','time_of_day','duration_minutes','goal_id']),
  habit_logs: new Set(['id','habit_id','date','count','notes','created_at','sync_status','user_id','value','completed','updated_at']),
  health_metrics: new Set(['id','user_id','date','weight_kg','height_cm','bmi','mood_score','energy_score','sleep_hours','sleep_quality','water_glasses','notes','created_at','updated_at','is_deleted','exercise_minutes']),
  workouts: new Set(['id','user_id','title','type','duration_minutes','calories_burned','notes','completed_at','created_at','updated_at']),
  workout_exercises: new Set(['id','user_id','workout_id','exercise_name','sets','reps','weight','duration_seconds','notes','created_at','updated_at']),
  income: new Set(['id','user_id','amount','description','source','client_id','date','is_recurring','recurrence_rule','category_id','created_at','updated_at','is_deleted','sync_status']),
  expenses: new Set(['id','user_id','amount','description','category_id','date','is_deductible','receipt_url','payment_method','created_at','updated_at','is_deleted','sync_status','is_recurring','travel_km']),
  bills: new Set(['id','user_id','title','amount','due_date','is_recurring','recurrence_rule','status','paid_date','payment_url','notes','category_id','created_at','updated_at','is_deleted','sync_status']),
  businesses: new Set(['id','user_id','name','type','icon','color','status','notes','created_at','updated_at','is_deleted']),
  clients: new Set(['id','user_id','name','email','phone','address','latitude','longitude','rate','rate_type','notes','sop','access_codes','color','is_active','created_at','updated_at','is_deleted','sync_status','business_id']),
  expense_categories: new Set(['id','user_id','name','icon','color','scope','budget_monthly','sort_order','created_at','updated_at']),
  transactions: new Set(['id','user_id','type','amount','title','date','category_id','business_id','client_id','task_id','event_id','notes','recurring','created_at','updated_at']),
  budgets: new Set(['id','user_id','category_id','month','amount','notes','created_at','updated_at']),
  journal_entries: new Set(['id','user_id','date','title','content','mood','energy','tags','created_at','updated_at','is_deleted','sync_status','image_url']),
  user_xp: new Set(['user_id','total_xp','level','title','stats','created_at','updated_at']),
  xp_events: new Set(['id','user_id','action_type','xp_amount','multiplier','description','created_at','updated_at']),
  achievements: new Set(['id','user_id','achievement_id','progress','unlocked_at','created_at','updated_at']),
  inventory_items: new Set(['id','user_id','name','description','category','subcategory','list_type','slot','brand','color','size','image_url','purchase_date','purchase_price','condition','is_equipped','is_favorite','tags','metadata','created_at','updated_at','is_deleted']),
  pet_profiles: new Set(['id','user_id','inventory_item_id','name','species','breed','birthday','weight','vet_name','vet_phone','next_vet_date','feeding_schedule','medications','avatar_url','metadata','created_at','is_deleted','updated_at']),
  parts_inventory: new Set(['id','user_id','name','description','category','quantity','unit_price','location','supplier','sku','condition','notes','tags','custom_fields','image_url','created_at','updated_at','is_deleted','sync_status']),
  categories: new Set(['id','user_id','name','color','icon','parent_id','domain','sort_order','created_at','updated_at','is_deleted','sync_status']),
  projects: new Set(['id','user_id','title','description','status','color','icon','goal_id','start_date','target_date','created_at','updated_at','is_deleted','sync_status']),
  notes: new Set(['id','user_id','title','content','category_id','is_pinned','created_at','updated_at','is_deleted','sync_status']),
  assets: new Set(['id','user_id','name','description','category','purchase_date','purchase_price','current_value','location','condition','notes','tags','image_url','warranty_expiry','created_at','updated_at','is_deleted','sync_status']),
  asset_maintenance: new Set(['id','user_id','asset_id','title','description','date','cost','provider','status','next_date','notes','created_at','updated_at','is_deleted','sync_status']),
  asset_bills: new Set(['id','user_id','asset_id','title','amount','due_date','is_recurring','recurrence_rule','status','paid_date','payment_url','notes','created_at','updated_at','is_deleted','sync_status']),
  asset_documents: new Set(['id','user_id','asset_id','title','type','file_url','file_size','mime_type','notes','created_at','updated_at','is_deleted','sync_status']),
  unified_events: new Set(['id','user_id','type','timestamp','title','details','source','is_deleted','created_at','updated_at','module_source']),
  event_completions: new Set(['id','user_id','schedule_event_id','event_type','duration_min','xp_awarded','metadata','completed_at','created_at']),
  ai_insights: new Set(['id','user_id','type','title','content','data','source','is_read','is_dismissed','created_at','updated_at']),
  user_profiles: new Set(['user_id','display_name','occupation','primary_focus','onboarding_complete','preferences','email','full_name','avatar_url','timezone','subscription_tier','stripe_customer_id','subscription_id','subscription_expires_at','created_at','updated_at']),
};

// ── Runtime Schema Cache ──
// Fetches actual column names from Supabase via RPC, caches for 1 hour.
// Falls back to STATIC_COLUMNS when unavailable (empty tables, network error).
let _runtimeColumns: Record<string, Set<string>> | null = null;
let _runtimeColumnsTs = 0;
const SCHEMA_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchRuntimeColumns(): Promise<Record<string, Set<string>> | null> {
  if (_runtimeColumns && (Date.now() - _runtimeColumnsTs) < SCHEMA_CACHE_TTL) {
    return _runtimeColumns;
  }

  // Skip schema introspection in Tauri mode — uses local SQLite directly
  // In Electron+synced mode, we CAN introspect the cloud schema
  const syncEnv = getEnvironment();
  if (syncEnv === 'tauri') {
    return null;
  }
  if (syncEnv === 'electron' && useUserStore.getState().mode !== 'synced') {
    return null;
  }

  try {
    const tableNames = SYNC_TABLES.map(t => getSupabaseTable(t));
    const client = await getSyncClient();
    const { data, error } = await client.rpc('get_table_columns', { table_names: tableNames });

    if (error || !data) {
      logger.warn('[sync] Schema introspection failed, using static fallback:', error?.message);
      return null;
    }

    const cols: Record<string, Set<string>> = {};
    for (const row of data as Array<{ table_name: string; column_name: string }>) {
      if (!cols[row.table_name]) cols[row.table_name] = new Set();
      cols[row.table_name].add(row.column_name);
    }

    _runtimeColumns = cols;
    _runtimeColumnsTs = Date.now();
    logger.log('[sync] Schema introspection succeeded:', Object.keys(cols).length, 'tables');
    return cols;
  } catch (e) {
    logger.warn('[sync] Schema introspection error, using static fallback:', e);
    return null;
  }
}

// ── Schema Validation (non-blocking, runs once per session) ──
let _schemaValidated = false;

async function validateSchemaOnce(): Promise<void> {
  if (_schemaValidated) return;
  _schemaValidated = true;

  const runtime = await fetchRuntimeColumns();
  if (!runtime) return;

  for (const table of SYNC_TABLES) {
    const st = getSupabaseTable(table);
    const staticCols = STATIC_COLUMNS[st];
    const runtimeCols = runtime[st];

    if (runtimeCols && staticCols) {
      const missing = [...runtimeCols].filter(c => !staticCols.has(c));
      const extra = [...staticCols].filter(c => !runtimeCols.has(c));
      if (missing.length) logger.warn(`[sync] Schema drift: ${st} has columns not in static whitelist:`, missing);
      if (extra.length) logger.warn(`[sync] Schema drift: ${st} static whitelist has columns not in Supabase:`, extra);
    }
  }
}

/**
 * Field renames: local name → Supabase column name.
 * Applied before whitelist filtering.
 */
const FIELD_RENAMES: Record<string, Record<string, string>> = {
  tasks: {
    estimated_duration: 'estimated_minutes',
    actual_duration: 'actual_minutes',
  },
};

/**
 * Sanitize a record before pushing to Supabase.
 * WHITELIST approach: only fields that exist in the Supabase table are kept.
 * Everything else is silently dropped. No more 400 errors from unknown columns.
 * Uses runtime schema introspection (cached 1hr), falls back to STATIC_COLUMNS.
 */
async function sanitizeForSupabase(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  // Resolve the Supabase table name (e.g. 'events' → 'schedule_events')
  const supabaseTable = getSupabaseTable(table);
  const runtimeCols = await fetchRuntimeColumns();
  const allowedColumns = runtimeCols?.[supabaseTable] || STATIC_COLUMNS[supabaseTable];

  // If we don't have a whitelist for this table, fall back to stripping only 'synced'
  if (!allowedColumns) {
    const cleaned = { ...data };
    delete cleaned.synced;
    return cleaned;
  }

  // Apply field renames first
  const renames = FIELD_RENAMES[table] || {};
  const renamed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const newKey = renames[key] || key;
    renamed[newKey] = value;
  }

  // Whitelist: only keep fields that exist in Supabase
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(renamed)) {
    if (allowedColumns.has(key) && !isKnownMissing(supabaseTable, key)) {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Get the primary key value from a record using the table's keyPath.
 * Most tables use 'id', but user_xp uses 'user_id', etc.
 */
function getRecordKey(table: TableName, record: Record<string, unknown>): string {
  const keyPath = getKeyPath(table);
  return record[keyPath];
}

// ══════════════════════════════════════════════════════════════
// Learned Missing Columns (self-healing schema drift)
// ══════════════════════════════════════════════════════════════

/**
 * When a push fails because a column doesn't exist in Supabase,
 * we add it here so future pushes strip it automatically.
 * Key: "supabaseTable:columnName", Value: timestamp when learned.
 */
const _learnedMissingCols: Map<string, number> = new Map();
const MISSING_COL_KEY = 'lifeos_sync_missing_cols';

function loadMissingCols(): void {
  try {
    const raw = localStorage.getItem(MISSING_COL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const [k, v] of Object.entries(parsed)) {
        _learnedMissingCols.set(k, v as number);
      }
    }
  } catch { /* ignore */ }
}

function saveMissingCols(): void {
  const obj: Record<string, number> = {};
  for (const [k, v] of _learnedMissingCols) obj[k] = v;
  localStorage.setItem(MISSING_COL_KEY, JSON.stringify(obj));
}

function learnMissingColumn(supabaseTable: string, colName: string): void {
  const key = `${supabaseTable}:${colName}`;
  if (!_learnedMissingCols.has(key)) {
    logger.warn(`[sync] Learned missing column: ${key}`);
    _learnedMissingCols.set(key, Date.now());
    saveMissingCols();
  }
}

function isKnownMissing(supabaseTable: string, colName: string): boolean {
  return _learnedMissingCols.has(`${supabaseTable}:${colName}`);
}

// Load on module init
loadMissingCols();

// ══════════════════════════════════════════════════════════════
// Retry Queue & Error Recovery
// ══════════════════════════════════════════════════════════════

const RETRY_QUEUE_KEY = 'lifeos_sync_retry_queue';
const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 60 seconds

interface RetryRecord {
  id: string;
  table: TableName;
  operation: 'push' | 'pull';
  recordId: string;
  attempts: number;
  lastAttempt: number;
  nextRetry: number;
  error: string;
}

/**
 * Calculate exponential backoff delay.
 */
function calculateBackoff(attempts: number): number {
  const delay = Math.min(BASE_RETRY_DELAY * Math.pow(2, attempts), MAX_RETRY_DELAY);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

/**
 * Get retry queue from localStorage.
 * Automatically cleans out entries for tables that are no longer synced.
 */
function getRetryQueue(): RetryRecord[] {
  try {
    const json = localStorage.getItem(RETRY_QUEUE_KEY);
    if (!json) return [];
    const queue: RetryRecord[] = JSON.parse(json);
    // Filter out entries for removed tables
    const cleaned = queue.filter(r => !REMOVED_SYNC_TABLES.includes(r.table));
    if (cleaned.length !== queue.length) {
      saveRetryQueue(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

/**
 * Save retry queue to localStorage.
 */
function saveRetryQueue(queue: RetryRecord[]): void {
  try {
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    logger.error('[sync] Failed to save retry queue:', e);
  }
}

/**
 * Add failed operation to retry queue.
 */
function addToRetryQueue(
  table: TableName,
  recordId: string,
  operation: 'push' | 'pull',
  error: string
): void {
  const queue = getRetryQueue();
  const existingIndex = queue.findIndex(
    r => r.table === table && r.recordId === recordId && r.operation === operation
  );

  if (existingIndex >= 0) {
    // Update existing retry record
    const existing = queue[existingIndex];
    existing.attempts++;
    existing.lastAttempt = Date.now();
    existing.error = error;
    existing.nextRetry = Date.now() + calculateBackoff(existing.attempts);

    // Remove if max attempts reached
    if (existing.attempts >= MAX_RETRY_ATTEMPTS) {
      logger.error(
        `[sync] Max retries reached for ${table}#${recordId} (${operation}):`,
        error
      );
      queue.splice(existingIndex, 1);
    }
  } else {
    // Add new retry record
    queue.push({
      id: `${table}_${recordId}_${operation}_${Date.now()}`,
      table,
      operation,
      recordId,
      attempts: 1,
      lastAttempt: Date.now(),
      nextRetry: Date.now() + calculateBackoff(0),
      error,
    });
  }

  saveRetryQueue(queue);
}

/**
 * Remove successfully synced operation from retry queue.
 */
function removeFromRetryQueue(
  table: TableName,
  recordId: string,
  operation: 'push' | 'pull'
): void {
  const queue = getRetryQueue();
  const filtered = queue.filter(
    r => !(r.table === table && r.recordId === recordId && r.operation === operation)
  );
  saveRetryQueue(filtered);
}

/**
 * Get records ready for retry (next retry time has passed).
 */
function getReadyRetries(): RetryRecord[] {
  const queue = getRetryQueue();
  const now = Date.now();
  return queue.filter(r => r.nextRetry <= now && r.attempts < MAX_RETRY_ATTEMPTS);
}

/**
 * Clear all retry queue entries.
 */
export function clearRetryQueue(): void {
  localStorage.removeItem(RETRY_QUEUE_KEY);
  logger.log('[sync] Retry queue cleared');
}

/**
 * Get retry queue status for UI.
 */
export function getRetryQueueStatus(): {
  pending: number;
  failed: number;
  records: RetryRecord[];
} {
  const queue = getRetryQueue();
  return {
    pending: queue.filter(r => r.attempts < MAX_RETRY_ATTEMPTS).length,
    failed: queue.filter(r => r.attempts >= MAX_RETRY_ATTEMPTS).length,
    records: queue,
  };
}

// ══════════════════════════════════════════════════════════════
// Sync State & Events
// ══════════════════════════════════════════════════════════════

let _isSyncing = false;
let _lastSyncAt = 0;
const _listeners: Set<(status: SyncStatus) => void> = new Set();

export interface SyncStatus {
  syncing: boolean;
  lastSyncAt: number;
  error: string | null;
  pushedCount: number;
  pulledCount: number;
  retryPending: number;
  retryFailed: number;
}

export function getSyncStatus(): SyncStatus {
  const retryStatus = getRetryQueueStatus();
  return {
    syncing: _isSyncing,
    lastSyncAt: _lastSyncAt,
    error: null,
    pushedCount: 0,
    pulledCount: 0,
    retryPending: retryStatus.pending,
    retryFailed: retryStatus.failed,
  };
}

export function onSyncChange(cb: (status: SyncStatus) => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function notifyListeners(status: SyncStatus) {
  _listeners.forEach(cb => cb(status));
}

// ══════════════════════════════════════════════════════════════
// Push: Local → Supabase
// ══════════════════════════════════════════════════════════════

/**
 * Fetch current remote versions of records and detect sync conflicts.
 * For each local record being pushed, checks if the remote already has a newer
 * version. If so, logs the conflict. Then proceeds with the LWW upsert as before
 * (no behavior change — conflicts are detection-only at this stage).
 *
 * Batch-fetches remote records in a single query per table for efficiency.
 *
 * @returns Number of conflicts detected during this push batch.
 */
async function detectConflictsForUpsert(
  table: TableName,
  localRecords: Record<string, unknown>[],
  pkField: string,
  syncClient: any
): Promise<number> {
  if (localRecords.length === 0) return 0;

  const supabaseTable = getSupabaseTable(table);

  // Collect the primary key values for all records being pushed
  const pkValues = localRecords.map(r => r[pkField]).filter(Boolean);
  if (pkValues.length === 0) return 0;

  let conflictsDetected = 0;

  try {
    // Batch-fetch current remote versions — single query, not one per record
    const { data: remoteRows, error } = await syncClient
      .from(supabaseTable)
      .select('*')
      .in(pkField, pkValues);

    if (error || !remoteRows || remoteRows.length === 0) {
      // No remote versions exist yet — no conflicts possible
      return 0;
    }

    // Index remote rows by pk for O(1) lookup
    const remoteByPk = new Map<string, Record<string, unknown>>();
    for (const row of remoteRows) {
      remoteByPk.set(String(row[pkField]), row);
    }

    // Compare each local record against its remote version
    for (const localRecord of localRecords) {
      const pk = String(localRecord[pkField]);
      const remoteRecord = remoteByPk.get(pk);
      if (!remoteRecord) continue; // No remote version → no conflict

      const conflict = detectConflict(localRecord, remoteRecord, table);
      if (conflict) {
        logConflict(conflict);
        conflictsDetected++;
      }
    }
  } catch (e: unknown) {
    // Conflict detection is best-effort — never block the sync
    logger.warn(`[sync] Conflict detection failed for ${table}:`, e);
  }

  return conflictsDetected;
}

/**
 * Push all unsynced local records to Supabase with retry logic.
 */
async function pushToSupabase(userId: string): Promise<number> {
  let totalPushed = 0;
  const syncClient = await getSyncClient();

  // First, process retry queue for push operations
  const retries = getReadyRetries().filter(r => r.operation === 'push');
  for (const retry of retries) {
    try {
      const unsynced = await localGetUnsynced(retry.table);
      const record = unsynced.find((r: Record<string, unknown>) => getRecordKey(retry.table, r) === retry.recordId);

      if (!record) {
        // Record no longer exists or already synced, remove from queue
        removeFromRetryQueue(retry.table, retry.recordId, 'push');
        continue;
      }

      const supabaseTable = getSupabaseTable(retry.table);
      const pkField = getKeyPath(retry.table);
      const recordKey = getRecordKey(retry.table, record);
      const { synced, ...data } = record;

      if (record.deleted_at || record.is_deleted) {
        // Only include is_deleted in update if the cloud table has it
        const deleteUpdate: Record<string, unknown> = {};
        if (!isKnownMissing(supabaseTable, 'is_deleted')) {
          deleteUpdate.is_deleted = true;
        }
        // If table doesn't have is_deleted, we can't soft-delete — 
        // just mark as synced locally (record stays in Supabase as-is)
        const { error } = Object.keys(deleteUpdate).length > 0
          ? await syncClient.from(supabaseTable).update(deleteUpdate).eq(pkField, recordKey)
          : { error: null }; // Nothing to update, treat as success

        if (!error) {
          await localMarkSynced(retry.table, recordKey);
          removeFromRetryQueue(retry.table, retry.recordId, 'push');
          totalPushed++;
          logger.log(`[sync] Retry succeeded: ${retry.table}#${retry.recordId}`);
        } else {
          addToRetryQueue(retry.table, retry.recordId, 'push', error.message);
        }
      } else {
        // Conflict detection for retry upsert (best-effort)
        detectConflictsForUpsert(retry.table, [record], pkField, syncClient).catch(() => {});

        const { error } = await syncClient
          .from(supabaseTable)
          .upsert(await sanitizeForSupabase(retry.table, data), { onConflict: pkField });

        if (!error) {
          await localMarkSynced(retry.table, recordKey);
          removeFromRetryQueue(retry.table, retry.recordId, 'push');
          totalPushed++;
          logger.log(`[sync] Retry succeeded: ${retry.table}#${retry.recordId}`);
        } else {
          addToRetryQueue(retry.table, retry.recordId, 'push', error.message);
        }
      }
    } catch (e: unknown) {
      addToRetryQueue(retry.table, retry.recordId, 'push', e.message || 'Unknown error');
    }
  }

  // Then, push new unsynced records (batched per table)
  for (const table of SYNC_TABLES) {
    try {
      const unsynced = await localGetUnsynced(table);
      if (unsynced.length === 0) continue;

      const supabaseTable = getSupabaseTable(table);
      const pkField = getKeyPath(table);

      // Separate into upserts vs soft deletes
      const toUpsert: Record<string, unknown>[] = [];
      const toDelete: Record<string, unknown>[] = [];
      for (const record of unsynced) {
        const { synced, ...data } = record;
        if (record.deleted_at || record.is_deleted) {
          toDelete.push(record);
        } else {
          toUpsert.push({ record, data });
        }
      }

      // Batch upsert
      if (toUpsert.length > 0) {
        // Conflict detection (best-effort, non-blocking): check if remote has newer versions
        const localRecordsForConflict = toUpsert.map(r => r.record);
        detectConflictsForUpsert(table, localRecordsForConflict, pkField, syncClient).catch(() => {});

        const batchData = await Promise.all(toUpsert.map(r => sanitizeForSupabase(table, r.data)));
        const { error } = await syncClient.from(supabaseTable).upsert(batchData, { onConflict: pkField });
        if (!error) {
          for (const { record } of toUpsert) {
            const rk = getRecordKey(table, record);
            await localMarkSynced(table, rk);
            removeFromRetryQueue(table, rk, 'push');
            totalPushed++;
          }
        } else {
          // Fallback to individual upserts
          logger.warn(`[sync] Batch upsert failed for ${table}, falling back to individual:`, error.message);
          for (const { record, data } of toUpsert) {
            const rk = getRecordKey(table, record);
            const { error: indError } = await syncClient.from(supabaseTable).upsert(await sanitizeForSupabase(table, data), { onConflict: pkField });
            if (!indError) {
              await localMarkSynced(table, rk);
              removeFromRetryQueue(table, rk, 'push');
              totalPushed++;
            } else {
              // Check if error is about a missing column — learn it and retry once
              const colMatch = indError.message?.match(/column ["']?(\w+)["']? does not exist/i) ||
                               indError.message?.match(/Could not find.*column.*['"](\w+)['"]/i);
              if (colMatch) {
                learnMissingColumn(supabaseTable, colMatch[1]);
                // Retry with the column stripped
                const retryData = await sanitizeForSupabase(table, data);
                const { error: retryErr } = await syncClient.from(supabaseTable)
                  .upsert(retryData, { onConflict: pkField });
                if (!retryErr) {
                  await localMarkSynced(table, rk);
                  removeFromRetryQueue(table, rk, 'push');
                  totalPushed++;
                  continue;
                }
              }
              addToRetryQueue(table, rk, 'push', indError.message);
            }
          }
        }
      }

      // Batch soft deletes
      if (toDelete.length > 0) {
        const deleteIds = toDelete.map(r => getRecordKey(table, r));
        // Only include is_deleted if cloud table has it
        const deletePayload: Record<string, unknown> = {};
        if (!isKnownMissing(supabaseTable, 'is_deleted')) {
          deletePayload.is_deleted = true;
        }
        if (Object.keys(deletePayload).length > 0) {
          const { error } = await syncClient.from(supabaseTable)
            .update(deletePayload)
            .in(pkField, deleteIds);
          if (!error) {
            for (const record of toDelete) {
              const rk = getRecordKey(table, record);
              await localMarkSynced(table, rk);
              removeFromRetryQueue(table, rk, 'push');
              totalPushed++;
            }
          } else {
            // Fallback to individual deletes
            for (const record of toDelete) {
              const rk = getRecordKey(table, record);
              const { error: indError } = await syncClient.from(supabaseTable)
                .update(deletePayload)
                .eq(pkField, rk);
              if (!indError) {
                await localMarkSynced(table, rk);
                removeFromRetryQueue(table, rk, 'push');
                totalPushed++;
              } else {
                addToRetryQueue(table, rk, 'push', indError.message);
              }
            }
          }
        } else {
          // Table doesn't have is_deleted — just mark as synced locally
          for (const record of toDelete) {
            const rk = getRecordKey(table, record);
            await localMarkSynced(table, rk);
            totalPushed++;
          }
        }
      }

      logger.log(`[sync] Pushed ${unsynced.length} records from ${table}`);
    } catch (e: unknown) {
      logger.error(`[sync] Error pushing ${table}:`, e);
      // Table-level errors don't add to retry queue, they'll be retried on next sync
    }
  }

  return totalPushed;
}

// ══════════════════════════════════════════════════════════════
// Pull: Supabase → Local
// ══════════════════════════════════════════════════════════════

/**
 * Pull server changes newer than last sync with retry logic.
 */
/**
 * Pull a single table from Supabase with pagination.
 * PostgREST defaults to 1000-row limit — we page through all results.
 */
async function pullTable(userId: string, table: TableName): Promise<number> {
  const syncClient = await getSyncClient();
  const meta = await getSyncMeta(table);
  const lastPull = meta?.last_pull_at || new Date(0).toISOString();
  const supabaseTable = getSupabaseTable(table);
  const PAGE_SIZE = 1000;
  let offset = 0;
  let totalForTable = 0;

  // Page through all results
  while (true) {
    const { data, error } = await syncClient
      .from(supabaseTable)
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', lastPull)
      .order('updated_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      logger.warn(`[sync] Failed to pull ${table}:`, error.message);
      addToRetryQueue(table, `__table_pull__`, 'pull', error.message);
      return totalForTable;
    }

    if (data && data.length > 0) {
      await localBulkUpsert(table, data);
      totalForTable += data.length;
    }

    // If we got fewer rows than PAGE_SIZE, we've reached the end
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (totalForTable > 0) {
    logger.log(`[sync] Pulled ${totalForTable} records into ${table}`);
    removeFromRetryQueue(table, `__table_pull__`, 'pull');
  } else {
    removeFromRetryQueue(table, `__table_pull__`, 'pull');
  }

  await updateSyncMeta(table, { last_pull_at: new Date().toISOString() });
  return totalForTable;
}

async function pullFromSupabase(userId: string): Promise<number> {
  let totalPulled = 0;

  // Pull tables in parallel tiers to speed up initial sync
  // Tier 0: no FK dependencies — safe to pull in parallel
  const tier0: TableName[] = [
    'user_xp', 'businesses', 'clients', 'expense_categories', 'categories',
    'budgets', 'journal_entries', 'health_metrics', 'workouts', 'workout_exercises',
    'income', 'expenses', 'bills', 'xp_events', 'achievements', 'inventory_items', 'pet_profiles',
    'parts_inventory', 'assets', 'asset_maintenance', 'asset_bills', 'asset_documents',
  ];
  // Tier 1: depend on tier 0
  const tier1: TableName[] = ['goals', 'habits', 'projects', 'notes'];
  // Tier 2: depend on tier 1
  const tier2: TableName[] = ['tasks', 'events', 'habit_logs', 'transactions'];

  for (const tier of [tier0, tier1, tier2]) {
    const activeTables = tier.filter(t => SYNC_TABLES.includes(t));
    const results = await Promise.allSettled(
      activeTables.map(async (table) => {
        try {
          return await pullTable(userId, table);
        } catch (e: unknown) {
          logger.error(`[sync] Error pulling ${table}:`, e);
          addToRetryQueue(table, `__table_pull__`, 'pull', e.message || 'Unknown error');
          return 0;
        }
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') totalPulled += r.value;
    }
  }

  return totalPulled;
}

// ══════════════════════════════════════════════════════════════
// Main Sync Function
// ══════════════════════════════════════════════════════════════

let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _syncResolvers: Array<(v: SyncStatus) => void> = [];

/**
 * Debounced sync — coalesces rapid mutations into a single sync cycle.
 * All callers receive the same result promise.
 */
export function syncNow(userId?: string): Promise<SyncStatus> {
  return new Promise((resolve) => {
    _syncResolvers.push(resolve);
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
      _syncTimer = null;
      const resolvers = [..._syncResolvers];
      _syncResolvers = [];
      const result = await _doSync(userId);
      resolvers.forEach(r => r(result));
    }, 3000);
  });
}

/**
 * Immediate sync — bypasses debounce. Use for init, online events, manual sync.
 */
export async function syncNowImmediate(userId?: string): Promise<SyncStatus> {
  if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; }
  const resolvers = [..._syncResolvers];
  _syncResolvers = [];
  const result = await _doSync(userId);
  resolvers.forEach(r => r(result));
  return result;
}

/**
 * Run full bidirectional sync: push local → pull server.
 */
async function _doSync(userId?: string): Promise<SyncStatus> {
  // Check if user is authenticated
  const { data: { session } } = await useUserStore.getState().getSessionCached();
  const retryStatus = getRetryQueueStatus();

  if (!session?.user) {
    return {
      syncing: false,
      lastSyncAt: _lastSyncAt,
      error: 'Not authenticated — sync skipped',
      pushedCount: 0,
      pulledCount: 0,
      retryPending: retryStatus.pending,
      retryFailed: retryStatus.failed,
    };
  }

  const uid = userId || session.user.id;

  // Prevent concurrent syncs
  if (_isSyncing) {
    return {
      syncing: true,
      lastSyncAt: _lastSyncAt,
      error: 'Sync already in progress',
      pushedCount: 0,
      pulledCount: 0,
      retryPending: retryStatus.pending,
      retryFailed: retryStatus.failed,
    };
  }

  _isSyncing = true;
  notifyListeners({
    syncing: true,
    lastSyncAt: _lastSyncAt,
    error: null,
    pushedCount: 0,
    pulledCount: 0,
    retryPending: retryStatus.pending,
    retryFailed: retryStatus.failed,
  });

  let pushed = 0;
  let pulled = 0;
  let error: string | null = null;

  try {
    logger.log('[sync] Starting bidirectional sync...');

    // Schema validation (fire-and-forget, logs drift warnings)
    validateSchemaOnce().catch(() => {});

    // 1. Push local changes to server (includes retry queue)
    pushed = await pushToSupabase(uid);

    // 2. Pull server changes to local (includes retry queue)
    pulled = await pullFromSupabase(uid);

    _lastSyncAt = Date.now();

    const finalRetryStatus = getRetryQueueStatus();
    logger.log(
      `[sync] Complete — pushed ${pushed}, pulled ${pulled}, ` +
      `retries pending: ${finalRetryStatus.pending}, failed: ${finalRetryStatus.failed}`
    );

    // Trigger UI refresh
    window.dispatchEvent(new Event('lifeos-refresh'));

    // Broadcast sync completion to other tabs via BroadcastChannel
    getTabCoordinator().broadcastSyncComplete();
  } catch (e: unknown) {
    error = e.message || 'Unknown sync error';
    logger.error('[sync] Sync failed:', e);
  } finally {
    _isSyncing = false;

    const finalRetryStatus = getRetryQueueStatus();
    const status: SyncStatus = {
      syncing: false,
      lastSyncAt: _lastSyncAt,
      error,
      pushedCount: pushed,
      pulledCount: pulled,
      retryPending: finalRetryStatus.pending,
      retryFailed: finalRetryStatus.failed,
    };

    notifyListeners(status);
    return status;
  }
}

// ══════════════════════════════════════════════════════════════
// Auto Sync (Background)
// ══════════════════════════════════════════════════════════════

let _autoSyncInterval: number | null = null;

/**
 * Start background auto-sync (every 5 minutes when online + authed).
 * Only the leader tab runs periodic sync to avoid race conditions
 * when multiple tabs are open.
 */
export function startAutoSync() {
  if (_autoSyncInterval) return;
  
  _autoSyncInterval = window.setInterval(async () => {
    // Only the leader tab runs periodic sync
    const coordinator = getTabCoordinator();
    if (!coordinator.isLeader) {
      return;
    }

    // Only sync if online
    if (!navigator.onLine) return;

    // Only sync if authenticated
    const { data: { session } } = await useUserStore.getState().getSessionCached();
    if (!session?.user) return;

    await syncNowImmediate(session.user.id);
  }, 5 * 60 * 1000); // 5 minutes
  
  logger.log('[sync] Auto-sync enabled (every 5 min, leader-only)');
}

/**
 * Stop background auto-sync.
 */
export function stopAutoSync() {
  if (_autoSyncInterval) {
    clearInterval(_autoSyncInterval);
    _autoSyncInterval = null;
    logger.log('[sync] Auto-sync disabled');
  }
}

// ══════════════════════════════════════════════════════════════
// Sync on Auth & Online Events
// ══════════════════════════════════════════════════════════════

/**
 * Initialize sync listeners (call once on app startup).
 */
export function initSyncEngine() {
  // NOTE: Auth-triggered sync is handled by useUserStore.initAuth() via triggerSync().
  // No onAuthStateChange listener here — prevents duplicate listeners and cascade races.

  // Sync on online event
  window.addEventListener('online', async () => {
    const { data: { session } } = await useUserStore.getState().getSessionCached();
    if (session?.user) {
      logger.log('[sync] Back online — triggering sync');
      await syncNowImmediate(session.user.id);
    }
  });
  
  // Start background auto-sync
  startAutoSync();
  
  // Initialize tab coordinator for multi-tab coordination
  initTabCoordinator((table?: TableName) => {
    // Invalidate caches when another tab writes or sync completes.
    // Dispatch the same 'lifeos-refresh' event that stores listen to.
    // If a specific table is provided, we could be more targeted, but
    // for now a broad refresh is safe and consistent.
    logger.log(`[sync] Tab coordinator invalidation (table=${table || 'all'}) — dispatching lifeos-refresh`);
    window.dispatchEvent(new Event('lifeos-refresh'));
  });

  // Register cleanup on tab close
  window.addEventListener('beforeunload', () => {
    getTabCoordinator().dispose();
  });

  logger.log('[sync] Sync engine initialized');
}

// ══════════════════════════════════════════════════════════════
// Manual Sync Trigger (for UI button)
// ══════════════════════════════════════════════════════════════

/**
 * Expose immediate sync for manual trigger (e.g., Settings button).
 */
export { syncNowImmediate as manualSync };

/**
 * triggerSync — called by useUserStore after auth events to kick off a sync.
 * Uses immediate sync to avoid delay on login/signup.
 */
export const triggerSync = syncNowImmediate;

// ══════════════════════════════════════════════════════════════
// Initial Sync Gate — stores await this before first load
// ══════════════════════════════════════════════════════════════

let _initialSyncPromise: Promise<SyncStatus> | null = null;

/**
 * Set the initial sync promise (called once on login).
 * Stores should await this before reading from local DB
 * to ensure Supabase data has been pulled in.
 */
export function setInitialSyncPromise(p: Promise<SyncStatus>): void {
  _initialSyncPromise = p;
  // Auto-clear after resolution so subsequent fetchAll calls aren't blocked
  p.finally(() => { _initialSyncPromise = null; });
}

/**
 * Wait for the initial sync to complete (if one is in progress).
 * Returns immediately if no initial sync is pending.
 */
export async function waitForInitialSync(): Promise<void> {
  if (_initialSyncPromise) {
    await _initialSyncPromise;
  }
}

/**
 * Broadcast a local write event to other tabs.
 * Stores should call this after localInsert/localUpdate/localDelete
 * so other tabs invalidate their caches.
 */
export function broadcastLocalWrite(table: TableName, recordId?: string): void {
  getTabCoordinator().broadcastLocalWrite(table, recordId);
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).syncEngine = {
    syncNow: syncNowImmediate,
    getStatus: getSyncStatus,
    startAuto: startAutoSync,
    stopAuto: stopAutoSync,
    getRetryQueue: getRetryQueueStatus,
    clearRetryQueue,
    isLeader: () => getTabCoordinator().isLeader,
  };
}
