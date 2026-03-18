-- ═══════════════════════════════════════════════════════════════
-- LIFEOS 009: Goals Revolution — NLP Decomposer + Smart Scheduler
-- Additive only — no drops, no renames, safe for live users
-- ═══════════════════════════════════════════════════════════════

-- Tasks: dependency + scheduling fields
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS depends_on_task_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS energy_level TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS suggested_week INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auto_scheduled BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tasks_depends_on
  ON tasks(depends_on_task_id) WHERE depends_on_task_id IS NOT NULL AND NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled
  ON tasks(scheduled_start, scheduled_end) WHERE scheduled_start IS NOT NULL AND NOT is_deleted;

-- Goals: decomposition metadata
ALTER TABLE goals ADD COLUMN IF NOT EXISTS decomposition_source TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS health_status TEXT;
