/**
 * LifeOS Capacitor Database Module
 *
 * Async SQLite backend using @capacitor-community/sqlite.
 * Ports all CRUD, filter parsing, and helpers from:
 *   - electron/database.js  (Electron/better-sqlite3 backend)
 *
 * All responses match the Supabase-compatible format:
 *   { data: T | null, error: PostgrestError | null, status: number, statusText: string }
 *
 * This module is a pure TypeScript re-implementation of the Electron database module.
 * The SQL generation logic is identical; only the transport layer differs
 * (async @capacitor-community/sqlite instead of synchronous better-sqlite3).
 */

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

// ═══════════════════════════════════════════════════════════════
// Constants (mirrors electron/database.js exactly)
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'lifeos';
const DB_VERSION = 1;
const DEFAULT_USER_ID = 'local-user-001';

const ALLOWED_TABLES = new Set([
  'users', 'user_profiles', 'goals', 'tasks', 'habits', 'habit_logs',
  'schedule_events', 'health_metrics', 'workouts', 'workout_exercises',
  'expense_categories', 'businesses', 'transactions', 'budgets',
  'income', 'expenses', 'bills', 'clients', 'journal_entries',
  'rpg_characters', 'rpg_quest_log', 'user_xp', 'xp_events',
  'achievements', 'inventory_items', 'pet_profiles', 'categories',
  'projects', 'notes', 'assets', 'asset_maintenance', 'asset_bills',
  'asset_documents', 'ai_insights', 'chat_messages', 'ai_conversations', 'unified_events',
  'sync_meta', 'lesson_progress', 'parts_inventory',
]);

const SOFT_DELETE_TABLES = new Set([
  'goals', 'tasks', 'habits', 'income', 'expenses', 'bills',
  'clients', 'journal_entries', 'businesses', 'categories', 'projects',
  'notes', 'assets', 'asset_maintenance', 'asset_bills', 'asset_documents',
  'inventory_items', 'pet_profiles', 'lesson_progress', 'parts_inventory',
]);

const TABLE_PK: Record<string, string> = {
  user_profiles: 'user_id',
  user_xp: 'user_id',
  sync_meta: 'table_name',
};

const NO_USER_ID_TABLES = new Set(['sync_meta']);

const JSON_FIELDS = new Set([
  'tags', 'metadata', 'preferences', 'stats', 'equipment',
  'position', 'sprite_data', 'exercises', 'attachments',
  'context', 'key_results', 'resources', 'steps_completed', 'custom_fields',
  'messages_json',
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
  'messages_json',
]);

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'contains';

export interface QueryFilter {
  column: string;
  operator: FilterOperator;
  value: any;
}

export interface QueryParams {
  table: string;
  method: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  columns?: string;
  filters?: QueryFilter[];
  order_col?: string;
  order_asc?: boolean;
  limit?: number;
  offset?: number;
  single?: boolean;
  body?: any;
  upsert_conflict?: string;
  return_select?: boolean;
  count?: string;
  or_filter?: string;
}

export interface PostgrestError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

export interface PostgrestResponse<T = any> {
  data: T | null;
  error: PostgrestError | null;
  count?: number;
  status: number;
  statusText: string;
}

// ═══════════════════════════════════════════════════════════════
// Database Singleton
// ═══════════════════════════════════════════════════════════════

let _sqlite: SQLiteConnection | null = null;
let _db: SQLiteDBConnection | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * Initialize the database connection and apply schema.
 * Safe to call multiple times — returns the same promise on concurrent calls.
 */
export async function initCapacitorDB(): Promise<void> {
  if (_db) return; // Already initialized
  if (_initPromise) return _initPromise;

  _initPromise = _doInit();
  return _initPromise;
}

async function _doInit(): Promise<void> {
  try {
    _sqlite = new SQLiteConnection(CapacitorSQLite);

    // Check connection consistency
    const consistency = await _sqlite.checkConnectionsConsistency();
    const isConn = (await _sqlite.isConnection(DB_NAME, false)).result;

    if (consistency.result && isConn) {
      _db = await _sqlite.retrieveConnection(DB_NAME, false);
    } else {
      _db = await _sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
    }

    await _db.open();
    await _applySchema();
    await _seedDefaultUser();
    console.log('[capacitor-db] Database initialized:', DB_NAME);
  } catch (err) {
    _initPromise = null;
    _db = null;
    _sqlite = null;
    throw err;
  }
}

async function _applySchema(): Promise<void> {
  if (!_db) throw new Error('DB not open');

  // Create all tables from the same schema as Electron
  const schema = `
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      email TEXT,
      full_name TEXT,
      avatar_url TEXT,
      timezone TEXT DEFAULT 'UTC',
      subscription_tier TEXT DEFAULT 'free',
      preferences TEXT DEFAULT '{}',
      onboarding_complete INTEGER DEFAULT 0,
      occupation TEXT,
      primary_focus TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_xp (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      total_xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      current_level_xp INTEGER DEFAULT 0,
      next_level_xp INTEGER DEFAULT 100,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      domain TEXT,
      category TEXT,
      financial_type TEXT,
      parent_goal_id TEXT,
      budget_allocated REAL,
      expected_return REAL,
      business_id TEXT,
      progress REAL DEFAULT 0,
      target_date TEXT,
      priority TEXT DEFAULT 'medium',
      estimated_hours REAL,
      deadline_type TEXT,
      success_criteria TEXT,
      key_results TEXT DEFAULT '[]',
      resources TEXT DEFAULT '[]',
      decomposition_source TEXT,
      health_status TEXT DEFAULT 'on_track',
      icon TEXT,
      color TEXT,
      sort_order INTEGER DEFAULT 0,
      source TEXT,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      goal_id TEXT REFERENCES goals(id),
      project_id TEXT,
      parent_task_id TEXT,
      category_id TEXT,
      depth_level INTEGER DEFAULT 0,
      board_status TEXT,
      board_position INTEGER,
      due_date TEXT,
      due_time TEXT,
      scheduled_date TEXT,
      scheduled_start TEXT,
      scheduled_end TEXT,
      estimated_minutes INTEGER,
      actual_minutes INTEGER,
      energy_level TEXT,
      suggested_week TEXT,
      auto_scheduled INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      financial_amount REAL,
      financial_category_id TEXT,
      completed_at TEXT,
      depends_on_task_id TEXT,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      frequency TEXT DEFAULT 'daily',
      target_count INTEGER DEFAULT 1,
      streak_current INTEGER DEFAULT 0,
      streak_best INTEGER DEFAULT 0,
      time_of_day TEXT,
      duration_minutes INTEGER,
      icon TEXT,
      color TEXT,
      is_active INTEGER DEFAULT 1,
      tags TEXT DEFAULT '[]',
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      habit_id TEXT REFERENCES habits(id),
      date TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      count INTEGER DEFAULT 1,
      value REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedule_events (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      start_time TEXT,
      end_time TEXT,
      all_day INTEGER DEFAULT 0,
      event_type TEXT DEFAULT 'event',
      task_id TEXT,
      habit_id TEXT,
      goal_id TEXT,
      location TEXT,
      day_type TEXT,
      recurrence_rule TEXT,
      is_recurring INTEGER DEFAULT 0,
      is_template INTEGER DEFAULT 0,
      is_live INTEGER DEFAULT 0,
      htmlLink TEXT,
      metadata TEXT DEFAULT '{}',
      schedule_layer TEXT,
      tags TEXT DEFAULT '[]',
      color TEXT,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS health_metrics (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      date TEXT NOT NULL,
      mood_score INTEGER,
      energy_score INTEGER,
      stress_score INTEGER,
      sleep_hours REAL,
      sleep_quality INTEGER,
      water_glasses INTEGER,
      weight_kg REAL,
      exercise_minutes INTEGER,
      notes TEXT,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      date TEXT,
      duration_minutes INTEGER,
      day_of_week INTEGER,
      preferred_time TEXT,
      exercises TEXT DEFAULT '[]',
      notes TEXT,
      is_template INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workout_exercises (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      workout_id TEXT REFERENCES workouts(id),
      name TEXT NOT NULL,
      sets INTEGER,
      reps INTEGER,
      weight REAL,
      duration_seconds INTEGER,
      notes TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      category_id TEXT,
      date TEXT,
      notes TEXT,
      business_id TEXT,
      client_id TEXT,
      event_id TEXT,
      recurring INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      category_id TEXT,
      month TEXT,
      amount REAL DEFAULT 0,
      scope TEXT DEFAULT 'personal',
      budget_monthly REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS income (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT,
      amount REAL NOT NULL,
      category_id TEXT,
      date TEXT,
      client_id TEXT,
      business_id TEXT,
      notes TEXT,
      recurring INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT,
      amount REAL NOT NULL,
      category_id TEXT,
      date TEXT,
      business_id TEXT,
      is_deductible INTEGER DEFAULT 0,
      receipt_url TEXT,
      payment_method TEXT,
      travel_km REAL,
      notes TEXT,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id TEXT,
      due_date TEXT,
      paid_date TEXT,
      payment_url TEXT,
      recurring INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'unpaid',
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      latitude REAL,
      longitude REAL,
      business_id TEXT,
      rate REAL,
      rate_type TEXT,
      notes TEXT,
      sop TEXT,
      access_codes TEXT,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT,
      industry TEXT,
      revenue_model TEXT,
      monthly_revenue REAL,
      monthly_expenses REAL,
      description TEXT,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT,
      icon TEXT,
      color TEXT,
      parent_id TEXT,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT,
      content TEXT,
      mood TEXT,
      energy INTEGER,
      tags TEXT DEFAULT '[]',
      image_url TEXT,
      is_pinned INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      goal_id TEXT,
      start_date TEXT,
      target_date TEXT,
      color TEXT,
      icon TEXT,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT,
      content TEXT,
      tags TEXT DEFAULT '[]',
      is_pinned INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rpg_characters (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT,
      class TEXT,
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      stats TEXT DEFAULT '{}',
      equipment TEXT DEFAULT '{}',
      sprite_data TEXT DEFAULT '{}',
      position TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rpg_quest_log (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      quest_id TEXT,
      title TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      source_type TEXT,
      source_id TEXT,
      xp_reward INTEGER DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS xp_events (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      source_type TEXT,
      source_id TEXT,
      xp_reward INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      code TEXT,
      title TEXT,
      description TEXT,
      tier TEXT DEFAULT 'bronze',
      icon TEXT,
      xp_reward INTEGER DEFAULT 0,
      unlocked_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT,
      rarity TEXT DEFAULT 'common',
      is_equipped INTEGER DEFAULT 0,
      slot TEXT,
      quantity INTEGER DEFAULT 1,
      icon TEXT,
      stats TEXT DEFAULT '{}',
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pet_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      species TEXT,
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      hunger INTEGER DEFAULT 100,
      happiness INTEGER DEFAULT 100,
      avatar_url TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT,
      description TEXT,
      purchase_date TEXT,
      cost REAL,
      business_id TEXT,
      notes TEXT,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS asset_maintenance (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      asset_id TEXT REFERENCES assets(id),
      title TEXT,
      date TEXT,
      cost REAL,
      notes TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS asset_bills (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      asset_id TEXT REFERENCES assets(id),
      title TEXT,
      amount REAL,
      due_date TEXT,
      status TEXT DEFAULT 'unpaid',
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS asset_documents (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      asset_id TEXT REFERENCES assets(id),
      title TEXT,
      file_url TEXT,
      file_type TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT,
      context TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments TEXT DEFAULT '[]',
      messages_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_insights (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      type TEXT,
      content TEXT,
      source_type TEXT,
      source_id TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS unified_events (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      type TEXT,
      source_type TEXT,
      source_id TEXT,
      title TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      table_name TEXT PRIMARY KEY,
      last_sync_at TEXT,
      record_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      lesson_id TEXT,
      module_id TEXT,
      status TEXT DEFAULT 'not_started',
      current_step INTEGER DEFAULT 0,
      steps_completed TEXT DEFAULT '[]',
      total_practice_time INTEGER DEFAULT 0,
      last_practiced_at TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parts_inventory (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT,
      quantity INTEGER DEFAULT 0,
      supplier TEXT,
      sku TEXT,
      unit_price REAL,
      location TEXT,
      custom_fields TEXT DEFAULT '{}',
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `;

  // Execute schema statements one by one (Capacitor SQLite requires individual statements)
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    await _db.execute(stmt + ';');
  }
}

async function _seedDefaultUser(): Promise<void> {
  if (!_db) return;
  await _db.execute(`
    INSERT OR IGNORE INTO users (id, email, display_name)
    VALUES ('${DEFAULT_USER_ID}', 'local@lifeos.app', 'LifeOS User');
  `);
  await _db.execute(`
    INSERT OR IGNORE INTO user_profiles (user_id, email, full_name, onboarding_complete)
    VALUES ('${DEFAULT_USER_ID}', 'local@lifeos.app', 'LifeOS User', 1);
  `);
  await _db.execute(`
    INSERT OR IGNORE INTO user_xp (user_id, total_xp, level)
    VALUES ('${DEFAULT_USER_ID}', 0, 1);
  `);
}

function getConn(): SQLiteDBConnection {
  if (!_db) throw new Error('Capacitor DB not initialized — call initCapacitorDB() first');
  return _db;
}

// ═══════════════════════════════════════════════════════════════
// Helpers (mirrors electron/database.js)
// ═══════════════════════════════════════════════════════════════

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

function supabaseOk<T>(data: T, extra: Record<string, any> = {}): PostgrestResponse<T> {
  return { data, error: null, status: 200, statusText: 'OK', ...extra };
}

function supabaseErr(message: string, code = 'DB_ERROR', status = 500): PostgrestResponse<any> {
  return {
    data: null,
    error: { message, details: '', hint: '', code },
    status,
    statusText: status === 400 ? 'Bad Request' : 'Internal Server Error',
  };
}

function validateTable(table: string): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Table '${table}' is not allowed`);
  }
}

function validateColumn(name: string): void {
  if (!name || name.length > 64) throw new Error(`Invalid column name: '${name}'`);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error(`Column name contains invalid characters: '${name}'`);
  if (!ALLOWED_COLUMNS.has(name)) throw new Error(`Column '${name}' is not in the allowed columns list`);
}

function valueToSql(v: any): any {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return JSON.stringify(v);
}

function parseRow(row: Record<string, any>): Record<string, any> {
  if (!row) return row;
  const result = { ...row };
  for (const key of JSON_FIELDS) {
    if (key in result && typeof result[key] === 'string') {
      try {
        const parsed = JSON.parse(result[key]);
        if (typeof parsed === 'object') result[key] = parsed;
      } catch { /* keep as string */ }
    }
  }
  return result;
}

function serializeJsonFields(body: Record<string, any>): void {
  for (const key of JSON_FIELDS) {
    if (key in body && typeof body[key] !== 'string' && body[key] !== null && body[key] !== undefined) {
      body[key] = JSON.stringify(body[key]);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Filter Parsing
// ═══════════════════════════════════════════════════════════════

interface WhereResult {
  clause: string;
  params: any[];
}

function buildWhereClause(filters?: QueryFilter[]): WhereResult {
  if (!filters || filters.length === 0) return { clause: '', params: [] };

  const conditions: string[] = [];
  const params: any[] = [];

  for (const f of filters) {
    validateColumn(f.column);
    switch (f.operator) {
      case 'eq':   conditions.push(`"${f.column}" = ?`); params.push(valueToSql(f.value)); break;
      case 'neq':  conditions.push(`"${f.column}" != ?`); params.push(valueToSql(f.value)); break;
      case 'gt':   conditions.push(`"${f.column}" > ?`); params.push(valueToSql(f.value)); break;
      case 'gte':  conditions.push(`"${f.column}" >= ?`); params.push(valueToSql(f.value)); break;
      case 'lt':   conditions.push(`"${f.column}" < ?`); params.push(valueToSql(f.value)); break;
      case 'lte':  conditions.push(`"${f.column}" <= ?`); params.push(valueToSql(f.value)); break;
      case 'like': conditions.push(`"${f.column}" LIKE ?`); params.push(valueToSql(f.value)); break;
      case 'ilike': conditions.push(`"${f.column}" LIKE ? COLLATE NOCASE`); params.push(valueToSql(f.value)); break;
      case 'is': {
        const v = String(f.value).toLowerCase();
        if (v === 'null' || v === '' || f.value === null) conditions.push(`"${f.column}" IS NULL`);
        else if (v === 'true') conditions.push(`"${f.column}" = 1`);
        else if (v === 'false') conditions.push(`"${f.column}" = 0`);
        else conditions.push(`"${f.column}" IS NULL`);
        break;
      }
      case 'in': {
        if (Array.isArray(f.value)) {
          if (f.value.length === 0) {
            conditions.push('0 = 1');
          } else {
            conditions.push(`"${f.column}" IN (${f.value.map(() => '?').join(', ')})`);
            for (const item of f.value) params.push(valueToSql(item));
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
        conditions.push(`"${f.column}" = ?`);
        params.push(valueToSql(f.value));
    }
  }

  return { clause: ` WHERE ${conditions.join(' AND ')}`, params };
}

function parseOrFilter(orString: string): WhereResult {
  if (!orString) return { clause: '', params: [] };

  const parts: string[] = [];
  const params: any[] = [];

  for (const item of orString.split(',')) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const dotIdx = trimmed.indexOf('.');
    if (dotIdx === -1) continue;
    const col = trimmed.substring(0, dotIdx);
    const rest = trimmed.substring(dotIdx + 1);
    const dotIdx2 = rest.indexOf('.');
    if (dotIdx2 === -1) continue;
    const op = rest.substring(0, dotIdx2);
    const val = rest.substring(dotIdx2 + 1);
    validateColumn(col);

    const OP_MAP: Record<string, string> = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'LIKE' };
    const sqlOp = OP_MAP[op];
    if (sqlOp) {
      parts.push(`"${col}" ${sqlOp} ?`);
      params.push(val);
    } else if (op === 'is') {
      const lower = val.toLowerCase();
      if (lower === 'null') parts.push(`"${col}" IS NULL`);
      else if (lower === 'true') parts.push(`"${col}" = 1`);
      else if (lower === 'false') parts.push(`"${col}" = 0`);
    } else if (op === 'in') {
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

async function execSelect(conn: SQLiteDBConnection, params: QueryParams): Promise<PostgrestResponse> {
  let columnsSql = '*';
  if (params.columns && params.columns.trim() !== '*') {
    const parts = params.columns.split(',').map(c => c.trim());
    for (const p of parts) {
      if (p !== '*' && !p.includes('(')) validateColumn(p);
    }
    columnsSql = parts.map(c => (c === '*' || c.includes('(')) ? c : `"${c}"`).join(', ');
  }

  const { clause: whereClause, params: whereParams } = buildWhereClause(params.filters);

  let orClause = '';
  let orParams: any[] = [];
  if (params.or_filter) {
    const parsed = parseOrFilter(params.or_filter);
    orClause = parsed.clause;
    orParams = parsed.params;
  }

  let fullWhere = whereClause;
  if (orClause) {
    fullWhere = fullWhere ? `${fullWhere} AND ${orClause}` : ` WHERE ${orClause}`;
  }

  let orderClause: string;
  if (params.order_col) {
    validateColumn(params.order_col);
    const dir = params.order_asc === false ? 'DESC' : 'ASC';
    orderClause = ` ORDER BY "${params.order_col}" ${dir}`;
  } else {
    orderClause = ' ORDER BY created_at DESC';
  }

  let limitClause = '';
  if (params.limit != null) limitClause += ` LIMIT ${Number(params.limit)}`;
  if (params.offset != null) limitClause += ` OFFSET ${Number(params.offset)}`;

  const sql = `SELECT ${columnsSql} FROM "${params.table}"${fullWhere}${orderClause}${limitClause}`;
  const allParams = [...whereParams, ...orParams];

  let rows: any[];
  try {
    const result = await conn.query(sql, allParams);
    rows = result.values || [];
  } catch {
    try {
      const fallbackSql = `SELECT ${columnsSql} FROM "${params.table}"${fullWhere}${limitClause}`;
      const result = await conn.query(fallbackSql, allParams);
      rows = result.values || [];
    } catch {
      const starSql = `SELECT * FROM "${params.table}"${fullWhere}${limitClause}`;
      const result = await conn.query(starSql, allParams);
      rows = result.values || [];
    }
  }

  const data = rows.map(parseRow);

  if (params.count) {
    const countSql = `SELECT COUNT(*) as c FROM "${params.table}"${fullWhere}`;
    const countResult = await conn.query(countSql, allParams);
    const c = countResult.values?.[0]?.c ?? 0;
    return supabaseOk(data, { count: c });
  }

  return supabaseOk(data);
}

async function execInsert(conn: SQLiteDBConnection, params: QueryParams): Promise<PostgrestResponse> {
  const rows = Array.isArray(params.body) ? params.body : [params.body];
  const inserted: any[] = [];
  const pk = TABLE_PK[params.table] || 'id';

  for (const row of rows) {
    const body = { ...row };
    serializeJsonFields(body);

    if (!body[pk]) body[pk] = newId();
    if (pk !== 'user_id' && !NO_USER_ID_TABLES.has(params.table) && !body.user_id) {
      body.user_id = DEFAULT_USER_ID;
    }
    if (!body.created_at) body.created_at = nowIso();
    if (!body.updated_at) body.updated_at = nowIso();

    const cols = Object.keys(body).filter(k => ALLOWED_COLUMNS.has(k));
    if (cols.length === 0) {
      inserted.push(body);
      continue;
    }

    const colList = cols.map(c => `"${c}"`).join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map(c => valueToSql(body[c]));

    await conn.execute(`INSERT OR IGNORE INTO "${params.table}" (${colList}) VALUES (${placeholders})`, values);

    // Fetch back the inserted row
    const result = await conn.query(
      `SELECT * FROM "${params.table}" WHERE "${pk}" = ?`,
      [body[pk]]
    );
    const insertedRow = result.values?.[0];
    if (insertedRow) inserted.push(parseRow(insertedRow));
    else inserted.push(body);
  }

  return supabaseOk(inserted);
}

async function execUpdate(conn: SQLiteDBConnection, params: QueryParams): Promise<PostgrestResponse> {
  const body = { ...params.body };
  serializeJsonFields(body);
  body.updated_at = nowIso();

  const { clause: whereClause, params: whereParams } = buildWhereClause(params.filters);
  if (!whereClause) return supabaseErr('UPDATE requires at least one filter', 'MISSING_FILTER', 400);

  const setCols = Object.keys(body).filter(k => ALLOWED_COLUMNS.has(k));
  if (setCols.length === 0) return supabaseOk([]);

  const setClause = setCols.map(c => `"${c}" = ?`).join(', ');
  const setValues = setCols.map(c => valueToSql(body[c]));

  const sql = `UPDATE "${params.table}" SET ${setClause}${whereClause}`;
  await conn.execute(sql, [...setValues, ...whereParams]);

  // Return updated rows
  const fetchSql = `SELECT * FROM "${params.table}"${whereClause}`;
  const result = await conn.query(fetchSql, whereParams);
  return supabaseOk((result.values || []).map(parseRow));
}

async function execUpsert(conn: SQLiteDBConnection, params: QueryParams): Promise<PostgrestResponse> {
  const rows = Array.isArray(params.body) ? params.body : [params.body];
  const upserted: any[] = [];
  const pk = TABLE_PK[params.table] || 'id';

  for (const row of rows) {
    const body = { ...row };
    serializeJsonFields(body);

    if (!body[pk]) body[pk] = newId();
    if (!NO_USER_ID_TABLES.has(params.table) && !body.user_id && pk !== 'user_id') {
      body.user_id = DEFAULT_USER_ID;
    }
    if (!body.created_at) body.created_at = nowIso();
    body.updated_at = nowIso();

    const cols = Object.keys(body).filter(k => ALLOWED_COLUMNS.has(k));
    if (cols.length === 0) continue;

    const colList = cols.map(c => `"${c}"`).join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map(c => valueToSql(body[c]));

    const updateCols = cols.filter(c => c !== pk && c !== 'created_at');
    const updateSet = updateCols.map(c => `"${c}" = excluded."${c}"`).join(', ');

    const conflict = params.upsert_conflict || pk;
    const sql = `INSERT INTO "${params.table}" (${colList}) VALUES (${placeholders})
      ON CONFLICT("${conflict}") DO UPDATE SET ${updateSet}`;

    await conn.execute(sql, values);

    const result = await conn.query(`SELECT * FROM "${params.table}" WHERE "${pk}" = ?`, [body[pk]]);
    const row2 = result.values?.[0];
    if (row2) upserted.push(parseRow(row2));
    else upserted.push(body);
  }

  return supabaseOk(upserted);
}

async function execDelete(conn: SQLiteDBConnection, params: QueryParams): Promise<PostgrestResponse> {
  const { clause: whereClause, params: whereParams } = buildWhereClause(params.filters);
  if (!whereClause) return supabaseErr('DELETE requires at least one filter', 'MISSING_FILTER', 400);

  if (SOFT_DELETE_TABLES.has(params.table)) {
    await conn.execute(
      `UPDATE "${params.table}" SET is_deleted = 1, updated_at = ?${whereClause}`,
      [nowIso(), ...whereParams]
    );
  } else {
    await conn.execute(`DELETE FROM "${params.table}"${whereClause}`, whereParams);
  }

  return supabaseOk([]);
}

// ═══════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════

export async function execQuery<T = any>(params: QueryParams): Promise<PostgrestResponse<T>> {
  try {
    validateTable(params.table);
    const conn = getConn();

    switch (params.method) {
      case 'select': return await execSelect(conn, params);
      case 'insert': return await execInsert(conn, params);
      case 'update': return await execUpdate(conn, params);
      case 'upsert': return await execUpsert(conn, params);
      case 'delete': return await execDelete(conn, params);
      default: return supabaseErr(`Unknown method: ${(params as any).method}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[capacitor-db] execQuery error:', msg, params);
    return supabaseErr(msg);
  }
}

export async function execRpc(fn: string, _params: Record<string, any>): Promise<PostgrestResponse> {
  // Basic RPC stubs — extend as needed
  return supabaseErr(`RPC '${fn}' not implemented in Capacitor mode`, 'NOT_IMPLEMENTED', 501);
}
