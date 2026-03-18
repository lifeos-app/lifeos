/**
 * LifeOS Goal Coach — AI-powered goal analysis & nudging
 *
 * Analyzes user goals to find:
 * - Neglected goals (no task activity in X days)
 * - Goals falling behind schedule
 * - Suggested next actions per active goal
 * - Motivational nudges based on progress patterns
 *
 * Free tier: basic neglected count
 * Pro tier: per-goal AI coaching with actionable suggestions
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { callLLMJson } from '../llm-proxy';
import { canAccess } from '../feature-gates';
import { logger } from '../../utils/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GoalCoachInsight {
  goalId: string;
  goalTitle: string;
  goalIcon: string;
  goalColor: string;
  /** 'neglected' | 'behind' | 'stalled' | 'on_track' | 'ahead' */
  status: 'neglected' | 'behind' | 'stalled' | 'on_track' | 'ahead';
  /** Days since last task activity under this goal */
  daysSinceActivity: number;
  /** Progress percentage (0-100) */
  progressPct: number;
  /** Expected progress based on timeline (0-100), null if no target date */
  expectedProgressPct: number | null;
  /** AI-generated suggested next action */
  suggestedAction: string;
  /** AI-generated motivational nudge */
  nudge: string;
  /** Priority for sorting (lower = more urgent) */
  priority: number;
}

export interface GoalCoachResult {
  insights: GoalCoachInsight[];
  summary: string;
  generatedAt: string;
  isPro: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const NEGLECT_THRESHOLD_DAYS = 7;
const STALE_THRESHOLD_DAYS = 14;

// ── Data fetching ──────────────────────────────────────────────────────────────

interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  progress: number;
  status: string;
  icon: string | null;
  color: string | null;
  target_date: string | null;
  priority: string | null;
  created_at: string;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  goal_id: string | null;
  completed_at: string | null;
  created_at: string;
  due_date: string | null;
}

async function fetchGoalData(userId: string, supabase: SupabaseClient) {
  const [goalsRes, tasksRes] = await Promise.all([
    supabase
      .from('goals')
      .select('id, title, description, category, progress, status, icon, color, target_date, priority, created_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .in('status', ['active', 'in_progress']),
    supabase
      .from('tasks')
      .select('id, title, status, goal_id, completed_at, created_at, due_date')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .not('goal_id', 'is', null),
  ]);

  return {
    goals: (goalsRes.data || []) as GoalRow[],
    tasks: (tasksRes.data || []) as TaskRow[],
  };
}

// ── Analysis (no LLM needed) ───────────────────────────────────────────────────

function analyzeGoals(goals: GoalRow[], tasks: TaskRow[]): GoalCoachInsight[] {
  const now = new Date();
  const insights: GoalCoachInsight[] = [];

  for (const goal of goals) {
    // Only analyze leaf-level goals (not objectives/epics)
    if (goal.category === 'objective' || goal.category === 'epic') continue;

    const goalTasks = tasks.filter(t => t.goal_id === goal.id);
    const completedTasks = goalTasks.filter(t => t.status === 'done');
    const progressPct = Math.round((goal.progress || 0) * 100);

    // Calculate days since last activity
    const activityDates = goalTasks
      .map(t => t.completed_at || t.created_at)
      .filter(Boolean)
      .map(d => new Date(d!).getTime())
      .sort((a, b) => b - a);

    const lastActivity = activityDates.length > 0 ? activityDates[0] : new Date(goal.created_at).getTime();
    const daysSinceActivity = Math.floor((now.getTime() - lastActivity) / (1000 * 60 * 60 * 24));

    // Calculate expected progress based on timeline
    let expectedProgressPct: number | null = null;
    if (goal.target_date) {
      const created = new Date(goal.created_at).getTime();
      const target = new Date(goal.target_date + 'T00:00:00').getTime();
      const totalDuration = target - created;
      const elapsed = now.getTime() - created;
      if (totalDuration > 0) {
        expectedProgressPct = Math.min(100, Math.round((elapsed / totalDuration) * 100));
      }
    }

    // Determine status
    let status: GoalCoachInsight['status'] = 'on_track';
    let priority = 50;

    if (daysSinceActivity >= STALE_THRESHOLD_DAYS) {
      status = 'neglected';
      priority = 10;
    } else if (daysSinceActivity >= NEGLECT_THRESHOLD_DAYS) {
      status = 'stalled';
      priority = 20;
    } else if (expectedProgressPct !== null && progressPct < expectedProgressPct - 15) {
      status = 'behind';
      priority = 15;
    } else if (expectedProgressPct !== null && progressPct > expectedProgressPct + 15) {
      status = 'ahead';
      priority = 70;
    }

    // Adjust priority based on goal priority
    if (goal.priority === 'critical') priority -= 5;
    else if (goal.priority === 'high') priority -= 2;

    // Basic suggestion (will be enhanced by LLM for pro users)
    let suggestedAction = '';
    let nudge = '';

    if (status === 'neglected') {
      suggestedAction = goalTasks.length === 0
        ? `Break down "${goal.title}" into smaller tasks to get started`
        : `Resume work on "${goal.title}" — pick the easiest next task`;
      nudge = `⚠️ ${daysSinceActivity} days since last activity`;
    } else if (status === 'stalled') {
      suggestedAction = `Spend 15 minutes making progress on "${goal.title}"`;
      nudge = `${daysSinceActivity} days since last activity — don't lose momentum`;
    } else if (status === 'behind') {
      const gap = expectedProgressPct! - progressPct;
      suggestedAction = `Focus on "${goal.title}" to close the ${gap}% gap`;
      nudge = `📉 ${progressPct}% done but should be at ${expectedProgressPct}%`;
    } else if (status === 'ahead') {
      suggestedAction = `Keep the momentum going on "${goal.title}"!`;
      nudge = `🚀 Ahead of schedule — ${progressPct}% vs expected ${expectedProgressPct}%`;
    } else {
      suggestedAction = completedTasks.length > 0
        ? `Continue with the next task under "${goal.title}"`
        : `Add your first task to "${goal.title}" to start tracking progress`;
      nudge = goalTasks.length > 0
        ? `${completedTasks.length}/${goalTasks.length} tasks done`
        : 'No tasks yet — break it down into steps';
    }

    insights.push({
      goalId: goal.id,
      goalTitle: goal.title,
      goalIcon: goal.icon || '🎯',
      goalColor: goal.color || '#00D4FF',
      status,
      daysSinceActivity,
      progressPct,
      expectedProgressPct,
      suggestedAction,
      nudge,
      priority,
    });
  }

  // Sort by priority (lower = more urgent first)
  insights.sort((a, b) => a.priority - b.priority);
  return insights;
}

// ── AI Enhancement (Pro tier) ──────────────────────────────────────────────────

async function enhanceWithAI(insights: GoalCoachInsight[]): Promise<GoalCoachInsight[]> {
  // Only enhance goals that need attention
  const needsAttention = insights.filter(i =>
    i.status === 'neglected' || i.status === 'behind' || i.status === 'stalled'
  ).slice(0, 5); // Limit to 5 to keep costs down

  if (needsAttention.length === 0) return insights;

  const prompt = `You are a goal achievement coach. For each goal below, provide a specific, actionable next step and a brief motivational nudge. Be practical and concise.

Goals needing attention:
${needsAttention.map((g, i) => `${i + 1}. "${g.goalTitle}" — ${g.progressPct}% done, ${g.daysSinceActivity} days idle, status: ${g.status}${g.expectedProgressPct !== null ? `, should be at ${g.expectedProgressPct}%` : ''}`).join('\n')}

Respond as JSON array:
[{ "goalId": "...", "suggestedAction": "specific next step (max 80 chars)", "nudge": "motivational message (max 60 chars)" }]`;

  try {
    const aiResults = await callLLMJson<{ goalId: string; suggestedAction: string; nudge: string }[]>(prompt, {
      timeoutMs: 15000,
    });

    // Merge AI results back into insights
    const enhanced = insights.map(insight => {
      const aiResult = aiResults.find(r => r.goalId === insight.goalId);
      if (aiResult) {
        return {
          ...insight,
          suggestedAction: aiResult.suggestedAction || insight.suggestedAction,
          nudge: aiResult.nudge || insight.nudge,
        };
      }
      return insight;
    });

    return enhanced;
  } catch (err) {
    logger.warn('[GoalCoach] AI enhancement failed, using basic suggestions:', err);
    return insights;
  }
}

// ── Main Entry Point ───────────────────────────────────────────────────────────

export async function analyzeGoalCoach(
  userId: string,
  supabase: SupabaseClient,
  tier: 'free' | 'pro' = 'free',
): Promise<GoalCoachResult> {
  const { goals, tasks } = await fetchGoalData(userId, supabase);

  let insights = analyzeGoals(goals, tasks);
  const isPro = canAccess('advanced_goals', tier);

  // Pro users get AI-enhanced suggestions
  if (isPro && insights.some(i => i.status !== 'on_track' && i.status !== 'ahead')) {
    insights = await enhanceWithAI(insights);
  }

  // Build summary
  const neglected = insights.filter(i => i.status === 'neglected').length;
  const behind = insights.filter(i => i.status === 'behind').length;
  const stalled = insights.filter(i => i.status === 'stalled').length;
  const onTrack = insights.filter(i => i.status === 'on_track').length;
  const ahead = insights.filter(i => i.status === 'ahead').length;

  let summary = '';
  if (neglected > 0) {
    summary = `${neglected} goal${neglected > 1 ? 's' : ''} neglected`;
  }
  if (behind > 0) {
    summary += `${summary ? ', ' : ''}${behind} behind schedule`;
  }
  if (stalled > 0) {
    summary += `${summary ? ', ' : ''}${stalled} stalled`;
  }
  if (!summary && onTrack > 0) {
    summary = `${onTrack + ahead} goals on track`;
    if (ahead > 0) summary += ` (${ahead} ahead!)`;
  }
  if (!summary) {
    summary = 'No active goals to coach';
  }

  return {
    insights,
    summary,
    generatedAt: new Date().toISOString(),
    isPro,
  };
}

/**
 * Get goal nudges formatted for the smart suggestions system.
 * Returns up to 2 nudge-style suggestions for the dashboard.
 */
export function getGoalNudgesForDashboard(
  insights: GoalCoachInsight[],
): { id: string; icon: string; label: string; detail: string; priority: number; goalId: string; suggestedAction: string }[] {
  const needsAttention = insights.filter(i =>
    i.status === 'neglected' || i.status === 'behind' || i.status === 'stalled'
  );

  return needsAttention.slice(0, 2).map(insight => ({
    id: `goal-coach-${insight.goalId}`,
    icon: insight.goalIcon,
    label: `"${insight.goalTitle}" needs attention`,
    detail: insight.nudge,
    priority: insight.status === 'neglected' ? 1 : insight.status === 'behind' ? 2 : 3,
    goalId: insight.goalId,
    suggestedAction: insight.suggestedAction,
  }));
}
