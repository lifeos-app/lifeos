#!/usr/bin/env python3
"""
LifeOS Flask Backend — Local-first SQLite API
Replaces Supabase with a simple REST API.
Single-user mode, no auth required.

All responses match Supabase's { data: [...], error: null } format
so the frontend adapter layer can consume them directly.
"""

import os
import json
import sqlite3
import uuid
import requests as http_requests
from datetime import datetime, date
from functools import wraps
from flask import Flask, request, jsonify, g, send_from_directory

# ═══════════════════════════════════════════════════════════════
# App Setup
# ═══════════════════════════════════════════════════════════════

app = Flask(__name__, static_folder=None)

# CORS — allow Vite dev server and any localhost
from flask_cors import CORS
CORS(app, origins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
])

DB_PATH = os.path.join(os.path.expanduser('~'), '.lifeos', 'data.db')
DEFAULT_USER_ID = 'local-user-001'
AI_BRIDGE_URL = os.environ.get('AI_BRIDGE_URL', 'http://localhost:11435')

# ═══════════════════════════════════════════════════════════════
# Database Helpers
# ═══════════════════════════════════════════════════════════════

def get_db():
    """Get a database connection for the current request."""
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(exc):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def row_to_dict(row):
    """Convert sqlite3.Row to dict, parsing JSON fields."""
    if row is None:
        return None
    d = dict(row)
    # Parse known JSON columns
    for key in ('tags', 'metadata', 'preferences', 'stats', 'equipment',
                'position', 'sprite_data', 'exercises', 'attachments',
                'steps_completed', 'custom_fields'):
        if key in d and isinstance(d[key], str):
            try:
                d[key] = json.loads(d[key])
            except (json.JSONDecodeError, TypeError):
                pass
    return d

def rows_to_list(rows):
    return [row_to_dict(r) for r in rows]

def now_iso():
    return datetime.utcnow().isoformat() + 'Z'

def new_id():
    return str(uuid.uuid4())

def supabase_response(data=None, error=None, count=None):
    """Return data in Supabase-compatible format."""
    resp = {"data": data, "error": error}
    if count is not None:
        resp["count"] = count
    return jsonify(resp)

# ═══════════════════════════════════════════════════════════════
# Schema — All Tables
# ═══════════════════════════════════════════════════════════════

SCHEMA_SQL = """
-- Users (simplified for single-user)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'Australia/Melbourne',
    subscription_tier TEXT DEFAULT 'free',
    preferences TEXT DEFAULT '{}',
    onboarding_complete INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
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
    estimated_hours INTEGER,
    deadline_type TEXT DEFAULT 'soft',
    success_criteria TEXT,
    key_results TEXT,
    resources TEXT,
    decomposition_source TEXT,
    health_status TEXT,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    source TEXT DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced',
    FOREIGN KEY (parent_goal_id) REFERENCES goals(id),
    FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    goal_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    due_date TEXT,
    due_time TEXT,
    scheduled_date TEXT,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    estimated_duration INTEGER,
    actual_duration INTEGER,
    category_id TEXT,
    project_id TEXT,
    parent_task_id TEXT,
    depth_level INTEGER DEFAULT 0,
    board_status TEXT DEFAULT 'todo',
    board_position INTEGER,
    sort_order INTEGER DEFAULT 0,
    depends_on_task_id TEXT,
    scheduled_start TEXT,
    scheduled_end TEXT,
    energy_level TEXT,
    domain TEXT,
    suggested_week INTEGER,
    auto_scheduled INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    financial_amount REAL,
    financial_type TEXT,
    financial_category_id TEXT,
    source TEXT DEFAULT 'manual',
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced',
    FOREIGN KEY (goal_id) REFERENCES goals(id),
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
);

-- Habits
CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    frequency TEXT DEFAULT 'daily',
    target_count INTEGER DEFAULT 1,
    streak_current INTEGER DEFAULT 0,
    streak_best INTEGER DEFAULT 0,
    category TEXT,
    category_id TEXT,
    time_of_day TEXT,
    duration_minutes INTEGER,
    goal_id TEXT,
    is_active INTEGER DEFAULT 1,
    source TEXT DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced',
    FOREIGN KEY (goal_id) REFERENCES goals(id)
);

-- Habit Logs
CREATE TABLE IF NOT EXISTS habit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    habit_id TEXT NOT NULL,
    date TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    value REAL,
    completed INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_status TEXT DEFAULT 'synced',
    FOREIGN KEY (habit_id) REFERENCES habits(id)
);

-- Schedule Events
CREATE TABLE IF NOT EXISTS schedule_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT,
    end_time TEXT,
    date TEXT,
    all_day INTEGER DEFAULT 0,
    event_type TEXT DEFAULT 'custom',
    category TEXT,
    category_id TEXT,
    task_id TEXT,
    habit_id TEXT,
    workout_template_id TEXT,
    location TEXT,
    notes TEXT,
    day_type TEXT,
    recurrence_rule TEXT,
    is_recurring INTEGER DEFAULT 0,
    status TEXT DEFAULT 'scheduled',
    color TEXT,
    source TEXT,
    htmlLink TEXT,
    metadata TEXT DEFAULT '{}',
    schedule_layer TEXT,
    is_template INTEGER DEFAULT 0,
    is_live INTEGER DEFAULT 0,
    financial_amount REAL,
    financial_type TEXT,
    financial_category_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced'
);

-- Health Metrics
CREATE TABLE IF NOT EXISTS health_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    mood_score REAL,
    energy_score REAL,
    stress_score REAL,
    sleep_hours REAL,
    sleep_quality REAL,
    water_glasses INTEGER,
    weight_kg REAL,
    exercise_minutes INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Workouts
CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    day_of_week INTEGER,
    preferred_time TEXT,
    duration_minutes INTEGER,
    exercises TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Workout Exercises
CREATE TABLE IF NOT EXISTS workout_exercises (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workout_id TEXT,
    name TEXT NOT NULL,
    sets INTEGER,
    reps INTEGER,
    weight REAL,
    duration_seconds INTEGER,
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workout_id) REFERENCES workouts(id)
);

-- Finance: Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    color TEXT DEFAULT '#64748B',
    scope TEXT DEFAULT 'personal',
    budget_monthly REAL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Finance: Businesses
CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'business',
    description TEXT,
    industry TEXT,
    revenue_model TEXT,
    monthly_revenue REAL,
    monthly_expenses REAL,
    icon TEXT DEFAULT '💼',
    color TEXT DEFAULT '#00D4FF',
    status TEXT DEFAULT 'active',
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced'
);

-- Finance: Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    title TEXT,
    description TEXT,
    date TEXT NOT NULL DEFAULT (date('now')),
    category_id TEXT,
    business_id TEXT,
    client_id TEXT,
    task_id TEXT,
    event_id TEXT,
    notes TEXT,
    recurring INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES expense_categories(id),
    FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- Finance: Budgets
CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT,
    month TEXT NOT NULL,
    amount REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES expense_categories(id)
);

-- Finance: Income
CREATE TABLE IF NOT EXISTS income (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    source TEXT,
    client_id TEXT,
    date TEXT NOT NULL DEFAULT (date('now')),
    is_recurring INTEGER DEFAULT 0,
    recurrence_rule TEXT,
    category_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced'
);

-- Finance: Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    category_id TEXT,
    date TEXT NOT NULL DEFAULT (date('now')),
    is_deductible INTEGER DEFAULT 0,
    receipt_url TEXT,
    payment_method TEXT,
    is_recurring INTEGER DEFAULT 0,
    travel_km REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced'
);

-- Finance: Bills
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    due_date TEXT,
    is_recurring INTEGER DEFAULT 0,
    recurrence_rule TEXT,
    status TEXT DEFAULT 'pending',
    paid_date TEXT,
    payment_url TEXT,
    notes TEXT,
    category_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced'
);

-- Finance: Clients
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    latitude REAL,
    longitude REAL,
    rate REAL,
    rate_type TEXT,
    notes TEXT,
    sop TEXT,
    access_codes TEXT,
    color TEXT,
    business_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced',
    FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    title TEXT,
    content TEXT,
    mood INTEGER,
    energy INTEGER,
    tags TEXT DEFAULT '[]',
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced'
);

-- RPG Characters
CREATE TABLE IF NOT EXISTS rpg_characters (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    class TEXT DEFAULT 'warrior',
    sprite_data TEXT DEFAULT '{}',
    stats TEXT DEFAULT '{}',
    equipment TEXT DEFAULT '[]',
    position TEXT DEFAULT '{"map":"life_town","x":600,"y":400}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- RPG Quest Log
CREATE TABLE IF NOT EXISTS rpg_quest_log (
    id TEXT PRIMARY KEY,
    character_id TEXT,
    quest_id TEXT NOT NULL,
    source_type TEXT DEFAULT 'system',
    source_id TEXT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    progress REAL DEFAULT 0,
    xp_reward INTEGER DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (character_id) REFERENCES rpg_characters(id)
);

-- User XP
CREATE TABLE IF NOT EXISTS user_xp (
    user_id TEXT PRIMARY KEY,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    current_level_xp INTEGER DEFAULT 0,
    next_level_xp INTEGER DEFAULT 100,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- XP Events
CREATE TABLE IF NOT EXISTS xp_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    source TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    xp_reward INTEGER DEFAULT 0,
    tier TEXT DEFAULT 'bronze',
    category TEXT,
    unlocked_at TEXT DEFAULT (datetime('now'))
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'item',
    rarity TEXT DEFAULT 'common',
    icon TEXT,
    description TEXT,
    stats TEXT DEFAULT '{}',
    is_equipped INTEGER DEFAULT 0,
    slot TEXT,
    quantity INTEGER DEFAULT 1,
    source TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0
);

-- Pet Profiles
CREATE TABLE IF NOT EXISTS pet_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    species TEXT DEFAULT 'cat',
    mood TEXT DEFAULT 'happy',
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    hunger INTEGER DEFAULT 100,
    happiness INTEGER DEFAULT 100,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0
);

-- Categories (generic)
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    parent_id TEXT,
    domain TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced'
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    color TEXT,
    icon TEXT,
    goal_id TEXT,
    start_date TEXT,
    target_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced'
);

-- Notes
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    content TEXT,
    category_id TEXT,
    is_pinned INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced'
);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    category TEXT,
    value REAL,
    purchase_date TEXT,
    description TEXT,
    image_url TEXT,
    is_equipped INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0
);

-- Asset Maintenance
CREATE TABLE IF NOT EXISTS asset_maintenance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    cost REAL,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
);

-- Asset Bills
CREATE TABLE IF NOT EXISTS asset_bills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset_id TEXT,
    title TEXT NOT NULL,
    amount REAL,
    due_date TEXT,
    is_recurring INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
);

-- Asset Documents
CREATE TABLE IF NOT EXISTS asset_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset_id TEXT,
    title TEXT NOT NULL,
    file_url TEXT,
    file_type TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
);

-- AI Insights
CREATE TABLE IF NOT EXISTS ai_insights (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT,
    content TEXT,
    context TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    attachments TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Unified Events (for live activity logging)
CREATE TABLE IF NOT EXISTS unified_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_type TEXT,
    title TEXT,
    description TEXT,
    amount REAL,
    date TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sync Meta (tracks last sync times)
CREATE TABLE IF NOT EXISTS sync_meta (
    table_name TEXT PRIMARY KEY,
    last_sync_at TEXT,
    record_count INTEGER DEFAULT 0
);

-- Lesson Progress
CREATE TABLE IF NOT EXISTS lesson_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    module_id TEXT DEFAULT 'teddys-lessons',
    status TEXT DEFAULT 'not_started',
    current_step TEXT,
    steps_completed TEXT DEFAULT '[]',
    score INTEGER DEFAULT 0,
    streak_current INTEGER DEFAULT 0,
    streak_best INTEGER DEFAULT 0,
    total_practice_time INTEGER DEFAULT 0,
    last_practiced_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id);

CREATE TABLE IF NOT EXISTS parts_inventory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    quantity INTEGER DEFAULT 0,
    unit_price REAL DEFAULT 0,
    location TEXT,
    supplier TEXT,
    sku TEXT,
    condition TEXT DEFAULT 'new',
    notes TEXT,
    tags TEXT DEFAULT '[]',
    custom_fields TEXT DEFAULT '{}',
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced'
);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_user ON parts_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_category ON parts_inventory(category);

CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);
CREATE INDEX IF NOT EXISTS idx_events_user ON schedule_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON schedule_events(date);
CREATE INDEX IF NOT EXISTS idx_health_user_date ON health_metrics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_income_user ON income(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);
"""

def init_db():
    """Create all tables and seed default user."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA_SQL)
    # Ensure default user exists
    db.execute(
        "INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)",
        (DEFAULT_USER_ID, 'local@lifeos.app', 'LifeOS User')
    )
    db.execute(
        "INSERT OR IGNORE INTO user_profiles (user_id, email, full_name, onboarding_complete) VALUES (?, ?, ?, 1)",
        (DEFAULT_USER_ID, 'local@lifeos.app', 'LifeOS User')
    )
    db.execute(
        "INSERT OR IGNORE INTO user_xp (user_id, total_xp, level) VALUES (?, 0, 1)",
        (DEFAULT_USER_ID,)
    )
    db.commit()
    db.close()
    print(f"[LifeOS] Database initialized at {DB_PATH}")


# ═══════════════════════════════════════════════════════════════
# Unified PostgREST-Compatible CRUD Handler
# ═══════════════════════════════════════════════════════════════
# Replaces per-table blueprint registrations with a single handler
# that properly parses PostgREST-style filter params from the frontend.
# The frontend's local-api.ts sends: db.from('table_name')...
# which maps to: /api/<table_name>?column=operator.value

ALLOWED_TABLES = {
    'users', 'user_profiles', 'goals', 'tasks', 'habits', 'habit_logs',
    'schedule_events', 'health_metrics', 'workouts', 'workout_exercises',
    'expense_categories', 'businesses', 'transactions', 'budgets',
    'income', 'expenses', 'bills', 'clients', 'journal_entries',
    'rpg_characters', 'rpg_quest_log', 'user_xp', 'xp_events',
    'achievements', 'inventory_items', 'pet_profiles', 'categories',
    'projects', 'notes', 'assets', 'asset_maintenance', 'asset_bills',
    'asset_documents', 'ai_insights', 'chat_messages', 'unified_events',
    'sync_meta', 'lesson_progress', 'parts_inventory',
}

SOFT_DELETE_TABLES = {
    'goals', 'tasks', 'habits', 'income', 'expenses', 'bills',
    'clients', 'journal_entries', 'businesses', 'categories', 'projects',
    'notes', 'assets', 'asset_maintenance', 'asset_bills', 'asset_documents',
    'inventory_items', 'pet_profiles', 'lesson_progress', 'parts_inventory',
}

# Tables that use a non-'id' primary key
TABLE_PK = {
    'user_profiles': 'user_id',
    'user_xp': 'user_id',
    'sync_meta': 'table_name',
}

# Tables that don't have a user_id column
NO_USER_ID_TABLES = {'sync_meta'}

RESERVED_PARAMS = {'select', 'order', 'limit', 'offset', 'single', 'count',
                    'on_conflict', 'return', 'or'}


def _parse_postgrest_filter(key, raw_value):
    """Parse a PostgREST-style filter: column=operator.value
    Returns (sql_clause, params_list)."""
    OP_MAP = {
        'eq': '=', 'neq': '!=', 'gt': '>', 'gte': '>=',
        'lt': '<', 'lte': '<=', 'like': 'LIKE', 'ilike': 'LIKE',
    }
    for op_name, sql_op in OP_MAP.items():
        prefix = f'{op_name}.'
        if raw_value.startswith(prefix):
            val = raw_value[len(prefix):]
            return f'"{key}" {sql_op} ?', [val]

    if raw_value.startswith('is.'):
        val = raw_value[3:].lower()
        if val == 'null':
            return f'"{key}" IS NULL', []
        elif val == 'true':
            return f'"{key}" = ?', [1]
        elif val == 'false':
            return f'"{key}" = ?', [0]
        return f'"{key}" IS ?', [val]

    if raw_value.startswith('in.(') and raw_value.endswith(')'):
        items = [x.strip() for x in raw_value[4:-1].split(',') if x.strip()]
        if not items:
            return '0', []  # empty IN → match nothing
        placeholders = ','.join('?' for _ in items)
        return f'"{key}" IN ({placeholders})', items

    # Default: plain equality (backwards compatibility with simple params)
    return f'"{key}" = ?', [raw_value]


def _parse_or_filter(or_string):
    """Parse PostgREST or filter: 'status.eq.active,status.eq.pending'"""
    parts = []
    params = []
    for item in or_string.split(','):
        item = item.strip()
        if not item:
            continue
        dot_idx = item.index('.')
        col = item[:dot_idx]
        rest = item[dot_idx + 1:]
        clause, p = _parse_postgrest_filter(col, rest)
        parts.append(clause)
        params.extend(p)
    if not parts:
        return '1=1', []
    return f'({" OR ".join(parts)})', params


def _serialize_json_fields(body):
    """Serialize JSON fields to strings for SQLite storage."""
    for key in ('tags', 'metadata', 'preferences', 'stats', 'equipment',
                'position', 'sprite_data', 'exercises', 'attachments',
                'context', 'key_results', 'resources', 'steps_completed', 'custom_fields'):
        if key in body and not isinstance(body[key], str):
            body[key] = json.dumps(body[key])


def _do_insert(db, table_name, body):
    """Insert a single record, return the inserted row as dict."""
    pk = TABLE_PK.get(table_name, 'id')
    body.setdefault(pk, new_id())
    if table_name not in NO_USER_ID_TABLES:
        body.setdefault('user_id', DEFAULT_USER_ID)
    body.setdefault('created_at', now_iso())
    _serialize_json_fields(body)

    cols = ", ".join(f'"{k}"' for k in body.keys())
    placeholders = ", ".join("?" for _ in body)
    db.execute(f'INSERT INTO {table_name} ({cols}) VALUES ({placeholders})', list(body.values()))
    row = db.execute(f'SELECT * FROM {table_name} WHERE "{pk}" = ?', (body[pk],)).fetchone()
    return row_to_dict(row)


def _do_upsert(db, table_name, body, on_conflict='id'):
    """Upsert a record (insert or update on conflict)."""
    pk = TABLE_PK.get(table_name, 'id')
    body.setdefault(pk, new_id())
    if table_name not in NO_USER_ID_TABLES:
        body.setdefault('user_id', DEFAULT_USER_ID)
    body.setdefault('created_at', now_iso())
    _serialize_json_fields(body)

    cols = ", ".join(f'"{k}"' for k in body.keys())
    placeholders = ", ".join("?" for _ in body)
    updates = ", ".join(f'"{k}" = excluded."{k}"' for k in body.keys() if k != on_conflict)
    if not updates:
        updates = f'"{pk}" = excluded."{pk}"'  # no-op update

    db.execute(
        f'INSERT INTO {table_name} ({cols}) VALUES ({placeholders}) ON CONFLICT("{on_conflict}") DO UPDATE SET {updates}',
        list(body.values())
    )
    row = db.execute(f'SELECT * FROM {table_name} WHERE "{pk}" = ?', (body.get(pk),)).fetchone()
    return row_to_dict(row)


@app.route('/api/<table_name>', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
@app.route('/api/<table_name>/<item_id>', methods=['GET', 'PUT', 'PATCH', 'DELETE'])
def unified_crud(table_name, item_id=None):
    """Unified PostgREST-compatible CRUD for all tables."""
    if table_name not in ALLOWED_TABLES:
        return supabase_response(error={"message": f"Unknown table: {table_name}"}), 404

    db = get_db()
    method = request.method
    pk = TABLE_PK.get(table_name, 'id')

    # ── GET: Select ──────────────────────────────────────────
    if method == 'GET':
        if item_id:
            row = db.execute(f'SELECT * FROM {table_name} WHERE "{pk}" = ?', (item_id,)).fetchone()
            if not row:
                return supabase_response(data=None, error={"message": "Not found"}), 404
            return supabase_response(data=row_to_dict(row))

        conditions = []
        params = []

        # Auto-filter by user_id
        if table_name not in NO_USER_ID_TABLES:
            conditions.append('"user_id" = ?')
            params.append(DEFAULT_USER_ID)

        # Soft delete filter
        if table_name in SOFT_DELETE_TABLES:
            conditions.append('("is_deleted" = 0 OR "is_deleted" IS NULL)')

        # Parse query params
        order_clause = 'rowid DESC'
        limit_val = None
        offset_val = 0
        single = False

        for key, val in request.args.items():
            if key == 'order':
                parts = val.split('.')
                col = parts[0]
                direction = parts[1].upper() if len(parts) > 1 else 'DESC'
                if direction not in ('ASC', 'DESC'):
                    direction = 'DESC'
                order_clause = f'"{col}" {direction}'
            elif key == 'limit':
                limit_val = int(val)
            elif key == 'offset':
                offset_val = int(val)
            elif key == 'single':
                single = val.lower() == 'true'
            elif key == 'or':
                clause, p = _parse_or_filter(val)
                conditions.append(clause)
                params.extend(p)
            elif key in RESERVED_PARAMS:
                continue
            else:
                clause, p = _parse_postgrest_filter(key, val)
                conditions.append(clause)
                params.extend(p)

        where = " AND ".join(conditions) if conditions else "1=1"
        sql = f'SELECT * FROM {table_name} WHERE {where} ORDER BY {order_clause}'
        if limit_val is not None:
            sql += f' LIMIT {limit_val} OFFSET {offset_val}'

        try:
            rows = db.execute(sql, params).fetchall()
        except sqlite3.OperationalError:
            # Fallback: retry without ORDER BY (column might not exist)
            sql = f'SELECT * FROM {table_name} WHERE {where}'
            if limit_val is not None:
                sql += f' LIMIT {limit_val} OFFSET {offset_val}'
            rows = db.execute(sql, params).fetchall()

        data = rows_to_list(rows)
        if single:
            return supabase_response(data=data[0] if data else None, count=len(data))
        return supabase_response(data=data, count=len(data))

    # ── POST: Insert ─────────────────────────────────────────
    elif method == 'POST':
        body = request.get_json(force=True, silent=True) or {}
        if isinstance(body, list):
            results = [_do_insert(db, table_name, item) for item in body]
            db.commit()
            return supabase_response(data=results), 201
        result = _do_insert(db, table_name, body)
        db.commit()
        return supabase_response(data=result), 201

    # ── PUT: Upsert or Update by ID ─────────────────────────
    elif method == 'PUT':
        body = request.get_json(force=True, silent=True) or {}
        on_conflict = request.args.get('on_conflict', pk)
        if item_id:
            # PUT /api/table/id → update
            body.pop(pk, None)
            body.pop('created_at', None)
            body.setdefault('updated_at', now_iso())
            _serialize_json_fields(body)
            if body:
                sets = ", ".join(f'"{k}" = ?' for k in body.keys())
                vals = list(body.values()) + [item_id]
                db.execute(f'UPDATE {table_name} SET {sets} WHERE "{pk}" = ?', vals)
                db.commit()
            row = db.execute(f'SELECT * FROM {table_name} WHERE "{pk}" = ?', (item_id,)).fetchone()
            return supabase_response(data=row_to_dict(row))
        # Upsert (no item_id)
        if isinstance(body, list):
            results = [_do_upsert(db, table_name, item, on_conflict) for item in body]
            db.commit()
            return supabase_response(data=results)
        result = _do_upsert(db, table_name, body, on_conflict)
        db.commit()
        return supabase_response(data=result)

    # ── PATCH: Update ────────────────────────────────────────
    elif method == 'PATCH':
        body = request.get_json(force=True, silent=True) or {}
        body.pop('created_at', None)
        body.setdefault('updated_at', now_iso())
        _serialize_json_fields(body)
        if item_id:
            body.pop(pk, None)
            if body:
                sets = ", ".join(f'"{k}" = ?' for k in body.keys())
                vals = list(body.values()) + [item_id]
                db.execute(f'UPDATE {table_name} SET {sets} WHERE "{pk}" = ?', vals)
                db.commit()
            row = db.execute(f'SELECT * FROM {table_name} WHERE "{pk}" = ?', (item_id,)).fetchone()
            return supabase_response(data=row_to_dict(row))
        # PATCH without item_id: update matching filters
        conditions = []
        params = []
        for key, val in request.args.items():
            if key in RESERVED_PARAMS:
                continue
            clause, p = _parse_postgrest_filter(key, val)
            conditions.append(clause)
            params.extend(p)
        if not conditions:
            return supabase_response(error={"message": "No filter for PATCH"}), 400
        body.pop(pk, None)
        if not body:
            return supabase_response(error={"message": "No fields to update"}), 400
        sets = ", ".join(f'"{k}" = ?' for k in body.keys())
        where = " AND ".join(conditions)
        db.execute(f'UPDATE {table_name} SET {sets} WHERE {where}', list(body.values()) + params)
        db.commit()
        return supabase_response(data=body)

    # ── DELETE ────────────────────────────────────────────────
    elif method == 'DELETE':
        if item_id:
            if table_name in SOFT_DELETE_TABLES:
                db.execute(f'UPDATE {table_name} SET is_deleted = 1, updated_at = ? WHERE "{pk}" = ?', (now_iso(), item_id))
            else:
                db.execute(f'DELETE FROM {table_name} WHERE "{pk}" = ?', (item_id,))
            db.commit()
            return supabase_response(data={pk: item_id, "deleted": True})
        # DELETE matching filters
        conditions = []
        params = []
        for key, val in request.args.items():
            if key in RESERVED_PARAMS:
                continue
            clause, p = _parse_postgrest_filter(key, val)
            conditions.append(clause)
            params.extend(p)
        if not conditions:
            return supabase_response(error={"message": "No filter for DELETE"}), 400
        where = " AND ".join(conditions)
        if table_name in SOFT_DELETE_TABLES:
            db.execute(f'UPDATE {table_name} SET is_deleted = 1, updated_at = ? WHERE {where}', [now_iso()] + params)
        else:
            db.execute(f'DELETE FROM {table_name} WHERE {where}', params)
        db.commit()
        return supabase_response(data={"deleted": True})

    return supabase_response(error={"message": "Method not allowed"}), 405


# ═══════════════════════════════════════════════════════════════
# RPC Endpoint — for supabase.rpc() calls
# ═══════════════════════════════════════════════════════════════

@app.route('/api/rpc/<fn_name>', methods=['POST'])
def rpc_handler(fn_name):
    """Handle RPC calls from the frontend (e.g. get_table_columns)."""
    body = request.get_json(force=True, silent=True) or {}

    if fn_name == 'get_table_columns':
        table = body.get('table_name', '')
        if table not in ALLOWED_TABLES:
            return supabase_response(data=[])
        db = get_db()
        cols = db.execute(f"PRAGMA table_info({table})").fetchall()
        return supabase_response(data=[{'column_name': c[1], 'data_type': c[2]} for c in cols])

    return supabase_response(data=None, error={"message": f"Unknown RPC: {fn_name}"}), 404


# ═══════════════════════════════════════════════════════════════
# Habit Logs — Special Endpoint
# ═══════════════════════════════════════════════════════════════

@app.route('/api/habit-logs', methods=['GET'])
def list_habit_logs():
    db = get_db()
    habit_id = request.args.get('habit_id')
    conditions = ["user_id = ?"]
    params = [DEFAULT_USER_ID]
    if habit_id:
        conditions.append("habit_id = ?")
        params.append(habit_id)
    where = " AND ".join(conditions)
    rows = db.execute(f"SELECT * FROM habit_logs WHERE {where} ORDER BY date DESC", params).fetchall()
    return supabase_response(data=rows_to_list(rows))

@app.route('/api/habit-logs', methods=['POST'])
def create_habit_log():
    db = get_db()
    body = request.get_json(force=True, silent=True) or {}
    body.setdefault('id', new_id())
    body.setdefault('user_id', DEFAULT_USER_ID)
    body.setdefault('created_at', now_iso())
    body.setdefault('count', 1)
    body.setdefault('completed', 1)

    cols = ", ".join(body.keys())
    placeholders = ", ".join("?" for _ in body)
    db.execute(f"INSERT INTO habit_logs ({cols}) VALUES ({placeholders})", list(body.values()))
    db.commit()
    row = db.execute("SELECT * FROM habit_logs WHERE id = ?", (body['id'],)).fetchone()
    return supabase_response(data=row_to_dict(row)), 201

@app.route('/api/habit-logs/<log_id>', methods=['DELETE'])
def delete_habit_log(log_id):
    db = get_db()
    db.execute("DELETE FROM habit_logs WHERE id = ?", (log_id,))
    db.commit()
    return supabase_response(data={"id": log_id, "deleted": True})


# ═══════════════════════════════════════════════════════════════
# XP System — Special Endpoints
# ═══════════════════════════════════════════════════════════════

@app.route('/api/xp', methods=['GET'])
def get_xp():
    db = get_db()
    row = db.execute("SELECT * FROM user_xp WHERE user_id = ?", (DEFAULT_USER_ID,)).fetchone()
    return supabase_response(data=row_to_dict(row) if row else {
        'user_id': DEFAULT_USER_ID, 'total_xp': 0, 'level': 1,
        'current_level_xp': 0, 'next_level_xp': 100
    })

@app.route('/api/xp/add', methods=['POST'])
def add_xp():
    db = get_db()
    body = request.get_json(force=True, silent=True) or {}
    amount = body.get('amount', 0)
    source = body.get('source', 'unknown')
    description = body.get('description', '')

    # Log xp event
    db.execute(
        "INSERT INTO xp_events (id, user_id, amount, source, description) VALUES (?, ?, ?, ?, ?)",
        (new_id(), DEFAULT_USER_ID, amount, source, description)
    )

    # Update total
    row = db.execute("SELECT * FROM user_xp WHERE user_id = ?", (DEFAULT_USER_ID,)).fetchone()
    if row:
        new_total = row['total_xp'] + amount
        level = 1 + int(new_total ** 0.5 / 5)  # Simple level formula
        next_lvl_xp = ((level) * 5) ** 2
        current_lvl_xp = new_total - (((level - 1) * 5) ** 2)
        db.execute(
            "UPDATE user_xp SET total_xp = ?, level = ?, current_level_xp = ?, next_level_xp = ?, updated_at = ? WHERE user_id = ?",
            (new_total, level, current_lvl_xp, next_lvl_xp, now_iso(), DEFAULT_USER_ID)
        )
    else:
        db.execute(
            "INSERT INTO user_xp (user_id, total_xp, level, current_level_xp, next_level_xp) VALUES (?, ?, 1, ?, 100)",
            (DEFAULT_USER_ID, amount, amount)
        )

    db.commit()
    updated = db.execute("SELECT * FROM user_xp WHERE user_id = ?", (DEFAULT_USER_ID,)).fetchone()
    return supabase_response(data=row_to_dict(updated))


# ═══════════════════════════════════════════════════════════════
# User / Auth — Simplified for Local Mode
# ═══════════════════════════════════════════════════════════════

@app.route('/api/auth/session', methods=['GET'])
def get_session():
    """Return a fake session — single user mode."""
    return supabase_response(data={
        "user": {
            "id": DEFAULT_USER_ID,
            "email": "local@lifeos.app",
            "user_metadata": {"full_name": "LifeOS User"}
        },
        "access_token": "local-token",
        "expires_at": 9999999999
    })

@app.route('/api/auth/user', methods=['GET'])
def get_user():
    return supabase_response(data={
        "id": DEFAULT_USER_ID,
        "email": "local@lifeos.app",
        "user_metadata": {"full_name": "LifeOS User"}
    })

@app.route('/api/user/profile', methods=['GET'])
def get_profile():
    db = get_db()
    row = db.execute("SELECT * FROM user_profiles WHERE user_id = ?", (DEFAULT_USER_ID,)).fetchone()
    return supabase_response(data=row_to_dict(row))

@app.route('/api/user/profile', methods=['PUT', 'PATCH'])
def update_profile():
    db = get_db()
    body = request.get_json(force=True, silent=True) or {}
    body.pop('user_id', None)
    body.setdefault('updated_at', now_iso())

    if 'preferences' in body and not isinstance(body['preferences'], str):
        body['preferences'] = json.dumps(body['preferences'])

    sets = ", ".join(f"{k} = ?" for k in body.keys())
    vals = list(body.values()) + [DEFAULT_USER_ID]
    db.execute(f"UPDATE user_profiles SET {sets} WHERE user_id = ?", vals)
    db.commit()

    row = db.execute("SELECT * FROM user_profiles WHERE user_id = ?", (DEFAULT_USER_ID,)).fetchone()
    return supabase_response(data=row_to_dict(row))


# ═══════════════════════════════════════════════════════════════
# Finance Summary Endpoints
# ═══════════════════════════════════════════════════════════════

@app.route('/api/finance/summary', methods=['GET'])
def finance_summary():
    """Monthly financial summary."""
    db = get_db()
    month = request.args.get('month', date.today().strftime('%Y-%m'))

    income_row = db.execute(
        "SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE user_id = ? AND strftime('%Y-%m', date) = ? AND (is_deleted = 0 OR is_deleted IS NULL)",
        (DEFAULT_USER_ID, month)
    ).fetchone()

    expense_row = db.execute(
        "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND strftime('%Y-%m', date) = ? AND (is_deleted = 0 OR is_deleted IS NULL)",
        (DEFAULT_USER_ID, month)
    ).fetchone()

    tx_income = db.execute(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income' AND strftime('%Y-%m', date) = ?",
        (DEFAULT_USER_ID, month)
    ).fetchone()

    tx_expense = db.execute(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND strftime('%Y-%m', date) = ?",
        (DEFAULT_USER_ID, month)
    ).fetchone()

    total_income = (income_row['total'] or 0) + (tx_income['total'] or 0)
    total_expenses = (expense_row['total'] or 0) + (tx_expense['total'] or 0)

    return supabase_response(data={
        "month": month,
        "income": total_income,
        "expenses": total_expenses,
        "net": total_income - total_expenses,
    })


# ═══════════════════════════════════════════════════════════════
# AI Chat — Proxy to SentientTeddy Bridge
# ═══════════════════════════════════════════════════════════════

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    """Proxy chat to local AI bridge (SentientTeddy at localhost:11435)."""
    body = request.get_json(force=True, silent=True) or {}
    message = body.get('message', '')
    context = body.get('context', {})
    history = body.get('history', [])

    # Save user message
    db = get_db()
    user_msg_id = new_id()
    db.execute(
        "INSERT INTO chat_messages (id, user_id, role, content) VALUES (?, ?, 'user', ?)",
        (user_msg_id, DEFAULT_USER_ID, message)
    )

    # Try to call AI bridge
    try:
        resp = http_requests.post(
            f"{AI_BRIDGE_URL}/v1/chat/completions",
            json={
                "model": "sentient-teddy",
                "messages": [
                    *[{"role": m.get("role", "user"), "content": m.get("content", "")} for m in history[-10:]],
                    {"role": "user", "content": message}
                ],
                "stream": False,
            },
            timeout=30
        )
        if resp.ok:
            data = resp.json()
            reply = data.get('choices', [{}])[0].get('message', {}).get('content', 'No response')
        else:
            reply = f"AI bridge returned {resp.status_code}: {resp.text[:200]}"
    except http_requests.ConnectionError:
        reply = "AI bridge not available. Start it with: python sentient_teddy_bridge.py"
    except Exception as e:
        reply = f"AI error: {str(e)}"

    # Save assistant reply
    assistant_msg_id = new_id()
    db.execute(
        "INSERT INTO chat_messages (id, user_id, role, content) VALUES (?, ?, 'assistant', ?)",
        (assistant_msg_id, DEFAULT_USER_ID, reply)
    )
    db.commit()

    return supabase_response(data={
        "id": assistant_msg_id,
        "role": "assistant",
        "content": reply,
        "created_at": now_iso()
    })


# ═══════════════════════════════════════════════════════════════
# Sync Endpoint — For Frontend Compatibility
# ═══════════════════════════════════════════════════════════════

@app.route('/api/sync/status', methods=['GET'])
def sync_status():
    """Return sync status — always 'synced' in local mode."""
    return supabase_response(data={
        "mode": "local",
        "status": "synced",
        "last_sync": now_iso(),
        "user_id": DEFAULT_USER_ID
    })

@app.route('/api/sync/pull', methods=['POST'])
def sync_pull():
    """Pull changes since last sync — return all data for requested tables."""
    db = get_db()
    body = request.get_json(force=True, silent=True) or {}
    tables = body.get('tables', [])
    since = body.get('since', '1970-01-01')

    result = {}
    for table in tables:
        # Sanitize table name
        if not table.isalnum() and '_' not in table:
            continue
        safe_table = table.replace('-', '_')
        try:
            rows = db.execute(
                f"SELECT * FROM {safe_table} WHERE user_id = ? AND (updated_at > ? OR created_at > ?)",
                (DEFAULT_USER_ID, since, since)
            ).fetchall()
            result[table] = rows_to_list(rows)
        except sqlite3.OperationalError:
            result[table] = []

    return supabase_response(data=result)

@app.route('/api/sync/push', methods=['POST'])
def sync_push():
    """Accept pushed changes — upsert into local DB."""
    db = get_db()
    body = request.get_json(force=True, silent=True) or {}
    counts = {}

    for table, records in body.items():
        safe_table = table.replace('-', '_')
        if not isinstance(records, list):
            continue
        count = 0
        for record in records:
            record.setdefault('user_id', DEFAULT_USER_ID)
            record.setdefault('id', new_id())

            # Serialize JSON fields
            for key in ('tags', 'metadata', 'preferences', 'stats', 'equipment',
                         'position', 'sprite_data', 'exercises', 'attachments'):
                if key in record and not isinstance(record[key], str):
                    record[key] = json.dumps(record[key])

            cols = ", ".join(record.keys())
            placeholders = ", ".join("?" for _ in record)
            updates = ", ".join(f"{k} = excluded.{k}" for k in record.keys() if k != 'id')

            try:
                db.execute(
                    f"INSERT INTO {safe_table} ({cols}) VALUES ({placeholders}) ON CONFLICT(id) DO UPDATE SET {updates}",
                    list(record.values())
                )
                count += 1
            except sqlite3.OperationalError as e:
                print(f"[sync/push] Error on {safe_table}: {e}")

        counts[table] = count

    db.commit()
    return supabase_response(data={"pushed": counts})


# ═══════════════════════════════════════════════════════════════
# Life Context — Aggregated Dashboard Data
# ═══════════════════════════════════════════════════════════════

@app.route('/api/context', methods=['GET'])
def life_context():
    """Return aggregated life context for AI/NPC dialogue."""
    db = get_db()
    today = date.today().isoformat()
    month = date.today().strftime('%Y-%m')

    # Goals
    active_goals = db.execute(
        "SELECT COUNT(*) as c FROM goals WHERE user_id = ? AND status IN ('active', 'in_progress') AND is_deleted = 0",
        (DEFAULT_USER_ID,)
    ).fetchone()['c']
    completed_goals = db.execute(
        "SELECT COUNT(*) as c FROM goals WHERE user_id = ? AND status IN ('completed', 'done') AND is_deleted = 0",
        (DEFAULT_USER_ID,)
    ).fetchone()['c']

    # Tasks
    today_tasks = db.execute(
        "SELECT COUNT(*) as c FROM tasks WHERE user_id = ? AND (due_date = ? OR scheduled_date = ?) AND is_deleted = 0",
        (DEFAULT_USER_ID, today, today)
    ).fetchone()['c']
    overdue = db.execute(
        "SELECT COUNT(*) as c FROM tasks WHERE user_id = ? AND due_date < ? AND status != 'done' AND is_deleted = 0",
        (DEFAULT_USER_ID, today)
    ).fetchone()['c']

    # Habits
    total_habits = db.execute(
        "SELECT COUNT(*) as c FROM habits WHERE user_id = ? AND is_active = 1 AND is_deleted = 0",
        (DEFAULT_USER_ID,)
    ).fetchone()['c']
    done_today = db.execute(
        "SELECT COUNT(DISTINCT habit_id) as c FROM habit_logs WHERE user_id = ? AND date = ?",
        (DEFAULT_USER_ID, today)
    ).fetchone()['c']

    # Health
    health = db.execute(
        "SELECT * FROM health_metrics WHERE user_id = ? AND date = ?",
        (DEFAULT_USER_ID, today)
    ).fetchone()

    # Schedule
    today_events = db.execute(
        "SELECT COUNT(*) as c FROM schedule_events WHERE user_id = ? AND date = ? AND (is_deleted = 0 OR is_deleted IS NULL)",
        (DEFAULT_USER_ID, today)
    ).fetchone()['c']

    return supabase_response(data={
        "goals": {"active": active_goals, "completed": completed_goals},
        "tasks": {"today": today_tasks, "overdue": overdue},
        "habits": {"total": total_habits, "completedToday": done_today},
        "health": {
            "mood": health['mood_score'] if health else None,
            "energy": health['energy_score'] if health else None,
            "sleep": health['sleep_hours'] if health else None,
        } if health else {"mood": None, "energy": None, "sleep": None},
        "schedule": {"todayEvents": today_events},
    })


# Note: Static file serving is handled by serve.py's patch_app_for_static().
# When running app.py directly (dev mode), only API endpoints are available.


# ═══════════════════════════════════════════════════════════════
# Health Check
# ═══════════════════════════════════════════════════════════════

@app.route('/api/health-check', methods=['GET'])
def health_check():
    """API health check."""
    return jsonify({
        "status": "ok",
        "version": "1.0.0",
        "database": DB_PATH,
        "user": DEFAULT_USER_ID,
        "timestamp": now_iso()
    })


# ═══════════════════════════════════════════════════════════════
# Academy & Educational Content API
# ═══════════════════════════════════════════════════════════════

ACADEMY_ROOT = '/mnt/data/tmp/academy'
LIFEOS_ASSETS = '/mnt/data/prodigy/creative-engine/LifeOS'
LIFEOS_DATA = '/home/tewedros/clawd/lifeOS_data'

def scan_curriculum():
    """Scan the academy directory structure into a curriculum object."""
    phases = []
    for dirname in sorted(os.listdir(ACADEMY_ROOT)):
        phase_path = os.path.join(ACADEMY_ROOT, dirname)
        if not os.path.isdir(phase_path) or dirname.startswith('.'):
            continue
        if dirname in ('references', 'study-music'):
            continue
        subjects = []
        for sub in sorted(os.listdir(phase_path)):
            sub_path = os.path.join(phase_path, sub)
            if os.path.isdir(sub_path):
                # Count lesson files
                lessons = []
                for f in sorted(os.listdir(sub_path)):
                    if f.endswith('.md'):
                        lessons.append({
                            "name": f.replace('.md', '').replace('-', ' ').replace('_', ' ').title(),
                            "file": f,
                            "path": os.path.join(sub_path, f)
                        })
                subjects.append({
                    "id": sub,
                    "name": sub.replace('-', ' ').replace('_', ' ').title(),
                    "lessons": lessons,
                    "lessonCount": len(lessons)
                })
        phases.append({
            "id": dirname,
            "name": dirname.split('-', 1)[1].replace('-', ' ').title() if '-' in dirname else dirname,
            "phase": dirname.split('-')[0] if '-' in dirname else dirname,
            "subjects": subjects,
            "subjectCount": len(subjects)
        })
    return phases

def scan_music():
    """Scan study music tracks."""
    music_dir = os.path.join(ACADEMY_ROOT, 'study-music')
    tracks = []
    if os.path.isdir(music_dir):
        for f in sorted(os.listdir(music_dir)):
            if f.endswith(('.mp3', '.ogg', '.wav', '.flac')):
                filepath = os.path.join(music_dir, f)
                tracks.append({
                    "name": os.path.splitext(f)[0],
                    "file": f,
                    "path": filepath,
                    "size": os.path.getsize(filepath),
                    "type": "study-music"
                })
    # Also scan LifeOS game music
    lifeos_music = os.path.join(LIFEOS_ASSETS, 'music')
    if os.path.isdir(lifeos_music):
        for f in sorted(os.listdir(lifeos_music)):
            if f.endswith(('.mp3', '.ogg', '.wav', '.flac')):
                filepath = os.path.join(lifeos_music, f)
                tracks.append({
                    "name": os.path.splitext(f)[0],
                    "file": f,
                    "path": filepath,
                    "size": os.path.getsize(filepath),
                    "type": "realm-music"
                })
    return tracks

def scan_references():
    """Scan reference books/repos."""
    refs_dir = os.path.join(ACADEMY_ROOT, 'references', 'books')
    refs = []
    if os.path.isdir(refs_dir):
        for d in sorted(os.listdir(refs_dir)):
            ref_path = os.path.join(refs_dir, d)
            if os.path.isdir(ref_path):
                # Look for README
                readme = None
                for r in ('README.md', 'readme.md', 'README.rst'):
                    rpath = os.path.join(ref_path, r)
                    if os.path.exists(rpath):
                        readme = rpath
                        break
                refs.append({
                    "id": d,
                    "name": d.replace('-', ' ').replace('_', ' ').title(),
                    "path": ref_path,
                    "hasReadme": readme is not None
                })
    return refs

def scan_backgrounds():
    """Scan LifeOS backgrounds."""
    bg_dir = os.path.join(LIFEOS_ASSETS, 'Backgrounds')
    bgs = []
    if os.path.isdir(bg_dir):
        for f in sorted(os.listdir(bg_dir)):
            if f.endswith(('.png', '.jpg', '.jpeg', '.webp')):
                filepath = os.path.join(bg_dir, f)
                bgs.append({
                    "name": os.path.splitext(f)[0],
                    "file": f,
                    "path": filepath,
                    "size": os.path.getsize(filepath)
                })
    return bgs

def scan_nature_data():
    """Scan fauna/flora CSV data."""
    datasets = []
    if os.path.isdir(LIFEOS_DATA):
        for f in sorted(os.listdir(LIFEOS_DATA)):
            if f.endswith('.csv'):
                filepath = os.path.join(LIFEOS_DATA, f)
                # Count lines (rows)
                with open(filepath, 'r') as fh:
                    rows = sum(1 for _ in fh) - 1  # subtract header
                datasets.append({
                    "name": f.replace('.csv', '').replace('_', ' ').title(),
                    "file": f,
                    "path": filepath,
                    "rows": rows,
                    "category": "fauna" if f.startswith("fauna") else "flora"
                })
    return datasets


@app.route('/api/academy/curriculum', methods=['GET'])
def academy_curriculum():
    """Return the full curriculum structure."""
    return supabase_response(scan_curriculum())

@app.route('/api/academy/music', methods=['GET'])
def academy_music():
    """Return all available music tracks (study + realm)."""
    return supabase_response(scan_music())

@app.route('/api/academy/references', methods=['GET'])
def academy_references():
    """Return reference book/repo list."""
    return supabase_response(scan_references())

@app.route('/api/academy/backgrounds', methods=['GET'])
def academy_backgrounds():
    """Return available realm backgrounds."""
    return supabase_response(scan_backgrounds())

@app.route('/api/academy/nature', methods=['GET'])
def academy_nature():
    """Return fauna/flora dataset info."""
    return supabase_response(scan_nature_data())

@app.route('/api/academy/lesson', methods=['GET'])
def academy_lesson():
    """Read a lesson markdown file. ?path=01-foundations/python/01-intro.md (relative to academy root)
    Also accepts absolute paths for backwards compatibility."""
    path = request.args.get('path', '')
    # If the path is relative (doesn't start with /), prepend academy root
    if path and not os.path.isabs(path):
        path = os.path.join(ACADEMY_ROOT, path)
    # Security: only allow reading from academy, lifeos assets, or lifeos data dirs
    allowed_roots = [ACADEMY_ROOT, LIFEOS_ASSETS, LIFEOS_DATA]
    real_path = os.path.realpath(path)
    if not any(real_path.startswith(os.path.realpath(r)) for r in allowed_roots):
        return supabase_response(error={"message": "Access denied: path outside allowed directories"}), 403
    if not os.path.isfile(real_path):
        return supabase_response(error={"message": "File not found"}), 404
    with open(real_path, 'r', errors='replace') as f:
        content = f.read()
    return supabase_response({"path": path, "content": content})

@app.route('/api/media/<path:filepath>', methods=['GET'])
def serve_media(filepath):
    """Serve static media files (music, backgrounds, etc).
    URL: /api/media/study-music/filename.mp3
         /api/media/backgrounds/filename.png
         /api/media/realm-music/filename.ogg
    """
    media_map = {
        'study-music': os.path.join(ACADEMY_ROOT, 'study-music'),
        'backgrounds': os.path.join(LIFEOS_ASSETS, 'Backgrounds'),
        'realm-music': os.path.join(LIFEOS_ASSETS, 'music'),
    }
    # Parse the first segment as media type
    parts = filepath.split('/', 1)
    if len(parts) != 2 or parts[0] not in media_map:
        return supabase_response(error={"message": "Invalid media path"}), 400
    
    media_type, filename = parts
    directory = media_map[media_type]
    # Security: prevent path traversal
    safe_name = os.path.basename(filename)
    return send_from_directory(directory, safe_name)

@app.route('/api/academy/overview', methods=['GET'])
def academy_overview():
    """Full academy overview — curriculum + music + refs + nature data in one call."""
    return supabase_response({
        "curriculum": scan_curriculum(),
        "music": scan_music(),
        "references": scan_references(),
        "backgrounds": scan_backgrounds(),
        "nature": scan_nature_data(),
        "stats": {
            "phases": 6,
            "musicTracks": len(scan_music()),
            "references": len(scan_references()),
            "backgrounds": len(scan_backgrounds()),
            "natureDatasets": len(scan_nature_data())
        }
    })


# ═══════════════════════════════════════════════════════════════
# Initialize on Import
# ═══════════════════════════════════════════════════════════════

init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
