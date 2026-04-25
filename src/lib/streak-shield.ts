/**
 * Streak Shield — Duolingo-style retention mechanic for LifeOS
 *
 * "1 free skip per week, earned via streak"
 * When a user has a streak going, if they miss a day of logging a habit,
 * the streak shield preserves their streak for one miss per week
 * (earned after 3+ day streak).
 *
 * All state is persisted in localStorage for offline support.
 * Pure functions — no React imports.
 */

// ── LOCALSTORAGE KEYS ──
const LS_SHIELDS_KEY = 'lifeos_streak_shields';
const LS_LAST_EARNED_KEY = 'lifeos_streak_shield_last_earned';
const LS_USES_KEY = 'lifeos_streak_shield_uses';

// ── CONSTANTS ──
export const MAX_SHIELDS = 3;
const EARN_STREAK_DAYS = 7; // Earn 1 shield per 7 consecutive days
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ── TYPES ──

export interface ShieldUse {
  date: string;
  habitId: string;
}

export interface ShieldInfo {
  availableShields: number;
  maxShields: number;
  usesThisWeek: ShieldUse[];
  canUse: boolean;
}

// ── DATE HELPERS ──

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
}

// ── PERSISTENCE HELPERS ──

function getStoredShields(): number {
  try {
    const val = localStorage.getItem(LS_SHIELDS_KEY);
    return val ? Math.min(parseInt(val, 10), MAX_SHIELDS) : 0;
  } catch {
    return 0;
  }
}

function setStoredShields(count: number): void {
  try {
    localStorage.setItem(LS_SHIELDS_KEY, String(Math.min(count, MAX_SHIELDS)));
  } catch { /* ignore */ }
}

function getStoredLastEarned(): string | null {
  try {
    return localStorage.getItem(LS_LAST_EARNED_KEY);
  } catch {
    return null;
  }
}

function setStoredLastEarned(date: string): void {
  try {
    localStorage.setItem(LS_LAST_EARNED_KEY, date);
  } catch { /* ignore */ }
}

function getStoredUses(): ShieldUse[] {
  try {
    const raw = localStorage.getItem(LS_USES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredUses(uses: ShieldUse[]): void {
  try {
    localStorage.setItem(LS_USES_KEY, JSON.stringify(uses));
  } catch { /* ignore */ }
}

/** Prune shield uses older than 2 weeks to keep storage clean */
function pruneOldUses(uses: ShieldUse[]): ShieldUse[] {
  const cutoff = daysAgoStr(14);
  return uses.filter(u => u.date >= cutoff);
}

// ── PUBLIC API ──

/**
 * Get current shield info: how many available, uses this week, can use.
 */
export function getShieldInfo(): ShieldInfo {
  const availableShields = getStoredShields();
  const weekStart = startOfWeek();
  const allUses = getStoredUses();
  const usesThisWeek = allUses.filter(u => u.date >= weekStart);

  return {
    availableShields,
    maxShields: MAX_SHIELDS,
    usesThisWeek,
    canUse: availableShields > 0,
  };
}

/**
 * Use a shield for a specific habit on a date.
 * Returns true if shield was successfully used, false if not available
 * or already used for this habit/date.
 */
export function useShield(habitId: string, date: string): boolean {
  const shields = getStoredShields();
  if (shields <= 0) return false;

  // Check if already used for this habit on this date
  const uses = getStoredUses();
  const alreadyUsed = uses.some(u => u.habitId === habitId && u.date === date);
  if (alreadyUsed) return false;

  // Deduct shield and record use
  setStoredShields(shields - 1);
  const updatedUses = pruneOldUses([...uses, { date, habitId }]);
  setStoredUses(updatedUses);

  return true;
}

/**
 * Check if a shield was used for a specific habit on a date.
 * Used by calculateStreak() to preserve streak across shielded gaps.
 */
export function hasShieldAvailableForHabit(habitId: string, date: string): boolean {
  const uses = getStoredUses();
  return uses.some(u => u.habitId === habitId && u.date === date);
}

/**
 * Check and earn new shields based on streak length.
 * Called after daily reward claim or habit toggle.
 *
 * If the user has a streak of 7+ consecutive days AND hasn't earned
 * a shield this week, grants 1 shield (up to MAX_SHIELDS).
 *
 * @param currentStreak - The current daily reward streak day number
 * @returns Number of shields earned (0 or 1)
 */
export function checkAndEarnShields(currentStreak: number): number {
  if (currentStreak < EARN_STREAK_DAYS) return 0;

  const shields = getStoredShields();
  if (shields >= MAX_SHIELDS) return 0;

  const lastEarned = getStoredLastEarned();
  const today = todayStr();

  // Check if we already earned a shield this week
  if (lastEarned) {
    const lastEarnedDate = new Date(lastEarned + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const daysSinceLastEarn = Math.round(
      (todayDate.getTime() - lastEarnedDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (daysSinceLastEarn < 7) return 0;
  }

  // Grant a shield
  const newShields = shields + 1;
  setStoredShields(newShields);
  setStoredLastEarned(today);

  return 1;
}

/**
 * Get the number of available shields.
 * Convenience function for quick checks.
 */
export function getAvailableShieldCount(): number {
  return getStoredShields();
}

/**
 * Reset all shield state (for testing).
 */
export function resetShieldState(): void {
  try {
    localStorage.removeItem(LS_SHIELDS_KEY);
    localStorage.removeItem(LS_LAST_EARNED_KEY);
    localStorage.removeItem(LS_USES_KEY);
  } catch { /* ignore */ }
}