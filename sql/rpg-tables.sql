-- RPG System Tables for LifeOS
-- Run via Supabase SQL Editor

-- Character table
CREATE TABLE IF NOT EXISTS rpg_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  class TEXT NOT NULL DEFAULT 'warrior',
  sprite_data JSONB DEFAULT '{}',
  stats JSONB DEFAULT '{}',
  equipment JSONB DEFAULT '[]',
  position JSONB DEFAULT '{"map":"life_town","x":600,"y":400}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rpg_characters ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own character
CREATE POLICY "Users manage own character" ON rpg_characters
  FOR ALL USING (auth.uid() = user_id);

-- Quest log
CREATE TABLE IF NOT EXISTS rpg_quest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID REFERENCES rpg_characters(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL,
  source_type TEXT DEFAULT 'system',
  source_id TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'abandoned')),
  progress FLOAT DEFAULT 0,
  xp_reward INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(character_id, quest_id)
);

ALTER TABLE rpg_quest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own quests" ON rpg_quest_log
  FOR ALL USING (
    character_id IN (SELECT id FROM rpg_characters WHERE user_id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rpg_characters_user ON rpg_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_rpg_quests_character ON rpg_quest_log(character_id);
CREATE INDEX IF NOT EXISTS idx_rpg_quests_status ON rpg_quest_log(status);
