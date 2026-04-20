/**
 * LifeOS Intent Engine — Goal Plan Executor
 *
 * Handles the goal_plan action type which creates a full
 * objective → epic → goals → tasks + habits hierarchy.
 */

import { supabase } from '../data-access';
import { schedulePreloadedTasks } from '../life-planner';
import { logger } from '../../utils/logger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function executeGoalPlan(
  data: Record<string, unknown>,
  successes: string[],
  failures: string[],
): Promise<void> {
  const plan = data as Record<string, any>;
  const planUserId = plan.user_id as string;
  logger.info('[goal_plan] Starting execution', { planUserId, hasObjective: !!plan.objective, goalsCount: plan.goals?.length, intake: plan.intake });
  if (!planUserId) {
    failures.push('❌ Goal plan missing user_id — cannot create goals');
    return;
  }
  const intake = plan.intake as { weekly_hours?: number; budget?: number | null; target_date?: string } | undefined;
  let objectiveId: string;
  let createdCounts = { objectives: 0, epics: 0, goals: 0, tasks: 0, habits: 0 };

  // Calculate estimated_hours from intake
  const targetDate = intake?.target_date || plan.epic?.target_date || null;
  const weeksUntilTarget = targetDate
    ? Math.max(1, Math.ceil((new Date(targetDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
    : null;

  // 1. Resolve or create objective
  if (plan.objective?.existing_id && UUID_REGEX.test(plan.objective.existing_id)) {
    objectiveId = plan.objective.existing_id;
  } else {
    const { data: newObj, error: objErr } = await supabase.from('goals').insert({
      user_id: planUserId,
      title: plan.objective?.title || 'New Objective',
      description: plan.objective?.title || '',
      category: 'objective',
      domain: plan.objective?.domain || null,
      status: 'active',
      color: plan.objective?.color || '#00D4FF',
      icon: plan.objective?.icon || '🎯',
      sort_order: 0,
      priority: 'high',
      estimated_hours: intake?.weekly_hours && weeksUntilTarget ? intake.weekly_hours * weeksUntilTarget : null,
      budget_allocated: intake?.budget || null,
      target_date: targetDate,
    }).select('id').single();
    if (objErr || !newObj) { logger.error('[goal_plan] Objective creation failed', objErr); throw new Error(`Failed to create objective: ${objErr?.message}`); }
    objectiveId = newObj.id;
    createdCounts.objectives = 1;
  }

  // 2. Create epic under objective
  const { data: newEpic, error: epicErr } = await supabase.from('goals').insert({
    user_id: planUserId,
    title: plan.epic?.title || 'New Epic',
    description: plan.epic?.description || '',
    category: 'epic',
    domain: plan.objective?.domain || null,
    parent_goal_id: objectiveId,
    status: 'active',
    target_date: plan.epic?.target_date || null,
    color: plan.objective?.color || '#00D4FF',
    icon: '⚡',
    sort_order: 0,
    priority: 'high',
  }).select('id').single();
  if (epicErr || !newEpic) { logger.error('[goal_plan] Epic creation failed', epicErr); throw new Error(`Failed to create epic: ${epicErr?.message}`); }
  createdCounts.epics = 1;

  // 3. Create goals under epic, with tasks under each goal
  const createdTaskRows: Record<string, unknown>[] = [];
  const goals = plan.goals || [];
  for (let gi = 0; gi < goals.length; gi++) {
    const g = goals[gi];
    const { data: newGoal, error: gErr } = await supabase.from('goals').insert({
      user_id: planUserId,
      title: g.title || `Goal ${gi + 1}`,
      description: g.description || '',
      category: 'goal',
      domain: plan.objective?.domain || null,
      parent_goal_id: newEpic.id,
      status: 'active',
      target_date: g.target_date || null,
      color: plan.objective?.color || '#00D4FF',
      icon: '🏁',
      sort_order: gi,
      priority: g.priority || 'medium',
    }).select('id').single();
    if (gErr || !newGoal) { failures.push(`❌ Failed to create goal: ${g.title}`); continue; }
    createdCounts.goals++;

    // Create tasks under this goal (collect for direct scheduling)
    const tasks = g.tasks || [];
    for (let ti = 0; ti < tasks.length; ti++) {
      const t = tasks[ti];
      const taskRow = {
        user_id: planUserId,
        title: t.title || `Task ${ti + 1}`,
        description: t.description || '',
        status: 'todo',
        priority: t.priority || 'medium',
        due_date: t.due_date || null,
        estimated_minutes: t.estimated_minutes || null,
        suggested_week: t.suggested_week || null,
        goal_id: newGoal.id,
        sort_order: ti,
        is_deleted: false,
        sync_status: 'synced',
      };
      const { data: newTask, error: tErr } = await supabase.from('tasks').insert(taskRow).select('id').single();
      if (tErr || !newTask) { failures.push(`❌ Failed to create task: ${t.title}`); continue; }
      createdTaskRows.push({ ...taskRow, id: newTask.id, created_at: new Date().toISOString() });
      createdCounts.tasks++;
    }
  }

  // 4. Create habits
  const habits = plan.habits || [];
  for (const h of habits) {
    const { error: hErr } = await supabase.from('habits').insert({
      user_id: planUserId,
      title: h.title || 'New Habit',
      description: h.description || '',
      frequency: h.frequency || 'daily',
      target_count: 1,
      icon: h.icon || '🔵',
      color: plan.objective?.color || '#00D4FF',
      is_active: true,
      streak_current: 0,
      streak_best: 0,
    });
    if (hErr) { failures.push(`❌ Failed to create habit: ${h.title}`); continue; }
    createdCounts.habits++;
  }

  // 5. Smart-schedule all objective tasks (pass directly — no re-fetch)
  if (createdTaskRows.length > 0) {
    try {
      const { scheduled } = await schedulePreloadedTasks(supabase, planUserId, createdTaskRows, { weeklyHours: intake?.weekly_hours });
      logger.log(`[intent] Scheduled ${scheduled}/${createdTaskRows.length} tasks`);
    } catch (e) {
      logger.warn('[intent] schedulePreloadedTasks failed:', e);
    }
  }

  const parts = [];
  if (createdCounts.objectives) parts.push(`1 objective`);
  parts.push(`1 epic`);
  if (createdCounts.goals) parts.push(`${createdCounts.goals} goals`);
  if (createdCounts.tasks) parts.push(`${createdCounts.tasks} tasks`);
  if (createdCounts.habits) parts.push(`${createdCounts.habits} daily habits`);
  successes.push(`🎯 Plan created: ${parts.join(', ')}`);
}