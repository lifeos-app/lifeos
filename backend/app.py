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
AI_BRIDGE_URL = os.environ.get('AI_BRIDGE_URL', 'http://localhost:11434')

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
# AI Chat — Proxy to Ollama AI Bridge
# ═══════════════════════════════════════════════════════════════

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    """Proxy chat to local AI bridge (Ollama at localhost:11434)."""
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
                "model": "glm-5.1:cloud",
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
        reply = "AI bridge not available. Make sure Ollama is running: ollama serve"
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
# Telegram Bot Webhook
# ═══════════════════════════════════════════════════════════════

TELEGRAM_CONFIG_PATH = os.path.join(os.path.expanduser('~'), '.lifeos', 'telegram_bot.json')

def get_telegram_config():
    """Load telegram bot config from file."""
    if os.path.exists(TELEGRAM_CONFIG_PATH):
        try:
            with open(TELEGRAM_CONFIG_PATH, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "bot_token": "",
        "webhook_url": "",
        "enabled": False,
        "authorized_users": [],
        "daily_brief_enabled": True,
        "daily_brief_time": "07:00",
        "habit_reminders": True,
        "streak_alerts": True,
    }

def save_telegram_config(config):
    """Save telegram bot config to file."""
    os.makedirs(os.path.dirname(TELEGRAM_CONFIG_PATH), exist_ok=True)
    with open(TELEGRAM_CONFIG_PATH, 'w') as f:
        json.dump(config, f, indent=2)

# Simple rate limiter for Telegram webhook
_telegram_rate_limits = {}  # user_id -> list of timestamps

def _telegram_rate_check(user_id, max_requests=30, window_sec=60):
    """Rate limit Telegram requests per user. Returns True if allowed."""
    import time as _time
    now = _time.time()
    if user_id not in _telegram_rate_limits:
        _telegram_rate_limits[user_id] = []
    # Remove old timestamps
    _telegram_rate_limits[user_id] = [t for t in _telegram_rate_limits[user_id] if now - t < window_sec]
    if len(_telegram_rate_limits[user_id]) >= max_requests:
        return False
    _telegram_rate_limits[user_id].append(now)
    return True

def _telegram_send_message(bot_token, chat_id, text, reply_markup=None):
    """Send a message via the Telegram Bot API."""
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    try:
        resp = http_requests.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json=payload,
            timeout=10
        )
        return resp.ok
    except Exception:
        return False

def _telegram_process_command(text, user_id, username, chat_id, bot_token, config, db):
    """Process a Telegram command and return the response text."""
    today = date.today().isoformat()
    
    # Parse command
    command = text.strip()
    cmd_parts = command.split(None, 1)
    cmd = cmd_parts[0].lower() if cmd_parts else ''
    args = cmd_parts[1] if len(cmd_parts) > 1 else ''
    
    # Remove @botname suffix
    if '@' in cmd:
        cmd = cmd.split('@')[0]
    
    # /start — welcome
    if cmd == '/start':
        return (
            f"👋 *Welcome to LifeOS Bot, {username}!*\\n\\n"
            "I can help you track habits, log activities, check your stats, and more.\\n\\n"
            "*Quick Start:*\\n"
            "/log — Log anything\\n"
            "/habit — Track a habit\\n"
            "/mood — Log your mood\\n"
            "/brief — Daily brief\\n"
            "/help — All commands\\n\\n"
            f"💡 _Your Telegram ID: {user_id}_\\n"
            "_Add this to authorized users in LifeOS settings._"
        )
    
    # /help — command list
    if cmd == '/help':
        return (
            "🤖 *LifeOS Bot Commands*\\n\\n"
            "  /start          — Welcome & account linking\\n"
            "  /log            — Quick log anything\\n"
            "  /habit          — Log habit completion\\n"
            "  /mood           — Log mood (1-10)\\n"
            "  /health         — Log health metrics\\n"
            "  /expense        — Log an expense\\n"
            "  /income         — Log income\\n"
            "  /balance        — Check financial balance\\n"
            "  /schedule       — View today's schedule\\n"
            "  /goals           — Goal progress overview\\n"
            "  /streak         — View habit streaks\\n"
            "  /brief           — Daily brief summary\\n"
            "  /stats           — Weekly/monthly statistics\\n"
            "  /journal          — Quick journal entry\\n"
            "  /help            — This message\\n\\n"
            "💡 _Natural language also works!_\\n"
            '_Type "3 hours work at Sonder" or "mood 8 feeling great"_'
        )
    
    # /brief — daily brief
    if cmd == '/brief':
        # Build context
        active_goals = db.execute(
            "SELECT COUNT(*) as c FROM goals WHERE user_id=? AND status IN ('active','in_progress') AND is_deleted=0",
            (DEFAULT_USER_ID,)
        ).fetchone()['c']
        completed_goals = db.execute(
            "SELECT COUNT(*) as c FROM goals WHERE user_id=? AND status IN ('completed','done') AND is_deleted=0",
            (DEFAULT_USER_ID,)
        ).fetchone()['c']
        today_tasks = db.execute(
            "SELECT COUNT(*) as c FROM tasks WHERE user_id=? AND (due_date=? OR scheduled_date=?) AND is_deleted=0",
            (DEFAULT_USER_ID, today, today)
        ).fetchone()['c']
        overdue = db.execute(
            "SELECT COUNT(*) as c FROM tasks WHERE user_id=? AND due_date<? AND status!='done' AND is_deleted=0",
            (DEFAULT_USER_ID, today)
        ).fetchone()['c']
        total_habits = db.execute(
            "SELECT COUNT(*) as c FROM habits WHERE user_id=? AND is_active=1 AND is_deleted=0",
            (DEFAULT_USER_ID,)
        ).fetchone()['c']
        done_today = db.execute(
            "SELECT COUNT(DISTINCT habit_id) as c FROM habit_logs WHERE user_id=? AND date=?",
            (DEFAULT_USER_ID, today)
        ).fetchone()['c']
        health = db.execute(
            "SELECT * FROM health_metrics WHERE user_id=? AND date=?",
            (DEFAULT_USER_ID, today)
        ).fetchone()
        today_events = db.execute(
            "SELECT COUNT(*) as c FROM schedule_events WHERE user_id=? AND date=? AND (is_deleted=0 OR is_deleted IS NULL)",
            (DEFAULT_USER_ID, today)
        ).fetchone()['c']
        
        lines = [f"🌅 *Daily Brief — {today}*\\n"]
        lines.append(f"📋 *Tasks:* {today_tasks} today, {overdue} overdue")
        lines.append(f"🔥 *Habits:* {done_today}/{total_habits} done")
        if health:
            lines.append(f"💪 *Health:* Mood {health['mood_score'] or '?'}/10 · Energy {health['energy_score'] or '?'}/10 · Sleep {health['sleep_hours'] or '?'}h")
        lines.append(f"🎯 *Goals:* {active_goals} active, {completed_goals} completed")
        lines.append(f"📅 *Events:* {today_events} today")
        return "\\n".join(lines)
    
    # /streak — habit streaks
    if cmd == '/streak':
        habits = db.execute(
            "SELECT title, streak_current, streak_best FROM habits WHERE user_id=? AND is_active=1 AND is_deleted=0 ORDER BY streak_current DESC LIMIT 15",
            (DEFAULT_USER_ID,)
        ).fetchall()
        if not habits:
            return "No active habits yet. Add some in LifeOS!"
        lines = ["🔥 *Habit Streaks*\\n"]
        for h in habits:
            streak = h['streak_current'] or 0
            fire = '🔥' if streak >= 7 else '✨' if streak >= 3 else '→'
            lines.append(f"  {fire} {h['title']}: {streak} day{'s' if streak != 1 else ''}")
        return "\\n".join(lines)
    
    # /balance — financial summary
    if cmd == '/balance':
        income = db.execute(
            "SELECT COALESCE(SUM(amount),0) as total FROM income WHERE user_id=? AND is_deleted=0",
            (DEFAULT_USER_ID,)
        ).fetchone()['total']
        expenses = db.execute(
            "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE user_id=? AND is_deleted=0",
            (DEFAULT_USER_ID,)
        ).fetchone()['total']
        net = income - expenses
        lines = [
            f"💰 *Financial Summary*\\n",
            f"Income: ${income:,.2f}",
            f"Expenses: ${expenses:,.2f}",
            f"Net: ${net:,.2f}"
        ]
        return "\\n".join(lines)
    
    # /schedule — today's events
    if cmd == '/schedule':
        events = db.execute(
            """SELECT title, start_time, end_time, event_type, location
            FROM schedule_events 
            WHERE user_id=? AND date(start_time)=? AND (is_deleted=0 OR is_deleted IS NULL)
            ORDER BY start_time ASC LIMIT 15""",
            (DEFAULT_USER_ID, today)
        ).fetchall()
        if not events:
            return f"📅 No events scheduled for today. Enjoy the free time! 🌊"
        lines = ["📅 *Today's Schedule*\\n"]
        for e in events:
            time = e['start_time'][-8:-3] if e['start_time'] else 'All day'
            icon = '💼' if e['event_type'] == 'work' else '💪' if e['event_type'] == 'health' else '📌'
            loc = f" @ {e['location']}" if e['location'] else ''
            lines.append(f"  {time} {icon} {e['title']}{loc}")
        return "\\n".join(lines)
    
    # /goals — active goals
    if cmd == '/goals':
        goals = db.execute(
            """SELECT title, progress, status FROM goals 
            WHERE user_id=? AND status='active' AND is_deleted=0 
            ORDER BY priority DESC LIMIT 10""",
            (DEFAULT_USER_ID,)
        ).fetchall()
        if not goals:
            return "🎯 No active goals. Time to set some!"
        lines = ["🎯 *Active Goals*\\n"]
        for g in goals:
            progress = int(g['progress'] or 0)
            bar = '█' * (progress // 10) + '░' * (10 - progress // 10)
            lines.append(f"  {g['title']} [{bar}] {progress}%")
        return "\\n".join(lines)
    
    # /stats — overview stats
    if cmd == '/stats':
        active_goals = db.execute(
            "SELECT COUNT(*) as c FROM goals WHERE user_id=? AND status IN ('active','in_progress') AND is_deleted=0",
            (DEFAULT_USER_ID,)
        ).fetchone()['c']
        completed_goals = db.execute(
            "SELECT COUNT(*) as c FROM goals WHERE user_id=? AND status IN ('completed','done') AND is_deleted=0",
            (DEFAULT_USER_ID,)
        ).fetchone()['c']
        today_tasks = db.execute(
            "SELECT COUNT(*) as c FROM tasks WHERE user_id=? AND (due_date=? OR scheduled_date=?) AND is_deleted=0",
            (DEFAULT_USER_ID, today, today)
        ).fetchone()['c']
        overdue = db.execute(
            "SELECT COUNT(*) as c FROM tasks WHERE user_id=? AND due_date<? AND status!='done' AND is_deleted=0",
            (DEFAULT_USER_ID, today)
        ).fetchone()['c']
        total_habits = db.execute(
            "SELECT COUNT(*) as c FROM habits WHERE user_id=? AND is_active=1 AND is_deleted=0",
            (DEFAULT_USER_ID,)
        ).fetchone()['c']
        done_today = db.execute(
            "SELECT COUNT(DISTINCT habit_id) as c FROM habit_logs WHERE user_id=? AND date=?",
            (DEFAULT_USER_ID, today)
        ).fetchone()['c']
        health = db.execute(
            "SELECT * FROM health_metrics WHERE user_id=? AND date=?",
            (DEFAULT_USER_ID, today)
        ).fetchone()
        
        lines = ["📊 *Your LifeOS Stats*\\n"]
        lines.append(f"🎯 Goals: {active_goals} active, {completed_goals} completed")
        lines.append(f"📋 Tasks: {today_tasks} today, {overdue} overdue")
        lines.append(f"🔥 Habits: {done_today}/{total_habits} done today")
        if health and health['mood_score']:
            lines.append(f"💪 Mood: {health['mood_score']}/10 · Energy: {health['energy_score'] or '?'}/10")
        return "\\n".join(lines)

    # /habit — log habit
    if cmd == '/habit':
        habit_name = args.strip()
        if not habit_name:
            # Show habit list with inline keyboard option
            habits = db.execute(
                "SELECT id, title FROM habits WHERE user_id=? AND is_active=1 AND is_deleted=0 ORDER BY title",
                (DEFAULT_USER_ID,)
            ).fetchall()
            if not habits:
                return "No active habits. Add some in LifeOS first!"
            lines = ["🔥 *Which habit did you complete?*\\n"]
            for h in habits:
                lines.append(f"  • {h['title']}")
            lines.append("\\n_Send: /habit <name>_")
            return "\\n".join(lines)
        
        # Try to find matching habit (fuzzy match)
        habit = db.execute(
            "SELECT id, title FROM habits WHERE user_id=? AND is_active=1 AND is_deleted=0 AND title LIKE ? LIMIT 1",
            (DEFAULT_USER_ID, f'%{habit_name}%')
        ).fetchone()
        if not habit:
            return f"❌ No habit found matching '{habit_name}'. Check the name and try again."
        
        # Log it
        log_id = new_id()
        db.execute(
            "INSERT INTO habit_logs (id, user_id, habit_id, date, count, completed, created_at) VALUES (?,?,?,?,?,1,?)",
            (log_id, DEFAULT_USER_ID, habit['id'], today, now_iso())
        )
        db.commit()
        return f"✅ *{habit['title']}* logged! Great job! 🔥"
    
    # /mood — log mood
    if cmd == '/mood':
        mood_text = args.strip()
        # Extract mood score (1-10)
        import re
        mood_match = re.match(r'(\d+(?:\.\d+)?)', mood_text)
        if not mood_match:
            return "Please include a mood score (1-10). Example: /mood 8 feeling great"
        mood_score = float(mood_match.group(1))
        mood_score = max(1, min(10, mood_score))
        notes = mood_text[mood_match.end():].strip() or None
        
        # Check if today's health entry exists
        existing = db.execute(
            "SELECT id FROM health_metrics WHERE user_id=? AND date=?",
            (DEFAULT_USER_ID, today)
        ).fetchone()
        
        if existing:
            db.execute(
                "UPDATE health_metrics SET mood_score=?, notes=COALESCE(?,notes), updated_at=? WHERE id=?",
                (mood_score, notes, now_iso(), existing['id'])
            )
        else:
            db.execute(
                "INSERT INTO health_metrics (id, user_id, date, mood_score, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                (new_id(), DEFAULT_USER_ID, today, mood_score, notes, now_iso(), now_iso())
            )
        db.commit()
        
        mood_emoji = '😊' if mood_score >= 7 else '😐' if mood_score >= 4 else '😟'
        return f"{mood_emoji} Mood logged: *{mood_score}/10*" + (f" — _{notes}_" if notes else "")
    
    # /expense — log expense
    if cmd == '/expense':
        expense_text = args.strip()
        if not expense_text:
            return "Please provide expense details. Example: /expense $45 groceries"
        # Try to extract amount
        import re
        amount_match = re.search(r'\$?(\d+(?:\.\d+)?)', expense_text)
        if not amount_match:
            return "Please include an amount. Example: /expense $45 groceries"
        amount = float(amount_match.group(1))
        description = expense_text.replace(amount_match.group(0), '').strip() or 'Expense'
        
        db.execute(
            "INSERT INTO expenses (id, user_id, amount, description, date, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
            (new_id(), DEFAULT_USER_ID, amount, description, today, now_iso(), now_iso())
        )
        db.commit()
        return f"💸 Expense logged: *${amount:.2f}* — {description}"
    
    # /income — log income
    if cmd == '/income':
        income_text = args.strip()
        if not income_text:
            return "Please provide income details. Example: /income $2000 client payment"
        import re
        amount_match = re.search(r'\$?(\d+(?:\.\d+)?)', income_text)
        if not amount_match:
            return "Please include an amount. Example: /income $2000 client payment"
        amount = float(amount_match.group(1))
        description = income_text.replace(amount_match.group(0), '').strip() or 'Income'
        
        source = None
        if 'from' in description.lower():
            source = description.split('from', 1)[1].strip()
        
        db.execute(
            "INSERT INTO income (id, user_id, amount, description, source, date, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (new_id(), DEFAULT_USER_ID, amount, description, source, today, now_iso(), now_iso())
        )
        db.commit()
        return f"💰 Income logged: *${amount:.2f}*" + (f" — {description}" if description else "")
    
    # /health — log health metrics
    if cmd == '/health':
        health_text = args.strip()
        if not health_text:
            return "Please provide health data. Example: /health sleep 7.5h water 6"
        import re
        # Parse health metrics from text
        sleep = None
        water = None
        weight = None
        exercise = None
        
        sleep_match = re.search(r'sleep\s+(\d+\.?\d*)\s*h', health_text, re.I)
        if sleep_match:
            sleep = float(sleep_match.group(1))
        water_match = re.search(r'water\s+(\d+)', health_text, re.I)
        if water_match:
            water = int(water_match.group(1))
        weight_match = re.search(r'weight\s+(\d+\.?\d*)', health_text, re.I)
        if weight_match:
            weight = float(weight_match.group(1))
        exercise_match = re.search(r'exercise\s+(\d+)\s*m', health_text, re.I)
        if exercise_match:
            exercise = int(exercise_match.group(1))
        
        if not any([sleep, water, weight, exercise]):
            return "Could not parse any health metrics. Try: /health sleep 7.5h water 6 glasses"
        
        existing = db.execute(
            "SELECT id FROM health_metrics WHERE user_id=? AND date=?",
            (DEFAULT_USER_ID, today)
        ).fetchone()
        
        if existing:
            updates = []
            params = []
            if sleep is not None:
                updates.append("sleep_hours=?")
                params.append(sleep)
            if water is not None:
                updates.append("water_glasses=?")
                params.append(water)
            if weight is not None:
                updates.append("weight_kg=?")
                params.append(weight)
            if exercise is not None:
                updates.append("exercise_minutes=?")
                params.append(exercise)
            params.append(now_iso())
            params.append(existing['id'])
            db.execute(f"UPDATE health_metrics SET {', '.join(updates)}, updated_at=? WHERE id=?", params)
        else:
            db.execute(
                "INSERT INTO health_metrics (id, user_id, date, sleep_hours, water_glasses, weight_kg, exercise_minutes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (new_id(), DEFAULT_USER_ID, today, sleep, water, weight, exercise, now_iso(), now_iso())
            )
        db.commit()
        
        parts = []
        if sleep: parts.append(f"💤 Sleep: {sleep}h")
        if water: parts.append(f"💧 Water: {water} glasses")
        if weight: parts.append(f"⚖️ Weight: {weight}kg")
        if exercise: parts.append(f"🏃 Exercise: {exercise}min")
        return "💪 Health logged:\\n" + " · ".join(parts)
    
    # /journal — quick journal entry
    if cmd == '/journal':
        content = args.strip()
        if not content:
            return "Please provide journal content. Example: /journal Had a productive day!"
        db.execute(
            "INSERT INTO journal_entries (id, user_id, date, content, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            (new_id(), DEFAULT_USER_ID, today, content, now_iso(), now_iso())
        )
        db.commit()
        return f"📖 Journal entry logged for *{today}*"
    
    # /log — generic logger (shorthand)
    if cmd == '/log':
        log_text = args.strip()
        if not log_text:
            return "What would you like to log? Example: /log 3 hours work at Sonder"
        # Try to route to intent engine
        try:
            resp = http_requests.post(
                f"{AI_BRIDGE_URL}/v1/chat/completions",
                json={
                    "model": "glm-5.1:cloud",
                    "messages": [
                        {"role": "system", "content": "You are LifeOS assistant. Parse the user's quick log and respond briefly."},
                        {"role": "user", "content": log_text}
                    ],
                    "stream": False,
                },
                timeout=10
            )
            if resp.ok:
                data = resp.json()
                reply = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                if reply:
                    return f"📝 {reply}"
        except Exception:
            pass
        # Fallback: just acknowledge
        return f"📝 Logged: _{log_text}_\n(Note: Intent Engine unavailable for detailed parsing. Try specific commands like /habit, /mood, /expense)"
    
    # Unknown command or natural language
    # Try intent engine
    try:
        resp = http_requests.post(
            f"{AI_BRIDGE_URL}/v1/chat/completions",
            json={
                "model": "glm-5.1:cloud",
                "messages": [
                    {"role": "system", "content": f"You are LifeOS Telegram bot assistant. Today is {today}. Respond concisely in Markdown format."},
                    {"role": "user", "content": text}
                ],
                "stream": False,
            },
            timeout=15
        )
        if resp.ok:
            data = resp.json()
            reply = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            if reply:
                return reply[:4000]  # Telegram message limit
    except Exception:
        pass
    
    return f"🤖 I didn't understand that. Type /help to see available commands."


@app.route('/api/telegram/webhook', methods=['POST'])
def telegram_webhook():
    """Receive and process Telegram webhook updates.
    
    This endpoint receives incoming messages from the Telegram Bot API,
    processes commands or natural language, and sends responses back
    via the Telegram Bot API.
    """
    body = request.get_json(force=True, silent=True) or {}
    config = get_telegram_config()
    
    # Verify bot is enabled
    if not config.get('enabled', False):
        return jsonify({"ok": False, "error": "Bot is disabled"}), 403
    
    # Extract message
    message = body.get('message') or body.get('callback_query', {}).get('message')
    callback_query = body.get('callback_query')
    
    if not message:
        return jsonify({"ok": True, "message": "No message to process"})
    
    chat_id = message.get('chat', {}).get('id')
    user_id = str(message.get('from', {}).get('id', ''))
    username = message.get('from', {}).get('username', '') or message.get('from', {}).get('first_name', 'Unknown')
    text = message.get('text', '')
    
    # Handle callback queries (inline keyboard)
    if callback_query:
        callback_data = callback_query.get('data', '')
        callback_chat_id = callback_query.get('message', {}).get('chat', {}).get('id', chat_id)
        callback_user_id = str(callback_query.get('from', {}).get('id', ''))
        
        # Process callback
        if callback_data.startswith('confirm:'):
            response_text = "✅ Action confirmed and executed!"
        elif callback_data.startswith('cancel:'):
            response_text = "❌ Action cancelled."
        elif callback_data.startswith('habit:'):
            habit_id = callback_data.split(':')[1]
            db = get_db()
            # Log habit completion
            habit = db.execute("SELECT title FROM habits WHERE id=?", (habit_id,)).fetchone()
            if habit:
                log_id = new_id()
                today = date.today().isoformat()
                db.execute(
                    "INSERT OR IGNORE INTO habit_logs (id, user_id, habit_id, date, count, completed, created_at) VALUES (?,?,?,?,?,1,?)",
                    (log_id, DEFAULT_USER_ID, habit_id, today, now_iso())
                )
                db.commit()
                response_text = f"✅ *{habit['title']}* logged! Great job! 🔥"
            else:
                response_text = "❌ Habit not found."
        else:
            response_text = "Unknown action."
        
        # Send callback response
        _telegram_send_message(config['bot_token'], callback_chat_id, response_text)
        
        # Answer callback query
        try:
            http_requests.post(
                f"https://api.telegram.org/bot{config['bot_token']}/answerCallbackQuery",
                json={"callback_query_id": callback_query.get('id', '')},
                timeout=5
            )
        except Exception:
            pass
        
        # Log activity
        db = get_db()
        db.execute(
            "INSERT INTO telegram_activity (id, user_id, username, command, input_text, response_text, status, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (new_id(), callback_user_id, username, 'callback', callback_data, response_text, 'success', now_iso())
        )
        db.commit()
        
        return jsonify({"ok": True})
    
    # Handle regular message
    if not text:
        return jsonify({"ok": True, "message": "No text content"})
    
    # Rate limiting
    if not _telegram_rate_check(user_id):
        _telegram_send_message(config['bot_token'], chat_id, "⚠️ Rate limit reached. Please wait a moment.")
        return jsonify({"ok": True, "message": "Rate limited"})
    
    # Authorization check
    authorized_users = config.get('authorized_users', [])
    if authorized_users and user_id not in [str(u) for u in authorized_users]:
        _telegram_send_message(
            config['bot_token'], chat_id,
            "🔒 You are not authorized to use this bot. Link your account in LifeOS Settings."
        )
        return jsonify({"ok": True, "message": "Unauthorized user"})
    
    bot_token = config.get('bot_token', '')
    db = get_db()
    
    start_time = datetime.utcnow()
    try:
        response_text = _telegram_process_command(text, user_id, username, chat_id, bot_token, config, db)
        status = 'success'
    except Exception as e:
        response_text = f"❌ Something went wrong. Please try again.\\n\\n_Error: {str(e)[:100]}_"
        status = 'error'
    
    duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
    
    # Send response
    _telegram_send_message(bot_token, chat_id, response_text)
    
    # Log activity
    try:
        db.execute(
            """CREATE TABLE IF NOT EXISTS telegram_activity (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                username TEXT,
                command TEXT,
                input_text TEXT,
                response_text TEXT,
                status TEXT DEFAULT 'success',
                duration_ms INTEGER,
                created_at TEXT
            )""",
            ()
        )
        db.execute(
            "INSERT INTO telegram_activity (id, user_id, username, command, input_text, response_text, status, duration_ms, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (new_id(), user_id, username, text.split()[0] if text.split() else '', text, response_text, status, duration_ms, now_iso())
        )
        db.commit()
    except Exception:
        pass
    
    return jsonify({"ok": True})


@app.route('/api/telegram/config', methods=['GET', 'PUT'])
def telegram_config_endpoint():
    """Get or update Telegram bot configuration."""
    if request.method == 'GET':
        config = get_telegram_config()
        # Don't expose full bot token
        safe_config = {**config}
        if safe_config.get('bot_token'):
            token = safe_config['bot_token']
            safe_config['bot_token_preview'] = f"{token[:8]}...{token[-4:]}" if len(token) > 12 else '***'
        else:
            safe_config['bot_token_preview'] = ''
        del safe_config['bot_token']
        return supabase_response(safe_config)
    
    # PUT — update config
    body = request.get_json(force=True, silent=True) or {}
    config = get_telegram_config()
    
    # Updatable fields
    for field in ('webhook_url', 'enabled', 'authorized_users', 'daily_brief_enabled',
                  'daily_brief_time', 'habit_reminders', 'streak_alerts', 'smart_suggestions',
                  'voice_input', 'command_prefix'):
        if field in body:
            config[field] = body[field]
    
    # Bot token update (separate for security)
    if 'bot_token' in body and body['bot_token']:
        config['bot_token'] = body['bot_token']
    
    save_telegram_config(config)
    return supabase_response(config)


@app.route('/api/telegram/test', methods=['POST'])
def telegram_test_connection():
    """Test Telegram bot connection by calling getMe API."""
    config = get_telegram_config()
    bot_token = config.get('bot_token', '')
    if not bot_token:
        return supabase_response(error={"message": "No bot token configured"}), 400
    
    try:
        resp = http_requests.get(
            f"https://api.telegram.org/bot{bot_token}/getMe",
            timeout=10
        )
        data = resp.json()
        if data.get('ok'):
            return supabase_response({
                "ok": True,
                "bot_name": data.get('result', {}).get('first_name', 'Unknown'),
                "bot_username": data.get('result', {}).get('username', ''),
            })
        else:
            return supabase_response(error={"message": data.get('description', 'Unknown error')}), 400
    except Exception as e:
        return supabase_response(error={"message": str(e)}), 500


@app.route('/api/telegram/set-webhook', methods=['POST'])
def telegram_set_webhook():
    """Set the Telegram webhook URL."""
    config = get_telegram_config()
    bot_token = config.get('bot_token', '')
    if not bot_token:
        return supabase_response(error={"message": "No bot token configured"}), 400
    
    body = request.get_json(force=True, silent=True) or {}
    webhook_url = body.get('webhook_url', config.get('webhook_url', ''))
    
    if not webhook_url:
        return supabase_response(error={"message": "No webhook URL provided"}), 400
    
    try:
        resp = http_requests.post(
            f"https://api.telegram.org/bot{bot_token}/setWebhook",
            json={
                "url": webhook_url,
                "allowed_updates": ["message", "callback_query"]
            },
            timeout=10
        )
        data = resp.json()
        if data.get('ok'):
            config['webhook_url'] = webhook_url
            save_telegram_config(config)
            return supabase_response({
                "ok": True,
                "description": data.get('description', 'Webhook set successfully')
            })
        else:
            return supabase_response(error={"message": data.get('description', 'Unknown error')}), 400
    except Exception as e:
        return supabase_response(error={"message": str(e)}), 500


@app.route('/api/telegram/webhook-info', methods=['GET'])
def telegram_webhook_info():
    """Get current Telegram webhook info."""
    config = get_telegram_config()
    bot_token = config.get('bot_token', '')
    if not bot_token:
        return supabase_response(error={"message": "No bot token configured"}), 400
    
    try:
        resp = http_requests.get(
            f"https://api.telegram.org/bot{bot_token}/getWebhookInfo",
            timeout=10
        )
        data = resp.json()
        if data.get('ok'):
            return supabase_response(data.get('result', {}))
        else:
            return supabase_response(error={"message": data.get('description', 'Unknown error')}), 400
    except Exception as e:
        return supabase_response(error={"message": str(e)}), 500


@app.route('/api/telegram/bridge', methods=['POST'])
def telegram_intent_bridge():
    """Bridge endpoint for LifeOS frontend to send messages through the Intent Engine.
    
    Receives a message + intent mapping, processes it through the local context
    and AI bridge, and returns the result for the Telegram bot to relay.
    """
    body = request.get_json(force=True, silent=True) or {}
    message = body.get('message', '')
    intent_action = body.get('intentAction', 'shorthand.parse')
    user_id = body.get('userId', DEFAULT_USER_ID)
    
    if not message:
        return supabase_response(error={"message": "No message provided"}), 400
    
    db = get_db()
    today = date.today().isoformat()
    
    # Build context for intent engine
    context_parts = []
    context_parts.append(f"Today is {today}.")
    
    # Try AI bridge
    try:
        resp = http_requests.post(
            f"{AI_BRIDGE_URL}/v1/chat/completions",
            json={
                "model": "glm-5.1:cloud",
                "messages": [
                    {"role": "system", "content": f"You are LifeOS assistant. Parse the user's input and respond concisely in Markdown. Today is {today}. Intent action: {intent_action}"},
                    {"role": "user", "content": message}
                ],
                "stream": False,
            },
            timeout=15
        )
        if resp.ok:
            data = resp.json()
            reply = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            return supabase_response({
                "reply": reply,
                "action": intent_action,
                "processed": True
            })
    except Exception:
        pass
    
    return supabase_response({
        "reply": f"Received: {message}",
        "action": intent_action,
        "processed": False,
        "message": "Intent Engine unavailable — relayed raw input"
    })


@app.route('/api/telegram/activity', methods=['GET'])
def telegram_activity_log():
    """Get recent Telegram bot activity."""
    limit = min(int(request.args.get('limit', 50)), 500)
    offset = int(request.args.get('offset', 0))
    command_filter = request.args.get('command', '')
    status_filter = request.args.get('status', '')
    
    db = get_db()
    
    # Ensure table exists
    db.execute("""CREATE TABLE IF NOT EXISTS telegram_activity (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        username TEXT,
        command TEXT,
        input_text TEXT,
        response_text TEXT,
        status TEXT DEFAULT 'success',
        duration_ms INTEGER,
        created_at TEXT
    )""")
    
    where_clauses = []
    params = []
    if command_filter:
        where_clauses.append("command=?")
        params.append(command_filter)
    if status_filter:
        where_clauses.append("status=?")
        params.append(status_filter)
    
    where = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    params.extend([limit, offset])
    
    rows = db.execute(
        f"SELECT * FROM telegram_activity {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params
    ).fetchall()
    
    return supabase_response([row_to_dict(r) for r in rows])


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

# ═══════════════════════════════════════════════════════════════
# Pendo Dashboard — plain HTML for Android 4.2.2 WebKit
# No JS frameworks, no ES6, no fetch. Meta-refresh only.
# ═══════════════════════════════════════════════════════════════

@app.route('/pendo')
def pendo_dashboard():
    db = get_db()
    user_id = DEFAULT_USER_ID

    # Jetson vitals
    import subprocess, platform, time
    uptime_s = time.time() - float(open('/proc/uptime').read().split()[0]) if False else None
    try:
        with open('/proc/uptime') as f:
            uptime_sec = float(f.read().split()[0])
        uptime_h = int(uptime_sec // 3600)
        uptime_m = int((uptime_sec % 3600) // 60)
        uptime_str = f"{uptime_h}h {uptime_m}m"
    except Exception:
        uptime_str = "?"

    try:
        with open('/proc/loadavg') as f:
            load = f.read().split()[:3]
        load_str = " / ".join(load)
    except Exception:
        load_str = "?"

    try:
        thermal = []
        import os, glob
        for tz in sorted(glob.glob('/sys/class/thermal/thermal_zone*/temp'))[:4]:
            t = int(open(tz).read().strip()) // 1000
            thermal.append(f"{t}°C")
        temp_str = "  ".join(thermal) if thermal else "?"
    except Exception:
        temp_str = "?"

    try:
        mem = {}
        for line in open('/proc/meminfo'):
            k, v = line.split(':')
            mem[k.strip()] = int(v.strip().split()[0])
        mem_used = (mem['MemTotal'] - mem['MemAvailable']) // 1024
        mem_total = mem['MemTotal'] // 1024
        mem_str = f"{mem_used} MB / {mem_total} MB"
    except Exception:
        mem_str = "?"

    # Today's schedule
    today = date.today().isoformat()
    schedule = db.execute("""
        SELECT title, start_time, end_time, event_type, location
        FROM schedule_events
        WHERE user_id=? AND date(start_time)=? AND is_deleted=0
        ORDER BY start_time ASC LIMIT 12
    """, (user_id, today)).fetchall()

    # Today's habits
    habits = db.execute("""
        SELECT h.title, h.icon,
               COALESCE(hl.completed, 0) as done,
               h.streak_current
        FROM habits h
        LEFT JOIN habit_logs hl
          ON hl.habit_id=h.id AND hl.date=? AND hl.user_id=?
        WHERE h.user_id=? AND h.is_active=1 AND h.is_deleted=0
        ORDER BY done ASC, h.title ASC LIMIT 10
    """, (today, user_id, user_id)).fetchall()

    # Active tasks due today or overdue
    tasks = db.execute("""
        SELECT title, status, priority, due_date
        FROM tasks
        WHERE user_id=? AND status!='done' AND is_deleted=0
          AND (due_date<=? OR due_date IS NULL)
        ORDER BY
          CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3 ELSE 4 END,
          due_date ASC NULLS LAST
        LIMIT 10
    """, (user_id, today)).fetchall()

    # XP / level
    xp_row = db.execute(
        "SELECT total_xp, level FROM user_xp WHERE user_id=?", (user_id,)
    ).fetchone()
    xp = xp_row['total_xp'] if xp_row else 0
    level = xp_row['level'] if xp_row else 1

    # Build HTML — inline everything, no external resources
    def row_bg(i):
        return '#1a1a2e' if i % 2 == 0 else '#16213e'

    schedule_rows = ""
    for i, e in enumerate(schedule):
        t_start = (e['start_time'] or '')[-8:-3] if e['start_time'] else '--:--'
        t_end   = (e['end_time']   or '')[-8:-3] if e['end_time']   else ''
        time_str = f"{t_start}–{t_end}" if t_end else t_start
        loc = f" @ {e['location']}" if e['location'] else ''
        schedule_rows += (
            f'<tr style="background:{row_bg(i)}">'
            f'<td style="padding:6px 8px;color:#64ffda;white-space:nowrap">{time_str}</td>'
            f'<td style="padding:6px 8px">{e["title"]}{loc}</td>'
            f'</tr>'
        )
    if not schedule_rows:
        schedule_rows = '<tr><td colspan="2" style="padding:8px;color:#555">No events today</td></tr>'

    habit_rows = ""
    for i, h in enumerate(habits):
        icon = h['icon'] or ''
        done_mark = '&#10003;' if h['done'] else '&#9675;'
        done_color = '#64ffda' if h['done'] else '#888'
        streak = f" &nbsp;&#128293;{h['streak_current']}" if h['streak_current'] > 1 else ''
        habit_rows += (
            f'<tr style="background:{row_bg(i)}">'
            f'<td style="padding:6px 8px;color:{done_color};font-size:18px;text-align:center">{done_mark}</td>'
            f'<td style="padding:6px 8px">{icon} {h["title"]}{streak}</td>'
            f'</tr>'
        )
    if not habit_rows:
        habit_rows = '<tr><td colspan="2" style="padding:8px;color:#555">No habits tracked</td></tr>'

    priority_colors = {'urgent': '#ff4444', 'high': '#ff9944', 'medium': '#ffdd44', 'low': '#aaaaaa'}
    task_rows = ""
    for i, t in enumerate(tasks):
        p_color = priority_colors.get(t['priority'] or 'medium', '#aaa')
        overdue = t['due_date'] and t['due_date'] < today
        due_str = f" <span style='color:#ff4444'>(overdue)</span>" if overdue else (f" <span style='color:#888'>{t['due_date']}</span>" if t['due_date'] else '')
        task_rows += (
            f'<tr style="background:{row_bg(i)}">'
            f'<td style="padding:4px 8px;color:{p_color};text-align:center;font-size:10px">{(t["priority"] or "med").upper()}</td>'
            f'<td style="padding:4px 8px">{t["title"]}{due_str}</td>'
            f'</tr>'
        )
    if not task_rows:
        task_rows = '<tr><td colspan="2" style="padding:8px;color:#64ffda">&#10003; All clear!</td></tr>'

    now_str = datetime.now().strftime('%a %d %b  %H:%M')

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="60">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TeddyBot</title>
<style>
  body{{margin:0;padding:0;background:#0d1117;color:#e6edf3;font-family:Arial,sans-serif;font-size:14px}}
  h2{{margin:0 0 6px 0;font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#58a6ff}}
  .card{{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:10px;margin:8px}}
  table{{width:100%;border-collapse:collapse}}
  .vitals{{display:block}}
  .v-item{{padding:4px 0;border-bottom:1px solid #21262d}}
  .v-label{{color:#58a6ff;display:inline-block;width:80px;font-size:12px}}
  .v-value{{color:#e6edf3}}
  .header{{background:#161b22;border-bottom:2px solid #21262d;padding:10px 12px;display:block}}
  .title{{font-size:18px;font-weight:bold;color:#64ffda;letter-spacing:1px}}
  .subtitle{{font-size:11px;color:#888;margin-top:2px}}
  .xp-bar-bg{{background:#21262d;height:8px;border-radius:4px;margin-top:4px}}
  .xp-bar{{background:#64ffda;height:8px;border-radius:4px}}
</style>
</head>
<body>

<div class="header">
  <span class="title">&#9889; TeddyBot</span>
  <div class="subtitle">Federation Node &mdash; Brisbane, QLD &mdash; {now_str}</div>
  <div style="margin-top:4px;font-size:12px;color:#888">Lv {level} &nbsp;&#11088; {xp:,} XP</div>
</div>

<div class="card">
  <h2>&#9881; Jetson Status</h2>
  <div class="vitals">
    <div class="v-item"><span class="v-label">Uptime</span><span class="v-value">{uptime_str}</span></div>
    <div class="v-item"><span class="v-label">Load</span><span class="v-value">{load_str}</span></div>
    <div class="v-item"><span class="v-label">Temp</span><span class="v-value">{temp_str}</span></div>
    <div class="v-item"><span class="v-label">Memory</span><span class="v-value">{mem_str}</span></div>
  </div>
</div>

<div class="card">
  <h2>&#128197; Today &mdash; {today}</h2>
  <table>{schedule_rows}</table>
</div>

<div class="card">
  <h2>&#9679; Habits</h2>
  <table>{habit_rows}</table>
</div>

<div class="card">
  <h2>&#9654; Tasks</h2>
  <table>{task_rows}</table>
</div>

<div style="text-align:center;padding:8px;font-size:10px;color:#333">
  Auto-refreshes every 60s &mdash; TeddyBot v1
</div>

</body>
</html>"""

    from flask import Response
    return Response(html, mimetype='text/html')


# ═══════════════════════════════════════════════════════════════
# Public API Blueprint — External integrations
# ═══════════════════════════════════════════════════════════════

from api import register_api_blueprint
register_api_blueprint(app)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
