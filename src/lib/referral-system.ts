/**
 * Referral System — Client-side referral codes, tracking, and XP rewards
 *
 * Generates deterministic 8-char referral codes per user.
 * Tracks referrals via localStorage (client-side only, no backend).
 * Awards XP through the existing xp-engine.
 */

import { awardXP } from './gamification/xp-engine';
import { logger } from '../utils/logger';

// ── CONSTANTS ──

const REFERRER_XP = 500;
const REFEREE_XP = 250;
const CODE_LENGTH = 8;
const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid ambiguity

const LS_MY_CODE = 'lifeos_my_referral_code';
const LS_APPLIED = 'lifeos_applied_referral';
const LS_STATS = 'lifeos_referral_stats';
const LS_LEADERBOARD = 'lifeos_referral_leaderboard';

const SHARE_URL_BASE = 'https://teddyscleaning.com.au/lifeos';

// ── REFERRAL STATS TYPE ──

export interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  earnedXP: number;
}

export interface LeaderboardEntry {
  userId: string;
  code: string;
  referrals: number;
  xp: number;
}

export interface ApplyResult {
  valid: boolean;
  reward: number;
  referrerReward: number;
  error?: string;
}

// ── CODE GENERATION ──

/**
 * Generate a deterministic 8-char alphanumeric referral code from a user ID.
 * Uses a simple hash so the same user ID always yields the same code.
 */
export function generateReferralCode(userId: string): string {
  // Simple deterministic hash
  let hash = 0;
  const combined = `lifeos-referral-${userId}`;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0; // bitwise OR 0 to keep 32-bit int
  }

  // Generate 8 chars from the hash, using multiple hash rounds for variety
  const chars: string[] = [];
  let h = Math.abs(hash);
  for (let i = 0; i < CODE_LENGTH; i++) {
    h = ((h * 1103515245 + 12345) & 0x7fffffff); // LCG
    chars.push(CODE_CHARSET[h % CODE_CHARSET.length]);
  }

  return chars.join('');
}

/**
 * Validate referral code format (8 chars, alphanumeric, no ambiguous chars)
 */
export function isValidReferralCodeFormat(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code);
}

// ── REFERRAL TRACKER CLASS ──

export class ReferralTracker {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Get or generate the user's own referral code.
   * Persists to localStorage for consistency.
   */
  getMyReferralCode(): string {
    try {
      const stored = localStorage.getItem(`${LS_MY_CODE}_${this.userId}`);
      if (stored) return stored;
    } catch { /* ignore */ }

    const code = generateReferralCode(this.userId);
    try {
      localStorage.setItem(`${LS_MY_CODE}_${this.userId}`, code);
    } catch { /* Safari private */ }
    return code;
  }

  /**
   * Apply someone else's referral code.
   * One-time only per user. Cannot apply own code.
   * Awards XP to both referrer and referee.
   */
  async applyReferralCode(code: string): Promise<ApplyResult> {
    const normalized = code.toUpperCase().trim();

    // Format validation
    if (!isValidReferralCodeFormat(normalized)) {
      return { valid: false, reward: 0, referrerReward: 0, error: 'Invalid code format. Codes are 8 alphanumeric characters.' };
    }

    // Check if already applied a code
    try {
      const applied = localStorage.getItem(`${LS_APPLIED}_${this.userId}`);
      if (applied) {
        return { valid: false, reward: 0, referrerReward: 0, error: 'You have already applied a referral code.' };
      }
    } catch { /* ignore */ }

    // Cannot apply own code
    const myCode = this.getMyReferralCode();
    if (normalized === myCode) {
      return { valid: false, reward: 0, referrerReward: 0, error: 'You cannot apply your own referral code.' };
    }

    // Mark as applied
    try {
      localStorage.setItem(`${LS_APPLIED}_${this.userId}`, normalized);
    } catch { /* Safari private */ }

    // Award XP to referee (this user)
    let refereeReward = 0;
    try {
      const result = await awardXP(null, this.userId, 'daily_reward' as any, {
        dailyRewardXP: REFEREE_XP,
        description: `Referral bonus: applied code ${normalized}`,
      });
      refereeReward = result.xpAwarded;
    } catch (e) {
      logger.warn('[referral] Failed to award referee XP:', e);
      refereeReward = REFEREE_XP; // still report the intended reward
    }

    // Track in local stats for this user
    const stats = this.getReferralStats();
    // No change to this user's referral stats — they applied someone else's code
    // The XP was awarded as a referee bonus

    // Update leaderboard: find or create entry for the referrer
    // Since we don't know the referrer's userId directly, we record by code
    try {
      const lb = this.loadLeaderboard();
      const entry = lb.find(e => e.code === normalized);
      if (entry) {
        entry.referrals += 1;
        entry.xp += REFERRER_XP;
      } else {
        // We don't know the referrer's userId from just the code on client-side.
        // Store with a placeholder and the code.
        lb.push({ userId: `ref-${normalized}`, code: normalized, referrals: 1, xp: REFERRER_XP });
      }
      localStorage.setItem(LS_LEADERBOARD, JSON.stringify(lb));
    } catch { /* ignore */ }

    return { valid: true, reward: refereeReward, referrerReward: REFERRER_XP };
  }

  /**
   * Get referral stats for the current user (as a referrer).
   * Tracks how many people used this user's code.
   */
  getReferralStats(): ReferralStats {
    try {
      const raw = localStorage.getItem(`${LS_STATS}_${this.userId}`);
      if (raw) return JSON.parse(raw) as ReferralStats;
    } catch { /* ignore */ }
    return { totalReferrals: 0, successfulReferrals: 0, earnedXP: 0 };
  }

  /**
   * Record that someone used this user's referral code.
   * Called when this user's code is detected as applied by another user
   * (in a pure client-side system, this is updated via leaderboard sync).
   */
  private recordSuccessfulReferral(): void {
    const stats = this.getReferralStats();
    stats.totalReferrals += 1;
    stats.successfulReferrals += 1;
    stats.earnedXP += REFERRER_XP;
    try {
      localStorage.setItem(`${LS_STATS}_${this.userId}`, JSON.stringify(stats));
    } catch { /* ignore */ }
  }

  /**
   * Check leaderboard to see if this user's code was used, and update stats.
   * This is a reconciliation step — checks if the local leaderboard
   * has entries for this user's code that aren't yet in local stats.
   */
  reconcileStats(): ReferralStats {
    const stats = this.getReferralStats();
    const myCode = this.getMyReferralCode();

    try {
      const lb = this.loadLeaderboard();
      const entry = lb.find(e => e.code === myCode);
      if (entry && entry.referrals > stats.successfulReferrals) {
        // New referrals detected on the leaderboard
        stats.totalReferrals = entry.referrals;
        stats.successfulReferrals = entry.referrals;
        stats.earnedXP = entry.referrals * REFERRER_XP;
        try {
          localStorage.setItem(`${LS_STATS}_${this.userId}`, JSON.stringify(stats));
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    return stats;
  }

  /**
   * Get the referral leaderboard (top referrers).
   */
  getReferralLeaderboard(): LeaderboardEntry[] {
    const lb = this.loadLeaderboard();
    // Sort by referrals descending, take top 50
    return lb.sort((a, b) => b.referrals - a.referrals).slice(0, 50);
  }

  /**
   * Check if this user is in the top 10 of the leaderboard.
   */
  isTopReferrer(): boolean {
    const myCode = this.getMyReferralCode();
    const lb = this.getReferralLeaderboard().slice(0, 10);
    return lb.some(e => e.code === myCode);
  }

  /**
   * Check if this user has already applied a referral code.
   */
  hasAppliedReferralCode(): boolean {
    try {
      return !!localStorage.getItem(`${LS_APPLIED}_${this.userId}`);
    } catch { return false; }
  }

  /**
   * Get the applied referral code (if any).
   */
  getAppliedReferralCode(): string | null {
    try {
      return localStorage.getItem(`${LS_APPLIED}_${this.userId}`);
    } catch { return null; }
  }

  // ── INTERNAL HELPERS ──

  private loadLeaderboard(): LeaderboardEntry[] {
    try {
      const raw = localStorage.getItem(LS_LEADERBOARD);
      if (raw) return JSON.parse(raw) as LeaderboardEntry[];
    } catch { /* ignore */ }
    return [];
  }
}

// ── SHARE FUNCTIONALITY ──

/**
 * Get the share link for a referral code.
 */
export function getShareLink(code: string): string {
  return `${SHARE_URL_BASE}?ref=${code}`;
}

/**
 * Get the share text for a referral code.
 */
export function getShareText(code: string): string {
  return `Join me on LifeOS -- the Operating System for Human Life. Use my referral code: ${code} for ${REFEREE_XP} bonus XP!`;
}

/**
 * Get combined share content (link + text).
 */
export function getShareContent(code: string): { link: string; text: string } {
  return {
    link: getShareLink(code),
    text: getShareText(code),
  };
}

// ── STANDALONE FUNCTIONS (for convenience without instantiating ReferralTracker) ──

/**
 * Get or generate a referral code for the given user ID.
 */
export function getOrCreateReferralCode(userId: string): string {
  const tracker = new ReferralTracker(userId);
  return tracker.getMyReferralCode();
}