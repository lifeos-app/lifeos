-- LifeOS Social v2 — Friends System + Ladder Classes
-- Migration: 20260219_social_v2_friends_ladder
-- Run after: 20260219_social_schema.sql

-- ══════════════════════════════════════════════════════
-- 1. ADD connection_type TO partnerships
--    Distinguish "friend" (social) vs "accountability_partner" (deliberate)
-- ══════════════════════════════════════════════════════
ALTER TABLE partnerships
  ADD COLUMN IF NOT EXISTS connection_type TEXT
    DEFAULT 'accountability_partner'
    CHECK (connection_type IN ('friend', 'accountability_partner'));

-- Existing rows without a type default to 'accountability_partner'
UPDATE partnerships SET connection_type = 'accountability_partner'
  WHERE connection_type IS NULL;

-- ══════════════════════════════════════════════════════
-- 2. ADD ladder + ladder_rank TO public_profiles
--    Ladder = the user's chosen path (Builder, Scholar, etc.)
--    Ladder rank = the rank title within that ladder at current level
-- ══════════════════════════════════════════════════════
ALTER TABLE public_profiles
  ADD COLUMN IF NOT EXISTS ladder TEXT
    DEFAULT NULL
    CHECK (ladder IN ('builder', 'scholar', 'innovator', 'athlete', 'creator', 'grower'));

ALTER TABLE public_profiles
  ADD COLUMN IF NOT EXISTS ladder_rank TEXT DEFAULT NULL;

-- ══════════════════════════════════════════════════════
-- 3. ADD last_seen_at — more granular than last_active_at
--    Updated on every meaningful action (not just daily)
-- ══════════════════════════════════════════════════════
ALTER TABLE public_profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();

-- Seed last_seen_at from last_active_at for existing rows
UPDATE public_profiles SET last_seen_at = last_active_at
  WHERE last_seen_at IS NULL;

-- ══════════════════════════════════════════════════════
-- 4. ADD blocked_by TO partnerships
--    Track who initiated a block (for enforcement)
-- ══════════════════════════════════════════════════════
ALTER TABLE partnerships
  ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- ══════════════════════════════════════════════════════
-- 5. CREATE friendships VIEW
--    Convenience view: accepted friendships (connection_type = 'friend')
-- ══════════════════════════════════════════════════════
CREATE OR REPLACE VIEW accepted_friendships AS
SELECT
  id,
  requester_id,
  responder_id,
  message,
  created_at,
  updated_at
FROM partnerships
WHERE status = 'accepted'
  AND connection_type = 'friend';

-- ══════════════════════════════════════════════════════
-- 6. CREATE accountability_partnerships VIEW
-- ══════════════════════════════════════════════════════
CREATE OR REPLACE VIEW accepted_accountability_partners AS
SELECT
  id,
  requester_id,
  responder_id,
  message,
  created_at,
  updated_at
FROM partnerships
WHERE status = 'accepted'
  AND connection_type = 'accountability_partner';

-- ══════════════════════════════════════════════════════
-- 7. INDEX for connection_type queries
-- ══════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_partnerships_type
  ON partnerships(connection_type);

CREATE INDEX IF NOT EXISTS idx_partnerships_type_status
  ON partnerships(connection_type, status);

-- ══════════════════════════════════════════════════════
-- 8. INDEX for ladder queries on public_profiles
-- ══════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_public_profiles_ladder
  ON public_profiles(ladder)
  WHERE ladder IS NOT NULL;

-- ══════════════════════════════════════════════════════
-- 9. FUNCTION: auto-update last_seen_at on message send
-- ══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION touch_sender_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public_profiles
    SET last_seen_at = now(), last_active_at = now()
  WHERE user_id = NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_touch_sender ON messages;
CREATE TRIGGER messages_touch_sender
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION touch_sender_last_seen();

-- ══════════════════════════════════════════════════════
-- NOTES FOR DEVELOPER
-- ══════════════════════════════════════════════════════
-- After running this migration:
--   1. partnerships.connection_type distinguishes friend vs accountability partner
--   2. public_profiles.ladder stores the user's path (builder/scholar/etc.)
--   3. public_profiles.ladder_rank stores the rank title at their current level
--   4. When a user completes onboarding, set their ladder based on primary_focus
--   5. Run syncProfileLadder(userId) after onboarding to set ladder + ladder_rank
