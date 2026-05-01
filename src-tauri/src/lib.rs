use rusqlite::{Connection, params};
use serde::{Serialize, Deserialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;
use thiserror::Error;
use rand::Rng;

// ═══════════════════════════════════════════════════════════════
// Error Types
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Error)]
pub enum LifeOsError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Table '{0}' is not allowed")]
    InvalidTable(String),

    #[error("Column name '{0}' is invalid: {1}")]
    InvalidColumn(String, String),

    #[error("Invalid session token")]
    Unauthorized,

    #[error("No fields to update")]
    EmptyUpdate,

    #[error("AI bridge error: {0}")]
    AiBridge(String),

    #[error("Raw queries are disabled for security")]
    RawQueryDisabled,

    #[error("IO error: {0}")]
    Io(String),

    #[error("Path not allowed: {0}")]
    PathNotAllowed(String),
}

impl From<LifeOsError> for Value {
    fn from(e: LifeOsError) -> Value {
        json!({ "data": null, "error": e.to_string() })
    }
}

// ═══════════════════════════════════════════════════════════════
// Database + Session State
// ═══════════════════════════════════════════════════════════════

pub struct AppState {
    pub db: Mutex<Connection>,
    pub session_token: Mutex<Option<String>>,
}

fn db_path() -> PathBuf {
    let mut path = dirs::home_dir().expect("No home directory");
    path.push(".lifeos");
    std::fs::create_dir_all(&path).ok();
    path.push("data.db");
    path
}

/// Generate a cryptographically random session token (64 hex chars).
fn generate_session_token() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Validate the provided token against the stored session token.
fn validate_session(state: &AppState, token: &str) -> Result<(), LifeOsError> {
    let stored = state.session_token.lock().unwrap();
    match stored.as_deref() {
        Some(t) if t == token => Ok(()),
        _ => Err(LifeOsError::Unauthorized),
    }
}

// ═══════════════════════════════════════════════════════════════
// Schema — Matches Flask backend exactly
// ═══════════════════════════════════════════════════════════════

const SCHEMA_SQL: &str = r#"
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TABLE IF NOT EXISTS user_xp (
    user_id TEXT PRIMARY KEY,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    current_level_xp INTEGER DEFAULT 0,
    next_level_xp INTEGER DEFAULT 100,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS xp_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    source TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TABLE IF NOT EXISTS ai_insights (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT,
    content TEXT,
    context TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    attachments TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TABLE IF NOT EXISTS sync_meta (
    table_name TEXT PRIMARY KEY,
    last_sync_at TEXT,
    record_count INTEGER DEFAULT 0
);

-- Indexes
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

-- Seed default user
INSERT OR IGNORE INTO users (id, email, display_name) VALUES ('local-user-001', 'local@lifeos.app', 'LifeOS User');
INSERT OR IGNORE INTO user_profiles (user_id, email, full_name, onboarding_complete) VALUES ('local-user-001', 'local@lifeos.app', 'LifeOS User', 1);
INSERT OR IGNORE INTO user_xp (user_id, total_xp, level) VALUES ('local-user-001', 0, 1);
"#;

// ═══════════════════════════════════════════════════════════════
// Allowed Tables & Columns Whitelist
// ═══════════════════════════════════════════════════════════════

const ALLOWED_TABLES: &[&str] = &[
    "users", "user_profiles", "goals", "tasks", "habits", "habit_logs",
    "schedule_events", "health_metrics", "workouts", "workout_exercises",
    "expense_categories", "businesses", "transactions", "budgets",
    "income", "expenses", "bills", "clients", "journal_entries",
    "rpg_characters", "rpg_quest_log", "user_xp", "xp_events",
    "achievements", "inventory_items", "pet_profiles", "categories",
    "projects", "notes", "assets", "asset_maintenance", "asset_bills",
    "asset_documents", "ai_insights", "chat_messages", "unified_events",
    "sync_meta",
];

/// Every column name that may appear across all tables. Only these are ever
/// interpolated into SQL. The set is derived directly from the schema above.
const ALLOWED_COLUMNS: &[&str] = &[
    // Common
    "id", "user_id", "created_at", "updated_at", "is_deleted", "sync_status",
    // users / user_profiles
    "email", "display_name", "full_name", "avatar_url", "timezone",
    "subscription_tier", "preferences", "onboarding_complete",
    // goals
    "title", "description", "status", "domain", "category", "financial_type",
    "parent_goal_id", "budget_allocated", "expected_return", "business_id",
    "progress", "target_date", "priority", "estimated_hours", "deadline_type",
    "success_criteria", "key_results", "resources", "decomposition_source",
    "health_status", "icon", "color", "sort_order", "source",
    // tasks
    "goal_id", "due_date", "due_time", "scheduled_date", "estimated_minutes",
    "actual_minutes", "estimated_duration", "actual_duration", "category_id",
    "project_id", "parent_task_id", "depth_level", "board_status",
    "board_position", "depends_on_task_id", "scheduled_start", "scheduled_end",
    "energy_level", "suggested_week", "auto_scheduled", "tags",
    "financial_amount", "financial_category_id", "completed_at",
    // habits
    "frequency", "target_count", "streak_current", "streak_best",
    "time_of_day", "duration_minutes", "is_active",
    // habit_logs
    "habit_id", "date", "count", "value", "completed", "notes",
    // schedule_events
    "start_time", "end_time", "all_day", "event_type", "task_id",
    "workout_template_id", "location", "day_type", "recurrence_rule",
    "is_recurring", "htmlLink", "metadata", "schedule_layer",
    "is_template", "is_live",
    // health_metrics
    "mood_score", "energy_score", "stress_score", "sleep_hours",
    "sleep_quality", "water_glasses", "weight_kg", "exercise_minutes",
    // workouts
    "day_of_week", "preferred_time", "exercises",
    // workout_exercises
    "workout_id", "name", "sets", "reps", "weight", "duration_seconds",
    // expense_categories
    "scope", "budget_monthly",
    // businesses
    "type", "industry", "revenue_model", "monthly_revenue", "monthly_expenses",
    // transactions
    "amount", "client_id", "event_id", "recurring",
    // budgets
    "month",
    // income
    "is_deductible", "receipt_url", "payment_method", "travel_km",
    // bills
    "paid_date", "payment_url",
    // clients
    "phone", "address", "latitude", "longitude", "rate", "rate_type",
    "sop", "access_codes",
    // journal_entries
    "content", "mood", "energy", "image_url",
    // rpg_characters
    "class", "sprite_data", "stats", "equipment", "position",
    // rpg_quest_log
    "character_id", "quest_id", "source_type", "source_id", "xp_reward",
    "started_at", "completed_at",
    // user_xp
    "total_xp", "level", "current_level_xp", "next_level_xp",
    // xp_events (amount already listed)
    // achievements
    "code", "tier", "unlocked_at",
    // inventory_items
    "rarity", "is_equipped", "slot", "quantity",
    // pet_profiles
    "species", "xp", "hunger", "happiness",
    // categories
    "parent_id",
    // projects
    "start_date",
    // notes
    "is_pinned",
    // assets
    "purchase_date",
    // asset_maintenance
    "asset_id", "cost",
    // asset_bills (amount, due_date already listed)
    // asset_documents
    "file_url", "file_type",
    // ai_insights
    "context",
    // chat_messages
    "role", "attachments",
    // unified_events
    // sync_meta
    "table_name", "last_sync_at", "record_count",
    // habit_id already listed above
];

// ═══════════════════════════════════════════════════════════════
// Validation Helpers
// ═══════════════════════════════════════════════════════════════

/// Validate that a table name is in the whitelist.
fn validate_table(table: &str) -> Result<(), LifeOsError> {
    if ALLOWED_TABLES.contains(&table) {
        Ok(())
    } else {
        Err(LifeOsError::InvalidTable(table.to_string()))
    }
}

/// Strict column name validation:
///  - Must match `^[a-zA-Z_][a-zA-Z0-9_]*$`
///  - Max 64 characters
///  - Must be in `ALLOWED_COLUMNS`
pub fn validate_column_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("column name is empty".to_string());
    }
    if name.len() > 64 {
        return Err(format!("column name exceeds 64 characters (got {})", name.len()));
    }

    let mut chars = name.chars();
    let first = chars.next().unwrap(); // safe: checked non-empty
    if !first.is_ascii_alphabetic() && first != '_' {
        return Err(format!(
            "column name must start with a letter or underscore, got '{}'",
            first
        ));
    }
    for ch in chars {
        if !ch.is_ascii_alphanumeric() && ch != '_' {
            return Err(format!("column name contains invalid character '{}'", ch));
        }
    }

    if !ALLOWED_COLUMNS.contains(&name) {
        return Err(format!("column '{}' is not in the allowed columns list", name));
    }

    Ok(())
}

/// Validate a column name, returning a `LifeOsError` on failure.
fn validate_column(name: &str) -> Result<(), LifeOsError> {
    validate_column_name(name).map_err(|reason| LifeOsError::InvalidColumn(name.to_string(), reason))
}

fn supabase_ok(data: Value) -> Value {
    json!({ "data": data, "error": null })
}

fn supabase_err(error: &str) -> Value {
    json!({ "data": null, "error": error })
}

// Helper to convert LifeOsError → supabase-style JSON response
fn err_to_response(e: LifeOsError) -> Value {
    supabase_err(&e.to_string())
}

// ═══════════════════════════════════════════════════════════════
// Row extraction helper (DRY — used by get_items)
// ═══════════════════════════════════════════════════════════════

fn row_to_json(row: &rusqlite::Row, col_names: &[String]) -> rusqlite::Result<Value> {
    let mut obj = serde_json::Map::new();
    for (i, name) in col_names.iter().enumerate() {
        let val: rusqlite::Result<String> = row.get(i);
        match val {
            Ok(s) => {
                if let Ok(parsed) = serde_json::from_str::<Value>(&s) {
                    if parsed.is_array() || parsed.is_object() {
                        obj.insert(name.clone(), parsed);
                        continue;
                    }
                }
                obj.insert(name.clone(), Value::String(s));
            }
            Err(_) => {
                if let Ok(n) = row.get::<_, i64>(i) {
                    obj.insert(name.clone(), json!(n));
                } else if let Ok(f) = row.get::<_, f64>(i) {
                    obj.insert(name.clone(), json!(f));
                } else {
                    obj.insert(name.clone(), Value::Null);
                }
            }
        }
    }
    Ok(Value::Object(obj))
}

// ═══════════════════════════════════════════════════════════════
// Unified db_query — handles all CRUD from the frontend
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct QueryFilter {
    column: String,
    operator: String,
    value: Value,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct QueryParams {
    table: String,
    method: String, // select | insert | update | upsert | delete
    columns: Option<String>,
    filters: Option<Vec<QueryFilter>>,
    order_col: Option<String>,
    order_asc: Option<bool>,
    limit: Option<u32>,
    offset: Option<u32>,
    single: Option<bool>,       // handled client-side (array→object unwrap)
    body: Option<Value>,
    upsert_conflict: Option<String>,
    return_select: Option<bool>,
    count: Option<String>,
    or_filter: Option<String>,  // Supabase-style OR filter string
}

/// Build WHERE clause from filters. Returns (sql_fragment, param_values).
fn build_where_clause(filters: &[QueryFilter]) -> Result<(String, Vec<String>), LifeOsError> {
    if filters.is_empty() {
        return Ok((String::new(), Vec::new()));
    }

    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<String> = Vec::new();

    for f in filters {
        validate_column(&f.column)?;

        match f.operator.as_str() {
            "eq" => {
                conditions.push(format!("\"{}\" = ?", f.column));
                param_values.push(value_to_sql_string(&f.value));
            }
            "neq" => {
                conditions.push(format!("\"{}\" != ?", f.column));
                param_values.push(value_to_sql_string(&f.value));
            }
            "gt" => {
                conditions.push(format!("\"{}\" > ?", f.column));
                param_values.push(value_to_sql_string(&f.value));
            }
            "gte" => {
                conditions.push(format!("\"{}\" >= ?", f.column));
                param_values.push(value_to_sql_string(&f.value));
            }
            "lt" => {
                conditions.push(format!("\"{}\" < ?", f.column));
                param_values.push(value_to_sql_string(&f.value));
            }
            "lte" => {
                conditions.push(format!("\"{}\" <= ?", f.column));
                param_values.push(value_to_sql_string(&f.value));
            }
            "like" => {
                conditions.push(format!("\"{}\" LIKE ?", f.column));
                param_values.push(value_to_sql_string(&f.value));
            }
            "ilike" => {
                conditions.push(format!("\"{}\" LIKE ? COLLATE NOCASE", f.column));
                param_values.push(value_to_sql_string(&f.value));
            }
            "is" => {
                // IS NULL / IS NOT NULL
                let v = value_to_sql_string(&f.value);
                if v == "null" || v.is_empty() {
                    conditions.push(format!("\"{}\" IS NULL", f.column));
                } else if v == "true" {
                    conditions.push(format!("\"{}\" IS TRUE", f.column));
                } else if v == "false" {
                    conditions.push(format!("\"{}\" IS FALSE", f.column));
                } else {
                    conditions.push(format!("\"{}\" IS NULL", f.column));
                }
            }
            "in" => {
                // value should be an array
                if let Value::Array(arr) = &f.value {
                    if arr.is_empty() {
                        // IN () is invalid SQL; use always-false condition
                        conditions.push("0 = 1".to_string());
                    } else {
                        let placeholders: Vec<&str> = arr.iter().map(|_| "?").collect();
                        conditions.push(format!(
                            "\"{}\" IN ({})",
                            f.column,
                            placeholders.join(", ")
                        ));
                        for item in arr {
                            param_values.push(value_to_sql_string(item));
                        }
                    }
                } else {
                    // Single value fallback
                    conditions.push(format!("\"{}\" = ?", f.column));
                    param_values.push(value_to_sql_string(&f.value));
                }
            }
            "contains" => {
                // JSON array contains — use LIKE as approximation for SQLite
                conditions.push(format!("\"{}\" LIKE ?", f.column));
                let v = value_to_sql_string(&f.value);
                param_values.push(format!("%{}%", v));
            }
            _ => {
                // Unknown operator — treat as eq
                conditions.push(format!("\"{}\" = ?", f.column));
                param_values.push(value_to_sql_string(&f.value));
            }
        }
    }

    let clause = format!(" WHERE {}", conditions.join(" AND "));
    Ok((clause, param_values))
}

/// Convert a serde_json::Value to a string suitable for SQL parameter binding.
fn value_to_sql_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => if *b { "1".to_string() } else { "0".to_string() },
        Value::Null => String::new(),
        other => other.to_string(), // arrays/objects get JSON string
    }
}

/// Execute a SELECT query and return results.
fn exec_select(
    conn: &Connection,
    params: &QueryParams,
) -> Result<Value, LifeOsError> {
    let columns_sql = if let Some(ref cols) = params.columns {
        // Parse column list: "id,title,status" → "\"id\", \"title\", \"status\""
        // Also handle "*"
        if cols.trim() == "*" {
            "*".to_string()
        } else {
            let parts: Vec<&str> = cols.split(',').map(|c| c.trim()).collect();
            for p in &parts {
                // Skip aggregate expressions or *
                if *p == "*" || p.contains('(') { continue; }
                validate_column(p)?;
            }
            parts
                .iter()
                .map(|c| {
                    if *c == "*" || c.contains('(') {
                        c.to_string()
                    } else {
                        format!("\"{}\"", c)
                    }
                })
                .collect::<Vec<_>>()
                .join(", ")
        }
    } else {
        "*".to_string()
    };

    let (where_clause, where_params) = if let Some(ref filters) = params.filters {
        build_where_clause(filters)?
    } else {
        (String::new(), Vec::new())
    };

    let order_clause = if let Some(ref col) = params.order_col {
        validate_column(col)?;
        let dir = if params.order_asc.unwrap_or(true) { "ASC" } else { "DESC" };
        format!(" ORDER BY \"{}\" {}", col, dir)
    } else {
        " ORDER BY created_at DESC".to_string()
    };

    let limit_clause = if let Some(lim) = params.limit {
        format!(" LIMIT {}", lim)
    } else {
        String::new()
    };

    let offset_clause = if let Some(off) = params.offset {
        format!(" OFFSET {}", off)
    } else {
        String::new()
    };

    let sql = format!(
        "SELECT {} FROM \"{}\"{}{}{}{}",
        columns_sql, params.table, where_clause, order_clause, limit_clause, offset_clause
    );

    let mut stmt = conn.prepare(&sql).map_err(LifeOsError::Database)?;

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = where_params
        .iter()
        .map(|v| v as &dyn rusqlite::types::ToSql)
        .collect();

    let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let rows: Result<Vec<Value>, _> = stmt
        .query_map(params_refs.as_slice(), |row| row_to_json(row, &col_names))
        .and_then(|mapped| mapped.collect());

    let data = rows.map_err(LifeOsError::Database)?;

    // Handle count
    if params.count.is_some() {
        let count_sql = format!(
            "SELECT COUNT(*) FROM \"{}\"{}",
            params.table, where_clause
        );
        let count: i64 = conn
            .query_row(&count_sql, params_refs.as_slice(), |row| row.get(0))
            .unwrap_or(0);
        return Ok(json!({
            "data": data,
            "error": null,
            "status": 200,
            "statusText": "OK",
            "count": count
        }));
    }

    Ok(json!({
        "data": data,
        "error": null,
        "status": 200,
        "statusText": "OK"
    }))
}

/// Execute an INSERT and return the inserted row(s).
fn exec_insert(
    conn: &Connection,
    params: &QueryParams,
) -> Result<Value, LifeOsError> {
    let body = params.body.as_ref().ok_or_else(|| {
        LifeOsError::AiBridge("INSERT requires a body".to_string())
    })?;

    // Handle both single object and array of objects
    let rows_to_insert: Vec<&serde_json::Map<String, Value>> = if let Value::Array(arr) = body {
        arr.iter()
            .filter_map(|v| v.as_object())
            .collect()
    } else if let Some(obj) = body.as_object() {
        vec![obj]
    } else {
        return Err(LifeOsError::AiBridge("INSERT body must be object or array".to_string()));
    };

    let mut inserted = Vec::new();

    for row_data in &rows_to_insert {
        let mut fields: serde_json::Map<String, Value> = (*row_data).clone();

        // Auto-generate id and timestamps
        if !fields.contains_key("id") {
            fields.insert("id".to_string(), Value::String(uuid::Uuid::new_v4().to_string()));
        }
        if !fields.contains_key("created_at") {
            fields.insert("created_at".to_string(), Value::String(chrono::Utc::now().to_rfc3339()));
        }
        if !fields.contains_key("user_id") {
            fields.insert("user_id".to_string(), Value::String("local-user-001".to_string()));
        }

        for key in fields.keys() {
            validate_column(key)?;
        }

        let columns: Vec<String> = fields.keys().cloned().collect();
        let placeholders: Vec<&str> = columns.iter().map(|_| "?").collect();
        let quoted_cols: Vec<String> = columns.iter().map(|c| format!("\"{}\"", c)).collect();

        let sql = format!(
            "INSERT INTO \"{}\" ({}) VALUES ({})",
            params.table,
            quoted_cols.join(", "),
            placeholders.join(", ")
        );

        let values: Vec<String> = columns.iter().map(|k| value_to_sql_string(&fields[k])).collect();
        let params_refs: Vec<&dyn rusqlite::types::ToSql> = values
            .iter()
            .map(|v| v as &dyn rusqlite::types::ToSql)
            .collect();

        conn.execute(&sql, params_refs.as_slice()).map_err(LifeOsError::Database)?;

        // If return_select, fetch the inserted row back
        if params.return_select.unwrap_or(false) {
            let id = fields.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let select_sql = format!("SELECT * FROM \"{}\" WHERE id = ?", params.table);
            let mut stmt = conn.prepare(&select_sql).map_err(LifeOsError::Database)?;
            let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
            let row = stmt
                .query_row(rusqlite::params![id], |r| row_to_json(r, &col_names))
                .map_err(LifeOsError::Database)?;
            inserted.push(row);
        } else {
            let id = fields.get("id").and_then(|v| v.as_str()).unwrap_or("");
            inserted.push(json!({ "id": id }));
        }
    }

    Ok(json!({
        "data": inserted,
        "error": null,
        "status": 201,
        "statusText": "Created"
    }))
}

/// Execute an UPDATE and return affected rows.
fn exec_update(
    conn: &Connection,
    params: &QueryParams,
) -> Result<Value, LifeOsError> {
    let body = params.body.as_ref().ok_or_else(|| {
        LifeOsError::AiBridge("UPDATE requires a body".to_string())
    })?;

    let obj = body.as_object().ok_or_else(|| {
        LifeOsError::AiBridge("UPDATE body must be an object".to_string())
    })?;

    let mut fields: serde_json::Map<String, Value> = obj.clone();
    fields.remove("id");
    fields.remove("created_at");
    fields.insert("updated_at".to_string(), Value::String(chrono::Utc::now().to_rfc3339()));

    if fields.is_empty() {
        return Err(LifeOsError::EmptyUpdate);
    }

    for key in fields.keys() {
        validate_column(key)?;
    }

    let set_clauses: Vec<String> = fields.keys().map(|k| format!("\"{}\" = ?", k)).collect();
    let mut values: Vec<String> = fields.keys().map(|k| value_to_sql_string(&fields[k])).collect();

    let (where_clause, where_params) = if let Some(ref filters) = params.filters {
        build_where_clause(filters)?
    } else {
        (String::new(), Vec::new())
    };
    values.extend(where_params);

    let sql = format!(
        "UPDATE \"{}\" SET {}{}",
        params.table,
        set_clauses.join(", "),
        where_clause
    );

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = values
        .iter()
        .map(|v| v as &dyn rusqlite::types::ToSql)
        .collect();

    let changed = conn.execute(&sql, params_refs.as_slice()).map_err(LifeOsError::Database)?;

    // If return_select, fetch the updated rows
    if params.return_select.unwrap_or(false) {
        let (wc, wp) = if let Some(ref filters) = params.filters {
            build_where_clause(filters)?
        } else {
            (String::new(), Vec::new())
        };
        let select_sql = format!("SELECT * FROM \"{}\"{}", params.table, wc);
        let mut stmt = conn.prepare(&select_sql).map_err(LifeOsError::Database)?;
        let wp_refs: Vec<&dyn rusqlite::types::ToSql> = wp.iter().map(|v| v as &dyn rusqlite::types::ToSql).collect();
        let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let rows: Result<Vec<Value>, _> = stmt
            .query_map(wp_refs.as_slice(), |row| row_to_json(row, &col_names))
            .and_then(|mapped| mapped.collect());
        let data = rows.map_err(LifeOsError::Database)?;
        return Ok(json!({
            "data": data,
            "error": null,
            "status": 200,
            "statusText": "OK"
        }));
    }

    Ok(json!({
        "data": json!({ "count": changed }),
        "error": null,
        "status": 200,
        "statusText": "OK"
    }))
}

/// Execute an UPSERT (INSERT ON CONFLICT UPDATE).
fn exec_upsert(
    conn: &Connection,
    params: &QueryParams,
) -> Result<Value, LifeOsError> {
    let body = params.body.as_ref().ok_or_else(|| {
        LifeOsError::AiBridge("UPSERT requires a body".to_string())
    })?;

    let conflict_col = params.upsert_conflict.as_deref().unwrap_or("id");
    validate_column(conflict_col)?;

    let rows_to_upsert: Vec<&serde_json::Map<String, Value>> = if let Value::Array(arr) = body {
        arr.iter().filter_map(|v| v.as_object()).collect()
    } else if let Some(obj) = body.as_object() {
        vec![obj]
    } else {
        return Err(LifeOsError::AiBridge("UPSERT body must be object or array".to_string()));
    };

    let mut upserted = Vec::new();

    for row_data in &rows_to_upsert {
        let mut fields: serde_json::Map<String, Value> = (*row_data).clone();

        if !fields.contains_key("id") {
            fields.insert("id".to_string(), Value::String(uuid::Uuid::new_v4().to_string()));
        }
        if !fields.contains_key("created_at") {
            fields.insert("created_at".to_string(), Value::String(chrono::Utc::now().to_rfc3339()));
        }
        if !fields.contains_key("user_id") {
            fields.insert("user_id".to_string(), Value::String("local-user-001".to_string()));
        }
        fields.insert("updated_at".to_string(), Value::String(chrono::Utc::now().to_rfc3339()));

        for key in fields.keys() {
            validate_column(key)?;
        }

        let columns: Vec<String> = fields.keys().cloned().collect();
        let placeholders: Vec<&str> = columns.iter().map(|_| "?").collect();
        let quoted_cols: Vec<String> = columns.iter().map(|c| format!("\"{}\"", c)).collect();

        // Build the ON CONFLICT DO UPDATE SET clause (excluding the conflict column)
        let update_cols: Vec<String> = columns
            .iter()
            .filter(|c| c.as_str() != conflict_col)
            .map(|c| format!("\"{}\" = excluded.\"{}\"", c, c))
            .collect();

        let sql = format!(
            "INSERT INTO \"{}\" ({}) VALUES ({}) ON CONFLICT(\"{}\") DO UPDATE SET {}",
            params.table,
            quoted_cols.join(", "),
            placeholders.join(", "),
            conflict_col,
            update_cols.join(", ")
        );

        let values: Vec<String> = columns.iter().map(|k| value_to_sql_string(&fields[k])).collect();
        let params_refs: Vec<&dyn rusqlite::types::ToSql> = values
            .iter()
            .map(|v| v as &dyn rusqlite::types::ToSql)
            .collect();

        conn.execute(&sql, params_refs.as_slice()).map_err(LifeOsError::Database)?;

        if params.return_select.unwrap_or(false) {
            let id = fields.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let select_sql = format!("SELECT * FROM \"{}\" WHERE id = ?", params.table);
            let mut stmt = conn.prepare(&select_sql).map_err(LifeOsError::Database)?;
            let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
            let row = stmt
                .query_row(rusqlite::params![id], |r| row_to_json(r, &col_names))
                .map_err(LifeOsError::Database)?;
            upserted.push(row);
        } else {
            let id = fields.get("id").and_then(|v| v.as_str()).unwrap_or("");
            upserted.push(json!({ "id": id }));
        }
    }

    Ok(json!({
        "data": upserted,
        "error": null,
        "status": 200,
        "statusText": "OK"
    }))
}

/// Execute a DELETE with filters.
fn exec_delete(
    conn: &Connection,
    params: &QueryParams,
) -> Result<Value, LifeOsError> {
    let (where_clause, where_params) = if let Some(ref filters) = params.filters {
        build_where_clause(filters)?
    } else {
        (String::new(), Vec::new())
    };

    if where_clause.is_empty() {
        return Err(LifeOsError::AiBridge("DELETE requires at least one filter".to_string()));
    }

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = where_params
        .iter()
        .map(|v| v as &dyn rusqlite::types::ToSql)
        .collect();

    // Try soft delete first (tables with is_deleted column)
    let soft_sql = format!(
        "UPDATE \"{}\" SET is_deleted = 1, updated_at = ?{}",
        params.table,
        where_clause.replacen(" WHERE ", " WHERE ", 1)  // keep WHERE as-is
    );
    let now = chrono::Utc::now().to_rfc3339();
    let mut soft_params: Vec<String> = vec![now];
    soft_params.extend(where_params.clone());
    let soft_refs: Vec<&dyn rusqlite::types::ToSql> = soft_params
        .iter()
        .map(|v| v as &dyn rusqlite::types::ToSql)
        .collect();

    let result = conn.execute(&soft_sql, soft_refs.as_slice());
    match result {
        Ok(n) if n > 0 => {
            return Ok(json!({
                "data": [],
                "error": null,
                "status": 200,
                "statusText": "OK"
            }));
        }
        _ => {}
    }

    // Fall back to hard delete
    let hard_sql = format!("DELETE FROM \"{}\"{}", params.table, where_clause);
    conn.execute(&hard_sql, params_refs.as_slice()).map_err(LifeOsError::Database)?;

    Ok(json!({
        "data": [],
        "error": null,
        "status": 200,
        "statusText": "OK"
    }))
}

/// Unified db_query command — the single entry point for all CRUD operations
/// from the frontend. No session token required (desktop app = trusted).
#[tauri::command]
fn db_query(state: State<'_, AppState>, params: QueryParams) -> Value {
    if let Err(e) = validate_table(&params.table) {
        return json!({
            "data": null,
            "error": { "message": e.to_string(), "details": "", "hint": "", "code": "INVALID_TABLE" },
            "status": 400,
            "statusText": "Bad Request"
        });
    }

    let conn = state.db.lock().unwrap();

    let result = match params.method.as_str() {
        "select" => exec_select(&conn, &params),
        "insert" => exec_insert(&conn, &params),
        "update" => exec_update(&conn, &params),
        "upsert" => exec_upsert(&conn, &params),
        "delete" => exec_delete(&conn, &params),
        other => Err(LifeOsError::AiBridge(format!("Unknown method: {}", other))),
    };

    match result {
        Ok(response) => response,
        Err(e) => json!({
            "data": null,
            "error": { "message": e.to_string(), "details": "", "hint": "", "code": "DB_ERROR" },
            "status": 500,
            "statusText": "Internal Server Error"
        }),
    }
}

// ═══════════════════════════════════════════════════════════════
// Tauri Commands
// ═══════════════════════════════════════════════════════════════

/// Initialize the session: returns a fresh session token.
/// Must be called once at app startup. All subsequent commands require this token.
#[tauri::command]
fn init_session(state: State<'_, AppState>) -> Value {
    let token = generate_session_token();
    {
        let mut stored = state.session_token.lock().unwrap();
        *stored = Some(token.clone());
    }
    supabase_ok(json!({ "session_token": token }))
}

#[tauri::command]
fn get_items(
    state: State<'_, AppState>,
    token: String,
    table: String,
    filters: Option<HashMap<String, String>>,
) -> Value {
    if let Err(e) = validate_session(&state, &token) {
        return err_to_response(e);
    }
    if let Err(e) = validate_table(&table) {
        return err_to_response(e);
    }

    let conn = state.db.lock().unwrap();
    let mut conditions = Vec::new();
    let mut param_values: Vec<String> = Vec::new();

    if let Some(f) = filters {
        for (key, val) in f {
            if let Err(e) = validate_column(&key) {
                return err_to_response(e);
            }
            conditions.push(format!("\"{}\" = ?", key));
            param_values.push(val);
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT * FROM \"{}\"{} ORDER BY created_at DESC",
        table, where_clause
    );

    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(e) => return err_to_response(LifeOsError::Database(e)),
    };

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values
        .iter()
        .map(|v| v as &dyn rusqlite::types::ToSql)
        .collect();

    let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let rows: Result<Vec<Value>, _> = stmt
        .query_map(params_refs.as_slice(), |row| row_to_json(row, &col_names))
        .and_then(|mapped| mapped.collect());

    match rows {
        Ok(data) => supabase_ok(json!(data)),
        Err(e) => err_to_response(LifeOsError::Database(e)),
    }
}

#[tauri::command]
fn create_item(
    state: State<'_, AppState>,
    token: String,
    table: String,
    data: HashMap<String, Value>,
) -> Value {
    if let Err(e) = validate_session(&state, &token) {
        return err_to_response(e);
    }
    if let Err(e) = validate_table(&table) {
        return err_to_response(e);
    }

    let conn = state.db.lock().unwrap();
    let mut fields = data.clone();

    // Auto-generate ID if not provided
    if !fields.contains_key("id") {
        fields.insert("id".to_string(), Value::String(uuid::Uuid::new_v4().to_string()));
    }
    if !fields.contains_key("created_at") {
        fields.insert("created_at".to_string(), Value::String(chrono::Utc::now().to_rfc3339()));
    }

    // Validate every column name before building SQL
    for key in fields.keys() {
        if let Err(e) = validate_column(key) {
            return err_to_response(e);
        }
    }

    let columns: Vec<String> = fields.keys().cloned().collect();
    let placeholders: Vec<String> = columns.iter().map(|_| "?".to_string()).collect();
    let quoted_cols: Vec<String> = columns.iter().map(|c| format!("\"{}\"", c)).collect();
    let sql = format!(
        "INSERT INTO \"{}\" ({}) VALUES ({})",
        table,
        quoted_cols.join(", "),
        placeholders.join(", ")
    );

    let values: Vec<String> = columns
        .iter()
        .map(|k| match &fields[k] {
            Value::String(s) => s.clone(),
            Value::Null => String::new(),
            other => other.to_string(),
        })
        .collect();

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = values
        .iter()
        .map(|v| v as &dyn rusqlite::types::ToSql)
        .collect();

    match conn.execute(&sql, params_refs.as_slice()) {
        Ok(_) => {
            let id = fields.get("id").and_then(|v| v.as_str()).unwrap_or("");
            supabase_ok(json!({ "id": id }))
        }
        Err(e) => err_to_response(LifeOsError::Database(e)),
    }
}

#[tauri::command]
fn update_item(
    state: State<'_, AppState>,
    token: String,
    table: String,
    id: String,
    data: HashMap<String, Value>,
) -> Value {
    if let Err(e) = validate_session(&state, &token) {
        return err_to_response(e);
    }
    if let Err(e) = validate_table(&table) {
        return err_to_response(e);
    }

    let conn = state.db.lock().unwrap();
    let mut fields = data;
    fields.remove("id");
    fields.remove("created_at");
    fields.insert("updated_at".to_string(), Value::String(chrono::Utc::now().to_rfc3339()));

    if fields.is_empty() {
        return err_to_response(LifeOsError::EmptyUpdate);
    }

    // Validate every column name
    for key in fields.keys() {
        if let Err(e) = validate_column(key) {
            return err_to_response(e);
        }
    }

    let set_clauses: Vec<String> = fields.keys().map(|k| format!("\"{}\" = ?", k)).collect();
    let sql = format!(
        "UPDATE \"{}\" SET {} WHERE id = ?",
        table,
        set_clauses.join(", ")
    );

    let mut values: Vec<String> = fields
        .keys()
        .map(|k| match &fields[k] {
            Value::String(s) => s.clone(),
            Value::Null => String::new(),
            other => other.to_string(),
        })
        .collect();
    values.push(id.clone());

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = values
        .iter()
        .map(|v| v as &dyn rusqlite::types::ToSql)
        .collect();

    match conn.execute(&sql, params_refs.as_slice()) {
        Ok(_) => supabase_ok(json!({ "id": id, "updated": true })),
        Err(e) => err_to_response(LifeOsError::Database(e)),
    }
}

#[tauri::command]
fn delete_item(
    state: State<'_, AppState>,
    token: String,
    table: String,
    id: String,
) -> Value {
    if let Err(e) = validate_session(&state, &token) {
        return err_to_response(e);
    }
    if let Err(e) = validate_table(&table) {
        return err_to_response(e);
    }

    let conn = state.db.lock().unwrap();

    // Try soft delete first, fall back to hard delete
    let result = conn.execute(
        &format!(
            "UPDATE \"{}\" SET is_deleted = 1, updated_at = ? WHERE id = ?",
            table
        ),
        params![chrono::Utc::now().to_rfc3339(), id],
    );

    match result {
        Ok(0) | Err(_) => {
            match conn.execute(
                &format!("DELETE FROM \"{}\" WHERE id = ?", table),
                params![id],
            ) {
                Ok(_) => supabase_ok(json!({ "id": id, "deleted": true })),
                Err(e) => err_to_response(LifeOsError::Database(e)),
            }
        }
        Ok(_) => supabase_ok(json!({ "id": id, "deleted": true })),
    }
}

/// Raw SQL queries are disabled for security. Use the typed CRUD commands instead.
#[tauri::command]
fn query_raw(
    state: State<'_, AppState>,
    token: String,
    _sql: String,
    _params: Option<Vec<String>>,
) -> Value {
    if let Err(e) = validate_session(&state, &token) {
        return err_to_response(e);
    }
    err_to_response(LifeOsError::RawQueryDisabled)
}

#[tauri::command]
async fn ai_chat(
    state: State<'_, AppState>,
    token: String,
    message: String,
) -> Result<Value, Value> {
    validate_session(&state, &token).map_err(|e| err_to_response(e))?;

    let client = reqwest::Client::new();
    let result = client
        .post("http://localhost:11434/v1/chat/completions")
        .json(&json!({
            "model": "glm-5.1:cloud",
            "messages": [
                {"role": "user", "content": message}
            ],
            "stream": false
        }))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await;

    match result {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<Value>().await {
                    Ok(data) => {
                        let reply = data["choices"][0]["message"]["content"]
                            .as_str()
                            .unwrap_or("No response")
                            .to_string();
                        Ok(supabase_ok(json!({
                            "role": "assistant",
                            "content": reply
                        })))
                    }
                    Err(e) => Err(err_to_response(LifeOsError::AiBridge(format!(
                        "Parse error: {}",
                        e
                    )))),
                }
            } else {
                Err(err_to_response(LifeOsError::AiBridge(format!(
                    "AI bridge returned {}",
                    resp.status()
                ))))
            }
        }
        Err(e) => Err(err_to_response(LifeOsError::AiBridge(format!(
            "AI bridge unavailable: {}",
            e
        )))),
    }
}

// ═══════════════════════════════════════════════════════════════
// Academy / Filesystem Commands
// ═══════════════════════════════════════════════════════════════

/// Directories the Tauri app is allowed to read from.
const ALLOWED_DIRS: &[&str] = &[
    "/mnt/data/tmp/academy/",
    "/mnt/data/prodigy/creative-engine/LifeOS/",
    "/home/tewedros/clawd/lifeOS_data/",
];

/// Check if a canonical path is inside one of the allowed directories.
fn is_path_allowed(path: &Path) -> bool {
    let canonical = match std::fs::canonicalize(path) {
        Ok(p) => p,
        Err(_) => return false,
    };
    let path_str = canonical.to_string_lossy();
    ALLOWED_DIRS.iter().any(|dir| path_str.starts_with(dir))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

/// Read a text file from an allowed directory.
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !is_path_allowed(p) {
        return Err(format!("Path not allowed: {}", path));
    }
    std::fs::read_to_string(p).map_err(|e| format!("IO error: {}", e))
}

/// List files in an allowed directory.
#[tauri::command]
fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let p = Path::new(&path);
    if !is_path_allowed(p) {
        return Err(format!("Path not allowed: {}", path));
    }
    let entries = std::fs::read_dir(p).map_err(|e| format!("IO error: {}", e))?;
    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("IO error: {}", e))?;
        let metadata = entry.metadata().map_err(|e| format!("IO error: {}", e))?;
        result.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
        });
    }
    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(result)
}

/// Return academy overview stats (phases, music count, etc).
#[tauri::command]
fn get_academy_overview() -> Value {
    // Count study-music files
    let music_count = std::fs::read_dir("/mnt/data/tmp/academy/study-music")
        .map(|d| d.filter_map(|e| e.ok()).filter(|e| {
            let name = e.file_name().to_string_lossy().to_lowercase();
            name.ends_with(".mp3") || name.ends_with(".ogg") || name.ends_with(".wav")
        }).count())
        .unwrap_or(0);

    // Count realm music files
    let realm_music_count = std::fs::read_dir("/mnt/data/prodigy/creative-engine/LifeOS/music")
        .map(|d| d.filter_map(|e| e.ok()).filter(|e| {
            let name = e.file_name().to_string_lossy().to_lowercase();
            name.ends_with(".mp3") || name.ends_with(".ogg") || name.ends_with(".wav")
        }).count())
        .unwrap_or(0);

    // Count backgrounds
    let bg_count = std::fs::read_dir("/mnt/data/prodigy/creative-engine/LifeOS/Backgrounds")
        .map(|d| d.filter_map(|e| e.ok()).filter(|e| {
            let name = e.file_name().to_string_lossy().to_lowercase();
            name.ends_with(".png") || name.ends_with(".jpg") || name.ends_with(".jpeg") || name.ends_with(".webp")
        }).count())
        .unwrap_or(0);

    // Count nature CSVs
    let nature_count = std::fs::read_dir("/home/tewedros/clawd/lifeOS_data")
        .map(|d| d.filter_map(|e| e.ok()).filter(|e| {
            e.file_name().to_string_lossy().to_lowercase().ends_with(".csv")
        }).count())
        .unwrap_or(0);

    // Count phase directories
    let phase_count = std::fs::read_dir("/mnt/data/tmp/academy")
        .map(|d| d.filter_map(|e| e.ok()).filter(|e| {
            e.metadata().map(|m| m.is_dir()).unwrap_or(false)
                && e.file_name().to_string_lossy().chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false)
        }).count())
        .unwrap_or(0);

    json!({
        "phases": phase_count,
        "studyMusicTracks": music_count,
        "realmMusicTracks": realm_music_count,
        "backgrounds": bg_count,
        "natureDatasets": nature_count,
    })
}

/// Serve binary file content (audio, images) from allowed directories.
#[tauri::command]
fn serve_media(path: String) -> Result<Vec<u8>, String> {
    let p = Path::new(&path);
    if !is_path_allowed(p) {
        return Err(format!("Path not allowed: {}", path));
    }
    std::fs::read(p).map_err(|e| format!("IO error: {}", e))
}

/// Serve media as raw bytes via Tauri IPC (efficient binary transfer, no JSON).
/// Used by the music player to load audio files directly into blob URLs.
#[tauri::command]
fn get_media_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    let p = Path::new(&path);
    if !is_path_allowed(p) {
        return Err(format!("Path not allowed: {}", path));
    }
    let data = std::fs::read(p).map_err(|e| format!("IO error: {}", e))?;
    Ok(tauri::ipc::Response::new(data))
}

// ═══════════════════════════════════════════════════════════════
// App Entry
// ═══════════════════════════════════════════════════════════════

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Fix WebKitGTK segfault on NVIDIA Tegra (DMA-BUF renderer + Tegra GPU driver)
    #[cfg(target_os = "linux")]
    {
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    let db_file = db_path();
    let conn = Connection::open(&db_file).expect("Failed to open database");
    conn.execute_batch(SCHEMA_SQL)
        .expect("Failed to initialize schema");
    log::info!("Database initialized at {:?}", db_file);

    tauri::Builder::default()
        .manage(AppState {
            db: Mutex::new(conn),
            session_token: Mutex::new(None),
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_query,
            init_session,
            get_items,
            create_item,
            update_item,
            delete_item,
            query_raw,
            ai_chat,
            read_file,
            list_directory,
            get_academy_overview,
            serve_media,
            get_media_bytes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ── validate_column_name ──────────────────────────────────

    #[test]
    fn test_valid_column_names() {
        // All of these are in ALLOWED_COLUMNS
        assert!(validate_column_name("id").is_ok());
        assert!(validate_column_name("user_id").is_ok());
        assert!(validate_column_name("created_at").is_ok());
        assert!(validate_column_name("htmlLink").is_ok());
        assert!(validate_column_name("is_deleted").is_ok());
    }

    #[test]
    fn test_empty_column_name() {
        let res = validate_column_name("");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_column_name_too_long() {
        let long = "a".repeat(65);
        let res = validate_column_name(&long);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("64"));
    }

    #[test]
    fn test_column_name_starts_with_digit() {
        let res = validate_column_name("1bad");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("start with"));
    }

    #[test]
    fn test_column_name_with_special_chars() {
        assert!(validate_column_name("col-name").is_err());
        assert!(validate_column_name("col name").is_err());
        assert!(validate_column_name("col;drop").is_err());
        assert!(validate_column_name("col'").is_err());
        assert!(validate_column_name("col\"").is_err());
        assert!(validate_column_name("table.col").is_err());
    }

    #[test]
    fn test_column_name_not_in_allowlist() {
        // Valid regex but not in ALLOWED_COLUMNS
        let res = validate_column_name("nonexistent_column_xyz");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("allowed columns"));
    }

    #[test]
    fn test_underscore_prefix_allowed() {
        // _foo passes regex but is not in allowlist
        let res = validate_column_name("_foo");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("allowed columns"));
    }

    // ── validate_table ────────────────────────────────────────

    #[test]
    fn test_valid_tables() {
        assert!(validate_table("users").is_ok());
        assert!(validate_table("tasks").is_ok());
        assert!(validate_table("sync_meta").is_ok());
    }

    #[test]
    fn test_invalid_tables() {
        assert!(validate_table("sqlite_master").is_err());
        assert!(validate_table("").is_err());
        assert!(validate_table("users; DROP TABLE users").is_err());
    }

    // ── session token ─────────────────────────────────────────

    #[test]
    fn test_generate_session_token_length() {
        let token = generate_session_token();
        assert_eq!(token.len(), 64); // 32 bytes → 64 hex chars
    }

    #[test]
    fn test_generate_session_token_uniqueness() {
        let t1 = generate_session_token();
        let t2 = generate_session_token();
        assert_ne!(t1, t2);
    }

    #[test]
    fn test_generate_session_token_hex_only() {
        let token = generate_session_token();
        assert!(token.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_validate_session_success() {
        let state = AppState {
            db: Mutex::new(Connection::open_in_memory().unwrap()),
            session_token: Mutex::new(Some("abc123".to_string())),
        };
        assert!(validate_session(&state, "abc123").is_ok());
    }

    #[test]
    fn test_validate_session_wrong_token() {
        let state = AppState {
            db: Mutex::new(Connection::open_in_memory().unwrap()),
            session_token: Mutex::new(Some("abc123".to_string())),
        };
        assert!(validate_session(&state, "wrong").is_err());
    }

    #[test]
    fn test_validate_session_no_token_set() {
        let state = AppState {
            db: Mutex::new(Connection::open_in_memory().unwrap()),
            session_token: Mutex::new(None),
        };
        assert!(validate_session(&state, "anything").is_err());
    }

    // ── LifeOsError display ───────────────────────────────────

    #[test]
    fn test_error_display() {
        let e = LifeOsError::InvalidTable("evil".to_string());
        assert_eq!(e.to_string(), "Table 'evil' is not allowed");

        let e = LifeOsError::InvalidColumn("x;y".to_string(), "bad char".to_string());
        assert!(e.to_string().contains("x;y"));

        let e = LifeOsError::Unauthorized;
        assert_eq!(e.to_string(), "Invalid session token");

        let e = LifeOsError::RawQueryDisabled;
        assert!(e.to_string().contains("disabled"));
    }

    // ── SQL injection patterns ────────────────────────────────

    #[test]
    fn test_sql_injection_column_attempts() {
        // Classic injection vectors must all fail
        let attacks = vec![
            "id; DROP TABLE users --",
            "id' OR '1'='1",
            "id\" OR \"1\"=\"1",
            "1 UNION SELECT * FROM sqlite_master",
            "id/**/OR/**/1=1",
            "id\0",
            "../../../etc/passwd",
        ];
        for attack in attacks {
            assert!(
                validate_column_name(attack).is_err(),
                "Should reject: {}",
                attack
            );
        }
    }
}
