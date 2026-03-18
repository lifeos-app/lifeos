-- LifeOS Systems — Connected Systems & Sync Log
-- Migration 006: System Bus persistence layer
--
-- connected_systems: stores which external systems a user has connected
-- system_sync_log: audit trail of sync events
--
-- Security: RLS ensures users can only see/manage their own connections

-- ── connected_systems ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connected_systems (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  system_id   TEXT NOT NULL,                          -- e.g. 'tcs', 'fitness-pro'
  config      JSONB NOT NULL DEFAULT '{}',            -- encrypted config (Supabase URL, keys, etc.)
  status      TEXT NOT NULL DEFAULT 'connected'       -- 'connected', 'disconnected', 'error'
    CHECK (status IN ('connected', 'disconnected', 'error')),
  error_msg   TEXT,                                   -- last error message if status = 'error'
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Each user can only have one connection per system
  UNIQUE(user_id, system_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connected_systems_user 
  ON connected_systems(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_systems_system 
  ON connected_systems(system_id);
CREATE INDEX IF NOT EXISTS idx_connected_systems_status 
  ON connected_systems(status);

-- RLS
ALTER TABLE connected_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own system connections"
  ON connected_systems FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own system connections"
  ON connected_systems FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own system connections"
  ON connected_systems FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own system connections"
  ON connected_systems FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_connected_systems_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_connected_systems_updated
  BEFORE UPDATE ON connected_systems
  FOR EACH ROW
  EXECUTE FUNCTION update_connected_systems_timestamp();

-- ── system_sync_log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_sync_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  system_id   TEXT NOT NULL,
  event_type  TEXT NOT NULL,                          -- 'connect', 'disconnect', 'sync', 'error'
  data        JSONB DEFAULT '{}',                     -- event-specific payload
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sync_log_user 
  ON system_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_system 
  ON system_sync_log(system_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_type 
  ON system_sync_log(event_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_time 
  ON system_sync_log(synced_at DESC);

-- RLS
ALTER TABLE system_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs"
  ON system_sync_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync logs"
  ON system_sync_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE — sync log is append-only

-- ── Helper: log a sync event ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_system_event(
  p_user_id  UUID,
  p_system_id TEXT,
  p_event_type TEXT,
  p_data     JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO system_sync_log (user_id, system_id, event_type, data)
  VALUES (p_user_id, p_system_id, p_event_type, p_data)
  RETURNING id INTO v_id;
  
  -- Also update connected_systems last_sync_at
  UPDATE connected_systems
  SET last_sync_at = now()
  WHERE user_id = p_user_id AND system_id = p_system_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
