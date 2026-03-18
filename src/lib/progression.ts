import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

interface Milestone {
  id: string;
  title: string;
  category: string;
  icon: string;
  color: string;
}

export async function recalcProgression(
  taskGoalId: string | null,
  supabase: SupabaseClient
): Promise<{ milestones: Milestone[] }> {
  const milestones: Milestone[] = [];

  if (!taskGoalId) return { milestones };

  try {
    // 1. Get all tasks for this goal
    const { data: goalTasks } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('goal_id', taskGoalId)
      .eq('is_deleted', false);

    if (!goalTasks || goalTasks.length === 0) return { milestones };

    // 2. Calculate progress: done / total
    const doneCount = goalTasks.filter((t) => t.status === 'done').length;
    const newProgress = doneCount / goalTasks.length;

    // 3. Update goal progress
    const { data: updatedGoal } = await supabase
      .from('goals')
      .update({ progress: newProgress })
      .eq('id', taskGoalId)
      .select('id, title, icon, color, category, progress, parent_goal_id')
      .single();

    // Check if this goal just hit 100%
    if (updatedGoal && newProgress === 1) {
      milestones.push({
        id: updatedGoal.id,
        title: updatedGoal.title,
        category: updatedGoal.category || 'goal',
        icon: updatedGoal.icon || '🎯',
        color: updatedGoal.color || '#00D4FF',
      });
    }

    if (!updatedGoal?.parent_goal_id) return { milestones };

    // 4. Get parent epic
    const epicId = updatedGoal.parent_goal_id;

    // 5. Get all goals under that epic
    const { data: epicGoals } = await supabase
      .from('goals')
      .select('id, progress')
      .eq('parent_goal_id', epicId)
      .eq('is_deleted', false);

    if (!epicGoals || epicGoals.length === 0) return { milestones };

    // 6. Calculate epic progress = avg of child goal progresses
    const epicProgress =
      epicGoals.reduce((sum, g) => sum + (g.progress || 0), 0) / epicGoals.length;

    // 7. Update epic progress
    const { data: updatedEpic } = await supabase
      .from('goals')
      .update({ progress: epicProgress })
      .eq('id', epicId)
      .select('id, title, icon, color, category, progress, parent_goal_id')
      .single();

    // Check if epic just hit 100%
    if (updatedEpic && epicProgress === 1) {
      milestones.push({
        id: updatedEpic.id,
        title: updatedEpic.title,
        category: updatedEpic.category || 'epic',
        icon: updatedEpic.icon || '⚡',
        color: updatedEpic.color || '#FACC15',
      });
    }

    if (!updatedEpic?.parent_goal_id) return { milestones };

    // 8. Get parent objective
    const objectiveId = updatedEpic.parent_goal_id;

    // 9. Get all epics under that objective
    const { data: objectiveEpics } = await supabase
      .from('goals')
      .select('id, progress')
      .eq('parent_goal_id', objectiveId)
      .eq('is_deleted', false);

    if (!objectiveEpics || objectiveEpics.length === 0) return { milestones };

    // 10. Calculate objective progress = avg of child epic progresses
    const objectiveProgress =
      objectiveEpics.reduce((sum, e) => sum + (e.progress || 0), 0) /
      objectiveEpics.length;

    // 11. Update objective progress
    const { data: updatedObjective } = await supabase
      .from('goals')
      .update({ progress: objectiveProgress })
      .eq('id', objectiveId)
      .select('id, title, icon, color, category')
      .single();

    // Check if objective just hit 100%
    if (updatedObjective && objectiveProgress === 1) {
      milestones.push({
        id: updatedObjective.id,
        title: updatedObjective.title,
        category: updatedObjective.category || 'objective',
        icon: updatedObjective.icon || '🎯',
        color: updatedObjective.color || '#00D4FF',
      });
    }

    return { milestones };
  } catch (error) {
    logger.error('Error recalculating progression:', error);
    return { milestones };
  }
}
