/**
 * Quest Engine v2 — Contextual Quest Generation
 *
 * Replaces the random-pool approach with personalised quests derived from
 * the user's actual goals, tasks, habits, and external plugin events.
 *
 * ALGORITHM
 * ─────────
 * 1. If enough v2 quests already exist for today/this week → return them (idempotent)
 * 2. Fetch user data in parallel: tasks (due soon), habits (not logged today),
 *    goals (stale or low progress), plugin suggestions
 * 3. Build scored "candidate" quests from each data source
 * 4. Apply variety constraint: max 2 quests per category
 * 5. Pick top 3–5 daily + top 3 weekly
 * 6. Insert into `quests` table with source links (for completion side-effects)
 * 7. Mark consumed plugin suggestions
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuestType } from './quests';

// ── TYPES ──────────────────────────────────────────────────────────────────────

export type QuestSourceType =
  | 'task'
  | 'habit'
  | 'goal'
  | 'finance'
  | 'plugin'
  | 'system';

export type QuestPriority = 'low' | 'medium' | 'high' | 'urgent';

export type QuestCategory =
  | 'productivity'
  | 'health'
  | 'finance'
  | 'consistency'
  | 'growth';

/**
 * A contextual quest row as returned from the database.
 * Extends the existing `quests` schema with v2 columns.
 *
 * v1 quests have quest_data populated but v2_title = null.
 * v2 quests have v2_title populated but quest_data = null.
 */
export interface ContextualQuest {
  id: string;
  user_id: string;
  quest_type: QuestType;

  // ── Source linking (v2) ──
  /** Where the quest was generated from */
  source_type: QuestSourceType;
  /** FK to the originating row (task id, habit id, goal id, plugin suggestion id) */
  source_id: string | null;
  /** Table name of the originating row ('tasks', 'habits', 'goals', …) */
  source_table: string | null;

  // ── Display ──
  /** v2 title stored directly (v1 reads from quest_data.title) */
  v2_title: string | null;
  /** v2 description stored directly */
  v2_description: string | null;
  /** v2 icon stored directly */
  v2_icon: string | null;
  /** v1 quest template (null for v2 quests) */
  quest_data: { title: string; description: string; icon: string; trackingAction: string } | null;

  // ── Progress ──
  progress: number;
  target: number;
  reward_xp: number;

  // ── Timing ──
  expires_at: string;
  completed_at: string | null;

  // ── v2 Metadata ──
  /** Urgency level — drives quest board sort order */
  priority: QuestPriority;
  /** Context blurb shown under the quest, e.g. "Part of: Build AI-Robotics Capability" */
  context_label: string;
  /** Category used for variety balancing */
  category: QuestCategory;
}

// ── INTERNAL TYPES ─────────────────────────────────────────────────────────────

/** Intermediate representation before the quest is persisted */
interface QuestCandidate {
  source_type: QuestSourceType;
  source_id: string | null;
  source_table: string | null;
  title: string;
  description: string;
  icon: string;
  category: QuestCategory;
  target: number;
  reward_xp: number;
  priority: QuestPriority;
  context_label: string;
  quest_type: QuestType;
  /** Score for ranking — higher = shown first */
  score: number;
}

// ── DATABASE ROW TYPES ────────────────────────────────────────────────────────

interface TaskRow {
  id: string;
  title: string;
  priority: string | null;
  due_date: string | null;
  goal_id: string | null;
}

interface GoalRow {
  id: string;
  title: string;
  category: string;
  progress: number;
  domain: string | null;
  updated_at: string | null;
  parent_goal_id: string | null;
}

interface HabitRow {
  id: string;
  title: string;
  icon: string | null;
  streak_current: number;
}

interface HabitLogRow {
  habit_id: string;
  date: string;
}

interface PluginSuggestionRow {
  id: string;
  plugin_id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  reward_xp: number;
  priority: string;
  metadata: Record<string, unknown>;
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────────

/** Ranking weights — urgent quests surface to the top */
const PRIORITY_SCORE: Record<QuestPriority, number> = {
  urgent: 100,
  high:    70,
  medium:  40,
  low:     10,
};

/** XP rewards per task priority level */
const TASK_XP: Record<string, number> = {
  urgent: 80,
  high:   60,
  medium: 40,
  low:    25,
};

// ── DATE HELPERS ───────────────────────────────────────────────────────────────

function getEndOfDay(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function getEndOfWeek(): string {
  const d = new Date();
  const daysUntilSunday = 7 - d.getDay();
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function daysDiff(isoDate: string): number {
  const target = new Date(isoDate);
  const now = new Date();
  // Zero out time for clean day comparison
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDueDate(isoDate: string): string {
  const days = daysDiff(isoDate);
  if (days < 0)  return `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

// ── CANDIDATE BUILDERS ────────────────────────────────────────────────────────

/**
 * Build daily quest candidates from tasks with approaching due dates.
 * Tasks due today/tomorrow become urgent quests. Due within 7 days = medium.
 */
function buildTaskCandidates(
  tasks: TaskRow[],
  goalMap: Map<string, GoalRow>
): QuestCandidate[] {
  return tasks.map(task => {
    const daysUntilDue = task.due_date ? daysDiff(task.due_date) : 999;

    const priority: QuestPriority =
      daysUntilDue <= 0 ? 'urgent' :
      daysUntilDue <= 1 ? 'high'   :
      daysUntilDue <= 3 ? 'medium' : 'low';

    const taskPriority = task.priority ?? 'medium';
    const xp = TASK_XP[taskPriority] ?? 40;

    const goal = task.goal_id ? goalMap.get(task.goal_id) : undefined;
    const contextLabel = goal ? `Part of: ${goal.title}` : '';

    const duePart = task.due_date ? formatDueDate(task.due_date) : '';
    const description = [duePart, contextLabel].filter(Boolean).join(' · ');

    const icon =
      priority === 'urgent' ? '🔥' :
      priority === 'high'   ? '⚡' :
      '✅';

    return {
      source_type: 'task' as const,
      source_id: task.id,
      source_table: 'tasks',
      title: `Complete: ${task.title}`,
      description,
      icon,
      category: 'productivity' as const,
      target: 1,
      reward_xp: xp,
      priority,
      context_label: contextLabel,
      quest_type: 'daily' as const,
      // Tasks due sooner rank higher; also add a nudge for task-level priority
      score: PRIORITY_SCORE[priority] + Math.max(0, 70 - daysUntilDue * 10),
    };
  });
}

/**
 * Build daily quest candidates from habits not yet logged today.
 * Habits with active streaks are marked high-priority (streak at risk).
 */
function buildHabitCandidates(
  habits: HabitRow[],
  loggedTodayIds: Set<string>
): QuestCandidate[] {
  return habits
    .filter(h => !loggedTodayIds.has(h.id))
    .map(habit => {
      const streak = habit.streak_current ?? 0;
      const priority: QuestPriority =
        streak >= 14 ? 'urgent' :
        streak >= 7  ? 'high'   :
        streak >= 3  ? 'medium' : 'low';

      const streakDescription =
        streak >= 14 ? `🔥 ${streak}-day streak — don't break it!` :
        streak >= 7  ? `🔥 ${streak}-day streak at risk today` :
        streak >= 1  ? `Current streak: ${streak} days` :
        'Start your streak today';

      const icon = habit.icon ?? '🔄';
      const xp = streak >= 14 ? 55 : streak >= 7 ? 45 : streak >= 3 ? 35 : 25;

      return {
        source_type: 'habit' as const,
        source_id: habit.id,
        source_table: 'habits',
        title: `Log your ${habit.title} habit`,
        description: streakDescription,
        icon,
        category: 'consistency' as const,
        target: 1,
        reward_xp: xp,
        priority,
        context_label: streak > 0 ? `${streak}-day streak active` : '',
        quest_type: 'daily' as const,
        // Longer streaks surface higher — more at stake
        score: PRIORITY_SCORE[priority] + Math.min(streak * 2, 60),
      };
    });
}

/**
 * Build daily quest candidates from goals with low progress or stale momentum.
 * Goals untouched for 7+ days become medium/high priority to re-activate focus.
 */
function buildGoalCandidates(goals: GoalRow[]): QuestCandidate[] {
  const now = Date.now();

  return goals
    // Only leaf-level goals, not epics or objectives
    .filter(g => g.category === 'goal')
    .map(goal => {
      const progressPct = Math.round((goal.progress ?? 0) * 100);
      const daysSinceUpdate = goal.updated_at
        ? Math.floor((now - new Date(goal.updated_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const priority: QuestPriority =
        daysSinceUpdate >= 14 ? 'high'   :
        daysSinceUpdate >= 7  ? 'medium' : 'low';

      const description =
        daysSinceUpdate >= 7
          ? `No progress in ${daysSinceUpdate} days (currently ${progressPct}%)`
          : `Currently at ${progressPct}% — keep pushing`;

      return {
        source_type: 'goal' as const,
        source_id: goal.id,
        source_table: 'goals',
        title: `Make progress on: ${goal.title}`,
        description,
        icon: '🎯',
        category: 'growth' as const,
        target: 1,
        reward_xp: 40,
        priority,
        context_label: `Goal is ${progressPct}% complete`,
        quest_type: 'daily' as const,
        // Stale + incomplete = high urgency
        score: PRIORITY_SCORE[priority] + Math.min(daysSinceUpdate, 50) + (100 - progressPct) * 0.3,
      };
    });
}

/**
 * Build weekly quest candidates from epics (group-level goals) and habits.
 * These give players a 7-day arc rather than just daily wins.
 */
function buildWeeklyCandidates(
  goals: GoalRow[],
  habits: HabitRow[]
): QuestCandidate[] {
  const candidates: QuestCandidate[] = [];

  // "Drive progress on [epic name]" — complete tasks that fall under this epic
  const epics = goals.filter(g => g.category === 'epic').slice(0, 3);
  for (const epic of epics) {
    const progressPct = Math.round((epic.progress ?? 0) * 100);
    candidates.push({
      source_type: 'goal' as const,
      source_id: epic.id,
      source_table: 'goals',
      title: `Advance: ${epic.title}`,
      description: `Complete 3 tasks under this epic this week (currently ${progressPct}%)`,
      icon: '⚡',
      category: 'productivity' as const,
      target: 3,
      reward_xp: 150,
      priority: 'medium' as const,
      context_label: `Epic — ${progressPct}% complete`,
      quest_type: 'weekly' as const,
      score: 60 + (100 - progressPct) * 0.2,
    });
  }

  // "Maintain your [habit] streak for 7 days" — streak-based weekly challenge
  const streakHabits = habits
    .filter(h => h.streak_current >= 3)
    .sort((a, b) => b.streak_current - a.streak_current)
    .slice(0, 2);

  for (const habit of streakHabits) {
    candidates.push({
      source_type: 'habit' as const,
      source_id: habit.id,
      source_table: 'habits',
      title: `Maintain your ${habit.title} streak`,
      description: 'Log this habit every day this week to extend your streak',
      icon: habit.icon ?? '🔥',
      category: 'consistency' as const,
      target: 7,
      reward_xp: 150,
      priority: 'medium' as const,
      context_label: `Current streak: ${habit.streak_current} days`,
      quest_type: 'weekly' as const,
      score: 50 + habit.streak_current * 2,
    });
  }

  return candidates;
}

/**
 * Build weekly "main quest" candidates from objectives with active tasks,
 * and daily "milestone quest" candidates from epics approaching target date.
 */
function buildObjectiveCandidates(
  goals: GoalRow[],
  tasks: TaskRow[]
): { daily: QuestCandidate[]; weekly: QuestCandidate[] } {
  const daily: QuestCandidate[] = [];
  const weekly: QuestCandidate[] = [];

  // Objectives with active tasks → weekly main quest
  const objectives = goals.filter(g => g.category === 'objective');
  const childGoalIds = new Set<string>();

  for (const obj of objectives) {
    // Collect all descendant goal IDs
    const descendants = new Set<string>();
    const queue = [obj.id];
    while (queue.length) {
      const parentId = queue.pop()!;
      for (const g of goals) {
        if (g.parent_goal_id === parentId && !descendants.has(g.id)) {
          descendants.add(g.id);
          queue.push(g.id);
        }
      }
    }

    const objectiveTasks = tasks.filter(t => t.goal_id && descendants.has(t.goal_id));
    if (objectiveTasks.length > 0) {
      weekly.push({
        source_type: 'goal',
        source_id: obj.id,
        source_table: 'goals',
        title: `Complete 3 ${obj.title} tasks this week`,
        description: `${objectiveTasks.length} active tasks under this objective`,
        icon: '🏆',
        category: 'productivity',
        target: 3,
        reward_xp: 100,
        priority: 'medium',
        context_label: `Objective: ${obj.title}`,
        quest_type: 'weekly',
        score: 65 + Math.min(objectiveTasks.length * 3, 30),
      });
    }

    // Track child IDs for descendants lookup
    for (const id of descendants) childGoalIds.add(id);
  }

  // Epics approaching target date → daily milestone quest
  const epics = goals.filter(g => g.category === 'epic' && g.parent_goal_id);
  for (const epic of epics) {
    if (!epic.updated_at) continue;
    // Check if epic has a target date approaching (use updated_at as proxy for target_date since GoalRow doesn't have it)
    const progressPct = Math.round((epic.progress ?? 0) * 100);
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(epic.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Epics stale for 3+ days get a daily milestone quest
    if (daysSinceUpdate >= 3) {
      daily.push({
        source_type: 'goal',
        source_id: epic.id,
        source_table: 'goals',
        title: `Make progress on: ${epic.title}`,
        description: `Epic at ${progressPct}% — no activity in ${daysSinceUpdate} days`,
        icon: '⚡',
        category: 'growth',
        target: 1,
        reward_xp: 60,
        priority: daysSinceUpdate >= 7 ? 'high' : 'medium',
        context_label: `Epic — ${progressPct}% complete`,
        quest_type: 'daily',
        score: 55 + Math.min(daysSinceUpdate * 3, 40),
      });
    }
  }

  return { daily, weekly };
}

/**
 * Build quest candidates from external plugin suggestions.
 * Plugin quests get a relevance boost since they come from real-world triggers.
 */
function buildPluginCandidates(suggestions: PluginSuggestionRow[]): QuestCandidate[] {
  return suggestions.map(s => {
    const priority = (s.priority as QuestPriority) ?? 'medium';
    return {
      source_type: 'plugin' as const,
      source_id: s.id,
      source_table: 'plugin_quest_suggestions',
      title: s.title,
      description: s.description,
      icon: s.icon,
      category: (s.category as QuestCategory) ?? 'productivity',
      target: 1,
      reward_xp: s.reward_xp,
      priority,
      context_label: `From: ${s.plugin_id}`,
      quest_type: 'daily' as const,
      // Plugin quests get a +20 relevance boost — they are real-world triggers
      score: PRIORITY_SCORE[priority] + 20,
    };
  });
}

// ── VARIETY CONSTRAINT ─────────────────────────────────────────────────────────

/**
 * Apply variety: max 2 quests per category in the first pass.
 * Falls back to allowing extras if we can't reach `maxTotal` with the constraint.
 */
function applyVariety(candidates: QuestCandidate[], maxTotal: number): QuestCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const picked: QuestCandidate[] = [];
  const categoryCounts: Partial<Record<QuestCategory, number>> = {};

  // First pass: max 2 per category
  for (const c of sorted) {
    if (picked.length >= maxTotal) break;
    const count = categoryCounts[c.category] ?? 0;
    if (count < 2) {
      picked.push(c);
      categoryCounts[c.category] = count + 1;
    }
  }

  // Second pass: relax constraint to hit `maxTotal`
  if (picked.length < maxTotal) {
    for (const c of sorted) {
      if (picked.length >= maxTotal) break;
      if (!picked.includes(c)) picked.push(c);
    }
  }

  return picked;
}

// ── SYSTEM FALLBACKS ───────────────────────────────────────────────────────────

/**
 * Generic daily fallbacks used when the user has no actionable data yet.
 * These are the v2 equivalents of the v1 random pool — lowest priority.
 */
function getSystemFallbacks(): QuestCandidate[] {
  return [
    {
      source_type: 'system', source_id: null, source_table: null,
      title: 'Complete any task today',
      description: 'Make progress on your to-do list',
      icon: '✅', category: 'productivity', target: 1, reward_xp: 25,
      priority: 'low', context_label: '', quest_type: 'daily', score: 5,
    },
    {
      source_type: 'system', source_id: null, source_table: null,
      title: 'Review your goals',
      description: 'Take 5 minutes to check your goal progress',
      icon: '🎯', category: 'growth', target: 1, reward_xp: 20,
      priority: 'low', context_label: '', quest_type: 'daily', score: 5,
    },
    {
      source_type: 'system', source_id: null, source_table: null,
      title: 'Log a habit today',
      description: 'Keep your streaks alive',
      icon: '🔄', category: 'consistency', target: 1, reward_xp: 20,
      priority: 'low', context_label: '', quest_type: 'daily', score: 5,
    },
  ];
}

function getWeeklySystemFallbacks(): QuestCandidate[] {
  return [
    {
      source_type: 'system', source_id: null, source_table: null,
      title: 'Complete 10 tasks this week',
      description: 'Maintain your productivity momentum',
      icon: '⚔️', category: 'productivity', target: 10, reward_xp: 100,
      priority: 'low', context_label: '', quest_type: 'weekly', score: 5,
    },
    {
      source_type: 'system', source_id: null, source_table: null,
      title: 'Log habits 5 times this week',
      description: 'Consistency is the foundation of results',
      icon: '🔥', category: 'consistency', target: 5, reward_xp: 80,
      priority: 'low', context_label: '', quest_type: 'weekly', score: 5,
    },
    {
      source_type: 'system', source_id: null, source_table: null,
      title: 'Make progress on 3 goals this week',
      description: 'Move your goals forward',
      icon: '🚀', category: 'growth', target: 3, reward_xp: 90,
      priority: 'low', context_label: '', quest_type: 'weekly', score: 5,
    },
  ];
}

// ── DB ROW BUILDER ─────────────────────────────────────────────────────────────

function buildQuestRow(
  userId: string,
  candidate: QuestCandidate,
  expiresAt: string
): Record<string, unknown> {
  return {
    user_id:        userId,
    quest_type:     candidate.quest_type,
    source_type:    candidate.source_type,
    source_id:      candidate.source_id,
    source_table:   candidate.source_table,
    v2_title:       candidate.title,
    v2_description: candidate.description,
    v2_icon:        candidate.icon,
    category:       candidate.category,
    priority:       candidate.priority,
    context_label:  candidate.context_label,
    progress:       0,
    target:         candidate.target,
    reward_xp:      candidate.reward_xp,
    expires_at:     expiresAt,
    completed_at:   null,
    quest_data:     null, // v2 quests do not use the JSON blob
  };
}

// ── EXISTING QUEST CHECK ───────────────────────────────────────────────────────

/**
 * Return any v2 contextual quests already generated for today / this week.
 * We identify v2 quests by the presence of v2_title (null for all v1 rows).
 */
async function getExistingContextualQuests(
  supabase: SupabaseClient,
  userId: string
): Promise<{ daily: ContextualQuest[]; weekly: ContextualQuest[] }> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const monday = new Date();
  const dow = monday.getDay();
  monday.setDate(monday.getDate() - ((dow + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const [dailyRes, weeklyRes] = await Promise.all([
    supabase
      .from('quests')
      .select('*')
      .eq('user_id', userId)
      .eq('quest_type', 'daily')
      .not('v2_title', 'is', null)
      .gte('expires_at', todayStart.toISOString()),

    supabase
      .from('quests')
      .select('*')
      .eq('user_id', userId)
      .eq('quest_type', 'weekly')
      .not('v2_title', 'is', null)
      .gte('expires_at', monday.toISOString()),
  ]);

  return {
    daily:  (dailyRes.data  ?? []) as ContextualQuest[],
    weekly: (weeklyRes.data ?? []) as ContextualQuest[],
  };
}

// ── MAIN GENERATION FUNCTION ───────────────────────────────────────────────────

/**
 * Generate contextual daily + weekly quests for a user.
 *
 * This is the core of Quest Engine v2. It reads the user's actual data and
 * produces quests that feel personal, urgent, and motivating.
 *
 * The function is **idempotent**: calling it multiple times today will not
 * create duplicate quests — it returns the ones already created.
 *
 * @param supabase         - Authenticated Supabase client
 * @param userId           - User ID to generate quests for
 * @param forceRegenerate  - Bypass the idempotency check and regenerate
 */
export async function generateContextualQuests(
  supabase: SupabaseClient,
  userId: string,
  forceRegenerate = false
): Promise<{ daily: ContextualQuest[]; weekly: ContextualQuest[] }> {

  // ── 1. Short-circuit if quests already generated for this period ──
  if (!forceRegenerate) {
    const existing = await getExistingContextualQuests(supabase, userId);
    if (existing.daily.length >= 3 && existing.weekly.length >= 3) {
      return existing;
    }
  }

  // ── 2. Fetch user data in parallel ──
  const today = todayDateString();
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [tasksRes, habitsRes, habitLogsRes, goalsRes, pluginRes] = await Promise.all([

    // Tasks: not done, have due dates, due within next 7 days
    supabase
      .from('tasks')
      .select('id, title, priority, due_date, goal_id')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .lte('due_date', sevenDaysFromNow)
      .order('due_date', { ascending: true })
      .limit(10),

    // Habits: active and not deleted
    supabase
      .from('habits')
      .select('id, title, icon, streak_current')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .limit(20),

    // Habit logs: logged today (to find which habits still need logging)
    supabase
      .from('habit_logs')
      .select('habit_id, date')
      .eq('user_id', userId)
      .eq('date', today),

    // Goals: active, not fully complete, not deleted; stale goals first
    supabase
      .from('goals')
      .select('id, title, category, progress, domain, updated_at, parent_goal_id')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .lt('progress', 1)
      .order('updated_at', { ascending: true }) // most-stale first
      .limit(20),

    // Plugin suggestions: unconsumed, not expired
    supabase
      .from('plugin_quest_suggestions')
      .select('id, plugin_id, title, description, icon, category, reward_xp, priority, metadata')
      .eq('user_id', userId)
      .is('consumed_at', null)
      .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
      .order('priority', { ascending: false }) // urgent suggestions first
      .limit(5),
  ]);

  const tasks   = (tasksRes.data      ?? []) as TaskRow[];
  const habits  = (habitsRes.data     ?? []) as HabitRow[];
  const logs    = (habitLogsRes.data  ?? []) as HabitLogRow[];
  const goals   = (goalsRes.data      ?? []) as GoalRow[];
  const plugins = (pluginRes.data     ?? []) as PluginSuggestionRow[];

  // Build lookup maps
  const goalMap       = new Map<string, GoalRow>(goals.map(g => [g.id, g]));
  const loggedTodayIds = new Set<string>(logs.map(l => l.habit_id));

  // ── 3. Build candidate pools ──
  const objectiveCandidates = buildObjectiveCandidates(goals, tasks);

  const dailyCandidates: QuestCandidate[] = [
    ...buildPluginCandidates(plugins),         // Real-world triggers → highest relevance
    ...buildTaskCandidates(tasks, goalMap),    // Tasks with due dates
    ...buildHabitCandidates(habits, loggedTodayIds), // Habits not yet done today
    ...buildGoalCandidates(goals),             // Stale / low-progress goals
    ...objectiveCandidates.daily,              // Epics approaching deadlines
  ];

  const weeklyCandidates: QuestCandidate[] = [
    ...buildWeeklyCandidates(goals, habits),
    ...objectiveCandidates.weekly,             // Objective main quests
  ];

  // ── 4. Fill with system fallbacks if too few candidates ──
  if (dailyCandidates.length < 3) {
    dailyCandidates.push(...getSystemFallbacks());
  }
  if (weeklyCandidates.length < 3) {
    weeklyCandidates.push(...getWeeklySystemFallbacks());
  }

  // ── 5. Apply variety constraint and pick the best ──
  const selectedDaily  = applyVariety(dailyCandidates,  5); // up to 5 daily
  const selectedWeekly = applyVariety(weeklyCandidates, 3); // exactly 3 weekly

  // ── 6. Persist to DB ──
  const dailyExpiry  = getEndOfDay();
  const weeklyExpiry = getEndOfWeek();

  const [dailyInsertRes, weeklyInsertRes] = await Promise.all([
    supabase
      .from('quests')
      .insert(selectedDaily.map(c => buildQuestRow(userId, c, dailyExpiry)))
      .select(),
    supabase
      .from('quests')
      .insert(selectedWeekly.map(c => buildQuestRow(userId, c, weeklyExpiry)))
      .select(),
  ]);

  // ── 7. Mark consumed plugin suggestions ──
  const consumedPluginIds = plugins
    .filter(p => selectedDaily.some(d => d.source_id === p.id))
    .map(p => p.id);

  if (consumedPluginIds.length > 0) {
    await supabase
      .from('plugin_quest_suggestions')
      .update({ consumed_at: new Date().toISOString() })
      .in('id', consumedPluginIds);
  }

  return {
    daily:  (dailyInsertRes.data  ?? []) as ContextualQuest[],
    weekly: (weeklyInsertRes.data ?? []) as ContextualQuest[],
  };
}

// ── FETCH ACTIVE QUESTS ────────────────────────────────────────────────────────

/**
 * Fetch all active quests (v1 + v2) for a user, sorted by priority.
 *
 * Incomplete quests appear before completed ones.
 * Within incomplete quests, urgent > high > medium > low.
 */
export async function getContextualQuests(
  supabase: SupabaseClient,
  userId: string
): Promise<{ daily: ContextualQuest[]; weekly: ContextualQuest[]; epic: ContextualQuest[] }> {
  const now = new Date().toISOString();

  const { data: all } = await supabase
    .from('quests')
    .select('*')
    .eq('user_id', userId)
    .or(`expires_at.gte.${now},quest_type.eq.epic`)
    .order('created_at', { ascending: false });

  const quests = (all ?? []) as ContextualQuest[];

  const sortQuests = (qs: ContextualQuest[]): ContextualQuest[] =>
    [...qs].sort((a, b) => {
      if (a.completed_at && !b.completed_at) return  1;
      if (!a.completed_at && b.completed_at) return -1;
      const ap = a.priority ?? 'medium';
      const bp = b.priority ?? 'medium';
      return PRIORITY_SCORE[bp] - PRIORITY_SCORE[ap];
    });

  return {
    daily:  sortQuests(quests.filter(q => q.quest_type === 'daily')),
    weekly: sortQuests(quests.filter(q => q.quest_type === 'weekly')),
    epic:   sortQuests(quests.filter(q => q.quest_type === 'epic')),
  };
}

// ── DISPLAY HELPERS ────────────────────────────────────────────────────────────

/** Get the display title for any quest (v1 or v2) */
export function getQuestTitle(quest: ContextualQuest): string {
  return quest.v2_title ?? quest.quest_data?.title ?? 'Quest';
}

/** Get the display description for any quest (v1 or v2) */
export function getQuestDescription(quest: ContextualQuest): string {
  return quest.v2_description ?? quest.quest_data?.description ?? '';
}

/** Get the display icon for any quest (v1 or v2) */
export function getQuestIcon(quest: ContextualQuest): string {
  return quest.v2_icon ?? quest.quest_data?.icon ?? '📋';
}

/** Get priority badge colour */
export function getPriorityColour(priority: QuestPriority): string {
  switch (priority) {
    case 'urgent': return '#EF4444'; // red
    case 'high':   return '#F97316'; // orange
    case 'medium': return '#EAB308'; // yellow
    case 'low':    return '#6B7280'; // grey
  }
}

/** Get priority badge label */
export function getPriorityLabel(priority: QuestPriority): string {
  switch (priority) {
    case 'urgent': return '🔴 URGENT';
    case 'high':   return '🟠 HIGH';
    case 'medium': return '🟡 MEDIUM';
    case 'low':    return '⬜ LOW';
  }
}
