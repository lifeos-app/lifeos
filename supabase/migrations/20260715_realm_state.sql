-- ═══════════════════════════════════════════════════
-- The Realm — Persistent game state per user
-- ═══════════════════════════════════════════════════
-- Stores zone unlocks, building levels, collected items,
-- and other realm-specific state that can't be derived
-- from existing tables.

CREATE TABLE IF NOT EXISTS realm_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Zone unlock tracking (derived on load, but cached for quick reads)
  zone_unlocks JSONB DEFAULT '{"life_town": true}'::jsonb NOT NULL,

  -- Building levels (e.g., {"player_house": 2, "library": 1})
  building_levels JSONB DEFAULT '{}'::jsonb NOT NULL,

  -- Collected realm-exclusive items
  collected_items TEXT[] DEFAULT '{}' NOT NULL,

  -- Shadow tracking
  shadows_defeated INTEGER DEFAULT 0 NOT NULL,
  active_shadows JSONB DEFAULT '[]'::jsonb NOT NULL,

  -- Visit tracking
  realm_visits INTEGER DEFAULT 0 NOT NULL,
  total_play_seconds INTEGER DEFAULT 0 NOT NULL,
  last_visited_at TIMESTAMPTZ,

  -- Seasonal event participation
  seasonal_events JSONB DEFAULT '{}'::jsonb NOT NULL,

  -- Player preferences
  music_enabled BOOLEAN DEFAULT true NOT NULL,
  sfx_enabled BOOLEAN DEFAULT true NOT NULL,
  zoom_level REAL DEFAULT 1.0 NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  UNIQUE(user_id)
);

-- Row Level Security
ALTER TABLE realm_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their realm state"
  ON realm_state
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_realm_state_user_id ON realm_state(user_id);

-- ═══════════════════════════════════════════════════
-- Realm events log — tracks significant realm happenings
-- Used for "replay" features and analytics
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS realm_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE realm_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their realm events"
  ON realm_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_realm_events_user_id ON realm_events(user_id);
CREATE INDEX IF NOT EXISTS idx_realm_events_type ON realm_events(event_type);
CREATE INDEX IF NOT EXISTS idx_realm_events_created ON realm_events(created_at DESC);
