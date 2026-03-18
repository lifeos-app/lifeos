-- User profiles — onboarding data + preferences
-- Separate from auth.users so we own the data model

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT,
  occupation TEXT,
  primary_focus TEXT,
  onboarding_complete BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own profile
CREATE POLICY "users_own_profile_select" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_own_profile_insert" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_profile_update" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);
