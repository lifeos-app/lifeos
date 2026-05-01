/**
 * AI Rate Limiter — Client-side enforcement of per-user daily message limits and cost caps.
 *
 * Uses ai-cost-tracker.ts data (via localStorage) to count today's AI usage,
 * and feature-gates.ts to determine the daily message limit by tier.
 *
 * Rate window: rolling 24h from first message of the day.
 * Persists check state in localStorage (key: lifeos:ai-rate-limit).
 * Dispatches 'lifeos:ai-rate-limited' custom event when blocked.
 */

import { getFeatureLimit, type ProFeature } from './feature-gates';

// ── Types ────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  reason?: string;
  messagesUsed: number;
  messagesLimit: number;
  costUsedCents: number;
  costLimitCents: number;
}

export interface RateLimitState {
  /** ISO date string of the first message today (YYYY-MM-DD) */
  windowStart: string | null;
  /** Number of messages sent in the current window */
  messagesUsed: number;
  /** Accumulated cost in cents in the current window */
  costUsedCents: number;
}

/** Error thrown when a rate limit is exceeded */
export class RateLimitError extends Error {
  public readonly remaining: number;
  public readonly resetAt: Date;
  public readonly reason: string;

  constructor(remaining: number, resetAt: Date, reason: string) {
    super(reason);
    this.name = 'RateLimitError';
    this.remaining = remaining;
    this.resetAt = resetAt;
    this.reason = reason;
  }
}

// ── Config ───────────────────────────────────────────────────────

const STORAGE_KEY = 'lifeos:ai-rate-limit';
const USAGE_STORAGE_KEY = 'lifeos:ai-usage';

/** Daily cost caps (in USD cents) by tier */
const COST_CAPS: Record<string, number> = {
  free: 50,   // $0.50/day
  pro: 200,   // $2.00/day
};

// Model pricing (cost per 1K tokens in cents) — kept in sync with ai-cost-tracker.ts
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash':             { input: 0.01, output: 0.04 },
  'gemini-2.5-pro':               { input: 0.15, output: 0.60 },
  'google/gemini-2.5-flash':      { input: 0.015, output: 0.06 },
  'google/gemini-2.5-pro':        { input: 0.15, output: 0.60 },
  'gemma4:e2b':                   { input: 0.00, output: 0.00 },
  'openai/gpt-4o-mini':          { input: 0.15, output: 0.60 },
  'openai/gpt-4o':               { input: 2.50, output: 10.00 },
  'anthropic/claude-3.5-haiku':   { input: 0.10, output: 0.50 },
  'anthropic/claude-3.5-sonnet':  { input: 0.30, output: 1.50 },
};

// ── Internal helpers ──────────────────────────────────────────────

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function loadState(): RateLimitState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RateLimitState;
      // Reset window if it's a new day
      if (parsed.windowStart !== getTodayStr()) {
        return { windowStart: null, messagesUsed: 0, costUsedCents: 0 };
      }
      return parsed;
    }
  } catch { /* ignore corrupt data */ }
  return { windowStart: null, messagesUsed: 0, costUsedCents: 0 };
}

function saveState(state: RateLimitState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* Safari private mode */ }
}

/** Get a user's tier from subscription data in localStorage or default to free */
function getUserTier(): 'free' | 'pro' {
  try {
    // Check early adopter mode — if Stripe not enabled, everyone is pro
    if (import.meta.env.VITE_STRIPE_ENABLED !== 'true') return 'pro';
    // Try to get from user_profiles cache
    const raw = localStorage.getItem('lifeos:user-tier');
    if (raw === 'pro' || raw === 'free') return raw;
  } catch { /* ignore */ }
  return 'free';
}

/**
 * Get today's AI usage from the ai-usage tracker.
 * Counts messages and estimates cost from persisted records.
 */
function getDailyUsage(): { messages: number; costCents: number } {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
    if (!raw) return { messages: 0, costCents: 0 };
    const records = JSON.parse(raw) as Array<{
      timestamp: number;
      model: string;
      inputTokens: number;
      outputTokens: number;
      cost: number;
    }>;

    const today = getTodayStr();
    let messages = 0;
    let costCents = 0;

    for (const rec of records) {
      const recDate = new Date(rec.timestamp).toISOString().split('T')[0];
      if (recDate === today) {
        messages++;
        // Use stored cost if available (in dollars), else estimate
        if (rec.cost !== undefined && rec.cost !== null) {
          costCents += Math.round(rec.cost * 100);
        } else {
          const pricing = MODEL_PRICING[rec.model];
          if (pricing) {
            costCents += Math.round((rec.inputTokens / 1000) * pricing.input + (rec.outputTokens / 1000) * pricing.output);
          }
        }
      }
    }

    return { messages, costCents };
  } catch {
    return { messages: 0, costCents: 0 };
  }
}

/** Calculate the reset time (midnight tonight in local TZ) */
function calculateResetAt(): Date {
  const now = new Date();
  const reset = new Date(now);
  reset.setHours(24, 0, 0, 0); // midnight tonight
  return reset;
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Check whether the current user is allowed to make an AI request.
 *
 * Returns a RateLimitResult with `allowed: true/false`, usage details,
 * remaining counts, and reset time.
 *
 * If `allowed` is false, dispatches a 'lifeos:ai-rate-limited' event
 * on `document`.
 */
export function checkRateLimit(service: string = 'ai'): RateLimitResult {
  const tier = getUserTier();
  const dailyUsage = getDailyUsage();

  // Get message limit from feature gates
  const messagesLimit = typeof getFeatureLimit('unlimited_ai' as ProFeature, tier) === 'number'
    ? (getFeatureLimit('unlimited_ai' as ProFeature, tier) as number)
    : 15; // fallback default

  // Get cost cap from config
  const costLimitCents = COST_CAPS[tier] ?? COST_CAPS.free;

  // Also check the persisted rate limit state (for tracking after check)
  const state = loadState();
  const messagesUsed = Math.max(dailyUsage.messages, state.messagesUsed);
  const costUsedCents = Math.max(dailyUsage.costCents, state.costUsedCents);

  const remaining = Math.max(0, messagesLimit - messagesUsed);
  const resetAt = calculateResetAt();

  // Check message limit
  if (messagesUsed >= messagesLimit) {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetAt,
      reason: `Daily message limit reached (${messagesUsed}/${messagesLimit}). Resets at midnight.`,
      messagesUsed,
      messagesLimit,
      costUsedCents,
      costLimitCents,
    };

    // Dispatch event
    document.dispatchEvent(new CustomEvent('lifeos:ai-rate-limited', {
      detail: { service, reason: result.reason, resetAt: resetAt.toISOString() },
    }));

    return result;
  }

  // Check cost cap
  if (costUsedCents >= costLimitCents) {
    const result: RateLimitResult = {
      allowed: false,
      remaining: Math.max(0, messagesLimit - messagesUsed),
      resetAt,
      reason: `Daily cost limit reached ($${(costUsedCents / 100).toFixed(2)}/$${(costLimitCents / 100).toFixed(2)}). Resets at midnight.`,
      messagesUsed,
      messagesLimit,
      costUsedCents,
      costLimitCents,
    };

    document.dispatchEvent(new CustomEvent('lifeos:ai-rate-limited', {
      detail: { service, reason: result.reason, resetAt: resetAt.toISOString(), costLimited: true },
    }));

    return result;
  }

  return {
    allowed: true,
    remaining,
    resetAt,
    messagesUsed,
    messagesLimit,
    costUsedCents,
    costLimitCents,
  };
}

/**
 * Record a message usage after a successful AI call.
 * Updates the persisted rate limit state.
 */
export function recordAIUsage(costCents: number = 0): void {
  const state = loadState();
  const today = getTodayStr();

  // If new day, reset
  if (state.windowStart !== today) {
    state.windowStart = today;
    state.messagesUsed = 0;
    state.costUsedCents = 0;
  }

  state.messagesUsed++;
  state.costUsedCents += costCents;
  saveState(state);
}

/**
 * Get current rate limit stats without checking/blocking.
 * Useful for UI display.
 */
export function getRateLimitStats(): RateLimitResult {
  return checkRateLimit('stats');
}

/**
 * Get cost caps config (for settings display).
 */
export function getCostCaps(): Record<string, number> {
  return { ...COST_CAPS };
}

/**
 * Update cost cap configuration.
 * Persists to localStorage for override.
 */
export function setCostCap(tier: 'free' | 'pro', cents: number): void {
  try {
    const raw = localStorage.getItem('lifeos:ai-cost-caps');
    const caps = raw ? JSON.parse(raw) : {};
    caps[tier] = cents;
    localStorage.setItem('lifeos:ai-cost-caps', JSON.stringify(caps));
    // Also update runtime config
    COST_CAPS[tier] = cents;
  } catch { /* ignore */ }
}

/**
 * Load custom cost caps from localStorage overrides.
 */
export function loadCustomCostCaps(): void {
  try {
    const raw = localStorage.getItem('lifeos:ai-cost-caps');
    if (raw) {
      const caps = JSON.parse(raw) as Record<string, number>;
      for (const [key, val] of Object.entries(caps)) {
        if (key in COST_CAPS && typeof val === 'number' && val > 0) {
          COST_CAPS[key] = val;
        }
      }
    }
  } catch { /* ignore */ }
}

// Load custom overrides on module init
loadCustomCostCaps();