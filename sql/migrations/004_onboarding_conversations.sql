-- 004_onboarding_conversations.sql — Store onboarding chat transcripts + implicit product insights
-- "Feedback without feedback" — every conversation tells us what users need
-- Run via Supabase SQL Editor

CREATE TABLE IF NOT EXISTS onboarding_conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('life', 'health', 'finance')),
  messages JSONB NOT NULL DEFAULT '[]',           -- full chat transcript [{role, text, timestamp}]
  gemini_history JSONB DEFAULT '[]',              -- raw Gemini conversation history for resume
  extracted_data JSONB DEFAULT '{}',              -- final structured data extracted by AI
  product_insights JSONB DEFAULT '[]',            -- implicit feedback mined from conversation
  coverage_percent INTEGER DEFAULT 0,
  duration_seconds INTEGER,                       -- how long the conversation took
  message_count INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE onboarding_conversations ENABLE ROW LEVEL SECURITY;

-- Users can insert and read their own conversations
CREATE POLICY "Users insert own conversations" ON onboarding_conversations
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users read own conversations" ON onboarding_conversations
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users update own conversations" ON onboarding_conversations
  FOR UPDATE USING (auth.uid()::text = user_id);

-- Service role can read all (for product analytics)
-- Already implicit with service_role key

CREATE INDEX idx_onboarding_conv_user ON onboarding_conversations(user_id);
CREATE INDEX idx_onboarding_conv_phase ON onboarding_conversations(phase);
CREATE INDEX idx_onboarding_conv_created ON onboarding_conversations(created_at DESC);

-- Rollback: DROP TABLE IF EXISTS onboarding_conversations CASCADE;
