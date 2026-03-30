-- LifeOS Database Schema
-- Shared by Tauri (lib.rs), Flask (app.py), and Electron (database.js)

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
    icon TEXT DEFAULT '?',
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
    icon TEXT DEFAULT '?',
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
