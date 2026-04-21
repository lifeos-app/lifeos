// LifeOS Challenge System — Weekly & Monthly challenges with bonus XP
//
// Weekly challenges reset every Monday, monthly challenges reset on the 1st.
// Challenge state is persisted in localStorage for offline support.
// Progress is updated when the user performs relevant actions.

import { logger } from '../utils/logger';

// ── CHALLENGE TYPES ──

export type ChallengeType = 'WEEKLY' | 'MONTHLY';

export type ChallengeActionType =
  | 'journal_log'     // journal_entry actions
  | 'habit_streak'    // complete 80%+ habits for a day
  | 'mood_log'        // mood entries
  | 'expense_log'     // financial entries
  | 'daily_checkin';  // daily check-ins / daily rewards

export interface ChallengeDefinition {
  id: string;
  type: ChallengeType;
  title: string;
  description: string;
  icon: string;
  actionType: ChallengeActionType;
  target: number;           // Number of times / days to complete
  xpReward: number;         // Bonus XP on claim
  accentColor: string;      // CSS color for UI
}

export interface ChallengeState {
  challengeId: string;
  progress: number;
  completed: boolean;       // Target reached (but reward maybe not claimed)
  claimed: boolean;         // Reward has been claimed
  seededPeriod: number;     // Week number (for weekly) or month number (for monthly)
  lastProgressDate?: string; // YYYY-MM-DD, to prevent double-counting per-day actions
}

export interface ActiveChallenge extends ChallengeDefinition {
  progress: number;
  target: number;
  percentage: number;       // 0-100
  completed: boolean;
  claimed: boolean;
  daysRemaining: number;
}

// ── LOCALSTORAGE KEYS ──

const LS_WEEKLY_KEY = 'lifeos_challenge_weekly';
const LS_MONTHLY_KEY = 'lifeos_challenge_monthly';

// ── WEEKLY CHALLENGE POOL ──

const WEEKLY_CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'weekly_journal_5',
    type: 'WEEKLY',
    title: 'Journal Writer',
    description: 'Log 5 journal entries this week',
    icon: '📝',
    actionType: 'journal_log',
    target: 5,
    xpReward: 200,
    accentColor: '#A855F7',
  },
  {
    id: 'weekly_habit_streak_5',
    type: 'WEEKLY',
    title: 'Habit Champion',
    description: 'Complete 80% of habits for 5 days',
    icon: '🔥',
    actionType: 'habit_streak',
    target: 5,
    xpReward: 300,
    accentColor: '#39FF14',
  },
  {
    id: 'weekly_mood_7',
    type: 'WEEKLY',
    title: 'Mood Tracker',
    description: 'Log 7 mood entries this week',
    icon: '🧠',
    actionType: 'mood_log',
    target: 7,
    xpReward: 150,
    accentColor: '#00D4FF',
  },
  {
    id: 'weekly_expense_5',
    type: 'WEEKLY',
    title: 'Expense Tracker',
    description: 'Track expenses for 5 days this week',
    icon: '💰',
    actionType: 'expense_log',
    target: 5,
    xpReward: 200,
    accentColor: '#FFD700',
  },
];

// ── MONTHLY MEGA-CHALLENGE ──

const MONTHLY_CHALLENGE: ChallengeDefinition = {
  id: 'monthly_checkin_30',
  type: 'MONTHLY',
  title: 'Dedicated One',
  description: 'Complete 30 daily check-ins this month',
  icon: '🏆',
  actionType: 'daily_checkin',
  target: 30,
  xpReward: 1000,
  accentColor: '#FFD700',
};

// ── DATE HELPERS ──

/** Get the ISO week number (1-53) for a given date */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** Get a combined year+week seed for deterministic weekly challenge selection */
function getWeeklySeed(): number {
  const now = new Date();
  return now.getFullYear() * 100 + getWeekNumber(now);
}

/** Get a combined year+month seed for deterministic monthly challenge tracking */
function getMonthlySeed(): number {
  const now = new Date();
  return now.getFullYear() * 100 + (now.getMonth() + 1);
}

/** Get today's date string YYYY-MM-DD */
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Days remaining until the end of the current week (Sunday) */
function daysRemainingInWeek(): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  // Week ends on Sunday; if today is Sunday (0), daysRemaining = 0 (last day)
  return dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
}

/** Days remaining until the end of the current month */
function daysRemainingInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

// ── SEED-BASED CHALLENGE SELECTION ──

/** Deterministically pick a weekly challenge based on the week seed */
function pickWeeklyChallenge(seed: number): ChallengeDefinition {
  // Simple hash from seed to get consistent index
  const index = seed % WEEKLY_CHALLENGES.length;
  return WEEKLY_CHALLENGES[index];
}

// ── PERSISTENCE ──

function loadChallengeState(key: string): ChallengeState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as ChallengeState;
  } catch {
    return null;
  }
}

function saveChallengeState(key: string, state: ChallengeState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    logger.warn('[challenges] Failed to persist state:', e);
  }
}

// ── PUBLIC API ──

/**
 * Get all active challenges (weekly + monthly) with their current progress.
 * Handles period reset logic — if the seed has changed, progress resets.
 */
export function getActiveChallenges(): { weekly: ActiveChallenge | null; monthly: ActiveChallenge | null } {
  const weeklySeed = getWeeklySeed();
  const monthlySeed = getMonthlySeed();

  // ── Weekly ──
  let weeklyState = loadChallengeState(LS_WEEKLY_KEY);
  const weeklyDef = pickWeeklyChallenge(weeklySeed);

  if (!weeklyState || weeklyState.seededPeriod !== weeklySeed || weeklyState.challengeId !== weeklyDef.id) {
    // New week or different challenge — reset
    weeklyState = {
      challengeId: weeklyDef.id,
      progress: 0,
      completed: false,
      claimed: false,
      seededPeriod: weeklySeed,
    };
    saveChallengeState(LS_WEEKLY_KEY, weeklyState);
  }

  const weeklyChallenge: ActiveChallenge = {
    ...weeklyDef,
    progress: weeklyState.progress,
    percentage: Math.min(100, Math.round((weeklyState.progress / weeklyDef.target) * 100)),
    completed: weeklyState.completed,
    claimed: weeklyState.claimed,
    daysRemaining: daysRemainingInWeek(),
  };

  // ── Monthly ──
  let monthlyState = loadChallengeState(LS_MONTHLY_KEY);

  if (!monthlyState || monthlyState.seededPeriod !== monthlySeed || monthlyState.challengeId !== MONTHLY_CHALLENGE.id) {
    monthlyState = {
      challengeId: MONTHLY_CHALLENGE.id,
      progress: 0,
      completed: false,
      claimed: false,
      seededPeriod: monthlySeed,
    };
    saveChallengeState(LS_MONTHLY_KEY, monthlyState);
  }

  const monthlyChallenge: ActiveChallenge = {
    ...MONTHLY_CHALLENGE,
    progress: monthlyState.progress,
    percentage: Math.min(100, Math.round((monthlyState.progress / MONTHLY_CHALLENGE.target) * 100)),
    completed: monthlyState.completed,
    claimed: monthlyState.claimed,
    daysRemaining: daysRemainingInMonth(),
  };

  return { weekly: weeklyChallenge, monthly: monthlyChallenge };
}

/**
 * Map an XP-engine action type to challenge action types.
 * Called when the user performs an action that awards XP.
 */
export function mapActionToChallengeAction(actionType: string): ChallengeActionType | null {
  switch (actionType) {
    case 'journal_entry':
      return 'journal_log';
    case 'habit_log':
      return 'habit_streak';
    case 'health_log':
      return 'mood_log';
    case 'financial_entry':
      return 'expense_log';
    case 'daily_reward':
      return 'daily_checkin';
    default:
      return null;
  }
}

/**
 * Update challenge progress when the user performs a relevant action.
 * For per-day actions (habit_streak, expense_log, daily_checkin), only
 * increments once per day.
 */
export function updateChallengeProgress(actionType: ChallengeActionType, increment: number = 1): void {
  const { weekly, monthly } = getActiveChallenges();
  const today = todayStr();

  // Helper: check if we should increment for per-day actions
  const shouldIncrement = (state: ChallengeState | null, key: string, challengeAction: ChallengeActionType): boolean => {
    if (!state) return true;
    // Per-day actions only count once per day
    if (challengeAction === 'habit_streak' || challengeAction === 'expense_log' || challengeAction === 'daily_checkin') {
      return state.lastProgressDate !== today;
    }
    return true;
  };

  // Update weekly challenge if action matches
  if (weekly && !weekly.completed && weekly.actionType === actionType) {
    const weeklyState = loadChallengeState(LS_WEEKLY_KEY);
    if (weeklyState && shouldIncrement(weeklyState, LS_WEEKLY_KEY, weekly.actionType)) {
      const newProgress = weeklyState.progress + increment;
      const completed = newProgress >= weekly.target;
      const newState: ChallengeState = {
        ...weeklyState,
        progress: newProgress,
        completed,
        lastProgressDate: today,
      };
      saveChallengeState(LS_WEEKLY_KEY, newState);
    }
  }

  // Update monthly challenge if action matches
  if (monthly && !monthly.completed && monthly.actionType === actionType) {
    const monthlyState = loadChallengeState(LS_MONTHLY_KEY);
    if (monthlyState && shouldIncrement(monthlyState, LS_MONTHLY_KEY, monthly.actionType)) {
      const newProgress = monthlyState.progress + increment;
      const completed = newProgress >= monthly.target;
      const newState: ChallengeState = {
        ...monthlyState,
        progress: newProgress,
        completed,
        lastProgressDate: today,
      };
      saveChallengeState(LS_MONTHLY_KEY, newState);
    }
  }
}

/**
 * Claim the bonus XP for a completed challenge.
 * Marks the challenge as claimed and returns the XP amount.
 * Returns 0 if the challenge is not completed or already claimed.
 */
export function claimChallengeReward(challengeId: string): number {
  const { weekly, monthly } = getActiveChallenges();

  // Check weekly
  if (weekly && weekly.id === challengeId) {
    const state = loadChallengeState(LS_WEEKLY_KEY);
    if (!state || !state.completed || state.claimed) return 0;
    const newState: ChallengeState = { ...state, claimed: true };
    saveChallengeState(LS_WEEKLY_KEY, newState);
    return weekly.xpReward;
  }

  // Check monthly
  if (monthly && monthly.id === challengeId) {
    const state = loadChallengeState(LS_MONTHLY_KEY);
    if (!state || !state.completed || state.claimed) return 0;
    const newState: ChallengeState = { ...state, claimed: true };
    saveChallengeState(LS_MONTHLY_KEY, newState);
    return monthly.xpReward;
  }

  return 0;
}

/**
 * Convenience: update challenge progress from an XP action type string.
 * Maps the XP action to a challenge action and updates progress.
 */
export function updateChallengeProgressFromXP(actionType: string): void {
  const challengeAction = mapActionToChallengeAction(actionType);
  if (challengeAction) {
    updateChallengeProgress(challengeAction);
  }
}