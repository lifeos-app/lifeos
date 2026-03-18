-- LifeOS Gamification Engine — Database Schema
-- Migration 006: XP, Achievements, Quests tables

-- ══════════════════════════════════════════════════════
-- 1. USER XP — core level/XP tracking per user
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_xp (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp  INTEGER NOT NULL DEFAULT 0,
  level     INTEGER NOT NULL DEFAULT 1,
  title     TEXT NOT NULL DEFAULT 'Awakened',
  stats     JSONB NOT NULL DEFAULT '{"productivity":0,"consistency":0,"health":0,"finance":0,"knowledge":0,"social":0}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own XP"
  ON user_xp FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own XP"
  ON user_xp FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own XP"
  ON user_xp FOR UPDATE
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════
-- 2. XP EVENTS — audit log of every XP award
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS xp_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  xp_amount   INTEGER NOT NULL,
  multiplier  REAL NOT NULL DEFAULT 1.0,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_xp_events_user_created
  ON xp_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_xp_events_user_action
  ON xp_events(user_id, action_type);

-- RLS
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own XP events"
  ON xp_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own XP events"
  ON xp_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════
-- 3. ACHIEVEMENTS — user achievement progress + unlocks
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS achievements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  progress       INTEGER NOT NULL DEFAULT 0,
  unlocked_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_achievements_user
  ON achievements(user_id);

-- RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements"
  ON achievements FOR UPDATE
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════
-- 4. QUESTS — daily/weekly/epic quests
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS quests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_type   TEXT NOT NULL CHECK (quest_type IN ('daily', 'weekly', 'epic')),
  quest_data   JSONB NOT NULL,
  progress     INTEGER NOT NULL DEFAULT 0,
  target       INTEGER NOT NULL DEFAULT 1,
  reward_xp    INTEGER NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quests_user_type
  ON quests(user_id, quest_type);

CREATE INDEX IF NOT EXISTS idx_quests_user_active
  ON quests(user_id, completed_at, expires_at);

-- RLS
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quests"
  ON quests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quests"
  ON quests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quests"
  ON quests FOR UPDATE
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════
-- 5. Enable REALTIME for xp_events (for live XP ticker)
-- ══════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE xp_events;
ALTER PUBLICATION supabase_realtime ADD TABLE user_xp;
ALTER PUBLICATION supabase_realtime ADD TABLE achievements;
ALTER PUBLICATION supabase_realtime ADD TABLE quests;
