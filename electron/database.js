/**
 * LifeOS Electron Database Module
 *
 * Native SQLite backend using better-sqlite3.
 * Ports all CRUD, filter parsing, and file operations from:
 *   - src-tauri/src/lib.rs  (Tauri/Rust backend)
 *   - backend/app.py        (Flask backend)
 *
 * All responses match the Supabase-compatible format:
 *   { data: T | null, error: PostgrestError | null, status: number, statusText: string }
 *
 * Uses synchronous better-sqlite3 API (ideal for Electron main process).
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, basename, extname } from 'node:path';
import { homedir, platform } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const DEFAULT_USER_ID = 'local-user-001';

const ALLOWED_TABLES = new Set([
  'users', 'user_profiles', 'goals', 'tasks', 'habits', 'habit_logs',
  'schedule_events', 'health_metrics', 'workouts', 'workout_exercises',
  'expense_categories', 'businesses', 'transactions', 'budgets',
  'income', 'expenses', 'bills', 'clients', 'journal_entries',
  'rpg_characters', 'rpg_quest_log', 'user_xp', 'xp_events',
  'achievements', 'inventory_items', 'pet_profiles', 'categories',
  'projects', 'notes', 'assets', 'asset_maintenance', 'asset_bills',
  'asset_documents', 'ai_insights', 'chat_messages', 'unified_events',
  'sync_meta', 'lesson_progress', 'parts_inventory',
]);

const SOFT_DELETE_TABLES = new Set([
  'goals', 'tasks', 'habits', 'income', 'expenses', 'bills',
  'clients', 'journal_entries', 'businesses', 'categories', 'projects',
  'notes', 'assets', 'asset_maintenance', 'asset_bills', 'asset_documents',
  'inventory_items', 'pet_profiles', 'lesson_progress', 'parts_inventory',
]);

const TABLE_PK = {
  user_profiles: 'user_id',
  user_xp: 'user_id',
  sync_meta: 'table_name',
};

const NO_USER_ID_TABLES = new Set(['sync_meta']);

const JSON_FIELDS = new Set([
  'tags', 'metadata', 'preferences', 'stats', 'equipment',
  'position', 'sprite_data', 'exercises', 'attachments',
  'context', 'key_results', 'resources', 'steps_completed', 'custom_fields',
]);

const ALLOWED_COLUMNS = new Set([
  'id', 'user_id', 'created_at', 'updated_at', 'is_deleted', 'sync_status',
  'email', 'display_name', 'full_name', 'avatar_url', 'timezone',
  'subscription_tier', 'preferences', 'onboarding_complete',
  'occupation', 'primary_focus',
  'title', 'description', 'status', 'domain', 'category', 'financial_type',
  'parent_goal_id', 'budget_allocated', 'expected_return', 'business_id',
  'progress', 'target_date', 'priority', 'estimated_hours', 'deadline_type',
  'success_criteria', 'key_results', 'resources', 'decomposition_source',
  'health_status', 'icon', 'color', 'sort_order', 'source',
  'goal_id', 'due_date', 'due_time', 'scheduled_date', 'estimated_minutes',
  'actual_minutes', 'estimated_duration', 'actual_duration', 'category_id',
  'project_id', 'parent_task_id', 'depth_level', 'board_status',
  'board_position', 'depends_on_task_id', 'scheduled_start', 'scheduled_end',
  'energy_level', 'suggested_week', 'auto_scheduled', 'tags',
  'financial_amount', 'financial_category_id', 'completed_at',
  'frequency', 'target_count', 'streak_current', 'streak_best',
  'time_of_day', 'duration_minutes', 'is_active',
  'habit_id', 'date', 'count', 'value', 'completed', 'notes',
  'start_time', 'end_time', 'all_day', 'event_type', 'task_id',
  'workout_template_id', 'location', 'day_type', 'recurrence_rule',
  'is_recurring', 'htmlLink', 'metadata', 'schedule_layer',
  'is_template', 'is_live',
  'mood_score', 'energy_score', 'stress_score', 'sleep_hours',
  'sleep_quality', 'water_glasses', 'weight_kg', 'exercise_minutes',
  'day_of_week', 'preferred_time', 'exercises',
  'workout_id', 'name', 'sets', 'reps', 'weight', 'duration_seconds',
  'scope', 'budget_monthly',
  'type', 'industry', 'revenue_model', 'monthly_revenue', 'monthly_expenses',
  'amount', 'client_id', 'event_id', 'recurring',
  'month',
  'is_deductible', 'receipt_url', 'payment_method', 'travel_km',
  'paid_date', 'payment_url',
  'phone', 'address', 'latitude', 'longitude', 'rate', 'rate_type',
  'sop', 'access_codes',
  'content', 'mood', 'energy', 'image_url',
  'class', 'sprite_data', 'stats', 'equipment', 'position',
  'character_id', 'quest_id', 'source_type', 'source_id', 'xp_reward',
  'started_at',
  'total_xp', 'level', 'current_level_xp', 'next_level_xp',
  'code', 'tier', 'unlocked_at',
  'rarity', 'is_equipped', 'slot', 'quantity',
  'species', 'xp', 'hunger', 'happiness',
  'parent_id',
  'start_date',
  'is_pinned',
  'purchase_date',
  'asset_id', 'cost',
  'file_url', 'file_type',
  'role', 'attachments',
  'table_name', 'last_sync_at', 'record_count',
  'lesson_id', 'module_id', 'current_step', 'steps_completed',
  'total_practice_time', 'last_practiced_at',
  'supplier', 'sku', 'unit_price', 'custom_fields',
]);

// Directories the app is allowed to read from (academy, assets, data)
const ALLOWED_DIRS = [
  '/mnt/data/tmp/academy/',
  '/mnt/data/prodigy/creative-engine/LifeOS/',
  '/home/tewedros/clawd/lifeOS_data/',
];

const ACADEMY_ROOT = '/mnt/data/tmp/academy';
const LIFEOS_ASSETS = '/mnt/data/prodigy/creative-engine/LifeOS';
const LIFEOS_DATA = '/home/tewedros/clawd/lifeOS_data';

// ═══════════════════════════════════════════════════════════════
// Database Singleton
// ═══════════════════════════════════════════════════════════════

/** @type {Database.Database | null} */
let db = null;

/**
 * Get the platform-aware database path.
 * Linux/macOS: ~/.lifeos/data.db
 * Windows: %APPDATA%/lifeos/data.db
 * @param {string} [userDataPath] - Electron app.getPath('userData') override
 */
export function getDbPath(userDataPath) {
  if (userDataPath) {
    return join(userDataPath, 'data.db');
  }
  const home = homedir();
  if (platform() === 'win32') {
    const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming');
    return join(appData, 'lifeos', 'data.db');
  }
  return join(home, '.lifeos', 'data.db');
}

/**
 * Initialize the database: create tables, seed default user.
 * @param {string} dbPath - Full path to the SQLite database file
 * @returns {Database.Database}
 */
export function initDatabase(dbPath) {
  // Ensure parent directory exists
  const dir = resolve(dbPath, '..');
  mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Read and execute schema — check both dev and production paths
  let schemaPath = join(__dirname, 'schema.sql');
  if (!existsSync(schemaPath)) {
    // In production builds, electron-builder puts extraResources alongside the asar
    schemaPath = join(process.resourcesPath || __dirname, 'schema.sql');
  }
  const schemaSql = readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);

  // Seed default user
  db.exec(`
    INSERT OR IGNORE INTO users (id, email, display_name)
      VALUES ('local-user-001', 'local@lifeos.app', 'LifeOS User');
    INSERT OR IGNORE INTO user_profiles (user_id, email, full_name, onboarding_complete)
      VALUES ('local-user-001', 'local@lifeos.app', 'LifeOS User', 1);
    INSERT OR IGNORE INTO user_xp (user_id, total_xp, level)
      VALUES ('local-user-001', 0, 1);
  `);

  console.log(`[database] Initialized at ${dbPath}`);
  return db;
}

/** Get the current database instance. */
export function getDb() {
  if (!db) throw new Error('Database not initialized — call initDatabase() first');
  return db;
}

/** Close the database connection. */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return randomUUID();
}

function supabaseOk(data, extra = {}) {
  return { data, error: null, status: 200, statusText: 'OK', ...extra };
}

function supabaseErr(message, code = 'DB_ERROR', status = 500) {
  return {
    data: null,
    error: { message, details: '', hint: '', code },
    status,
    statusText: status === 400 ? 'Bad Request' : 'Internal Server Error',
  };
}

/** Validate table name against allowlist. */
function validateTable(table) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Table '${table}' is not allowed`);
  }
}

/** Validate column name: alphanumeric + underscore, in allowlist. */
function validateColumn(name) {
  if (!name || name.length > 64) {
    throw new Error(`Invalid column name: '${name}'`);
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Column name contains invalid characters: '${name}'`);
  }
  if (!ALLOWED_COLUMNS.has(name)) {
    throw new Error(`Column '${name}' is not in the allowed columns list`);
  }
}

/**
 * Convert a JSON value to a string suitable for SQL binding.
 * @param {any} v
 * @returns {string|number|null}
 */
function valueToSql(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  // Arrays and objects → JSON string
  return JSON.stringify(v);
}

/**
 * Parse a row from better-sqlite3, auto-parsing JSON fields.
 * @param {Record<string, any>} row
 * @returns {Record<string, any>}
 */
function parseRow(row) {
  if (!row) return null;
  const result = { ...row };
  for (const key of JSON_FIELDS) {
    if (key in result && typeof result[key] === 'string') {
      try {
        const parsed = JSON.parse(result[key]);
        if (typeof parsed === 'object') {
          result[key] = parsed;
        }
      } catch {
        // Keep as string
      }
    }
  }
  return result;
}

/**
 * Serialize JSON fields in a body object to strings for SQLite storage.
 * @param {Record<string, any>} body
 */
function serializeJsonFields(body) {
  for (const key of JSON_FIELDS) {
    if (key in body && typeof body[key] !== 'string' && body[key] !== null && body[key] !== undefined) {
      body[key] = JSON.stringify(body[key]);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Filter Parsing — matches lib.rs build_where_clause + app.py
// ═══════════════════════════════════════════════════════════════

/**
 * Build WHERE clause from QueryParams.filters array.
 * @param {Array<{column: string, operator: string, value: any}>} filters
 * @returns {{ clause: string, params: any[] }}
 */
function buildWhereClause(filters) {
  if (!filters || filters.length === 0) return { clause: '', params: [] };

  const conditions = [];
  const params = [];

  for (const f of filters) {
    validateColumn(f.column);

    switch (f.operator) {
      case 'eq':
        conditions.push(`"${f.column}" = ?`);
        params.push(valueToSql(f.value));
        break;
      case 'neq':
        conditions.push(`"${f.column}" != ?`);
        params.push(valueToSql(f.value));
        break;
      case 'gt':
        conditions.push(`"${f.column}" > ?`);
        params.push(valueToSql(f.value));
        break;
      case 'gte':
        conditions.push(`"${f.column}" >= ?`);
        params.push(valueToSql(f.value));
        break;
      case 'lt':
        conditions.push(`"${f.column}" < ?`);
        params.push(valueToSql(f.value));
        break;
      case 'lte':
        conditions.push(`"${f.column}" <= ?`);
        params.push(valueToSql(f.value));
        break;
      case 'like':
        conditions.push(`"${f.column}" LIKE ?`);
        params.push(valueToSql(f.value));
        break;
      case 'ilike':
        conditions.push(`"${f.column}" LIKE ? COLLATE NOCASE`);
        params.push(valueToSql(f.value));
        break;
      case 'is': {
        const v = String(f.value).toLowerCase();
        if (v === 'null' || v === '' || f.value === null) {
          conditions.push(`"${f.column}" IS NULL`);
        } else if (v === 'true') {
          conditions.push(`"${f.column}" = 1`);
        } else if (v === 'false') {
          conditions.push(`"${f.column}" = 0`);
        } else {
          conditions.push(`"${f.column}" IS NULL`);
        }
        break;
      }
      case 'in': {
        if (Array.isArray(f.value)) {
          if (f.value.length === 0) {
            conditions.push('0 = 1'); // empty IN → always false
          } else {
            const placeholders = f.value.map(() => '?').join(', ');
            conditions.push(`"${f.column}" IN (${placeholders})`);
            for (const item of f.value) {
              params.push(valueToSql(item));
            }
          }
        } else {
          conditions.push(`"${f.column}" = ?`);
          params.push(valueToSql(f.value));
        }
        break;
      }
      case 'contains':
        conditions.push(`"${f.column}" LIKE ?`);
        params.push(`%${valueToSql(f.value)}%`);
        break;
      default:
        // Unknown operator — treat as eq
        conditions.push(`"${f.column}" = ?`);
        params.push(valueToSql(f.value));
    }
  }

  return {
    clause: ` WHERE ${conditions.join(' AND ')}`,
    params,
  };
}

/**
 * Parse an OR filter string (PostgREST-style).
 * Format: "status.eq.active,status.eq.pending"
 * @param {string} orString
 * @returns {{ clause: string, params: any[] }}
 */
function parseOrFilter(orString) {
  if (!orString) return { clause: '', params: [] };

  const parts = [];
  const params = [];

  for (const item of orString.split(',')) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    const dotIdx = trimmed.indexOf('.');
    if (dotIdx === -1) continue;

    const col = trimmed.substring(0, dotIdx);
    const rest = trimmed.substring(dotIdx + 1);

    // Parse operator.value
    const dotIdx2 = rest.indexOf('.');
    if (dotIdx2 === -1) continue;

    const op = rest.substring(0, dotIdx2);
    const val = rest.substring(dotIdx2 + 1);

    validateColumn(col);

    const OP_MAP = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'LIKE' };
    const sqlOp = OP_MAP[op];

    if (sqlOp) {
      parts.push(`"${col}" ${sqlOp} ?`);
      params.push(val);
    } else if (op === 'is') {
      const lower = val.toLowerCase();
      if (lower === 'null') {
        parts.push(`"${col}" IS NULL`);
      } else if (lower === 'true') {
        parts.push(`"${col}" = 1`);
      } else if (lower === 'false') {
        parts.push(`"${col}" = 0`);
      }
    } else if (op === 'in') {
      // in.(a,b,c)
      const inner = val.replace(/^\(/, '').replace(/\)$/, '');
      const items = inner.split(',').map(s => s.trim()).filter(Boolean);
      if (items.length > 0) {
        parts.push(`"${col}" IN (${items.map(() => '?').join(', ')})`);
        params.push(...items);
      }
    }
  }

  if (parts.length === 0) return { clause: '', params: [] };
  return { clause: `(${parts.join(' OR ')})`, params };
}

// ═══════════════════════════════════════════════════════════════
// CRUD Operations
// ═══════════════════════════════════════════════════════════════

/**
 * Execute a SELECT query.
 * @param {Database.Database} conn
 * @param {object} params - QueryParams
 */
function execSelect(conn, params) {
  // Build column list
  let columnsSql = '*';
  if (params.columns && params.columns.trim() !== '*') {
    const parts = params.columns.split(',').map(c => c.trim());
    for (const p of parts) {
      if (p !== '*' && !p.includes('(')) validateColumn(p);
    }
    columnsSql = parts.map(c => (c === '*' || c.includes('(')) ? c : `"${c}"`).join(', ');
  }

  // Build WHERE
  const { clause: whereClause, params: whereParams } = buildWhereClause(params.filters);

  // OR filter
  let orClause = '';
  let orParams = [];
  if (params.or_filter) {
    const parsed = parseOrFilter(params.or_filter);
    orClause = parsed.clause;
    orParams = parsed.params;
  }

  // Combine WHERE + OR
  let fullWhere = whereClause;
  if (orClause) {
    fullWhere = fullWhere
      ? `${fullWhere} AND ${orClause}`
      : ` WHERE ${orClause}`;
  }

  // ORDER BY
  let orderClause;
  if (params.order_col) {
    validateColumn(params.order_col);
    const dir = params.order_asc === false ? 'DESC' : 'ASC';
    orderClause = ` ORDER BY "${params.order_col}" ${dir}`;
  } else {
    orderClause = ' ORDER BY created_at DESC';
  }

  // LIMIT / OFFSET
  let limitClause = '';
  if (params.limit != null) limitClause += ` LIMIT ${Number(params.limit)}`;
  if (params.offset != null) limitClause += ` OFFSET ${Number(params.offset)}`;

  const sql = `SELECT ${columnsSql} FROM "${params.table}"${fullWhere}${orderClause}${limitClause}`;
  const allParams = [...whereParams, ...orParams];

  let rows;
  try {
    rows = conn.prepare(sql).all(...allParams);
  } catch (err) {
    // Fallback 1: retry without ORDER BY (column might not exist)
    try {
      const fallbackSql = `SELECT ${columnsSql} FROM "${params.table}"${fullWhere}${limitClause}`;
      rows = conn.prepare(fallbackSql).all(...allParams);
    } catch (err2) {
      // Fallback 2: retry with SELECT * (requested columns might not exist in table)
      const starSql = `SELECT * FROM "${params.table}"${fullWhere}${limitClause}`;
      rows = conn.prepare(starSql).all(...allParams);
    }
  }

  const data = rows.map(parseRow);

  // Count query if requested
  if (params.count) {
    const countSql = `SELECT COUNT(*) as c FROM "${params.table}"${fullWhere}`;
    const countRow = conn.prepare(countSql).get(...allParams);
    return supabaseOk(data, { count: countRow?.c ?? 0 });
  }

  return supabaseOk(data);
}

/**
 * Execute an INSERT and return inserted row(s).
 * @param {Database.Database} conn
 * @param {object} params - QueryParams
 */
function execInsert(conn, params) {
  if (!params.body) return supabaseErr('INSERT requires a body', 'MISSING_BODY', 400);

  const rowsToInsert = Array.isArray(params.body) ? params.body : [params.body];
  const inserted = [];
  const pk = TABLE_PK[params.table] || 'id';

  const insertMany = conn.transaction((rows) => {
    for (const rowData of rows) {
      const fields = { ...rowData };

      // Auto-generate defaults
      if (!(pk in fields)) fields[pk] = newId();
      if (!fields.created_at) fields.created_at = nowIso();
      if (!NO_USER_ID_TABLES.has(params.table) && !fields.user_id) {
        fields.user_id = DEFAULT_USER_ID;
      }

      serializeJsonFields(fields);
      for (const key of Object.keys(fields)) validateColumn(key);

      const columns = Object.keys(fields);
      const quotedCols = columns.map(c => `"${c}"`).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map(k => valueToSql(fields[k]));

      conn.prepare(`INSERT INTO "${params.table}" (${quotedCols}) VALUES (${placeholders})`).run(...values);

      if (params.return_select) {
        const row = conn.prepare(`SELECT * FROM "${params.table}" WHERE "${pk}" = ?`).get(fields[pk]);
        inserted.push(parseRow(row));
      } else {
        inserted.push({ [pk]: fields[pk] });
      }
    }
  });

  insertMany(rowsToInsert);
  return { data: inserted, error: null, status: 201, statusText: 'Created' };
}

/**
 * Execute an UPDATE with filters.
 * @param {Database.Database} conn
 * @param {object} params - QueryParams
 */
function execUpdate(conn, params) {
  if (!params.body) return supabaseErr('UPDATE requires a body', 'MISSING_BODY', 400);

  const fields = { ...params.body };
  delete fields.id;
  delete fields.created_at;
  fields.updated_at = nowIso();

  serializeJsonFields(fields);

  const fieldKeys = Object.keys(fields);
  if (fieldKeys.length === 0) return supabaseErr('No fields to update', 'EMPTY_UPDATE', 400);

  for (const key of fieldKeys) validateColumn(key);

  const setClauses = fieldKeys.map(k => `"${k}" = ?`).join(', ');
  const setValues = fieldKeys.map(k => valueToSql(fields[k]));

  const { clause: whereClause, params: whereParams } = buildWhereClause(params.filters);

  const sql = `UPDATE "${params.table}" SET ${setClauses}${whereClause}`;
  const info = conn.prepare(sql).run(...setValues, ...whereParams);

  if (params.return_select) {
    const selectSql = `SELECT * FROM "${params.table}"${whereClause}`;
    const rows = conn.prepare(selectSql).all(...whereParams);
    return supabaseOk(rows.map(parseRow));
  }

  return supabaseOk({ count: info.changes });
}

/**
 * Execute an UPSERT (INSERT ON CONFLICT UPDATE).
 * @param {Database.Database} conn
 * @param {object} params - QueryParams
 */
function execUpsert(conn, params) {
  if (!params.body) return supabaseErr('UPSERT requires a body', 'MISSING_BODY', 400);

  const conflictCol = params.upsert_conflict || 'id';
  validateColumn(conflictCol);
  const pk = TABLE_PK[params.table] || 'id';

  const rowsToUpsert = Array.isArray(params.body) ? params.body : [params.body];
  const upserted = [];

  const upsertMany = conn.transaction((rows) => {
    for (const rowData of rows) {
      const fields = { ...rowData };

      if (!(pk in fields)) fields[pk] = newId();
      if (!fields.created_at) fields.created_at = nowIso();
      if (!NO_USER_ID_TABLES.has(params.table) && !fields.user_id) {
        fields.user_id = DEFAULT_USER_ID;
      }
      fields.updated_at = nowIso();

      serializeJsonFields(fields);
      for (const key of Object.keys(fields)) validateColumn(key);

      const columns = Object.keys(fields);
      const quotedCols = columns.map(c => `"${c}"`).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map(k => valueToSql(fields[k]));

      const updateCols = columns
        .filter(c => c !== conflictCol)
        .map(c => `"${c}" = excluded."${c}"`)
        .join(', ');

      const sql = `INSERT INTO "${params.table}" (${quotedCols}) VALUES (${placeholders}) ON CONFLICT("${conflictCol}") DO UPDATE SET ${updateCols}`;
      conn.prepare(sql).run(...values);

      if (params.return_select) {
        const row = conn.prepare(`SELECT * FROM "${params.table}" WHERE "${pk}" = ?`).get(fields[pk]);
        upserted.push(parseRow(row));
      } else {
        upserted.push({ [pk]: fields[pk] });
      }
    }
  });

  upsertMany(rowsToUpsert);
  return supabaseOk(upserted);
}

/**
 * Execute a DELETE with filters.
 * Soft-delete tables get is_deleted=1; others get hard-deleted.
 * @param {Database.Database} conn
 * @param {object} params - QueryParams
 */
function execDelete(conn, params) {
  const { clause: whereClause, params: whereParams } = buildWhereClause(params.filters);

  if (!whereClause) {
    return supabaseErr('DELETE requires at least one filter', 'MISSING_FILTER', 400);
  }

  if (SOFT_DELETE_TABLES.has(params.table)) {
    const sql = `UPDATE "${params.table}" SET is_deleted = 1, updated_at = ?${whereClause}`;
    conn.prepare(sql).run(nowIso(), ...whereParams);
  } else {
    const sql = `DELETE FROM "${params.table}"${whereClause}`;
    conn.prepare(sql).run(...whereParams);
  }

  return supabaseOk([]);
}

// ═══════════════════════════════════════════════════════════════
// Unified Query Dispatcher — the single IPC entry point
// ═══════════════════════════════════════════════════════════════

/**
 * Execute a unified CRUD query. This is the main IPC handler.
 * Mirrors Tauri's db_query and Flask's unified_crud.
 *
 * @param {object} params - QueryParams object from frontend
 * @returns {{ data: any, error: any, status: number, statusText: string }}
 */
export function execQuery(params) {
  try {
    validateTable(params.table);
    const conn = getDb();

    switch (params.method) {
      case 'select':  return execSelect(conn, params);
      case 'insert':  return execInsert(conn, params);
      case 'update':  return execUpdate(conn, params);
      case 'upsert':  return execUpsert(conn, params);
      case 'delete':  return execDelete(conn, params);
      default:
        return supabaseErr(`Unknown method: ${params.method}`, 'INVALID_METHOD', 400);
    }
  } catch (err) {
    return supabaseErr(err.message || String(err), 'DB_ERROR', 500);
  }
}

// ═══════════════════════════════════════════════════════════════
// RPC Handler
// ═══════════════════════════════════════════════════════════════

/**
 * Execute an RPC function.
 * @param {string} fnName
 * @param {object} fnParams
 */
export function execRpc(fnName, fnParams = {}) {
  try {
    const conn = getDb();

    if (fnName === 'get_table_columns') {
      const tableName = fnParams.table_name;
      if (!tableName || !ALLOWED_TABLES.has(tableName)) {
        return supabaseOk([]);
      }
      const cols = conn.pragma(`table_info("${tableName}")`);
      const data = cols.map(c => ({ column_name: c.name, data_type: c.type }));
      return supabaseOk(data);
    }

    return supabaseErr(`Unknown RPC: ${fnName}`, 'UNKNOWN_RPC', 404);
  } catch (err) {
    return supabaseErr(err.message || String(err), 'RPC_ERROR', 500);
  }
}

// ═══════════════════════════════════════════════════════════════
// File / Academy Operations
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a path is inside one of the allowed directories.
 * @param {string} filePath
 * @returns {boolean}
 */
function isPathAllowed(filePath) {
  try {
    const real = resolve(filePath);
    return ALLOWED_DIRS.some(dir => real.startsWith(dir));
  } catch {
    return false;
  }
}

/**
 * Read a text file from an allowed directory.
 * @param {string} filePath
 * @returns {{ data: string | null, error: string | null }}
 */
export function readAllowedFile(filePath) {
  if (!isPathAllowed(filePath)) {
    return { data: null, error: `Path not allowed: ${filePath}` };
  }
  try {
    const content = readFileSync(filePath, 'utf-8');
    return { data: content, error: null };
  } catch (err) {
    return { data: null, error: `IO error: ${err.message}` };
  }
}

/**
 * Read a binary file (audio, images) from an allowed directory.
 * Returns a Buffer suitable for Electron IPC binary transfer.
 * @param {string} filePath
 * @returns {{ data: Buffer | null, error: string | null }}
 */
export function readMediaBytes(filePath) {
  if (!isPathAllowed(filePath)) {
    return { data: null, error: `Path not allowed: ${filePath}` };
  }
  try {
    const data = readFileSync(filePath);
    return { data, error: null };
  } catch (err) {
    return { data: null, error: `IO error: ${err.message}` };
  }
}

/**
 * List files in an allowed directory.
 * @param {string} dirPath
 * @returns {{ data: Array | null, error: string | null }}
 */
export function listAllowedDirectory(dirPath) {
  if (!isPathAllowed(dirPath)) {
    return { data: null, error: `Path not allowed: ${dirPath}` };
  }
  try {
    const entries = readdirSync(dirPath)
      .map(name => {
        const full = join(dirPath, name);
        try {
          const stat = statSync(full);
          return { name, path: full, is_dir: stat.isDirectory(), size: stat.size };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    return { data: entries, error: null };
  } catch (err) {
    return { data: null, error: `IO error: ${err.message}` };
  }
}

/**
 * Get academy overview stats.
 */
export function getAcademyOverview() {
  const countFiles = (dir, filter) => {
    try {
      return readdirSync(dir).filter(f => filter(f.toLowerCase())).length;
    } catch {
      return 0;
    }
  };

  const audioFilter = f => f.endsWith('.mp3') || f.endsWith('.ogg') || f.endsWith('.wav');
  const imageFilter = f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp');
  const csvFilter = f => f.endsWith('.csv');

  const musicCount = countFiles(join(ACADEMY_ROOT, 'study-music'), audioFilter);
  const realmMusicCount = countFiles(join(LIFEOS_ASSETS, 'music'), audioFilter);
  const bgCount = countFiles(join(LIFEOS_ASSETS, 'Backgrounds'), imageFilter);
  const natureCount = countFiles(LIFEOS_DATA, csvFilter);

  let phaseCount = 0;
  try {
    phaseCount = readdirSync(ACADEMY_ROOT).filter(name => {
      const full = join(ACADEMY_ROOT, name);
      try {
        return statSync(full).isDirectory() && /^\d/.test(name);
      } catch {
        return false;
      }
    }).length;
  } catch { /* ignore */ }

  return {
    phases: phaseCount,
    studyMusicTracks: musicCount,
    realmMusicTracks: realmMusicCount,
    backgrounds: bgCount,
    natureDatasets: natureCount,
  };
}

// ═══════════════════════════════════════════════════════════════
// XP System Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Add XP to the user. Logs event, updates level.
 * @param {{ amount: number, source?: string, description?: string }} params
 */
export function addXp({ amount = 0, source = 'unknown', description = '' }) {
  try {
    const conn = getDb();

    // Log XP event
    conn.prepare(
      'INSERT INTO xp_events (id, user_id, amount, source, description) VALUES (?, ?, ?, ?, ?)'
    ).run(newId(), DEFAULT_USER_ID, amount, source, description);

    // Get current XP
    const row = conn.prepare('SELECT * FROM user_xp WHERE user_id = ?').get(DEFAULT_USER_ID);
    if (row) {
      const newTotal = row.total_xp + amount;
      const level = 1 + Math.floor(Math.sqrt(newTotal) / 5);
      const nextLvlXp = (level * 5) ** 2;
      const currentLvlXp = newTotal - ((level - 1) * 5) ** 2;
      conn.prepare(
        'UPDATE user_xp SET total_xp = ?, level = ?, current_level_xp = ?, next_level_xp = ?, updated_at = ? WHERE user_id = ?'
      ).run(newTotal, level, currentLvlXp, nextLvlXp, nowIso(), DEFAULT_USER_ID);
    } else {
      conn.prepare(
        'INSERT INTO user_xp (user_id, total_xp, level, current_level_xp, next_level_xp) VALUES (?, ?, 1, ?, 100)'
      ).run(DEFAULT_USER_ID, amount, amount);
    }

    const updated = conn.prepare('SELECT * FROM user_xp WHERE user_id = ?').get(DEFAULT_USER_ID);
    return supabaseOk(parseRow(updated));
  } catch (err) {
    return supabaseErr(err.message, 'XP_ERROR');
  }
}

// ═══════════════════════════════════════════════════════════════
// Life Context (aggregated dashboard data)
// ═══════════════════════════════════════════════════════════════

/**
 * Get aggregated life context for AI/NPC dialogue.
 */
export function getLifeContext() {
  try {
    const conn = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const uid = DEFAULT_USER_ID;

    const activeGoals = conn.prepare(
      "SELECT COUNT(*) as c FROM goals WHERE user_id = ? AND status IN ('active', 'in_progress') AND is_deleted = 0"
    ).get(uid).c;
    const completedGoals = conn.prepare(
      "SELECT COUNT(*) as c FROM goals WHERE user_id = ? AND status IN ('completed', 'done') AND is_deleted = 0"
    ).get(uid).c;
    const todayTasks = conn.prepare(
      'SELECT COUNT(*) as c FROM tasks WHERE user_id = ? AND (due_date = ? OR scheduled_date = ?) AND is_deleted = 0'
    ).get(uid, today, today).c;
    const overdue = conn.prepare(
      "SELECT COUNT(*) as c FROM tasks WHERE user_id = ? AND due_date < ? AND status != 'done' AND is_deleted = 0"
    ).get(uid, today).c;
    const totalHabits = conn.prepare(
      'SELECT COUNT(*) as c FROM habits WHERE user_id = ? AND is_active = 1 AND is_deleted = 0'
    ).get(uid).c;
    const doneToday = conn.prepare(
      'SELECT COUNT(DISTINCT habit_id) as c FROM habit_logs WHERE user_id = ? AND date = ?'
    ).get(uid, today).c;
    const health = conn.prepare(
      'SELECT * FROM health_metrics WHERE user_id = ? AND date = ?'
    ).get(uid, today);
    const todayEvents = conn.prepare(
      'SELECT COUNT(*) as c FROM schedule_events WHERE user_id = ? AND date = ? AND (is_deleted = 0 OR is_deleted IS NULL)'
    ).get(uid, today).c;

    return supabaseOk({
      goals: { active: activeGoals, completed: completedGoals },
      tasks: { today: todayTasks, overdue },
      habits: { total: totalHabits, completedToday: doneToday },
      health: health
        ? { mood: health.mood_score, energy: health.energy_score, sleep: health.sleep_hours }
        : { mood: null, energy: null, sleep: null },
      schedule: { todayEvents },
    });
  } catch (err) {
    return supabaseErr(err.message, 'CONTEXT_ERROR');
  }
}
