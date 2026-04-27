-- P7-004: Convert journal_entries.tags from comma-separated text to JSONB array
--
-- Before: tags = 'gratitude,reflection,goals'  (TEXT)
-- After:  tags = ["gratitude","reflection","goals"]  (JSONB)
--
-- Handles three cases for existing data:
-- 1. NULL or empty string → '[]'::jsonb
-- 2. Already JSON array (starting with '[') → cast directly to jsonb
-- 3. Comma-separated string → split and build jsonb array
--
-- DO NOT apply this migration automatically — it should be run
-- after the frontend code is deployed with backward-compatible
-- normalizeTags() that handles both formats gracefully.

ALTER TABLE journal_entries
  ALTER COLUMN tags TYPE JSONB
  USING CASE
    WHEN tags IS NULL OR tags = '' THEN '[]'::jsonb
    WHEN tags::text LIKE '[%' THEN tags::jsonb
    ELSE (
      SELECT jsonb_agg(trim(elem))
      FROM unnest(string_to_array(tags::text, ',')) AS elem
      WHERE trim(elem) != ''
    )
  END;

-- Set default for new rows (empty JSONB array instead of empty string)
ALTER TABLE journal_entries
  ALTER COLUMN tags SET DEFAULT '[]'::jsonb;

-- Add GIN index for efficient tag containment/overlap queries
CREATE INDEX IF NOT EXISTS idx_journal_entries_tags
  ON journal_entries USING GIN (tags jsonb_path_ops);