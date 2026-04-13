// LifeOS Gamification — Achievement / Badge System
// 60+ achievements across 7 categories

import type { SupabaseClient } from '@supabase/supabase-js';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type AchievementCategory =
  | 'consistency'
  | 'productivity'
  | 'financial'
  | 'health'
  | 'social'
  | 'knowledge'
  | 'meta';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  category: AchievementCategory;
  xp_reward: number;
  /** Function name used to evaluate unlock condition */
  condition: string;
  /** Numeric target for progress-based achievements */
  target?: number;
  /** Whether this is a hidden/secret achievement */
  secret?: boolean;
}

export interface UserAchievement {
  achievement_id: string;
  unlocked_at: string | null;
  progress: number;
}

// ── RARITY COLORS ──
export const RARITY_COLORS: Record<AchievementRarity, string> = {
  common: '#8BA4BE',
  rare: '#00D4FF',
  epic: '#A855F7',
  legendary: '#FFD700',
};

export const RARITY_LABELS: Record<AchievementRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

// ── ALL ACHIEVEMENTS ──
export const ACHIEVEMENTS: Achievement[] = [
  // ─── CONSISTENCY ───
  {
    id: 'first_step',
    title: 'First Step',
    description: 'Complete your first action in LifeOS',
    icon: '👣',
    rarity: 'common',
    category: 'consistency',
    xp_reward: 25,
    condition: 'total_actions_gte',
    target: 1,
  },
  {
    id: 'getting_started',
    title: 'Getting Started',
    description: 'Complete 10 actions',
    icon: '🌱',
    rarity: 'common',
    category: 'consistency',
    xp_reward: 50,
    condition: 'total_actions_gte',
    target: 10,
  },
  {
    id: 'iron_will',
    title: 'Iron Will',
    description: 'Maintain a 7-day streak',
    icon: '🔗',
    rarity: 'rare',
    category: 'consistency',
    xp_reward: 100,
    condition: 'streak_gte',
    target: 7,
  },
  {
    id: 'unstoppable',
    title: 'Unstoppable',
    description: 'Maintain a 30-day streak',
    icon: '🔥',
    rarity: 'epic',
    category: 'consistency',
    xp_reward: 500,
    condition: 'streak_gte',
    target: 30,
  },
  {
    id: 'centurion',
    title: 'Centurion',
    description: 'Maintain a 100-day streak',
    icon: '💯',
    rarity: 'legendary',
    category: 'consistency',
    xp_reward: 2000,
    condition: 'streak_gte',
    target: 100,
  },
  {
    id: 'immortal',
    title: 'Immortal',
    description: 'Maintain a 365-day streak',
    icon: '♾️',
    rarity: 'legendary',
    category: 'consistency',
    xp_reward: 10000,
    condition: 'streak_gte',
    target: 365,
  },
  {
    id: 'habit_starter',
    title: 'Habit Starter',
    description: 'Create your first habit',
    icon: '🔄',
    rarity: 'common',
    category: 'consistency',
    xp_reward: 25,
    condition: 'habits_created_gte',
    target: 1,
  },
  {
    id: 'habit_builder',
    title: 'Habit Builder',
    description: 'Create 5 habits',
    icon: '🏗️',
    rarity: 'rare',
    category: 'consistency',
    xp_reward: 75,
    condition: 'habits_created_gte',
    target: 5,
  },
  {
    id: 'daily_ritual',
    title: 'Daily Ritual',
    description: 'Complete all habits in one day',
    icon: '🧘',
    rarity: 'rare',
    category: 'consistency',
    xp_reward: 100,
    condition: 'all_habits_one_day',
  },
  {
    id: 'perfect_week',
    title: 'Perfect Week',
    description: 'Complete all habits every day for 7 days',
    icon: '⭐',
    rarity: 'epic',
    category: 'consistency',
    xp_reward: 500,
    condition: 'perfect_habit_week',
  },

  // ─── PRODUCTIVITY ───
  {
    id: 'task_slayer',
    title: 'Task Slayer',
    description: 'Complete 100 tasks',
    icon: '⚔️',
    rarity: 'rare',
    category: 'productivity',
    xp_reward: 200,
    condition: 'tasks_completed_gte',
    target: 100,
  },
  {
    id: 'task_machine',
    title: 'Task Machine',
    description: 'Complete 500 tasks',
    icon: '🤖',
    rarity: 'epic',
    category: 'productivity',
    xp_reward: 1000,
    condition: 'tasks_completed_gte',
    target: 500,
  },
  {
    id: 'task_legend',
    title: 'Task Legend',
    description: 'Complete 1000 tasks',
    icon: '👑',
    rarity: 'legendary',
    category: 'productivity',
    xp_reward: 3000,
    condition: 'tasks_completed_gte',
    target: 1000,
  },
  {
    id: 'first_goal',
    title: 'Aim True',
    description: 'Complete your first goal',
    icon: '🎯',
    rarity: 'common',
    category: 'productivity',
    xp_reward: 50,
    condition: 'goals_completed_gte',
    target: 1,
  },
  {
    id: 'goal_crusher',
    title: 'Goal Crusher',
    description: 'Complete 10 goals',
    icon: '💪',
    rarity: 'rare',
    category: 'productivity',
    xp_reward: 300,
    condition: 'goals_completed_gte',
    target: 10,
  },
  {
    id: 'epic_victory',
    title: 'Epic Victory',
    description: 'Complete an Epic',
    icon: '⚡',
    rarity: 'epic',
    category: 'productivity',
    xp_reward: 500,
    condition: 'epics_completed_gte',
    target: 1,
  },
  {
    id: 'objective_master',
    title: 'Objective Master',
    description: 'Complete an Objective',
    icon: '🏔️',
    rarity: 'legendary',
    category: 'productivity',
    xp_reward: 1500,
    condition: 'objectives_completed_gte',
    target: 1,
  },
  {
    id: 'five_in_a_day',
    title: 'Productive Day',
    description: 'Complete 5 tasks in a single day',
    icon: '📋',
    rarity: 'common',
    category: 'productivity',
    xp_reward: 50,
    condition: 'tasks_in_day_gte',
    target: 5,
  },
  {
    id: 'ten_in_a_day',
    title: 'Machine Mode',
    description: 'Complete 10 tasks in a single day',
    icon: '🔥',
    rarity: 'rare',
    category: 'productivity',
    xp_reward: 150,
    condition: 'tasks_in_day_gte',
    target: 10,
  },
  {
    id: 'zero_inbox',
    title: 'Inbox Zero',
    description: 'Clear all tasks from your inbox',
    icon: '📭',
    rarity: 'rare',
    category: 'productivity',
    xp_reward: 100,
    condition: 'inbox_zero',
  },

  // ─── FINANCIAL ───
  {
    id: 'first_dollar',
    title: 'First Dollar',
    description: 'Log your first income',
    icon: '💵',
    rarity: 'common',
    category: 'financial',
    xp_reward: 25,
    condition: 'income_logged_gte',
    target: 1,
  },
  {
    id: 'expense_tracker',
    title: 'Expense Tracker',
    description: 'Log 50 expenses',
    icon: '📊',
    rarity: 'rare',
    category: 'financial',
    xp_reward: 100,
    condition: 'expenses_logged_gte',
    target: 50,
  },
  {
    id: 'budget_master',
    title: 'Budget Master',
    description: 'Stay under budget for 3 consecutive months',
    icon: '🎓',
    rarity: 'epic',
    category: 'financial',
    xp_reward: 500,
    condition: 'under_budget_months_gte',
    target: 3,
  },
  {
    id: 'saving_streak',
    title: 'Saving Streak',
    description: 'Positive net income for 6 consecutive months',
    icon: '🏦',
    rarity: 'epic',
    category: 'financial',
    xp_reward: 750,
    condition: 'positive_months_gte',
    target: 6,
  },
  {
    id: 'billionaire',
    title: 'Bill Slayer',
    description: 'Pay all bills on time for 3 months',
    icon: '💳',
    rarity: 'rare',
    category: 'financial',
    xp_reward: 200,
    condition: 'bills_on_time_months_gte',
    target: 3,
  },
  {
    id: 'money_mogul',
    title: 'Money Mogul',
    description: 'Log $10,000+ total income',
    icon: '🤑',
    rarity: 'legendary',
    category: 'financial',
    xp_reward: 2000,
    condition: 'total_income_gte',
    target: 10000,
  },
  {
    id: 'diversified',
    title: 'Diversified',
    description: 'Have 3+ income sources tracked',
    icon: '🌐',
    rarity: 'rare',
    category: 'financial',
    xp_reward: 150,
    condition: 'income_sources_gte',
    target: 3,
  },

  // ─── HEALTH ───
  {
    id: 'early_riser',
    title: 'Early Riser',
    description: 'Log a health metric before 7am for 7 days',
    icon: '🌅',
    rarity: 'rare',
    category: 'health',
    xp_reward: 150,
    condition: 'early_health_logs_gte',
    target: 7,
  },
  {
    id: 'hydrated',
    title: 'Hydrated',
    description: 'Hit your water target for 30 days',
    icon: '💧',
    rarity: 'epic',
    category: 'health',
    xp_reward: 300,
    condition: 'water_target_days_gte',
    target: 30,
  },
  {
    id: 'sleep_champion',
    title: 'Sleep Champion',
    description: 'Log 7+ hours of sleep for 14 consecutive nights',
    icon: '😴',
    rarity: 'rare',
    category: 'health',
    xp_reward: 200,
    condition: 'good_sleep_days_gte',
    target: 14,
  },
  {
    id: 'health_tracker',
    title: 'Health Tracker',
    description: 'Log health metrics for 30 days',
    icon: '❤️',
    rarity: 'rare',
    category: 'health',
    xp_reward: 200,
    condition: 'health_logs_gte',
    target: 30,
  },
  {
    id: 'mood_master',
    title: 'Mood Master',
    description: 'Log mood every day for 30 days',
    icon: '🧠',
    rarity: 'epic',
    category: 'health',
    xp_reward: 400,
    condition: 'mood_logs_gte',
    target: 30,
  },
  {
    id: 'weight_warrior',
    title: 'Weight Warrior',
    description: 'Track your weight for 90 days',
    icon: '⚖️',
    rarity: 'epic',
    category: 'health',
    xp_reward: 500,
    condition: 'weight_logs_gte',
    target: 90,
  },
  {
    id: 'energy_master',
    title: 'Energy Master',
    description: 'Average energy score of 4+ for a month',
    icon: '⚡',
    rarity: 'rare',
    category: 'health',
    xp_reward: 200,
    condition: 'avg_energy_month_gte',
    target: 4,
  },

  // ─── KNOWLEDGE ───
  {
    id: 'first_entry',
    title: 'Dear Diary',
    description: 'Write your first journal entry',
    icon: '📝',
    rarity: 'common',
    category: 'knowledge',
    xp_reward: 25,
    condition: 'journal_entries_gte',
    target: 1,
  },
  {
    id: 'journaler',
    title: 'Journaler',
    description: 'Write 30 journal entries',
    icon: '📖',
    rarity: 'rare',
    category: 'knowledge',
    xp_reward: 200,
    condition: 'journal_entries_gte',
    target: 30,
  },
  {
    id: 'chronicler',
    title: 'Chronicler',
    description: 'Write 100 journal entries',
    icon: '📚',
    rarity: 'epic',
    category: 'knowledge',
    xp_reward: 500,
    condition: 'journal_entries_gte',
    target: 100,
  },
  {
    id: 'journal_streak_7',
    title: 'Week of Words',
    description: '7-day journal streak',
    icon: '✍️',
    rarity: 'rare',
    category: 'knowledge',
    xp_reward: 100,
    condition: 'journal_streak_gte',
    target: 7,
  },
  {
    id: 'journal_streak_30',
    title: 'Month of Reflection',
    description: '30-day journal streak',
    icon: '🪶',
    rarity: 'epic',
    category: 'knowledge',
    xp_reward: 400,
    condition: 'journal_streak_gte',
    target: 30,
  },
  {
    id: 'voice_of_god',
    title: 'Voice of God',
    description: 'Send 100 messages to the AI assistant',
    icon: '🤖',
    rarity: 'rare',
    category: 'knowledge',
    xp_reward: 200,
    condition: 'ai_messages_gte',
    target: 100,
  },
  {
    id: 'wisdom_seeker',
    title: 'Wisdom Seeker',
    description: 'Send 500 messages to the AI assistant',
    icon: '🧙',
    rarity: 'epic',
    category: 'knowledge',
    xp_reward: 500,
    condition: 'ai_messages_gte',
    target: 500,
  },

  // ─── SOCIAL ───
  {
    id: 'team_player',
    title: 'Team Player',
    description: 'Connect your first external system',
    icon: '🤝',
    rarity: 'common',
    category: 'social',
    xp_reward: 50,
    condition: 'systems_connected_gte',
    target: 1,
  },
  {
    id: 'networked',
    title: 'Networked',
    description: 'Connect 3 external systems',
    icon: '🌐',
    rarity: 'rare',
    category: 'social',
    xp_reward: 150,
    condition: 'systems_connected_gte',
    target: 3,
  },
  {
    id: 'event_planner',
    title: 'Event Planner',
    description: 'Create 50 schedule events',
    icon: '📅',
    rarity: 'rare',
    category: 'social',
    xp_reward: 150,
    condition: 'events_created_gte',
    target: 50,
  },

  // ─── META ───
  {
    id: 'explorer',
    title: 'Explorer',
    description: 'Visit every page in LifeOS',
    icon: '🗺️',
    rarity: 'rare',
    category: 'meta',
    xp_reward: 100,
    condition: 'all_pages_visited',
  },
  {
    id: 'completionist',
    title: 'Completionist',
    description: 'Set up all LifeOS modules (goals, habits, finance, health, journal)',
    icon: '🏅',
    rarity: 'rare',
    category: 'meta',
    xp_reward: 200,
    condition: 'all_modules_setup',
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Complete an action between midnight and 4am',
    icon: '🦉',
    rarity: 'common',
    category: 'meta',
    xp_reward: 30,
    condition: 'night_owl_action',
  },
  {
    id: 'early_bird_ach',
    title: 'Early Bird',
    description: 'Complete an action before 6am 7 times',
    icon: '🐦',
    rarity: 'rare',
    category: 'meta',
    xp_reward: 100,
    condition: 'early_bird_actions_gte',
    target: 7,
  },
  {
    id: 'combo_king',
    title: 'Combo King',
    description: 'Trigger a ×2 combo multiplier',
    icon: '⚡',
    rarity: 'rare',
    category: 'meta',
    xp_reward: 100,
    condition: 'mega_combo_triggered',
  },
  {
    id: 'level_10',
    title: 'Double Digits',
    description: 'Reach Level 10',
    icon: '🔟',
    rarity: 'common',
    category: 'meta',
    xp_reward: 100,
    condition: 'level_gte',
    target: 10,
  },
  {
    id: 'level_25',
    title: 'Quarter Century',
    description: 'Reach Level 25',
    icon: '🥈',
    rarity: 'rare',
    category: 'meta',
    xp_reward: 250,
    condition: 'level_gte',
    target: 25,
  },
  {
    id: 'level_50',
    title: 'Half Way',
    description: 'Reach Level 50',
    icon: '🥇',
    rarity: 'epic',
    category: 'meta',
    xp_reward: 1000,
    condition: 'level_gte',
    target: 50,
  },
  {
    id: 'level_75',
    title: 'Legendary Status',
    description: 'Reach Level 75',
    icon: '💎',
    rarity: 'legendary',
    category: 'meta',
    xp_reward: 2500,
    condition: 'level_gte',
    target: 75,
  },
  {
    id: 'level_99',
    title: 'Transcendence',
    description: 'Reach Level 99 — the maximum',
    icon: '✨',
    rarity: 'legendary',
    category: 'meta',
    xp_reward: 10000,
    condition: 'level_gte',
    target: 99,
  },
  {
    id: 'one_month',
    title: 'One Month In',
    description: 'Use LifeOS for 30 days',
    icon: '📆',
    rarity: 'common',
    category: 'meta',
    xp_reward: 75,
    condition: 'days_active_gte',
    target: 30,
  },
  {
    id: 'one_year',
    title: 'Year One',
    description: 'Use LifeOS for 365 days',
    icon: '🎂',
    rarity: 'legendary',
    category: 'meta',
    xp_reward: 5000,
    condition: 'days_active_gte',
    target: 365,
  },
  {
    id: 'feedback_hero',
    title: 'Feedback Hero',
    description: 'Submit feedback to help improve LifeOS',
    icon: '💬',
    rarity: 'common',
    category: 'meta',
    xp_reward: 50,
    condition: 'feedback_submitted',
  },
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    description: 'Complete 3 tasks within 10 minutes',
    icon: '⏱️',
    rarity: 'rare',
    category: 'meta',
    xp_reward: 100,
    condition: 'tasks_in_10min_gte',
    target: 3,
    secret: true,
  },

  // ─── ACADEMY / LESSONS ───
  {
    id: 'first_lesson',
    title: 'First Steps',
    description: 'Complete your first lesson step',
    icon: '📖',
    rarity: 'common',
    category: 'knowledge',
    xp_reward: 25,
    condition: 'lesson_steps_gte',
    target: 1,
  },
  {
    id: 'lesson_apprentice',
    title: 'Apprentice Learner',
    description: 'Complete 10 lesson steps',
    icon: '🎓',
    rarity: 'common',
    category: 'knowledge',
    xp_reward: 75,
    condition: 'lesson_steps_gte',
    target: 10,
  },
  {
    id: 'lesson_scholar',
    title: 'Scholar',
    description: 'Complete 25 lesson steps',
    icon: '📚',
    rarity: 'rare',
    category: 'knowledge',
    xp_reward: 200,
    condition: 'lesson_steps_gte',
    target: 25,
  },
  {
    id: 'lesson_sage',
    title: 'Sage',
    description: 'Complete 50 lesson steps',
    icon: '🏛️',
    rarity: 'epic',
    category: 'knowledge',
    xp_reward: 500,
    condition: 'lesson_steps_gte',
    target: 50,
  },
  {
    id: 'lesson_polymath',
    title: 'Polymath',
    description: 'Complete 100 lesson steps across multiple disciplines',
    icon: '🧠',
    rarity: 'legendary',
    category: 'knowledge',
    xp_reward: 2000,
    condition: 'lesson_steps_gte',
    target: 100,
  },
  {
    id: 'piano_first_note',
    title: 'First Note',
    description: 'Complete your first Piano Academy step',
    icon: '🎵',
    rarity: 'common',
    category: 'knowledge',
    xp_reward: 30,
    condition: 'piano_steps_gte',
    target: 1,
  },
  {
    id: 'piano_practitioner',
    title: 'Piano Practitioner',
    description: 'Complete 5 Piano Academy steps',
    icon: '🎹',
    rarity: 'rare',
    category: 'knowledge',
    xp_reward: 150,
    condition: 'piano_steps_gte',
    target: 5,
  },
  {
    id: 'piano_virtuoso',
    title: 'Virtuoso',
    description: 'Complete all Piano Academy steps',
    icon: '🎼',
    rarity: 'epic',
    category: 'knowledge',
    xp_reward: 500,
    condition: 'piano_steps_gte',
    target: 8,
  },
  {
    id: 'code_first_line',
    title: 'Hello World',
    description: 'Complete your first Learning to Code step',
    icon: '</>',
    rarity: 'common',
    category: 'knowledge',
    xp_reward: 30,
    condition: 'code_steps_gte',
    target: 1,
  },
  {
    id: 'code_apprentice',
    title: 'Code Apprentice',
    description: 'Complete 3 Learning to Code steps',
    icon: '{ }',
    rarity: 'rare',
    category: 'knowledge',
    xp_reward: 150,
    condition: 'code_steps_gte',
    target: 3,
  },
  {
    id: 'code_craftsman',
    title: 'Code Craftsman',
    description: 'Complete all Learning to Code steps',
    icon: '⌨️',
    rarity: 'epic',
    category: 'knowledge',
    xp_reward: 500,
    condition: 'code_steps_gte',
    target: 6,
  },
  {
    id: 'academy_streak_3',
    title: 'Study Streak',
    description: 'Practice lessons 3 days in a row',
    icon: '📖',
    rarity: 'common',
    category: 'consistency',
    xp_reward: 50,
    condition: 'lesson_streak_gte',
    target: 3,
  },
  {
    id: 'academy_streak_7',
    title: 'Dedicated Student',
    description: 'Practice lessons 7 days in a row',
    icon: '📋',
    rarity: 'rare',
    category: 'consistency',
    xp_reward: 150,
    condition: 'lesson_streak_gte',
    target: 7,
  },
  {
    id: 'academy_streak_30',
    title: 'Lifelong Learner',
    description: 'Practice lessons 30 days in a row',
    icon: '🏅',
    rarity: 'epic',
    category: 'consistency',
    xp_reward: 500,
    condition: 'lesson_streak_gte',
    target: 30,
  },
  {
    id: 'multi_discipline',
    title: 'Renaissance Mind',
    description: 'Complete steps in 3 different lesson categories',
    icon: '🔀',
    rarity: 'rare',
    category: 'knowledge',
    xp_reward: 200,
    condition: 'lesson_categories_gte',
    target: 3,
  },

  // ─── JUNCTION / SPIRITUAL ───
  {
    id: 'first_practice',
    title: 'Seeker',
    description: 'Complete your first Junction practice session',
    icon: '🕯️',
    rarity: 'common',
    category: 'knowledge',
    xp_reward: 50,
    condition: 'junction_practices_gte',
    target: 1,
  },
  {
    id: 'devoted_practitioner',
    title: 'Devoted Practitioner',
    description: 'Complete 50 Junction practice sessions',
    icon: '📿',
    rarity: 'rare',
    category: 'knowledge',
    xp_reward: 300,
    condition: 'junction_practices_gte',
    target: 50,
  },
  {
    id: 'tradition_explorer',
    title: 'Tradition Explorer',
    description: 'Switch to a different Junction tradition',
    icon: '🧭',
    rarity: 'rare',
    category: 'knowledge',
    xp_reward: 100,
    condition: 'junction_traditions_switched_gte',
    target: 1,
  },
  {
    id: 'tier_2_unlock',
    title: 'Rising Devotee',
    description: 'Unlock Tier 2 in any Junction tradition',
    icon: '⭐',
    rarity: 'rare',
    category: 'knowledge',
    xp_reward: 200,
    condition: 'junction_tier_gte',
    target: 2,
  },
  {
    id: 'tier_4_unlock',
    title: 'Enlightened Master',
    description: 'Unlock Tier 4 in any Junction tradition',
    icon: '👁️',
    rarity: 'legendary',
    category: 'knowledge',
    xp_reward: 1000,
    condition: 'junction_tier_gte',
    target: 4,
  },
];

// ── GET ACHIEVEMENT BY ID ──
export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

// ── CHECK ALL ACHIEVEMENTS ──
export async function checkAchievements(
  supabase: SupabaseClient,
  userId: string
): Promise<Achievement[]> {
  // Get user's existing unlocked achievements
  const { data: existing } = await supabase
    .from('achievements')
    .select('achievement_id')
    .eq('user_id', userId)
    .not('unlocked_at', 'is', null);

  const unlockedIds = new Set((existing || []).map((a: { achievement_id: string }) => a.achievement_id));

  // Get user stats for evaluation
  const stats = await gatherAchievementStats(supabase, userId);

  const newlyUnlocked: Achievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlockedIds.has(achievement.id)) continue;

    const { unlocked, progress } = evaluateCondition(achievement, stats);

    // Upsert progress
    await supabase.from('achievements').upsert({
      user_id: userId,
      achievement_id: achievement.id,
      progress: Math.min(progress, achievement.target || 1),
      unlocked_at: unlocked ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,achievement_id' });

    if (unlocked) {
      newlyUnlocked.push(achievement);
    }
  }

  return newlyUnlocked;
}

// ── STAT GATHERING ──
interface AchievementStats {
  totalActions: number;
  longestStreak: number;
  currentStreak: number;
  tasksCompleted: number;
  goalsCompleted: number;
  epicsCompleted: number;
  objectivesCompleted: number;
  habitsCreated: number;
  incomeLogged: number;
  expensesLogged: number;
  journalEntries: number;
  journalStreak: number;
  aiMessages: number;
  healthLogs: number;
  systemsConnected: number;
  eventsCreated: number;
  level: number;
  daysActive: number;
  tasksToday: number;
  maxTasksInDay: number;
  totalIncome: number;
  incomeSources: number;
  earlyBirdActions: number;
  waterTargetDays: number;
  goodSleepDays: number;
  moodLogs: number;
  weightLogs: number;
  feedbackSubmitted: boolean;
  pagesVisited: Set<string>;
  allModulesSetup: boolean;
  nightOwlAction: boolean;
  megaComboTriggered: boolean;
  allHabitsOneDay: boolean;
  perfectHabitWeek: boolean;
  inboxZero: boolean;
  // Lesson / Academy stats
  lessonStepsCompleted: number;
  pianoStepsCompleted: number;
  codeStepsCompleted: number;
  lessonStreak: number;
  lessonCategoriesCompleted: number;
}

async function gatherAchievementStats(
  supabase: SupabaseClient,
  userId: string
): Promise<AchievementStats> {
  // Parallel queries for efficiency
  const [
    xpEventsRes,
    tasksRes,
    goalsRes,
    habitsRes,
    incomeRes,
    expensesRes,
    journalRes,
    healthRes,
    eventsRes,
    userXPRes,
    feedbackRes,
    lessonProgressRes,
  ] = await Promise.all([
    supabase.from('xp_events').select('action_type, created_at, multiplier', { count: 'exact' }).eq('user_id', userId),
    supabase.from('tasks').select('id, status, completed_at', { count: 'exact' }).eq('is_deleted', false),
    supabase.from('goals').select('id, category, progress', { count: 'exact' }).eq('is_deleted', false),
    supabase.from('habits').select('id', { count: 'exact' }).eq('is_deleted', false),
    supabase.from('income').select('id, amount, source', { count: 'exact' }).eq('is_deleted', false),
    supabase.from('expenses').select('id', { count: 'exact' }).eq('is_deleted', false),
    supabase.from('journal_entries').select('id, date', { count: 'exact' }).eq('is_deleted', false),
    supabase.from('health_metrics').select('id, date, water_glasses, sleep_hours, mood_score, weight_kg, created_at').limit(500),
    supabase.from('schedule_events').select('id', { count: 'exact' }).eq('is_deleted', false),
    supabase.from('user_xp').select('level, total_xp').eq('user_id', userId).maybeSingle(),
    supabase.from('feedback').select('id', { count: 'exact' }).eq('user_id', userId),
    supabase.from('lesson_progress').select('lesson_id, steps_completed, last_practiced_at, status').eq('user_id', userId).eq('is_deleted', 0),
  ]);

  const xpEvents = xpEventsRes.data || [];
  const tasks = tasksRes.data || [];
  const goals = goalsRes.data || [];
  const health = healthRes.data || [];

  const doneTasks = tasks.filter((t: { status: string }) => t.status === 'done');
  const doneGoals = goals.filter((g: { progress?: number }) => (g.progress || 0) >= 1);

  // Calculate days active from xp_events
  const activeDays = new Set(xpEvents.map((e: { created_at?: string }) => e.created_at?.split('T')[0]));

  // Tasks per day for max
  const tasksByDay: Record<string, number> = {};
  for (const t of doneTasks) {
    if (t.completed_at) {
      const day = t.completed_at.split('T')[0];
      tasksByDay[day] = (tasksByDay[day] || 0) + 1;
    }
  }
  const maxTasksInDay = Math.max(0, ...Object.values(tasksByDay));

  // Today's tasks
  const today = new Date().toISOString().split('T')[0];
  const tasksToday = tasksByDay[today] || 0;

  // Income sources
  const sources = new Set((incomeRes.data || []).map((i: { source?: string }) => i.source).filter(Boolean));

  // Total income
  const totalIncome = (incomeRes.data || []).reduce((s: number, i: { amount?: number }) => s + (i.amount || 0), 0);

  // Health stats
  const waterDays = health.filter((h: { water_glasses?: number }) => h.water_glasses && h.water_glasses >= 8).length;
  const goodSleepDays = health.filter((h: { sleep_hours?: number }) => h.sleep_hours && h.sleep_hours >= 7).length;
  const moodDays = health.filter((h: { mood_score?: number }) => h.mood_score != null).length;
  const weightDays = health.filter((h: { weight_kg?: number }) => h.weight_kg != null).length;

  // Early bird actions (before 6am)
  const earlyActions = xpEvents.filter((e: { created_at?: string; multiplier?: number; action_type?: string }) => {
    const hour = new Date(e.created_at).getHours();
    return hour < 6;
  });

  // Night owl
  const nightActions = xpEvents.filter((e: { created_at?: string; multiplier?: number; action_type?: string }) => {
    const hour = new Date(e.created_at).getHours();
    return hour >= 0 && hour < 4;
  });

  // Mega combo check
  const megaCombo = xpEvents.some((e: { multiplier?: number }) => (e.multiplier || 0) >= 2);

  // Longest streak (simplified — based on consecutive active days)
  const sortedDays = [...activeDays].sort();
  let longest = 0;
  let current = 0;
  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) { current = 1; }
    else {
      const prev = new Date(sortedDays[i - 1]);
      const cur = new Date(sortedDays[i]);
      const diff = (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      current = diff <= 1 ? current + 1 : 1;
    }
    if (current > longest) longest = current;
  }

  // Journal streak
  const journalDates = (journalRes.data || []).map((j: { date: string }) => j.date).sort().reverse();
  let jStreak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (journalDates.includes(ds)) jStreak++;
    else if (i > 0) break;
  }

  // Current streak
  let cStreak = 0;
  const allDays = [...activeDays].sort().reverse();
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (allDays.includes(ds)) cStreak++;
    else if (i > 0) break;
  }

  return {
    totalActions: xpEvents.length,
    longestStreak: longest,
    currentStreak: cStreak,
    tasksCompleted: doneTasks.length,
    goalsCompleted: doneGoals.filter((g: { category?: string }) => !g.category || g.category === 'goal').length,
    epicsCompleted: doneGoals.filter((g: { category?: string }) => g.category === 'epic').length,
    objectivesCompleted: doneGoals.filter((g: { category?: string }) => g.category === 'objective').length,
    habitsCreated: habitsRes.count || 0,
    incomeLogged: incomeRes.count || 0,
    expensesLogged: expensesRes.count || 0,
    journalEntries: journalRes.count || 0,
    journalStreak: jStreak,
    aiMessages: xpEvents.filter((e: { action_type?: string }) => e.action_type === 'ai_message').length,
    healthLogs: health.length,
    systemsConnected: 0, // Would need a systems table query
    eventsCreated: eventsRes.count || 0,
    level: userXPRes.data?.level || 1,
    daysActive: activeDays.size,
    tasksToday,
    maxTasksInDay,
    totalIncome,
    incomeSources: sources.size,
    earlyBirdActions: earlyActions.length,
    waterTargetDays: waterDays,
    goodSleepDays,
    moodLogs: moodDays,
    weightLogs: weightDays,
    feedbackSubmitted: (feedbackRes.count || 0) > 0,
    pagesVisited: new Set(), // Tracked client-side
    allModulesSetup: false,  // Complex check done client-side
    nightOwlAction: nightActions.length > 0,
    megaComboTriggered: megaCombo,
    allHabitsOneDay: false,  // Complex, tracked via habit engine
    perfectHabitWeek: false, // Complex, tracked via habit engine
    inboxZero: false,        // Tracked client-side
    // Lesson / Academy stats
    lessonStepsCompleted: (lessonProgressRes.data || []).reduce((sum: number, r: { steps_completed?: string | string[] }) => {
      const steps = Array.isArray(r.steps_completed) ? r.steps_completed : (typeof r.steps_completed === 'string' ? JSON.parse(r.steps_completed) : []);
      return sum + steps.length;
    }, 0),
    pianoStepsCompleted: (lessonProgressRes.data || []).filter((r: { lesson_id: string }) => r.lesson_id === 'piano-academy').reduce((sum: number, r: { steps_completed?: string | string[] }) => {
      const steps = Array.isArray(r.steps_completed) ? r.steps_completed : (typeof r.steps_completed === 'string' ? JSON.parse(r.steps_completed) : []);
      return sum + steps.length;
    }, 0),
    codeStepsCompleted: (lessonProgressRes.data || []).filter((r: { lesson_id: string }) => r.lesson_id === 'learning-to-code').reduce((sum: number, r: { steps_completed?: string | string[] }) => {
      const steps = Array.isArray(r.steps_completed) ? r.steps_completed : (typeof r.steps_completed === 'string' ? JSON.parse(r.steps_completed) : []);
      return sum + steps.length;
    }, 0),
    lessonStreak: (() => {
      const practiceDates = (lessonProgressRes.data || []).map((r: { last_practiced_at: string | null }) => r.last_practiced_at).filter(Boolean).sort().reverse() as string[];
      // Deduplicate by day
      const uniqueDays = [...new Set(practiceDates.map((d: string) => d.split('T')[0]))].sort().reverse();
      let streak = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        if (uniqueDays.includes(ds)) streak++;
        else if (i > 0) break;
      }
      return streak;
    })(),
    lessonCategoriesCompleted: new Set(
      (lessonProgressRes.data || []).filter((r: { steps_completed?: string | string[] }) => {
        const steps = Array.isArray(r.steps_completed) ? r.steps_completed : (typeof r.steps_completed === 'string' ? JSON.parse(r.steps_completed) : []);
        return steps.length > 0;
      }).map((r: { lesson_id: string }) => r.lesson_id)
    ).size,
  };
}

function evaluateCondition(
  achievement: Achievement,
  stats: AchievementStats
): { unlocked: boolean; progress: number } {
  const target = achievement.target || 1;

  switch (achievement.condition) {
    case 'total_actions_gte':
      return { unlocked: stats.totalActions >= target, progress: stats.totalActions };
    case 'streak_gte':
      return { unlocked: stats.longestStreak >= target, progress: stats.longestStreak };
    case 'tasks_completed_gte':
      return { unlocked: stats.tasksCompleted >= target, progress: stats.tasksCompleted };
    case 'goals_completed_gte':
      return { unlocked: stats.goalsCompleted >= target, progress: stats.goalsCompleted };
    case 'epics_completed_gte':
      return { unlocked: stats.epicsCompleted >= target, progress: stats.epicsCompleted };
    case 'objectives_completed_gte':
      return { unlocked: stats.objectivesCompleted >= target, progress: stats.objectivesCompleted };
    case 'habits_created_gte':
      return { unlocked: stats.habitsCreated >= target, progress: stats.habitsCreated };
    case 'income_logged_gte':
      return { unlocked: stats.incomeLogged >= target, progress: stats.incomeLogged };
    case 'expenses_logged_gte':
      return { unlocked: stats.expensesLogged >= target, progress: stats.expensesLogged };
    case 'journal_entries_gte':
      return { unlocked: stats.journalEntries >= target, progress: stats.journalEntries };
    case 'journal_streak_gte':
      return { unlocked: stats.journalStreak >= target, progress: stats.journalStreak };
    case 'ai_messages_gte':
      return { unlocked: stats.aiMessages >= target, progress: stats.aiMessages };
    case 'health_logs_gte':
      return { unlocked: stats.healthLogs >= target, progress: stats.healthLogs };
    case 'systems_connected_gte':
      return { unlocked: stats.systemsConnected >= target, progress: stats.systemsConnected };
    case 'events_created_gte':
      return { unlocked: stats.eventsCreated >= target, progress: stats.eventsCreated };
    case 'level_gte':
      return { unlocked: stats.level >= target, progress: stats.level };
    case 'days_active_gte':
      return { unlocked: stats.daysActive >= target, progress: stats.daysActive };
    case 'tasks_in_day_gte':
      return { unlocked: stats.maxTasksInDay >= target, progress: stats.maxTasksInDay };
    case 'total_income_gte':
      return { unlocked: stats.totalIncome >= target, progress: Math.floor(stats.totalIncome) };
    case 'income_sources_gte':
      return { unlocked: stats.incomeSources >= target, progress: stats.incomeSources };
    case 'early_bird_actions_gte':
      return { unlocked: stats.earlyBirdActions >= target, progress: stats.earlyBirdActions };
    case 'early_health_logs_gte':
      return { unlocked: stats.earlyBirdActions >= target, progress: stats.earlyBirdActions };
    case 'water_target_days_gte':
      return { unlocked: stats.waterTargetDays >= target, progress: stats.waterTargetDays };
    case 'good_sleep_days_gte':
      return { unlocked: stats.goodSleepDays >= target, progress: stats.goodSleepDays };
    case 'mood_logs_gte':
      return { unlocked: stats.moodLogs >= target, progress: stats.moodLogs };
    case 'weight_logs_gte':
      return { unlocked: stats.weightLogs >= target, progress: stats.weightLogs };
    case 'under_budget_months_gte':
      return { unlocked: false, progress: 0 }; // Complex — track separately
    case 'positive_months_gte':
      return { unlocked: false, progress: 0 };
    case 'bills_on_time_months_gte':
      return { unlocked: false, progress: 0 };
    case 'avg_energy_month_gte':
      return { unlocked: false, progress: 0 };
    case 'all_pages_visited':
      return { unlocked: false, progress: 0 }; // Client-side
    case 'all_modules_setup':
      return { unlocked: stats.allModulesSetup, progress: stats.allModulesSetup ? 1 : 0 };
    case 'night_owl_action':
      return { unlocked: stats.nightOwlAction, progress: stats.nightOwlAction ? 1 : 0 };
    case 'mega_combo_triggered':
      return { unlocked: stats.megaComboTriggered, progress: stats.megaComboTriggered ? 1 : 0 };
    case 'all_habits_one_day':
      return { unlocked: stats.allHabitsOneDay, progress: stats.allHabitsOneDay ? 1 : 0 };
    case 'perfect_habit_week':
      return { unlocked: stats.perfectHabitWeek, progress: stats.perfectHabitWeek ? 1 : 0 };
    case 'inbox_zero':
      return { unlocked: stats.inboxZero, progress: stats.inboxZero ? 1 : 0 };
    case 'feedback_submitted':
      return { unlocked: stats.feedbackSubmitted, progress: stats.feedbackSubmitted ? 1 : 0 };
    case 'tasks_in_10min_gte':
      return { unlocked: false, progress: 0 }; // Complex timing — track client-side
    // ── Lesson / Academy conditions ──
    case 'lesson_steps_gte':
      return { unlocked: stats.lessonStepsCompleted >= target, progress: stats.lessonStepsCompleted };
    case 'piano_steps_gte':
      return { unlocked: stats.pianoStepsCompleted >= target, progress: stats.pianoStepsCompleted };
    case 'code_steps_gte':
      return { unlocked: stats.codeStepsCompleted >= target, progress: stats.codeStepsCompleted };
    case 'lesson_streak_gte':
      return { unlocked: stats.lessonStreak >= target, progress: stats.lessonStreak };
    case 'lesson_categories_gte':
      return { unlocked: stats.lessonCategoriesCompleted >= target, progress: stats.lessonCategoriesCompleted };
    default:
      return { unlocked: false, progress: 0 };
  }
}
