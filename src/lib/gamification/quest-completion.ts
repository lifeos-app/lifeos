/**
 * Quest Completion — Side-Effects Engine
 *
 * Single entry point for completing any quest (v1 or v2).
 * Orchestrates all downstream effects in one atomic-ish flow:
 *
 *   1. Mark quest as completed in `quests` table
 *   2. Apply source-specific side effects:
 *        task   → mark underlying task as done
 *        habit  → create/upsert habit_log + update streak
 *        goal   → nudge goal progress by +5%
 *        plugin → acknowledged (consumed at generation time)
 *   3. Award XP for the action type + quest completion bonus
 *   4. Check for newly-unlocked achievements
 *   5. Return a result object for the UI (level-up, new achievements, XP breakdown)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { awardXP } from './xp-engine';
import type { ActionType } from './xp-engine';
import { checkAchievements } from './achievements';
import type { Achievement } from './achievements';
import type { ContextualQuest } from './quest-engine-v2';
import type { ActiveQuest } from './quests';
import { showToast } from '../../components/Toast';
import { logger } from '../../utils/logger';

// ── TYPES ──────────────────────────────────────────────────────────────────────

/** Shape returned to the UI after completing a quest */
export interface QuestCompletionResult {
  /** Total XP awarded this completion (action XP + quest bonus) */
  xpAwarded: number;
  /** New XP total for the user */
  newTotal: number;
  /** New level */
  newLevel: number;
  /** Whether the user crossed a level threshold */
  leveledUp: boolean;
  /** Previous level (for level-up animation) */
  previousLevel: number;
  /** Human-readable XP breakdown lines for the toast notification */
  breakdown: string[];
  /** Any achievements newly unlocked by this completion */
  newAchievements: Pick<Achievement, 'id' | 'title' | 'icon' | 'rarity'>[];
  /** Human-readable list of side effects that ran */
  sideEffectsApplied: string[];
}

/** Accept both v1 ActiveQuest and v2 ContextualQuest (they share shape from DB) */
type AnyQuest = ActiveQuest | ContextualQuest;

// ── PUBLIC API ─────────────────────────────────────────────────────────────────

/**
 * Complete a quest and apply all side-effects.
 *
 * Call this from any UI button that represents "mark quest done".
 * The function handles both v1 (pool-based) and v2 (contextual) quests.
 *
 * @param supabase  - Authenticated Supabase client
 * @param userId    - Authenticated user ID
 * @param quest     - The quest to complete (v1 ActiveQuest or v2 ContextualQuest)
 */
export async function completeQuest(
  supabase: SupabaseClient,
  userId: string,
  quest: AnyQuest
): Promise<QuestCompletionResult> {
  const sideEffectsApplied: string[] = [];
  const now = new Date().toISOString();

  // Guard: already completed
  if (quest.completed_at) {
    return {
      xpAwarded: 0,
      newTotal: 0,
      newLevel: 1,
      leveledUp: false,
      previousLevel: 1,
      breakdown: ['Quest already completed'],
      newAchievements: [],
      sideEffectsApplied: [],
    };
  }

  // ── 1. Mark quest complete ──
  await supabase
    .from('quests')
    .update({
      completed_at: now,
      progress: quest.target,
    })
    .eq('id', quest.id);

  // ── 2. Source-specific side effects (v2 only) ──
  // v1 quests have source_type = undefined — safe to check with 'in' operator
  const sourceType = isContextualQuest(quest) ? quest.source_type : 'system';
  const sourceId   = isContextualQuest(quest) ? quest.source_id   : null;

  if (sourceType === 'task' && sourceId) {
    await completeTaskSideEffect(supabase, sourceId);
    sideEffectsApplied.push('Task marked as done');
  }

  if (sourceType === 'habit' && sourceId) {
    const streakUpdated = await logHabitSideEffect(supabase, sourceId);
    sideEffectsApplied.push(
      streakUpdated ? `Habit logged — streak now ${streakUpdated}` : 'Habit logged for today'
    );
  }

  if (sourceType === 'goal' && sourceId) {
    const { newPct, category } = await updateGoalSideEffect(supabase, sourceId);
    sideEffectsApplied.push(`Goal progress nudged to ${newPct}%`);

    // Tiered XP bonus based on goal category (objective/epic/goal)
    const categoryBonus = category === 'objective' ? 500 : category === 'epic' ? 200 : 100;
    if (newPct >= 100 && categoryBonus > 0) {
      await supabase.from('xp_events').insert({
        user_id: userId,
        action_type: 'goal_complete',
        xp_amount: categoryBonus,
        multiplier: 1,
        description: `${category} completed: ${questTitle} (+${categoryBonus} XP)`,
      });
      sideEffectsApplied.push(`${category} complete bonus: +${categoryBonus} XP`);
    }
  }

  if (sourceType === 'plugin') {
    sideEffectsApplied.push('Plugin action acknowledged');
  }

  // ── 3. Award XP ──
  const actionType = resolveActionType(sourceType);
  const questTitle = resolveTitle(quest);

  const xpResult = await awardXP(supabase, userId, actionType, {
    description: `Quest completed: ${questTitle}`,
  });

  // Bonus XP for the quest reward itself (on top of base action XP)
  const bonusXP = quest.reward_xp;
  let finalTotal = xpResult.newTotal;

  if (bonusXP > 0) {
    await supabase.from('xp_events').insert({
      user_id:     userId,
      action_type: 'task_complete', // generic log for the quest bonus
      xp_amount:   bonusXP,
      multiplier:  1,
      description: `Quest bonus: ${questTitle}`,
    });

    finalTotal += bonusXP;

    await supabase
      .from('user_xp')
      .update({ total_xp: finalTotal, updated_at: now })
      .eq('user_id', userId);
  }

  // ── 4. Achievement check ──
  const unlockedAchievements = await checkAchievements(supabase, userId);
  const newAchievements = unlockedAchievements.map(a => ({
    id:     a.id,
    title:  a.title,
    icon:   a.icon,
    rarity: a.rarity,
  }));

  // ── 5. Smart complete — suggest next step via ZeroClaw (non-blocking) ──
  const questGoalId = isContextualQuest(quest) && quest.source_type === 'goal' ? quest.source_id
    : isContextualQuest(quest) ? quest.source_id : null;

  if (questGoalId || (sourceType === 'task' && sourceId)) {
    // Fire-and-forget — never blocks the completion result
    suggestNextStep(supabase, userId, questTitle, questGoalId).catch(e => logger.warn('[quest] suggestNextStep failed:', e));
  }

  return {
    xpAwarded:        xpResult.xpAwarded + bonusXP,
    newTotal:         finalTotal,
    newLevel:         xpResult.newLevel,
    leveledUp:        xpResult.leveledUp,
    previousLevel:    xpResult.previousLevel,
    breakdown:        [...xpResult.breakdown, `Quest bonus: +${bonusXP} XP`],
    newAchievements,
    sideEffectsApplied,
  };
}

// ── SIDE EFFECT HANDLERS ───────────────────────────────────────────────────────

/**
 * Mark the underlying task as completed.
 * Mirrors the status update in NodeDetail.tsx for consistency.
 */
async function completeTaskSideEffect(
  supabase: SupabaseClient,
  taskId: string
): Promise<void> {
  await supabase
    .from('tasks')
    .update({
      status:       'done',
      completed_at: new Date().toISOString(),
    })
    .eq('id', taskId);
}

/**
 * Log today's habit entry and update the streak counter.
 * Uses UPSERT so calling this twice on the same habit today is safe.
 *
 * @returns New streak count, or null if the habit row was not found
 */
async function logHabitSideEffect(
  supabase: SupabaseClient,
  habitId: string
): Promise<number | null> {
  const today = new Date().toISOString().split('T')[0];

  // Upsert the log row (idempotent)
  await supabase
    .from('habit_logs')
    .upsert(
      { habit_id: habitId, date: today, count: 1 },
      { onConflict: 'habit_id,date' }
    );

  // Update streak on the habit row
  const { data: habit } = await supabase
    .from('habits')
    .select('streak_current, streak_best')
    .eq('id', habitId)
    .maybeSingle();

  if (!habit) return null;

  const newStreak = (habit.streak_current ?? 0) + 1;
  const newBest   = Math.max(habit.streak_best ?? 0, newStreak);

  await supabase
    .from('habits')
    .update({
      streak_current: newStreak,
      streak_best:    newBest,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', habitId);

  return newStreak;
}

/**
 * Nudge goal progress by +5% when a goal-sourced quest is completed.
 * The user can manually set the exact percentage in the goal detail view.
 *
 * @returns New progress as integer percentage (0–100) and goal category
 */
async function updateGoalSideEffect(
  supabase: SupabaseClient,
  goalId: string
): Promise<{ newPct: number; category: string }> {
  const { data: goal } = await supabase
    .from('goals')
    .select('progress, category')
    .eq('id', goalId)
    .maybeSingle();

  const oldProgress  = goal?.progress ?? 0;
  const newProgress  = Math.min(1, oldProgress + 0.05);
  const newPct       = Math.round(newProgress * 100);

  await supabase
    .from('goals')
    .update({
      progress:   newProgress,
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId);

  return { newPct, category: goal?.category || 'goal' };
}

// ── HELPERS ────────────────────────────────────────────────────────────────────

/** Map quest source type to the matching XP action type */
function resolveActionType(sourceType: string): ActionType {
  switch (sourceType) {
    case 'task':    return 'task_complete';
    case 'habit':   return 'habit_log';
    case 'goal':    return 'goal_complete';
    case 'finance': return 'financial_entry';
    case 'plugin':
    case 'system':
    default:        return 'task_complete';
  }
}

/** Get the human-readable title from either quest format */
function resolveTitle(quest: AnyQuest): string {
  if (isContextualQuest(quest) && quest.v2_title) return quest.v2_title;
  if (quest.quest_data) return quest.quest_data.title;
  return 'Quest';
}

/** Runtime type-guard: is this a v2 ContextualQuest? */
function isContextualQuest(quest: AnyQuest): quest is ContextualQuest {
  return 'source_type' in quest && quest.source_type !== undefined;
}

// ── SMART COMPLETE — Suggest next step via ZeroClaw ─────────────────────

async function suggestNextStep(
  supabase: SupabaseClient,
  userId: string,
  questTitle: string,
  goalId: string | null,
): Promise<void> {
  try {
    const { agentChat, agentHealthCheck } = await import('../zeroclaw-client');
    const isOnline = await agentHealthCheck();
    if (!isOnline) return;

    let goalTitle = '';
    if (goalId) {
      const { data } = await supabase
        .from('goals')
        .select('title')
        .eq('id', goalId)
        .maybeSingle();
      goalTitle = data?.title || '';
    }

    const prompt = goalTitle
      ? `User just completed "${questTitle}" for goal "${goalTitle}". Suggest one logical next step in 1 sentence. Be specific and actionable.`
      : `User just completed "${questTitle}". Suggest one logical next step in 1 sentence. Be specific and actionable.`;

    const res = await agentChat({ userId, message: prompt });
    const suggestion = res.message?.trim();
    if (!suggestion || suggestion.length < 5) return;

    showToast(
      suggestion,
      '🧠',
      '#7C5CFC',
      {
        duration: 8000,
        action: {
          label: 'Create task',
          onClick: () => {
            // Use the schedule store's createTask (fire-and-forget)
            import('../../stores/useScheduleStore').then(({ useScheduleStore }) => {
              useScheduleStore.getState().createTask(userId, suggestion);
            }).catch(() => {});
          },
        },
      },
    );
  } catch (e) {
    logger.warn('[quest] suggestNextStep error:', e);
  }
}
