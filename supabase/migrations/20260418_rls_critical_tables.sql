-- ══════════════════════════════════════════════════════════════
-- LifeOS RLS Migration — Secure All User Data Tables
-- ══════════════════════════════════════════════════════════════
-- 
-- "As above, so below" — The Principle of Correspondence.
-- Security at the row level mirrors security at the whole.
-- Every user's data is sacred. Every table needs a guardian.
--
-- Run this in the Supabase SQL Editor.
-- This is idempotent — safe to run multiple times.
-- ══════════════════════════════════════════════════════════════

-- ── PRIORITY 1: Financial Data (Most Sensitive) ──

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- Expenses
CREATE POLICY "Users can view own expenses" ON expenses FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own expenses" ON expenses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own expenses" ON expenses FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own expenses" ON expenses FOR DELETE USING (user_id = auth.uid());

-- Income
CREATE POLICY "Users can view own income" ON income FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own income" ON income FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own income" ON income FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own income" ON income FOR DELETE USING (user_id = auth.uid());

-- Budgets
CREATE POLICY "Users can view own budgets" ON budgets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own budgets" ON budgets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own budgets" ON budgets FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own budgets" ON budgets FOR DELETE USING (user_id = auth.uid());

-- Recurring Transactions
CREATE POLICY "Users can view own recurring transactions" ON recurring_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own recurring transactions" ON recurring_transactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own recurring transactions" ON recurring_transactions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own recurring transactions" ON recurring_transactions FOR DELETE USING (user_id = auth.uid());

-- Bills
CREATE POLICY "Users can view own bills" ON bills FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own bills" ON bills FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own bills" ON bills FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own bills" ON bills FOR DELETE USING (user_id = auth.uid());

-- Clients
CREATE POLICY "Users can view own clients" ON clients FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own clients" ON clients FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own clients" ON clients FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own clients" ON clients FOR DELETE USING (user_id = auth.uid());

-- Expense Categories
CREATE POLICY "Users can view own expense categories" ON expense_categories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own expense categories" ON expense_categories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own expense categories" ON expense_categories FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own expense categories" ON expense_categories FOR DELETE USING (user_id = auth.uid());

-- ── PRIORITY 2: Health Data (Personal & Sensitive) ──

ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health metrics" ON health_metrics FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own health metrics" ON health_metrics FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own health metrics" ON health_metrics FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own health metrics" ON health_metrics FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view own workout templates" ON workout_templates FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own workout templates" ON workout_templates FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own workout templates" ON workout_templates FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own workout templates" ON workout_templates FOR DELETE USING (user_id = auth.uid());

-- ── PRIORITY 3: Journal (Deeply Personal) ──

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entries" ON journal_entries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own journal entries" ON journal_entries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own journal entries" ON journal_entries FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own journal entries" ON journal_entries FOR DELETE USING (user_id = auth.uid());

-- ── PRIORITY 4: Goals & Tasks (Core Productivity) ──

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (user_id = auth.uid());

-- ── PRIORITY 5: Habits (Daily Rhythm) ──

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habits" ON habits FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own habits" ON habits FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own habits" ON habits FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own habits" ON habits FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view own habit logs" ON habit_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own habit logs" ON habit_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own habit logs" ON habit_logs FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own habit logs" ON habit_logs FOR DELETE USING (user_id = auth.uid());

-- ── PRIORITY 6: Schedule ──

ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedule events" ON schedule_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own schedule events" ON schedule_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own schedule events" ON schedule_events FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own schedule events" ON schedule_events FOR DELETE USING (user_id = auth.uid());

-- ── PRIORITY 7: User Profile & Gamification ──

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own XP" ON user_xp FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own XP" ON user_xp FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own XP" ON user_xp FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own achievements" ON user_achievements FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own achievements" ON user_achievements FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own achievements" ON user_achievements FOR DELETE USING (user_id = auth.uid());

-- ── PRIORITY 8: AI Chat & Social ──

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat messages" ON chat_messages FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own chat messages" ON chat_messages FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own chat messages" ON chat_messages FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view own chat attachments" ON chat_attachments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own chat attachments" ON chat_attachments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own chat attachments" ON chat_attachments FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view own partnerships" ON partnerships FOR SELECT USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "Users can insert own partnerships" ON partnerships FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own partnerships" ON partnerships FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own public profile" ON public_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own public profile" ON public_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own public profile" ON public_profiles FOR UPDATE USING (user_id = auth.uid());

-- ── PRIORITY 9: Business ──

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own businesses" ON businesses FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own businesses" ON businesses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own businesses" ON businesses FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own businesses" ON businesses FOR DELETE USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION: Check RLS status on all user tables
-- ══════════════════════════════════════════════════════════════

-- Run this query after applying the migration to verify:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND rowsecurity = true
-- ORDER BY tablename;