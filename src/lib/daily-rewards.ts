// LifeOS Daily Reward System — Escalating XP for consecutive logins
//
// Reward tiers escalate with streak length. Streaks reset after >1 day gap.
// All state is persisted in localStorage for simplicity and offline support.

// ── REWARD TIERS ──
const DAILY_REWARD_TIERS: Record<number, number> = {
  1: 10,
  2: 20,
  3: 30,
  4: 50,
  5: 80,
  6: 120,
  7: 200, // Weekly bonus — also applies for day 8, 9, … (cap at 200)
};

const MAX_STREAK_XP = 200;

// ── LOCALSTORAGE KEYS ──
const LS_STREAK_KEY = 'lifeos_daily_streak';
const LS_LAST_CLAIM_KEY = 'lifeos_daily_last_claim';

export interface DailyRewardInfo {
  /** Current streak day number (1-indexed) */
  streakDay: number;
  /** XP amount for the current streak day */
  xpReward: number;
  /** Whether the user has already claimed today's reward */
  claimedToday: boolean;
  /** Whether this is a 7+ day streak (for fire animation) */
  isOnFire: boolean;
}

// ── DATE HELPERS ──

/** Get today's date string in YYYY-MM-DD format (local timezone) */
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Difference in calendar days between two YYYY-MM-DD strings */
function dayDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / (86400000));
}

// ── STREAK CALCULATION ──

/**
 * Calculate and persist the current streak.
 * - Same day: no change
 * - Yesterday: increment streak
 * - >1 day gap: reset to 0
 * - No previous claim: start at 0 (will become 1 on claim)
 *
 * Returns the updated streak day number.
 */
function computeStreak(): number {
  const lastClaim = localStorage.getItem(LS_LAST_CLAIM_KEY);
  const savedStreak = parseInt(localStorage.getItem(LS_STREAK_KEY) || '0', 10);

  if (!lastClaim) {
    // Never claimed before
    return 0;
  }

  const today = todayStr();
  const diff = dayDiff(lastClaim, today);

  if (diff === 0) {
    // Already claimed today — return current streak
    return savedStreak;
  } else if (diff === 1) {
    // Consecutive day — streak continues (will increment on claim)
    return savedStreak;
  } else {
    // Gap >1 day — reset streak
    return 0;
  }
}

// ── PUBLIC API ──

/**
 * Get the XP reward for a given streak day.
 * Day 7+ always yields 200 (weekly bonus).
 */
export function getXPForStreakDay(day: number): number {
  return DAILY_REWARD_TIERS[day] ?? MAX_STREAK_XP;
}

/**
 * Get the full daily reward info for the current user.
 * Call this to decide whether to show the toast.
 */
export function getDailyRewardInfo(): DailyRewardInfo {
  const streakDay = computeStreak();
  const lastClaim = localStorage.getItem(LS_LAST_CLAIM_KEY);
  const claimedToday = lastClaim === todayStr();

  // If already claimed today, the streak day is the saved value
  const displayDay = claimedToday ? streakDay : streakDay + 1;
  const xpReward = getXPForStreakDay(displayDay);

  return {
    streakDay: displayDay,
    xpReward,
    claimedToday,
    isOnFire: displayDay >= 7,
  };
}

/**
 * Claim today's daily reward.
 * Updates streak and last-claim timestamp in localStorage.
 * Returns the XP amount awarded.
 *
 * Should only be called if `claimedToday` is false.
 */
export function claimDailyReward(): number {
  const info = getDailyRewardInfo();
  if (info.claimedToday) return 0;

  const newStreak = info.streakDay; // already computed as streakDay+1
  localStorage.setItem(LS_STREAK_KEY, String(newStreak));
  localStorage.setItem(LS_LAST_CLAIM_KEY, todayStr());

  return info.xpReward;
}

/**
 * Check if the daily reward toast should be shown.
 * Returns true if the user hasn't claimed today.
 */
export function shouldShowDailyReward(): boolean {
  return !getDailyRewardInfo().claimedToday;
}