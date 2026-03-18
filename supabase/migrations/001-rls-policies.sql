-- =====================================================================
-- RLS Policy Fix Migration
-- Generated: 2026-03-02
-- Purpose: Fix weak RLS policies and remove duplicate policies
--
-- CRITICAL SECURITY FIX:
-- Several tables currently allow ANY authenticated user to access
-- ANY data. This migration fixes user_id filtering to ensure
-- proper data isolation.
-- =====================================================================

-- =====================================================================
-- PART 1: Remove Duplicate RLS Policies
-- =====================================================================
-- Based on audit findings: goals (12→4), transactions (12→4),
-- tasks (8→4), businesses (8→4), habits (8→4), user_profiles (6→4),
-- plugin_quest_suggestions (8→4)
-- =====================================================================

-- Goals table: Remove duplicate policies (keep *_own variants)
DROP POLICY IF EXISTS "Users can delete their own goals" ON goals;
DROP POLICY IF EXISTS "Users can insert their own goals" ON goals;
DROP POLICY IF EXISTS "Users can select their own goals" ON goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON goals;
DROP POLICY IF EXISTS "goals_delete" ON goals;
DROP POLICY IF EXISTS "goals_insert" ON goals;
DROP POLICY IF EXISTS "goals_select" ON goals;
DROP POLICY IF EXISTS "goals_update" ON goals;
-- Keep: goals_delete_own, goals_insert_own, goals_select_own, goals_update_own

-- Transactions table: Remove duplicate policies
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can select their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "transactions_delete" ON transactions;
DROP POLICY IF EXISTS "transactions_insert" ON transactions;
DROP POLICY IF EXISTS "transactions_select" ON transactions;
DROP POLICY IF EXISTS "transactions_update" ON transactions;

-- Tasks table: Remove duplicate policies
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can select their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;

-- Businesses table: Remove duplicate policies
DROP POLICY IF EXISTS "Users can delete their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can insert their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can select their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can update their own businesses" ON businesses;

-- Habits table: Remove duplicate policies
DROP POLICY IF EXISTS "Users can delete their own habits" ON habits;
DROP POLICY IF EXISTS "Users can insert their own habits" ON habits;
DROP POLICY IF EXISTS "Users can select their own habits" ON habits;
DROP POLICY IF EXISTS "Users can update their own habits" ON habits;

-- User profiles: Remove duplicate policies
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;

-- Plugin quest suggestions: Remove duplicate policies
DROP POLICY IF EXISTS "Users can delete their own suggestions" ON plugin_quest_suggestions;
DROP POLICY IF EXISTS "Users can insert their own suggestions" ON plugin_quest_suggestions;
DROP POLICY IF EXISTS "Users can select their own suggestions" ON plugin_quest_suggestions;
DROP POLICY IF EXISTS "Users can update their own suggestions" ON plugin_quest_suggestions;

-- =====================================================================
-- PART 2: Fix Weak RLS Policies (CRITICAL SECURITY)
-- =====================================================================
-- These tables currently use "auth.uid() IS NOT NULL" which allows
-- ANY authenticated user to access ANY data. This is a critical
-- security vulnerability in multi-user deployments.
-- =====================================================================

-- ------------------------------
-- Categories table
-- ------------------------------
-- CURRENT ISSUE: Any authenticated user can read/write/delete ANY category
-- FIX: Add proper user_id filtering

-- First, add user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'categories'
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE categories ADD COLUMN user_id UUID REFERENCES auth.users(id);

        -- Migrate existing categories to first user (or mark as system)
        -- WARNING: Review this migration carefully for your use case
        UPDATE categories SET user_id = (
            SELECT id FROM auth.users LIMIT 1
        ) WHERE user_id IS NULL;

        -- Make user_id NOT NULL after migration
        ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- Drop weak policies
DROP POLICY IF EXISTS "Categories are viewable by authenticated users" ON categories;
DROP POLICY IF EXISTS "Categories can be created by authenticated users" ON categories;
DROP POLICY IF EXISTS "Categories can be updated by authenticated users" ON categories;
DROP POLICY IF EXISTS "Categories can be deleted by authenticated users" ON categories;

-- Create proper user-scoped policies
CREATE POLICY "Users can view own categories"
    ON categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own categories"
    ON categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
    ON categories FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
    ON categories FOR DELETE
    USING (auth.uid() = user_id);

-- ------------------------------
-- Tags table
-- ------------------------------
-- CURRENT ISSUE: Any authenticated user can read/write ANY tag
-- FIX: Add proper user_id filtering

-- Add user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tags'
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE tags ADD COLUMN user_id UUID REFERENCES auth.users(id);

        -- Migrate existing tags
        UPDATE tags SET user_id = (
            SELECT id FROM auth.users LIMIT 1
        ) WHERE user_id IS NULL;

        ALTER TABLE tags ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- Drop weak policies
DROP POLICY IF EXISTS "Tags are viewable by authenticated users" ON tags;
DROP POLICY IF EXISTS "Tags can be created by authenticated users" ON tags;
DROP POLICY IF EXISTS "Tags can be updated by authenticated users" ON tags;
DROP POLICY IF EXISTS "Tags can be deleted by authenticated users" ON tags;

-- Create proper user-scoped policies
CREATE POLICY "Users can view own tags"
    ON tags FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tags"
    ON tags FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags"
    ON tags FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags"
    ON tags FOR DELETE
    USING (auth.uid() = user_id);

-- ------------------------------
-- Entity tags table
-- ------------------------------
-- CURRENT ISSUE: Any authenticated user can read/write/delete ANY entity tag
-- FIX: Add proper user_id filtering

-- Add user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'entity_tags'
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE entity_tags ADD COLUMN user_id UUID REFERENCES auth.users(id);

        -- Migrate existing entity_tags
        UPDATE entity_tags SET user_id = (
            SELECT id FROM auth.users LIMIT 1
        ) WHERE user_id IS NULL;

        ALTER TABLE entity_tags ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- Drop weak policies
DROP POLICY IF EXISTS "Entity tags are viewable by authenticated users" ON entity_tags;
DROP POLICY IF EXISTS "Entity tags can be created by authenticated users" ON entity_tags;
DROP POLICY IF EXISTS "Entity tags can be updated by authenticated users" ON entity_tags;
DROP POLICY IF EXISTS "Entity tags can be deleted by authenticated users" ON entity_tags;

-- Create proper user-scoped policies
CREATE POLICY "Users can view own entity_tags"
    ON entity_tags FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own entity_tags"
    ON entity_tags FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entity_tags"
    ON entity_tags FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own entity_tags"
    ON entity_tags FOR DELETE
    USING (auth.uid() = user_id);

-- ------------------------------
-- Attachments table
-- ------------------------------
-- CURRENT ISSUE: Any authenticated user can read/write/delete ANY attachment
-- FIX: Add proper user_id filtering

-- Add user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attachments'
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE attachments ADD COLUMN user_id UUID REFERENCES auth.users(id);

        -- Migrate existing attachments
        UPDATE attachments SET user_id = (
            SELECT id FROM auth.users LIMIT 1
        ) WHERE user_id IS NULL;

        ALTER TABLE attachments ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- Drop weak policies
DROP POLICY IF EXISTS "Attachments are viewable by authenticated users" ON attachments;
DROP POLICY IF EXISTS "Attachments can be created by authenticated users" ON attachments;
DROP POLICY IF EXISTS "Attachments can be updated by authenticated users" ON attachments;
DROP POLICY IF EXISTS "Attachments can be deleted by authenticated users" ON attachments;

-- Create proper user-scoped policies
CREATE POLICY "Users can view own attachments"
    ON attachments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own attachments"
    ON attachments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attachments"
    ON attachments FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own attachments"
    ON attachments FOR DELETE
    USING (auth.uid() = user_id);

-- ------------------------------
-- Sprint tasks table
-- ------------------------------
-- CURRENT ISSUE: Any authenticated user can read/write ANY sprint task
-- FIX: Add proper user_id filtering

-- Add user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sprint_tasks'
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE sprint_tasks ADD COLUMN user_id UUID REFERENCES auth.users(id);

        -- Migrate existing sprint_tasks
        UPDATE sprint_tasks SET user_id = (
            SELECT id FROM auth.users LIMIT 1
        ) WHERE user_id IS NULL;

        ALTER TABLE sprint_tasks ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- Drop weak policies
DROP POLICY IF EXISTS "Sprint tasks are viewable by authenticated users" ON sprint_tasks;
DROP POLICY IF EXISTS "Sprint tasks can be created by authenticated users" ON sprint_tasks;
DROP POLICY IF EXISTS "Sprint tasks can be updated by authenticated users" ON sprint_tasks;
DROP POLICY IF EXISTS "Sprint tasks can be deleted by authenticated users" ON sprint_tasks;

-- Create proper user-scoped policies
CREATE POLICY "Users can view own sprint_tasks"
    ON sprint_tasks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sprint_tasks"
    ON sprint_tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sprint_tasks"
    ON sprint_tasks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sprint_tasks"
    ON sprint_tasks FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================================
-- PART 3: Verification Queries
-- =====================================================================
-- Run these after applying migration to verify correctness
-- =====================================================================

-- Check duplicate policies are removed
-- Should return 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
DO $$
DECLARE
    table_name TEXT;
    policy_count INTEGER;
BEGIN
    FOR table_name IN
        SELECT unnest(ARRAY['goals', 'transactions', 'tasks', 'businesses',
                           'habits', 'user_profiles', 'plugin_quest_suggestions'])
    LOOP
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name;

        IF policy_count > 4 THEN
            RAISE WARNING 'Table % still has % policies (expected 4)', table_name, policy_count;
        END IF;
    END LOOP;
END $$;

-- Check weak RLS is fixed
-- Should return 0 rows (no policies using only auth.uid() IS NOT NULL)
DO $$
DECLARE
    weak_policy RECORD;
BEGIN
    FOR weak_policy IN
        SELECT schemaname, tablename, policyname, qual
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('categories', 'tags', 'entity_tags', 'attachments', 'sprint_tasks')
        AND qual = '(auth.uid() IS NOT NULL)'
    LOOP
        RAISE WARNING 'Weak RLS still exists on %.% (policy: %)',
            weak_policy.schemaname, weak_policy.tablename, weak_policy.policyname;
    END LOOP;
END $$;

-- =====================================================================
-- ROLLBACK SCRIPT (save for emergency)
-- =====================================================================
-- If this migration causes issues, run the following to rollback:
--
-- ALTER TABLE categories DROP COLUMN IF EXISTS user_id;
-- ALTER TABLE tags DROP COLUMN IF EXISTS user_id;
-- ALTER TABLE entity_tags DROP COLUMN IF EXISTS user_id;
-- ALTER TABLE attachments DROP COLUMN IF EXISTS user_id;
-- ALTER TABLE sprint_tasks DROP COLUMN IF EXISTS user_id;
--
-- Then recreate the original weak policies (NOT RECOMMENDED):
-- CREATE POLICY "Categories are viewable by authenticated users"
--     ON categories FOR SELECT
--     USING (auth.uid() IS NOT NULL);
-- ... (repeat for all weak policies)
-- =====================================================================

-- =====================================================================
-- MIGRATION COMPLETE
-- =====================================================================
-- Summary:
-- - Removed duplicate RLS policies on 7 tables
-- - Fixed weak RLS on 5 tables (categories, tags, entity_tags,
--   attachments, sprint_tasks)
-- - Added proper user_id filtering to ensure data isolation
--
-- IMPORTANT: Test thoroughly with 2+ user accounts before deploying
-- to production. Verify that:
-- 1. Users can only see their own data
-- 2. Users cannot see other users' data
-- 3. All existing data is properly migrated
-- =====================================================================
