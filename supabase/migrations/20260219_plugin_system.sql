-- LifeOS Plugin System Migration
-- Created: 2026-02-19
-- Purpose: Generic plugin pipeline (TCS, Shopify, gym apps, etc.) + activity feed

-- ════════════════════════════════════════════════════════
-- PLUGIN CONFIGURATIONS
-- ════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plugins (
  id          TEXT PRIMARY KEY,                          -- 'tcs', 'shopify', etc.
  name        TEXT NOT NULL,
  icon        TEXT,                                      -- emoji
  color       TEXT,                                      -- hex colour for UI
  description TEXT,
  enabled     BOOLEAN DEFAULT true,
  webhook_secret TEXT,                                   -- HMAC-SHA256 secret (stored hashed ideally)
  config      JSONB DEFAULT '{}',                        -- plugin-specific settings
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- One plugin config per user per plugin
CREATE UNIQUE INDEX IF NOT EXISTS plugins_user_id_id_idx ON plugins (user_id, id);

ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plugins"
  ON plugins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plugins"
  ON plugins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plugins"
  ON plugins FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plugins"
  ON plugins FOR DELETE
  USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════
-- PLUGIN EVENT LOG
-- ════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plugin_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id   TEXT NOT NULL,                             -- 'tcs', 'shopify', etc.
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,                             -- 'job_complete', 'sale', etc.
  data        JSONB DEFAULT '{}',                        -- raw event payload
  result      JSONB DEFAULT '{}',                        -- processing result
  processed   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plugin_events_user_id_idx      ON plugin_events (user_id);
CREATE INDEX IF NOT EXISTS plugin_events_plugin_id_idx    ON plugin_events (plugin_id);
CREATE INDEX IF NOT EXISTS plugin_events_created_at_idx   ON plugin_events (created_at DESC);
CREATE INDEX IF NOT EXISTS plugin_events_processed_idx    ON plugin_events (processed) WHERE processed = false;

ALTER TABLE plugin_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plugin events"
  ON plugin_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plugin events"
  ON plugin_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plugin events"
  ON plugin_events FOR UPDATE
  USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════
-- PLUGIN ACTIVITY FEED
-- ════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plugin_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id   TEXT NOT NULL,                             -- 'tcs', 'shopify', etc.
  title       TEXT NOT NULL,                             -- "Sonder clean ✅ +35 XP"
  description TEXT,
  icon        TEXT,                                      -- emoji
  xp_earned   INTEGER DEFAULT 0,
  metadata    JSONB DEFAULT '{}',                        -- { amount, client, etc. }
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plugin_activity_user_id_idx    ON plugin_activity (user_id);
CREATE INDEX IF NOT EXISTS plugin_activity_created_at_idx ON plugin_activity (created_at DESC);
CREATE INDEX IF NOT EXISTS plugin_activity_plugin_id_idx  ON plugin_activity (plugin_id);

ALTER TABLE plugin_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plugin activity"
  ON plugin_activity FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plugin activity"
  ON plugin_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plugin activity"
  ON plugin_activity FOR DELETE
  USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════
-- DEFAULT PLUGIN SEED DATA (skips if already exists)
-- ════════════════════════════════════════════════════════
-- NOTE: These are template rows — user_id is NULL (system defaults).
-- When a user enables a plugin, a row with their user_id is created.

-- No seed data required — plugins are created per-user on first enable.
