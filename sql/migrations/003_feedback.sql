-- 003_feedback.sql — User feedback table
-- Run via Supabase SQL Editor

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'praise', 'other')),
  message TEXT NOT NULL,
  page TEXT,               -- which page they were on
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  screenshot_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can read own feedback" ON feedback
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_feedback_type ON feedback(type);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);
