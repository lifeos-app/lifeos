-- Migration 005: Source Tracking + Schedule Intelligence
-- Adds source tracking for "feedback without feedback" analysis
-- Adds schedule_preference fields for auto-scheduling

-- 1. Source tracking on goals
ALTER TABLE goals ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
-- Values: 'manual', 'onboarding_ai', 'chat_ai', 'import'
ALTER TABLE goals ADD COLUMN IF NOT EXISTS source_conversation_id UUID;
-- Links to onboarding_conversations table for traceability
ALTER TABLE goals ADD COLUMN IF NOT EXISTS source_prompt TEXT;
-- The user input that generated this goal (for analysis)

-- 2. Source tracking on tasks  
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_conversation_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_prompt TEXT;

-- 3. Source tracking on habits
ALTER TABLE habits ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS source_conversation_id UUID;

-- 4. Schedule preferences on user_profiles (for auto-scheduling)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS schedule_preferences JSONB DEFAULT '{}';
-- Structure: {
--   "wake_time": "05:00",
--   "sleep_time": "21:00",  
--   "work_blocks": [{"days": [1,2,3,4,5], "start": "09:00", "end": "17:00", "label": "Work"}],
--   "blocked_times": [{"days": [5,6], "start": "19:00", "end": "00:30", "label": "Security shift"}],
--   "preferred_focus_time": "morning",
--   "shift_pattern": "standard" | "night" | "rotating" | "custom"
-- }

-- 5. Index for source analysis queries
CREATE INDEX IF NOT EXISTS idx_goals_source ON goals(source) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_habits_source ON habits(source);

-- 6. Analysis view: AI-generated content summary per user
CREATE OR REPLACE VIEW ai_generated_summary AS
SELECT 
  g.user_id,
  g.source,
  g.category,
  COUNT(*) as count,
  COUNT(DISTINCT g.title) as unique_titles,
  COUNT(*) - COUNT(DISTINCT g.title) as duplicate_count
FROM goals g
WHERE g.is_deleted = false
GROUP BY g.user_id, g.source, g.category;
