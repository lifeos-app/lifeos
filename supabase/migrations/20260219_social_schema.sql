-- LifeOS Social Schema — Accountability Partners, Messaging, Groups
-- Migration: 20260219_social_schema

-- ══════════════════════════════════════════════════════
-- 1. PUBLIC PROFILES (opt-in sharing)
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public_profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name   TEXT NOT NULL,
  avatar_url     TEXT,
  bio            TEXT,
  -- MapleStory-style visible stats
  level          INTEGER DEFAULT 1,
  title          TEXT DEFAULT 'Newcomer',
  total_xp       INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  -- What they're working on (opt-in)
  featured_goal  TEXT,
  featured_badges TEXT[] DEFAULT '{}',
  -- Privacy controls
  show_goals     BOOLEAN DEFAULT false,
  show_habits    BOOLEAN DEFAULT false,
  show_stats     BOOLEAN DEFAULT true,
  show_streak    BOOLEAN DEFAULT true,
  show_level     BOOLEAN DEFAULT true,
  -- Discovery
  goal_categories TEXT[] DEFAULT '{}',
  looking_for_partner BOOLEAN DEFAULT false,
  -- Activity tracking
  last_active_at TIMESTAMPTZ DEFAULT now(),
  -- Meta
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_profiles_looking
  ON public_profiles(looking_for_partner) WHERE looking_for_partner = true;

CREATE INDEX IF NOT EXISTS idx_public_profiles_categories
  ON public_profiles USING GIN(goal_categories);

ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone (authenticated) can view public profiles
CREATE POLICY "Authenticated users can view public profiles"
  ON public_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert/update their own profile
CREATE POLICY "Users can insert own public profile"
  ON public_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own public profile"
  ON public_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own public profile"
  ON public_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════
-- 2. PARTNER CONNECTIONS
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS partnerships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  responder_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  message      TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, responder_id)
);

CREATE INDEX IF NOT EXISTS idx_partnerships_requester ON partnerships(requester_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_responder ON partnerships(responder_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_status    ON partnerships(status);

ALTER TABLE partnerships ENABLE ROW LEVEL SECURITY;

-- Users can see partnerships they are part of
CREATE POLICY "Users can view own partnerships"
  ON partnerships FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = responder_id);

CREATE POLICY "Users can create partnership requests"
  ON partnerships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

-- Responder can update (accept/decline/block), requester can update (cancel)
CREATE POLICY "Participants can update partnerships"
  ON partnerships FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = responder_id);

CREATE POLICY "Participants can delete partnerships"
  ON partnerships FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = responder_id);

-- ══════════════════════════════════════════════════════
-- 3. GOAL-BASED GROUP CHATS (must be before messages)
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS goal_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL,
  icon         TEXT DEFAULT '🎯',
  member_count INTEGER DEFAULT 0,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_groups_category ON goal_groups(category);

ALTER TABLE goal_groups ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view groups
CREATE POLICY "Authenticated users can view groups"
  ON goal_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create groups"
  ON goal_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creator can update group"
  ON goal_groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- ══════════════════════════════════════════════════════
-- 4. GROUP MEMBERS
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS goal_group_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID REFERENCES goal_groups(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_group_members_group ON goal_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_goal_group_members_user  ON goal_group_members(user_id);

ALTER TABLE goal_group_members ENABLE ROW LEVEL SECURITY;

-- Members can see their own group memberships; group members see all members of shared groups
CREATE POLICY "Users can view group memberships"
  ON goal_group_members FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM goal_group_members gm
      WHERE gm.group_id = goal_group_members.group_id
        AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join groups"
  ON goal_group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups"
  ON goal_group_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════
-- 5. DIRECT MESSAGES & GROUP MESSAGES
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id     UUID REFERENCES goal_groups(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'achievement', 'milestone', 'nudge', 'system')),
  metadata     JSONB DEFAULT '{}',
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT messages_target_check CHECK (
    (receiver_id IS NOT NULL AND group_id IS NULL) OR
    (receiver_id IS NULL AND group_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_messages_sender    ON messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver  ON messages(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_group     ON messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread    ON messages(receiver_id, read_at) WHERE read_at IS NULL;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can see their own DMs (sent or received)
CREATE POLICY "Users can view own direct messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id OR
    auth.uid() = receiver_id OR
    (group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM goal_group_members gm
      WHERE gm.group_id = messages.group_id AND gm.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can mark messages as read"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- ══════════════════════════════════════════════════════
-- 6. NUDGE SYSTEM
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nudges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID REFERENCES auth.users(id),
  receiver_id UUID REFERENCES auth.users(id),
  nudge_type  TEXT DEFAULT 'encourage' CHECK (nudge_type IN ('encourage', 'challenge', 'celebrate')),
  message     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nudges_receiver ON nudges(receiver_id, created_at DESC);

ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view nudges they sent or received"
  ON nudges FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send nudges"
  ON nudges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- ══════════════════════════════════════════════════════
-- 7. UPDATED_AT TRIGGERS
-- ══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER public_profiles_updated_at
  BEFORE UPDATE ON public_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER partnerships_updated_at
  BEFORE UPDATE ON partnerships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════
-- 8. AUTO-INCREMENT member_count ON goal_groups
-- ══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE goal_groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE goal_groups SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER goal_group_member_count_trigger
  AFTER INSERT OR DELETE ON goal_group_members
  FOR EACH ROW EXECUTE FUNCTION update_group_member_count();
