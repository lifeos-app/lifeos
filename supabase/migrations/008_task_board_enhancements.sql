-- ═══════════════════════════════════════════════════════════════
-- LIFEOS TASKS: Board View Enhancements
-- Adds board_status and board_position for kanban manual ordering
-- Priority field unchanged (reuse existing string field)
-- ═══════════════════════════════════════════════════════════════

-- PART 1: Board View Fields
-- ─────────────────────────────────────────────────────────────

-- Add board_status (separate from main status for board view)
-- NULL = use main status, non-NULL = override for board positioning
ALTER TABLE tasks ADD COLUMN board_status TEXT;
ALTER TABLE tasks ADD CONSTRAINT board_status_values
    CHECK (board_status IS NULL OR board_status IN ('todo', 'in_progress', 'done'));

COMMENT ON COLUMN tasks.board_status IS
    'Optional override status for board view. NULL means use main status field.';

-- Add board_position for manual drag-drop ordering within columns
-- NULL = auto-sort by priority/created_at, non-NULL = manual order
ALTER TABLE tasks ADD COLUMN board_position INTEGER;

COMMENT ON COLUMN tasks.board_position IS
    'Manual sort position within board columns. NULL = auto-sort, integer = drag position.';

-- Create composite index for board queries (status + position)
CREATE INDEX idx_tasks_board_order ON tasks(
    COALESCE(board_status, status),
    board_position NULLS LAST,
    created_at DESC
) WHERE NOT is_deleted;

-- PART 2: Subtask Depth Enforcement
-- ─────────────────────────────────────────────────────────────

-- Add depth_level tracking (0 = root task, 1 = subtask, 2 = sub-subtask)
-- Maximum 3 levels to prevent infinite nesting
ALTER TABLE tasks ADD COLUMN depth_level INTEGER DEFAULT 0;

COMMENT ON COLUMN tasks.depth_level IS
    'Nesting depth: 0 = root task, 1 = subtask, 2 = sub-subtask. Max 3 levels.';

-- Trigger to calculate depth on insert/update
CREATE OR REPLACE FUNCTION calculate_task_depth()
RETURNS TRIGGER AS $$
DECLARE
    parent_depth INTEGER;
BEGIN
    IF NEW.parent_task_id IS NULL THEN
        NEW.depth_level := 0;
    ELSE
        SELECT COALESCE(depth_level, 0) + 1 INTO parent_depth
        FROM tasks WHERE id = NEW.parent_task_id;

        IF parent_depth >= 3 THEN
            RAISE EXCEPTION 'Maximum task nesting depth (3 levels) exceeded';
        END IF;

        NEW.depth_level := parent_depth;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_task_depth
    BEFORE INSERT OR UPDATE OF parent_task_id ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION calculate_task_depth();

-- Ensure parent_task_id index exists (may already exist)
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id)
    WHERE parent_task_id IS NOT NULL AND NOT is_deleted;

-- PART 3: Helper View for Subtask Progress
-- ─────────────────────────────────────────────────────────────

-- View: Tasks with subtask counts and completion progress
CREATE OR REPLACE VIEW tasks_with_progress AS
SELECT
    t.*,
    COUNT(st.id) FILTER (WHERE NOT st.is_deleted) as subtask_count,
    COUNT(st.id) FILTER (WHERE st.status IN ('done', 'completed') AND NOT st.is_deleted) as subtasks_completed,
    CASE
        WHEN COUNT(st.id) FILTER (WHERE NOT st.is_deleted) = 0 THEN NULL
        ELSE ROUND(
            100.0 * COUNT(st.id) FILTER (WHERE st.status IN ('done', 'completed') AND NOT st.is_deleted) /
            NULLIF(COUNT(st.id) FILTER (WHERE NOT st.is_deleted), 0),
            0
        )
    END as subtask_progress_percent
FROM tasks t
LEFT JOIN tasks st ON st.parent_task_id = t.id AND NOT st.is_deleted
WHERE NOT t.is_deleted
GROUP BY t.id;

COMMENT ON VIEW tasks_with_progress IS
    'Tasks enriched with subtask counts and completion percentage for progress displays.';

GRANT SELECT ON tasks_with_progress TO authenticated;
