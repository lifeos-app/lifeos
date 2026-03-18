-- ══════════════════════════════════════════════════════════════════════════════
-- Quest Engine v2 Migration
-- Adds contextual quest fields to `quests` table and creates
-- `plugin_quest_suggestions` for external system integration.
--
-- Run this in the Supabase SQL editor.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. EXTEND THE QUESTS TABLE ────────────────────────────────────────────────
-- Add v2 columns. All nullable / default-safe so existing rows are untouched.

ALTER TABLE quests
  ADD COLUMN IF NOT EXISTS source_type   text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS source_id     text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_table  text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS priority      text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS context_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category      text NOT NULL DEFAULT 'productivity',
  ADD COLUMN IF NOT EXISTS v2_title      text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS v2_description text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS v2_icon       text          DEFAULT NULL;

-- Validate enums without breaking existing rows
ALTER TABLE quests
  DROP CONSTRAINT IF EXISTS quests_source_type_check,
  ADD  CONSTRAINT quests_source_type_check
       CHECK (source_type IN ('task', 'habit', 'goal', 'finance', 'plugin', 'system'));

ALTER TABLE quests
  DROP CONSTRAINT IF EXISTS quests_priority_check,
  ADD  CONSTRAINT quests_priority_check
       CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

ALTER TABLE quests
  DROP CONSTRAINT IF EXISTS quests_category_check,
  ADD  CONSTRAINT quests_category_check
       CHECK (category IN ('productivity', 'health', 'finance', 'consistency', 'growth'));

-- Faster look-up for active contextual quests per user
CREATE INDEX IF NOT EXISTS quests_user_source_active
  ON quests (user_id, source_type, quest_type)
  WHERE completed_at IS NULL;

-- ── 2. PLUGIN QUEST SUGGESTIONS TABLE ────────────────────────────────────────
-- External systems (TCS, Shopify, finance apps, etc.) write rows here.
-- Quest Engine v2 reads + consumes them during daily generation.

CREATE TABLE IF NOT EXISTS plugin_quest_suggestions (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plugin_id    text        NOT NULL,                         -- 'tcs', 'shopify', 'finance', …
  title        text        NOT NULL,
  description  text        NOT NULL,
  icon         text        NOT NULL DEFAULT '🔌',
  category     text        NOT NULL DEFAULT 'productivity'
               CHECK (category IN ('productivity', 'health', 'finance', 'consistency', 'growth')),
  reward_xp    integer     NOT NULL DEFAULT 50 CHECK (reward_xp > 0),
  priority     text        NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  metadata     jsonb       NOT NULL DEFAULT '{}',            -- plugin-specific payload
  consumed_at  timestamptz          DEFAULT NULL,            -- set when a quest was created
  expires_at   timestamptz          DEFAULT NULL,            -- NULL = never expires
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Efficient lookup: unconsumed, non-expired suggestions for a user
CREATE INDEX IF NOT EXISTS plugin_quest_suggestions_user_active
  ON plugin_quest_suggestions (user_id, consumed_at, created_at DESC)
  WHERE consumed_at IS NULL;

-- ── 3. ROW LEVEL SECURITY ─────────────────────────────────────────────────────

ALTER TABLE plugin_quest_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can view their own suggestions
CREATE POLICY IF NOT EXISTS "pqs_select_own"
  ON plugin_quest_suggestions FOR SELECT
  USING (auth.uid() = user_id);

-- Users (and plugins acting on behalf of a user) can insert suggestions
CREATE POLICY IF NOT EXISTS "pqs_insert_own"
  ON plugin_quest_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own suggestions (mark consumed, dismiss, etc.)
CREATE POLICY IF NOT EXISTS "pqs_update_own"
  ON plugin_quest_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own suggestions
CREATE POLICY IF NOT EXISTS "pqs_delete_own"
  ON plugin_quest_suggestions FOR DELETE
  USING (auth.uid() = user_id);

-- ── 4. BACKFILL: mark all existing v1 quests as source_type = 'system' ────────
-- Already handled by the DEFAULT 'system' above, so nothing extra needed.
-- This comment is here for documentation only.
