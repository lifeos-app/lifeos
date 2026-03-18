// LifeOS Gamification — Daily/Weekly/Epic Quest System
//
// v1: Random pool quests (original — kept for backward compatibility)
// v2: Contextual quests derived from real user data → see quest-engine-v2.ts
//
// ── Re-exports for convenience ──────────────────────────────────────────────
export {
  generateContextualQuests,
  getContextualQuests,
  getQuestTitle,
  getQuestDescription,
  getQuestIcon,
  getPriorityColour,
  getPriorityLabel,
} from './quest-engine-v2';
export type {
  ContextualQuest,
  QuestSourceType,
  QuestPriority,
  QuestCategory,
} from './quest-engine-v2';

export { completeQuest } from './quest-completion';
export type { QuestCompletionResult } from './quest-completion';

import type { SupabaseClient } from '@supabase/supabase-js';

export type QuestType = 'daily' | 'weekly' | 'epic';

export interface QuestTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: QuestType;
  target: number;
  reward_xp: number;
  /** action_type used to track progress, or 'custom' for special checks */
  trackingAction: string;
}

export interface ActiveQuest {
  id: string;
  user_id: string;
  quest_type: QuestType;
  quest_data: QuestTemplate;
  progress: number;
  target: number;
  reward_xp: number;
  expires_at: string;
  completed_at: string | null;
}

// ── DAILY QUEST POOL ──
const DAILY_QUESTS: QuestTemplate[] = [
  {
    id: 'daily_tasks_3',
    title: 'Task Warrior',
    description: 'Complete 3 tasks today',
    icon: '⚔️',
    type: 'daily',
    target: 3,
    reward_xp: 30,
    trackingAction: 'task_complete',
  },
  {
    id: 'daily_tasks_5',
    title: 'Unstoppable',
    description: 'Complete 5 tasks today',
    icon: '🔥',
    type: 'daily',
    target: 5,
    reward_xp: 50,
    trackingAction: 'task_complete',
  },
  {
    id: 'daily_habit_all',
    title: 'Creature of Habit',
    description: 'Complete all your habits today',
    icon: '🔄',
    type: 'daily',
    target: 1,
    reward_xp: 40,
    trackingAction: 'all_habits_done',
  },
  {
    id: 'daily_journal',
    title: 'Reflect & Write',
    description: 'Write a journal entry',
    icon: '📝',
    type: 'daily',
    target: 1,
    reward_xp: 20,
    trackingAction: 'journal_entry',
  },
  {
    id: 'daily_health',
    title: 'Vital Signs',
    description: 'Log your health metrics',
    icon: '❤️',
    type: 'daily',
    target: 1,
    reward_xp: 20,
    trackingAction: 'health_log',
  },
  {
    id: 'daily_finance',
    title: 'Money Tracker',
    description: 'Log an income or expense',
    icon: '💰',
    type: 'daily',
    target: 1,
    reward_xp: 15,
    trackingAction: 'financial_entry',
  },
  {
    id: 'daily_early_bird',
    title: 'Early Bird',
    description: 'Complete any action before 7am',
    icon: '🌅',
    type: 'daily',
    target: 1,
    reward_xp: 25,
    trackingAction: 'early_action',
  },
  {
    id: 'daily_water',
    title: 'Stay Hydrated',
    description: 'Drink 8 glasses of water',
    icon: '💧',
    type: 'daily',
    target: 8,
    reward_xp: 20,
    trackingAction: 'water_intake',
  },
  {
    id: 'daily_combo',
    title: 'Variety Pack',
    description: 'Complete 3 different types of actions',
    icon: '🎲',
    type: 'daily',
    target: 3,
    reward_xp: 35,
    trackingAction: 'unique_action_types',
  },
];

// ── WEEKLY QUEST POOL ──
const WEEKLY_QUESTS: QuestTemplate[] = [
  {
    id: 'weekly_tasks_15',
    title: 'Weekly Warrior',
    description: 'Complete 15 tasks this week',
    icon: '⚔️',
    type: 'weekly',
    target: 15,
    reward_xp: 150,
    trackingAction: 'task_complete',
  },
  {
    id: 'weekly_habits_5',
    title: 'Habit Dedication',
    description: 'Complete all habits on 5 out of 7 days',
    icon: '🏋️',
    type: 'weekly',
    target: 5,
    reward_xp: 200,
    trackingAction: 'all_habits_days',
  },
  {
    id: 'weekly_journal_5',
    title: 'Weekly Reflection',
    description: 'Write 5 journal entries this week',
    icon: '📖',
    type: 'weekly',
    target: 5,
    reward_xp: 100,
    trackingAction: 'journal_entry',
  },
  {
    id: 'weekly_health_7',
    title: 'Health Week',
    description: 'Log health metrics every day this week',
    icon: '💪',
    type: 'weekly',
    target: 7,
    reward_xp: 150,
    trackingAction: 'health_log',
  },
  {
    id: 'weekly_finance_track',
    title: 'Financial Awareness',
    description: 'Log expenses 5 days this week',
    icon: '📊',
    type: 'weekly',
    target: 5,
    reward_xp: 100,
    trackingAction: 'financial_entry',
  },
  {
    id: 'weekly_goal_progress',
    title: 'Goal Mover',
    description: 'Make progress on 3 different goals',
    icon: '🎯',
    type: 'weekly',
    target: 3,
    reward_xp: 120,
    trackingAction: 'goal_progress',
  },
  {
    id: 'weekly_streak',
    title: 'Seven Day Fire',
    description: 'Log into LifeOS every day this week',
    icon: '🔥',
    type: 'weekly',
    target: 7,
    reward_xp: 100,
    trackingAction: 'daily_login',
  },
];

// ── EPIC QUESTS (long-term) ──
const EPIC_QUESTS: QuestTemplate[] = [
  {
    id: 'epic_first_objective',
    title: 'The Grand Vision',
    description: 'Complete your first Objective',
    icon: '🏔️',
    type: 'epic',
    target: 1,
    reward_xp: 1000,
    trackingAction: 'objective_complete',
  },
  {
    id: 'epic_30_day_streak',
    title: 'The Unbreakable',
    description: 'Maintain a 30-day activity streak',
    icon: '⛓️',
    type: 'epic',
    target: 30,
    reward_xp: 500,
    trackingAction: 'streak_days',
  },
  {
    id: 'epic_100_tasks',
    title: 'Century Club',
    description: 'Complete 100 tasks',
    icon: '💯',
    type: 'epic',
    target: 100,
    reward_xp: 750,
    trackingAction: 'total_tasks',
  },
  {
    id: 'epic_all_modules',
    title: 'Full Setup',
    description: 'Use every module in LifeOS at least once',
    icon: '🧩',
    type: 'epic',
    target: 7,
    reward_xp: 300,
    trackingAction: 'modules_used',
  },
  {
    id: 'epic_level_25',
    title: 'Master Rank',
    description: 'Reach Level 25',
    icon: '👑',
    type: 'epic',
    target: 25,
    reward_xp: 500,
    trackingAction: 'level_reached',
  },
  {
    id: 'epic_10_achievements',
    title: 'Achievement Hunter',
    description: 'Unlock 10 achievements',
    icon: '🏅',
    type: 'epic',
    target: 10,
    reward_xp: 300,
    trackingAction: 'achievements_unlocked',
  },
];

// ── QUEST GENERATION ──

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Get midnight tonight in ISO string */
function getEndOfDay(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Get end of current week (Sunday 23:59) */
function getEndOfWeek(): string {
  const d = new Date();
  const daysUntilSunday = 7 - d.getDay();
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Generate daily quests for a user (picks 3 random from pool) */
export async function generateDailyQuests(
  supabase: SupabaseClient,
  userId: string
): Promise<ActiveQuest[]> {
  // Check if quests already exist for today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existing } = await supabase
    .from('quests')
    .select('*')
    .eq('user_id', userId)
    .eq('quest_type', 'daily')
    .gte('expires_at', todayStart.toISOString());

  if (existing && existing.length >= 3) {
    return existing as ActiveQuest[];
  }

  // Pick 3 random daily quests
  const selected = shuffleArray(DAILY_QUESTS).slice(0, 3);
  const expiry = getEndOfDay();

  const quests: Omit<ActiveQuest, 'id'>[] = selected.map(q => ({
    user_id: userId,
    quest_type: 'daily' as const,
    quest_data: q,
    progress: 0,
    target: q.target,
    reward_xp: q.reward_xp,
    expires_at: expiry,
    completed_at: null,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from('quests')
    .insert(quests)
    .select();

  if (insertErr) {
    // Race condition — another component already inserted. Re-fetch.
    const { data: refetched } = await supabase.from('quests').select('*')
      .eq('user_id', userId).eq('quest_type', 'daily')
      .gte('expires_at', todayStart.toISOString());
    return (refetched || []) as ActiveQuest[];
  }

  return (inserted || []) as ActiveQuest[];
}

/** Generate weekly quests (picks 3 random) */
export async function generateWeeklyQuests(
  supabase: SupabaseClient,
  userId: string
): Promise<ActiveQuest[]> {
  // Check Monday of current week
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const { data: existing } = await supabase
    .from('quests')
    .select('*')
    .eq('user_id', userId)
    .eq('quest_type', 'weekly')
    .gte('expires_at', monday.toISOString());

  if (existing && existing.length >= 3) {
    return existing as ActiveQuest[];
  }

  const selected = shuffleArray(WEEKLY_QUESTS).slice(0, 3);
  const expiry = getEndOfWeek();

  const quests: Omit<ActiveQuest, 'id'>[] = selected.map(q => ({
    user_id: userId,
    quest_type: 'weekly' as const,
    quest_data: q,
    progress: 0,
    target: q.target,
    reward_xp: q.reward_xp,
    expires_at: expiry,
    completed_at: null,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from('quests')
    .insert(quests)
    .select();

  if (insertErr) {
    const { data: refetched } = await supabase.from('quests').select('*')
      .eq('user_id', userId).eq('quest_type', 'weekly')
      .gte('expires_at', monday.toISOString());
    return (refetched || []) as ActiveQuest[];
  }

  return (inserted || []) as ActiveQuest[];
}

/** Generate epic quests (all of them, one time) */
export async function generateEpicQuests(
  supabase: SupabaseClient,
  userId: string
): Promise<ActiveQuest[]> {
  const { data: existing } = await supabase
    .from('quests')
    .select('*')
    .eq('user_id', userId)
    .eq('quest_type', 'epic');

  if (existing && existing.length >= EPIC_QUESTS.length) {
    return existing as ActiveQuest[];
  }

  const existingIds = new Set((existing || []).map((q: any) => q.quest_data?.id));
  const newQuests = EPIC_QUESTS.filter(q => !existingIds.has(q.id));

  // Epic quests never expire (far future)
  const farFuture = new Date('2099-12-31T23:59:59Z').toISOString();

  const quests: Omit<ActiveQuest, 'id'>[] = newQuests.map(q => ({
    user_id: userId,
    quest_type: 'epic' as const,
    quest_data: q,
    progress: 0,
    target: q.target,
    reward_xp: q.reward_xp,
    expires_at: farFuture,
    completed_at: null,
  }));

  if (quests.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from('quests')
      .insert(quests)
      .select();
    if (insertErr) {
      const { data: refetched } = await supabase.from('quests').select('*')
        .eq('user_id', userId).eq('quest_type', 'epic')
        .is('completed_at', null);
      return (refetched || []) as ActiveQuest[];
    }
    return [...(existing || []), ...(inserted || [])] as ActiveQuest[];
  }

  return (existing || []) as ActiveQuest[];
}

/** Update quest progress based on an action */
export async function updateQuestProgress(
  supabase: SupabaseClient,
  userId: string,
  actionType: string
): Promise<ActiveQuest[]> {
  const now = new Date().toISOString();

  // Get all active (non-completed, non-expired) quests
  const { data: activeQuests } = await supabase
    .from('quests')
    .select('*')
    .eq('user_id', userId)
    .is('completed_at', null)
    .gte('expires_at', now);

  if (!activeQuests || activeQuests.length === 0) return [];

  const completedQuests: ActiveQuest[] = [];

  for (const quest of activeQuests) {
    const template = quest.quest_data as QuestTemplate;

    // Check if this action matches the quest's tracking action
    const matches = doesActionMatch(actionType, template.trackingAction);
    if (!matches) continue;

    const newProgress = Math.min(quest.progress + 1, quest.target);
    const isComplete = newProgress >= quest.target;

    await supabase
      .from('quests')
      .update({
        progress: newProgress,
        completed_at: isComplete ? now : null,
      })
      .eq('id', quest.id);

    if (isComplete) {
      completedQuests.push({ ...quest, progress: newProgress, completed_at: now });
    }
  }

  return completedQuests;
}

function doesActionMatch(action: string, trackingAction: string): boolean {
  // Direct match
  if (action === trackingAction) return true;

  // Mapping: XP action types → quest tracking actions
  const mappings: Record<string, string[]> = {
    'task_complete': ['task_complete'],
    'habit_log': ['all_habits_done', 'all_habits_days'],
    'journal_entry': ['journal_entry'],
    'health_log': ['health_log', 'water_intake'],
    'financial_entry': ['financial_entry'],
    'goal_complete': ['goal_progress', 'objective_complete'],
    'schedule_event': ['daily_login'],
    'page_visit': ['modules_used'],
    'ai_message': [],
  };

  const mapped = mappings[action] || [];
  return mapped.includes(trackingAction);
}

/** Get all active quests for a user */
export async function getActiveQuests(
  supabase: SupabaseClient,
  userId: string
): Promise<{ daily: ActiveQuest[]; weekly: ActiveQuest[]; epic: ActiveQuest[] }> {
  const now = new Date().toISOString();

  const { data: all } = await supabase
    .from('quests')
    .select('*')
    .eq('user_id', userId)
    .or(`expires_at.gte.${now},quest_type.eq.epic`)
    .order('created_at', { ascending: false });

  const quests = (all || []) as ActiveQuest[];

  return {
    daily: quests.filter(q => q.quest_type === 'daily'),
    weekly: quests.filter(q => q.quest_type === 'weekly'),
    epic: quests.filter(q => q.quest_type === 'epic'),
  };
}
