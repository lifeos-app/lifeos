/**
 * churn-prevention.ts — Churn Prevention & Re-Engagement Engine for LifeOS
 *
 * Detects user inactivity and generates NPC-themed re-engagement signals.
 * Works offline-first using localStorage — no Supabase queries needed.
 *
 * Churn levels:
 *   warning  (2-3 days)  — Light nudge, warm NPC message
 *   critical (7+ days)   — Urgent NPC message, streak preservation
 *   lost     (30+ days)  — Gentle re-onboarding, data preserved
 *
 * NPC selection: Uses the NPC with highest friendship (xp), defaults to Sage.
 */

import { NPC_DEFINITIONS, getAllBonds, type NPCBond } from './npc-friendship';
import type { ProactiveSuggestion } from './proactive-suggestions';
import { getFriendshipTier } from './npc-friendship';

// ── Types ─────────────────────────────────────────────────────────────

export interface UserActivity {
  lastLogin: number | null;       // timestamp ms
  lastHabitLog: number | null;    // timestamp ms
  lastJournal: number | null;    // timestamp ms
  streaksAtRisk: number;          // count of habits with streaks at risk
  goalsStalled: number;          // count of stalled goals
}

export type ChurnLevel = 'warning' | 'critical' | 'lost';

export interface ChurnSignal {
  level: ChurnLevel;
  daysInactive: number;
  message: string;
  npcCharacter: string;         // NPC name (e.g., "The Sage")
  npcId: string;                // NPC id (e.g., "sage_npc")
  actionSuggestion: string;    // What the user should do
  streakSnapshot: number;       // Best streak at time of signal
}

// ── Constants ──────────────────────────────────────────────────────────

const LAST_ACTIVE_KEY = 'lifeos_last_active';
const CHURN_SHOWN_KEY = 'lifeos_churn_shown_date';
const NPC_BONDS_KEY = 'lifeos_npc_bonds';

const WARNING_THRESHOLD_DAYS = 2;
const CRITICAL_THRESHOLD_DAYS = 7;
const LOST_THRESHOLD_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Helpers ─────────────────────────────────────────────────────────────

function daysBetween(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / DAY_MS);
}

/** Get the last active timestamp from localStorage */
export function getLastActive(): number | null {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

/** Update the last active timestamp in localStorage (debounced externally) */
export function setLastActive(timestamp: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(timestamp));
  } catch { /* ignore */ }
}

/** Get the date string of the last time churn was shown (to limit to once/day) */
function getLastChurnShownDate(): string | null {
  try {
    return localStorage.getItem(CHURN_SHOWN_KEY);
  } catch {
    return null;
  }
}

/** Record that churn was shown today */
export function markChurnShownToday(): void {
  try {
    localStorage.setItem(CHURN_SHOWN_KEY, new Date().toISOString().split('T')[0]);
  } catch { /* ignore */ }
}

/** Check if churn was already shown today */
function wasChurnShownToday(): boolean {
  const last = getLastChurnShownDate();
  if (!last) return false;
  return last === new Date().toISOString().split('T')[0];
}

/** Load NPC bonds from localStorage or fallback */
function loadNpcBonds(): NPCBond[] {
  try {
    const raw = localStorage.getItem(NPC_BONDS_KEY);
    if (raw) {
      return getAllBonds(JSON.parse(raw));
    }
  } catch { /* ignore */ }

  // Fallback: try from user profile store
  try {
    // Check for user profile preferences in localStorage
    const profileRaw = localStorage.getItem('lifeos_user_profile');
    if (profileRaw) {
      const profile = JSON.parse(profileRaw);
      if (profile?.preferences?.npc_bonds) {
        return getAllBonds(profile.preferences.npc_bonds);
      }
    }
  } catch { /* ignore */ }

  return getAllBonds({});
}

// ── NPC Selection ────────────────────────────────────────────────────

/**
 * Select the NPC character with the highest friendship (xp).
 * Falls back to Sage if no bonds exist yet.
 */
export function selectHighestFriendshipNPC(bonds: NPCBond[]): { npcId: string; npcName: string } {
  if (bonds.length === 0) {
    return { npcId: 'sage_npc', npcName: 'The Sage' };
  }

  const sorted = [...bonds].sort((a, b) => b.xp - a.xp);
  const topBond = sorted[0];

  // Even the top bond must have some interaction to be chosen
  if (topBond.xp === 0) {
    return { npcId: 'sage_npc', npcName: 'The Sage' };
  }

  const def = NPC_DEFINITIONS.find(n => n.id === topBond.npcId);
  if (!def) {
    return { npcId: 'sage_npc', npcName: 'The Sage' };
  }

  return { npcId: def.id, npcName: def.name };
}

// ── Re-engagement Message Generation ─────────────────────────────────

/**
 * Generate NPC-themed re-engagement messages based on churn level.
 * Each level has a different tone: warning = warm, critical = urgent, lost = gentle.
 */
export function getReengagementMessage(signal: ChurnSignal, userName: string): string {
  const name = userName || 'friend';

  switch (signal.level) {
    case 'warning':
      return `Hey ${name}, ${signal.npcCharacter} misses you! Your ${signal.streakSnapshot}-day streak is waiting. Just 5 minutes today can keep your momentum going.`;

    case 'critical':
      return `${signal.npcCharacter} is worried about you, ${name}. Your habits need attention — come back for just 5 minutes to get back on track. Your progress is worth protecting.`;

    case 'lost':
      return `Life goes on, but ${signal.npcCharacter} never forgot about you, ${name}. Start fresh — your data is safe and waiting. No pressure, just pick up where you left off.`;

    default:
      return `Welcome back, ${name}! ${signal.npcCharacter} is glad to see you.`;
  }
}

// ── Churn Detection ─────────────────────────────────────────────────

/**
 * Detect churn signals from user activity data.
 * Returns the highest-priority signal only (most severe).
 * Returns null if user is active (less than WARNING_THRESHOLD_DAYS inactive).
 */
export function detectChurnSignals(activity: UserActivity): ChurnSignal | null {
  // Find the most recent activity
  const timestamps: number[] = [];
  if (activity.lastLogin) timestamps.push(activity.lastLogin);
  if (activity.lastHabitLog) timestamps.push(activity.lastHabitLog);
  if (activity.lastJournal) timestamps.push(activity.lastJournal);

  // Try last_active from localStorage as fallback
  const lastActive = getLastActive();
  if (lastActive) timestamps.push(lastActive);

  if (timestamps.length === 0) {
    // Brand new user — no activity at all, no churn signal
    return null;
  }

  const mostRecent = Math.max(...timestamps);
  const daysInactive = daysBetween(mostRecent);

  // Determine level
  let level: ChurnLevel;
  if (daysInactive >= LOST_THRESHOLD_DAYS) {
    level = 'lost';
  } else if (daysInactive >= CRITICAL_THRESHOLD_DAYS) {
    level = 'critical';
  } else if (daysInactive >= WARNING_THRESHOLD_DAYS) {
    level = 'warning';
  } else {
    return null; // User is active
  }

  // Select NPC
  const bonds = loadNpcBonds();
  const { npcId, npcName } = selectHighestFriendshipNPC(bonds);

  // Find best current streak among bonds for context
  const streakSnapshot = activity.streaksAtRisk > 0 ? activity.streaksAtRisk : 0;

  // Build message based on level
  let message: string;
  let actionSuggestion: string;

  switch (level) {
    case 'warning':
      message = `Hey, ${npcName} misses you! Your streak is waiting.`;
      actionSuggestion = 'Log one habit to keep your streak alive';
      break;
    case 'critical':
      message = `${npcName} is worried about you. Your habits need attention.`;
      actionSuggestion = 'Come back for just 5 minutes';
      break;
    case 'lost':
      message = `Life goes on, but ${npcName} never forgot. Start fresh — your data is safe.`;
      actionSuggestion = 'Pick up where you left off';
      break;
  }

  return {
    level,
    daysInactive,
    message,
    npcCharacter: npcName,
    npcId,
    actionSuggestion,
    streakSnapshot,
  };
}

/**
 * Check churn on app open. Convenience wrapper for detectChurnSignals.
 * Respects the rule: show churn re-engagement at most once per day.
 * Returns null if already shown today or if no churn detected.
 */
export function scheduleChurnCheck(activity: UserActivity): ChurnSignal | null {
  // Don't re-check if already shown today
  if (wasChurnShownToday()) return null;

  return detectChurnSignals(activity);
}

// ── Proactive Suggestion Integration ─────────────────────────────────

/**
 * Generate a ProactiveSuggestion from a ChurnSignal.
 * This allows churn warnings to appear in the existing suggestion system.
 */
export function generateChurnWarningSuggestion(signal: ChurnSignal, userId: string): ProactiveSuggestion {
  const genId = () => `churn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Determine route based on what's at risk
  let route = '/';  // default: Dashboard
  let actionLabel = 'View Dashboard';
  let intentType = 'navigate';
  let summary = 'Welcome back to LifeOS';

  switch (signal.level) {
    case 'warning':
      route = '/habits';
      actionLabel = 'Check Habits';
      summary = 'Log a habit to keep your streak';
      break;
    case 'critical':
      route = '/habits';
      actionLabel = 'Keep Streak';
      summary = 'Come back and protect your streaks';
      break;
    case 'lost':
      route = '/';
      actionLabel = 'Welcome Back';
      summary = 'Start fresh with your data intact';
      break;
  }

  return {
    id: genId(),
    type: 'churn_warning',
    priority: 1,  // Highest priority — churn prevention is critical
    title: signal.level === 'lost'
      ? `${signal.npcCharacter} welcomes you back`
      : `${signal.npcCharacter} misses you`,
    message: signal.message,
    action: {
      label: actionLabel,
      intent: {
        type: intentType,
        data: { route, churn_level: signal.level, days_inactive: signal.daysInactive },
        summary,
        confidence: 1.0,  // Churn signals are high certainty
      },
    },
    dismissed: false,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build UserActivity from current store data.
 * Convenience function for components to call.
 */
export function buildUserActivityFromStores(data: {
  lastHabitLog?: string | null;
  lastJournalDate?: string | null;
  habitsWithStreaks?: number;
  stalledGoals?: number;
}): UserActivity {
  const lastActive = getLastActive();

  // Parse ISO dates to timestamps
  let lastHabitLogTs: number | null = null;
  if (data.lastHabitLog) {
    try { lastHabitLogTs = new Date(data.lastHabitLog).getTime(); } catch { /* ignore */ }
  }

  let lastJournalTs: number | null = null;
  if (data.lastJournalDate) {
    try { lastJournalTs = new Date(data.lastJournalDate).getTime(); } catch { /* ignore */ }
  }

  return {
    lastLogin: lastActive,
    lastHabitLog: lastHabitLogTs,
    lastJournal: lastJournalTs,
    streaksAtRisk: data.habitsWithStreaks ?? 0,
    goalsStalled: data.stalledGoals ?? 0,
  };
}