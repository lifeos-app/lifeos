// LifeOS Gamification — XP Calculation Engine
// Every action earns XP with streaks, combos, time bonuses
//
// Architecture: All reads/writes go through local-db (IndexedDB) first.
// Supabase sync happens in the background via syncNow().
// This ensures gamification works offline.

import {
  localGetAll,
  localInsert,
  localGet,
  type TableName,
} from '../local-db';
import { SEVEN_PRINCIPLES } from '../hermetic-integration';
import { getLevelFromXP, getTitleForLevel } from './levels';
import { syncNow } from '../sync-engine';
import { logger } from '../../utils/logger';

// ── ACTION TYPES & BASE XP ──
export type ActionType =
  | 'task_complete'
  | 'habit_log'
  | 'goal_complete'
  | 'journal_entry'
  | 'health_log'
  | 'financial_entry'
  | 'schedule_event'
  | 'ai_message'
  | 'page_visit'
  | 'junction_practice'
  | 'goal_create'
  | 'healer_consult'
  | 'scholar_study'
  | 'daily_reward'
  | 'guild_contribute';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type GoalCategory = 'goal' | 'epic' | 'objective';

export interface XPActionMetadata {
  // Task
  priority?: TaskPriority;
  // Goal
  goalCategory?: GoalCategory;
  // Habit
  streakDays?: number;
  // Junction
  tradition?: string;
  tier?: number;
  // Daily reward — exact XP amount for the tier
  dailyRewardXP?: number;
  // Generic
  description?: string;
}

export interface XPCalculation {
  baseXP: number;
  streakMultiplier: number;
  comboMultiplier: number;
  firstOfDayBonus: number;
  earlyBirdBonus: number;
  totalXP: number;
  breakdown: string[];
  hermeticPrinciple: number;
  hermeticInsight: string;
}

// ── BASE XP VALUES ──
const BASE_XP: Record<ActionType, number> = {
  task_complete: 20,
  habit_log: 5,
  goal_complete: 200,
  journal_entry: 15,
  health_log: 10,
  financial_entry: 10,
  schedule_event: 5,
  ai_message: 2,
  page_visit: 1,
  junction_practice: 10,
  goal_create: 25,
  healer_consult: 10,
  scholar_study: 10,
  daily_reward: 0, // Base is 0 — actual XP amount comes from daily-rewards utility via metadata
  guild_contribute: 15,
};

// Task priority multipliers
const TASK_PRIORITY_XP: Record<TaskPriority, number> = {
  low: 10,
  medium: 20,
  high: 35,
  urgent: 50,
};

// Goal category XP
const GOAL_CATEGORY_XP: Record<GoalCategory, number> = {
  goal: 100,
  epic: 300,
  objective: 500,
};

// ── STREAK MULTIPLIERS ──
export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 100) return 5.0;
  if (streakDays >= 30) return 3.0;
  if (streakDays >= 7) return 2.0;
  if (streakDays >= 3) return 1.5;
  return 1.0;
}

export function getStreakLabel(streakDays: number): string {
  if (streakDays >= 100) return '🔥💀 IMMORTAL STREAK';
  if (streakDays >= 30) return '🔥🔥 UNSTOPPABLE';
  if (streakDays >= 7) return '🔥 ON FIRE';
  if (streakDays >= 3) return '✨ Warming up';
  return '';
}

// Habit streak milestone bonuses (flat XP bonus at these milestones)
const HABIT_STREAK_BONUSES: Record<number, number> = {
  7: 50,
  14: 75,
  30: 150,
  60: 250,
  100: 500,
  365: 2000,
};

// ── CALCULATE XP FOR AN ACTION ──
export function calculateXP(
  action: ActionType,
  metadata: XPActionMetadata,
  context: {
    isFirstOfDay: boolean;
    hourOfDay: number;
    sessionActionTypes: Set<ActionType>;
  }
): XPCalculation {
  const breakdown: string[] = [];

  // 1. Base XP
  let baseXP = BASE_XP[action];

  // Task priority override
  if (action === 'task_complete' && metadata.priority) {
    baseXP = TASK_PRIORITY_XP[metadata.priority];
    breakdown.push(`Task (${metadata.priority}): ${baseXP} XP`);
  }
  // Goal category override
  else if (action === 'goal_complete' && metadata.goalCategory) {
    baseXP = GOAL_CATEGORY_XP[metadata.goalCategory];
    breakdown.push(`${metadata.goalCategory} completed: ${baseXP} XP`);
  }
  // Junction practice — tier-scaled XP
  else if (action === 'junction_practice' && metadata.tier != null) {
    const TIER_XP: Record<number, number> = { 1: 10, 2: 15, 3: 20, 4: 25 };
    baseXP = TIER_XP[metadata.tier] ?? 10;
    breakdown.push(`Junction practice (Tier ${metadata.tier}): ${baseXP} XP`);
  }
  // Daily reward — exact XP from tier system
  else if (action === 'daily_reward' && metadata.dailyRewardXP) {
    baseXP = metadata.dailyRewardXP;
    breakdown.push(`Daily login reward: ${baseXP} XP`);
  }
  // Habit with streak bonus
  else if (action === 'habit_log' && metadata.streakDays) {
    const milestoneBonus = HABIT_STREAK_BONUSES[metadata.streakDays] || 0;
    if (milestoneBonus > 0) {
      baseXP += milestoneBonus;
      breakdown.push(`🏆 ${metadata.streakDays}-day streak milestone: +${milestoneBonus} XP`);
    } else {
      breakdown.push(`Habit logged: ${baseXP} XP`);
    }
  } else {
    breakdown.push(`${action.replace(/_/g, ' ')}: ${baseXP} XP`);
  }

  // 2. Streak multiplier
  const streakMultiplier = metadata.streakDays
    ? getStreakMultiplier(metadata.streakDays)
    : 1.0;
  if (streakMultiplier > 1) {
    breakdown.push(`${getStreakLabel(metadata.streakDays!)} (×${streakMultiplier})`);
  }

  // 3. Combo system: 3+ different action types in session
  const uniqueTypes = new Set([...context.sessionActionTypes, action]);
  let comboMultiplier = 1.0;
  if (uniqueTypes.size >= 5) {
    comboMultiplier = 2.0;
    breakdown.push('⚡ MEGA COMBO (5 types) ×2');
  } else if (uniqueTypes.size >= 3) {
    comboMultiplier = 1.5;
    breakdown.push('🔗 Combo (3+ types) ×1.5');
  }

  // 4. First-of-day bonus
  let firstOfDayBonus = 0;
  if (context.isFirstOfDay) {
    firstOfDayBonus = 25;
    breakdown.push('🌅 First action of the day: +25 XP');
  }

  // 5. Early Bird bonus (5am–7am)
  let earlyBirdBonus = 0;
  if (context.hourOfDay >= 5 && context.hourOfDay < 7) {
    earlyBirdBonus = 10;
    breakdown.push('🐦 Early Bird (5–7am): +10 XP');
  }

  // 5b. Night Owl bonus (11pm–3am) — overnight cleaning shifts
  let nightOwlBonus = 0;
  if (context.hourOfDay >= 23 || context.hourOfDay < 3) {
    nightOwlBonus = 15;
    breakdown.push('🦉 Night Owl (11pm–3am): +15 XP');
  }

  // 5c. Dawn Warrior bonus (3am–5am) — between cleaning runs
  let dawnWarriorBonus = 0;
  if (context.hourOfDay >= 3 && context.hourOfDay < 5) {
    dawnWarriorBonus = 20;
    breakdown.push('⚔️ Dawn Warrior (3–5am): +20 XP');
  }

  // 6. Total
  const totalXP = Math.round(
    (baseXP * streakMultiplier * comboMultiplier) + firstOfDayBonus + earlyBirdBonus + nightOwlBonus + dawnWarriorBonus
  );

  return {
    baseXP,
    streakMultiplier,
    comboMultiplier,
    firstOfDayBonus,
    earlyBirdBonus,
    totalXP,
    breakdown,
    hermeticPrinciple: 5,
    hermeticInsight: `Every cause has its effect — your ${action.replace(/_/g, ' ')} generated ${totalXP} XP. The Law of Compensation operates.`,
  };
}

// ── AWARD XP (writes to local-db first, syncs in background) ──
export async function awardXP(
  _supabase: unknown, // kept for API compat, no longer used directly
  userId: string,
  action: ActionType,
  metadata: XPActionMetadata = {}
): Promise<{
  xpAwarded: number;
  newTotal: number;
  newLevel: number;
  leveledUp: boolean;
  previousLevel: number;
  breakdown: string[];
}> {
  // 1. Get current user_xp from local-db
  let userXP: any = null;
  try {
    userXP = await localGet<any>('user_xp', userId);
  } catch (e) {
    logger.warn('[xp-engine] Could not read user_xp from local-db, initializing fresh:', e);
  }

  const currentTotal = userXP?.total_xp || 0;
  const currentLevel = userXP?.level || 1;

  // 2. Check if first action today by reading xp_events from local-db
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let isFirstOfDay = true;
  try {
    const allEvents = await localGetAll<any>('xp_events');
    const userEvents = allEvents.filter(e => e.user_id === userId && !e.deleted_at);
    const todayEvents = userEvents.filter(e =>
      e.created_at && new Date(e.created_at) >= todayStart
    );
    isFirstOfDay = todayEvents.length === 0;
  } catch (e) {
    logger.warn('[xp-engine] Could not read xp_events for first-of-day check:', e);
  }

  // 3. Get session action types (last 2 hours) from local-db
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const sessionActionTypes = new Set<ActionType>();

  try {
    const allEvents = await localGetAll<any>('xp_events');
    const userEvents = allEvents.filter(e => e.user_id === userId && !e.deleted_at);
    const recentEvents = userEvents.filter(e =>
      e.created_at && e.created_at >= twoHoursAgo
    );
    for (const e of recentEvents) {
      if (e.action_type) sessionActionTypes.add(e.action_type as ActionType);
    }
  } catch (e) {
    logger.warn('[xp-engine] Could not read recent xp_events for session combo:', e);
  }

  // 4. Calculate XP
  const now = new Date();
  const calc = calculateXP(action, metadata, {
    isFirstOfDay,
    hourOfDay: now.getHours(),
    sessionActionTypes,
  });

  // 5. Insert XP event to local-db
  try {
    await localInsert('xp_events', {
      user_id: userId,
      action_type: action,
      xp_amount: calc.totalXP,
      multiplier: calc.streakMultiplier * calc.comboMultiplier,
      description: metadata.description || calc.breakdown.join(' | '),
    });
  } catch (e) {
    logger.error('[xp-engine] Failed to insert XP event to local-db:', e);
  }

  // 6. Update user_xp in local-db
  const newTotal = currentTotal + calc.totalXP;
  const newLevel = getLevelFromXP(newTotal);
  const newTitle = getTitleForLevel(newLevel);

  try {
    if (userXP) {
      // Update existing record (keyPath is user_id)
      await localUpdate('user_xp', userId, {
        total_xp: newTotal,
        level: newLevel,
        title: newTitle,
        updated_at: now.toISOString(),
      });
    } else {
      // Insert new user_xp record
      await localInsert('user_xp', {
        user_id: userId,
        total_xp: newTotal,
        level: newLevel,
        title: newTitle,
        stats: { productivity: 0, consistency: 0, health: 0, finance: 0, knowledge: 0, social: 0 },
      });
    }
  } catch (e) {
    logger.error('[xp-engine] Failed to update user_xp in local-db:', e);
  }

  // 7. Update challenge progress (non-blocking)
  try {
    const { updateChallengeProgressFromXP } = await import('../challenges');
    updateChallengeProgressFromXP(action);
    // Dispatch event so ChallengeCard UI refreshes
    window.dispatchEvent(new CustomEvent('challenge-progress'));
  } catch (e) {
    // Non-critical — don't block XP awarding
  }

  // 8. Trigger background sync (debounced)
  syncNow(userId).catch(() => { /* non-blocking */ });

  return {
    xpAwarded: calc.totalXP,
    newTotal,
    newLevel,
    leveledUp: newLevel > currentLevel,
    previousLevel: currentLevel,
    breakdown: calc.breakdown,
  };
}

// ── RECALCULATE USER STATS ──
export interface UserStats {
  productivity: number;  // 0-100
  consistency: number;
  health: number;
  finance: number;
  knowledge: number;
  social: number;
}

export async function recalcUserStats(
  _supabase: unknown, // kept for API compat, no longer used directly
  userId: string
): Promise<UserStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get XP events from last 30 days via local-db
  let events: any[] = [];
  try {
    const allEvents = await localGetAll<any>('xp_events');
    events = allEvents.filter(e =>
      e.user_id === userId &&
      e.created_at >= thirtyDaysAgo &&
      !e.deleted_at
    );
  } catch (e) {
    logger.warn('[xp-engine] Could not read xp_events for stat recalc:', e);
  }

  if (events.length === 0) {
    return { productivity: 0, consistency: 0, health: 0, finance: 0, knowledge: 0, social: 0 };
  }

  // Sum XP by category
  const totals: Record<string, number> = {};
  for (const e of events) {
    const cat = actionToCategory(e.action_type);
    totals[cat] = (totals[cat] || 0) + (e.xp_amount || 0);
  }

  // Normalize to 0-100 (max possible: ~5000 XP/category in 30 days for active user)
  const maxExpected = 3000;
  const normalize = (val: number) => Math.min(100, Math.round((val / maxExpected) * 100));

  const stats: UserStats = {
    productivity: normalize(totals['productivity'] || 0),
    consistency: normalize(totals['consistency'] || 0),
    health: normalize(totals['health'] || 0),
    finance: normalize(totals['finance'] || 0),
    knowledge: normalize(totals['knowledge'] || 0),
    social: normalize(totals['social'] || 0),
  };

  // Update in local-db
  try {
    const existing = await localGet<any>('user_xp', userId);
    if (existing) {
      await localUpdate('user_xp', userId, {
        stats,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    logger.warn('[xp-engine] Could not update stats in user_xp:', e);
  }

  // Trigger background sync
  syncNow(userId).catch(() => { /* non-blocking */ });

  return stats;
}

function actionToCategory(action: string): string {
  switch (action) {
    case 'task_complete':
    case 'goal_complete':
    case 'goal_create':
      return 'productivity';
    case 'habit_log':
      return 'consistency';
    case 'health_log':
      return 'health';
    case 'financial_entry':
      return 'finance';
    case 'journal_entry':
    case 'ai_message':
      return 'knowledge';
    case 'page_visit':
    case 'schedule_event':
      return 'social';
    case 'junction_practice':
      return 'knowledge';
    case 'daily_reward':
      return 'consistency';
    default:
      return 'productivity';
  }
}