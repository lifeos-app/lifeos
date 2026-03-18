-- LifeOS Finance Schema Migration
-- Run date: 2026-02-11
-- Creates: expense_categories, businesses, transactions, budgets
-- Alters: tasks, schedule_events, clients, goals
-- This is the consolidated migration — all 11 scripts in one file

-- ══════════════════════════════════════════
-- NEW TABLES
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#64748B',
  scope TEXT DEFAULT 'personal',
  budget_monthly DECIMAL(10,2) DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'business',
  icon TEXT DEFAULT '💼',
  color TEXT DEFAULT '#00D4FF',
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  title TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id TEXT REFERENCES expense_categories(id),
  business_id TEXT REFERENCES businesses(id),
  client_id TEXT REFERENCES clients(id),
  task_id TEXT REFERENCES tasks(id),
  event_id TEXT REFERENCES schedule_events(id),
  notes TEXT,
  recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  category_id TEXT REFERENCES expense_categories(id),
  month TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════
-- RLS (separate policies per operation — matches working tables)
-- ══════════════════════════════════════════

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_select_own" ON expense_categories FOR SELECT USING (user_id = auth.uid()::TEXT);
CREATE POLICY "categories_insert_own" ON expense_categories FOR INSERT WITH CHECK (user_id = auth.uid()::TEXT);
CREATE POLICY "categories_update_own" ON expense_categories FOR UPDATE USING (user_id = auth.uid()::TEXT);
CREATE POLICY "categories_delete_own" ON expense_categories FOR DELETE USING (user_id = auth.uid()::TEXT);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "businesses_select_own" ON businesses FOR SELECT USING (user_id = auth.uid()::TEXT);
CREATE POLICY "businesses_insert_own" ON businesses FOR INSERT WITH CHECK (user_id = auth.uid()::TEXT);
CREATE POLICY "businesses_update_own" ON businesses FOR UPDATE USING (user_id = auth.uid()::TEXT);
CREATE POLICY "businesses_delete_own" ON businesses FOR DELETE USING (user_id = auth.uid()::TEXT);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_select_own" ON transactions FOR SELECT USING (user_id = auth.uid()::TEXT);
CREATE POLICY "transactions_insert_own" ON transactions FOR INSERT WITH CHECK (user_id = auth.uid()::TEXT);
CREATE POLICY "transactions_update_own" ON transactions FOR UPDATE USING (user_id = auth.uid()::TEXT);
CREATE POLICY "transactions_delete_own" ON transactions FOR DELETE USING (user_id = auth.uid()::TEXT);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_select_own" ON budgets FOR SELECT USING (user_id = auth.uid()::TEXT);
CREATE POLICY "budgets_insert_own" ON budgets FOR INSERT WITH CHECK (user_id = auth.uid()::TEXT);
CREATE POLICY "budgets_update_own" ON budgets FOR UPDATE USING (user_id = auth.uid()::TEXT);
CREATE POLICY "budgets_delete_own" ON budgets FOR DELETE USING (user_id = auth.uid()::TEXT);

-- ══════════════════════════════════════════
-- ALTER EXISTING TABLES
-- ══════════════════════════════════════════

-- Tasks: financial fields
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS financial_amount DECIMAL(10,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS financial_type TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS financial_category_id TEXT REFERENCES expense_categories(id);

-- Schedule events: financial fields
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS financial_amount DECIMAL(10,2);
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS financial_type TEXT;
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS financial_category_id TEXT REFERENCES expense_categories(id);

-- Clients: link to business
ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_id TEXT REFERENCES businesses(id);

-- Goals: enhanced objective fields
ALTER TABLE goals ADD COLUMN IF NOT EXISTS budget_allocated DECIMAL(10,2);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS financial_type TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS expected_return DECIMAL(10,2);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS business_id TEXT REFERENCES businesses(id);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS estimated_hours INT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS deadline_type TEXT DEFAULT 'soft';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS success_criteria TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS key_results TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS resources TEXT;
