/**
 * Feature Gating System
 * Defines which features require Pro subscription or are in development
 */

export const PRO_FEATURES = {
  unlimited_ai: true,      // Free: 5 msgs/day, Pro: 15/day
  finances: true,           // Free: basic view, Pro: full
  health_analytics: true,   // Free: basic, Pro: full
  data_export: true,        // Pro only
  advanced_goals: true,     // Free: 1 objective, Pro: unlimited
  review_page: true,        // Pro only
} as const;

export type ProFeature = keyof typeof PRO_FEATURES;

// ── Coming Soon / In-Development Features ──
// These features exist in the app but aren't ready for public users yet.
// The app owner can still access them fully.

const OWNER_USER_IDS: string[] = [
  // Add your Supabase auth user ID here if you're self-hosting
  // e.g. 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
];

// Owner emails — checked as fallback so new accounts from these emails auto-get owner access
const OWNER_EMAILS = [
  'tewedross12@gmail.com',
  'tewedros@teddyscleaning.com.au',
];

// ── TCS Plugin Gate ────────────────────────────────────────────────────────
// TCS (Teddy's Cleaning Systems) components are business-specific.
// They auto-enable for these emails; all other users get a clean experience.
// Users can also manually opt-in via profile.preferences.tcs_enabled = true.
export const TCS_OWNER_EMAILS = [
  'tewedross12@gmail.com',
  'tewedros@teddyscleaning.com.au',
];

/**
 * Check if TCS (Teddy's Cleaning Systems) plugin is enabled for a user.
 *
 * TCS is enabled if:
 *  - The user's email is in TCS_OWNER_EMAILS (auto-enabled for the business owner), OR
 *  - The user explicitly opted in via profile.preferences.tcs_enabled = true
 *
 * This gate controls all TCS-specific UI components so non-TCS users see a
 * clean, generic LifeOS experience without cleaning-business widgets.
 */
export function isTCSEnabled(
  userEmail: string | null | undefined,
  preferences: Record<string, unknown> | null | undefined,
): boolean {
  if (userEmail && TCS_OWNER_EMAILS.includes(userEmail.toLowerCase())) return true;
  return preferences?.tcs_enabled === true;
}

// Features that show a "Coming Soon" overlay for non-owner users
export const COMING_SOON_FEATURES = ['story'] as const;
export type ComingSoonFeature = typeof COMING_SOON_FEATURES[number];

/**
 * Check if the current user is the app owner (bypasses coming-soon gates)
 */
export function isAppOwner(userId: string | undefined | null): boolean {
  if (!userId) return false;
  if (OWNER_USER_IDS.includes(userId)) return true;
  // Fallback: check email from cached auth (handles account recreations)
  try {
    const _ref = (import.meta.env.VITE_SUPABASE_URL || '').match(/\/+([^.]+)\./)?.[1] || 'app';
    const stored = localStorage.getItem(`sb-${_ref}-auth-token`);
    if (stored) {
      const parsed = JSON.parse(stored);
      const email = parsed?.user?.email;
      if (email && OWNER_EMAILS.includes(email.toLowerCase())) return true;
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * Check if the current user is an owner by email (used for early adopter gating)
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase());
}

/**
 * Check if a feature should show "Coming Soon" for this user
 */
export function isComingSoon(feature: ComingSoonFeature, userId: string | undefined | null): boolean {
  if (isAppOwner(userId)) return false;
  return COMING_SOON_FEATURES.includes(feature);
}

/**
 * Result of a canAccess check with additional gating metadata
 */
export interface AccessResult {
  /** Whether the user can access the feature */
  allowed: boolean;
  /** If blocked, why: 'pro_required', 'limit_reached', 'early_adopter_bypass' */
  reason?: string;
  /** In early adopter mode, true means the user gets a softer gate (badge instead of wall) */
  earlyAdopterFree: boolean;
}

const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED === 'true';

/**
 * Check if user can access a feature based on their tier.
 *
 * This is the primary gate function with backward-compatible behaviour:
 * - When called with just (feature, tier), returns a simple boolean (legacy API)
 * - When called with (feature, tier, { userId, userEmail, usageCount }), returns AccessResult
 *
 * EARLY ADOPTER MODE: When VITE_STRIPE_ENABLED !== 'true',
 *  - Owner emails get full access (allowed=true)
 *  - Non-owners get a soft gate: allowed=false but earlyAdopterFree=true
 *    so the UI shows "Early Adopter — Free" / "Coming Soon" badge instead of hard wall
 *
 * When Stripe IS enabled, tier from user_profiles drives access.
 */
export function canAccess(
  feature: ProFeature,
  tier: 'free' | 'pro',
): boolean;

export function canAccess(
  feature: ProFeature,
  tier: 'free' | 'pro',
  options: { userId?: string; userEmail?: string | null; usageCount?: number },
): AccessResult;

export function canAccess(
  feature: ProFeature,
  tier: 'free' | 'pro',
  options?: { userId?: string; userEmail?: string | null; usageCount?: number },
): boolean | AccessResult {
  // ── Early Adopter Mode ──
  if (!STRIPE_ENABLED) {
    const isOwner = options?.userEmail
      ? isOwnerEmail(options.userEmail)
      : isAppOwner(options?.userId);

    if (isOwner) {
      // Owners always get full access
      if (options) {
        return { allowed: true, earlyAdopterFree: true };
      }
      return true;
    }

    // Non-owner in early adopter mode: show soft gate
    if (options) {
      return {
        allowed: false,
        reason: 'early_adopter_bypass',
        earlyAdopterFree: true,
      };
    }
    // Legacy call: return true for backward compatibility with existing callers
    // that don't pass options. This preserves the original early adopter behavior.
    return true;
  }

  // ── Stripe Enabled (Production Gating) ──

  // Pro users have access to everything
  if (tier === 'pro') {
    if (options) {
      return { allowed: true, earlyAdopterFree: false };
    }
    return true;
  }

  // Free users: check if feature is gated
  if (!PRO_FEATURES[feature]) {
    // Not a Pro feature — free access
    if (options) {
      return { allowed: true, earlyAdopterFree: false };
    }
    return true;
  }

  // It IS a Pro feature — check usage limits
  const limit = getFeatureLimit(feature, tier);
  if (limit === 'unlimited') {
    if (options) {
      return { allowed: true, earlyAdopterFree: false };
    }
    return true;
  }

  if (limit === 0) {
    // Hard gate: no free access at all (e.g., data_export, review_page)
    if (options) {
      return { allowed: false, reason: 'pro_required', earlyAdopterFree: false };
    }
    return false;
  }

  // Limited free access (e.g., 5 AI msgs/day)
  const usageCount = options?.usageCount ?? 0;
  if (usageCount >= limit) {
    if (options) {
      return { allowed: false, reason: 'limit_reached', earlyAdopterFree: false };
    }
    return false;
  }

  if (options) {
    return { allowed: true, earlyAdopterFree: false };
  }
  return true;
}

/**
 * Get feature limits based on tier
 */
export function getFeatureLimit(feature: ProFeature, tier: 'free' | 'pro'): number | 'unlimited' {
  if (tier === 'pro') {
    // Pro gets 15 AI messages per day (server-enforced)
    if (feature === 'unlimited_ai') return 15;
    return 'unlimited';
  }

  const freeLimits: Record<ProFeature, number | 'unlimited'> = {
    unlimited_ai: 5,          // 5 messages per day
    finances: 1,              // 1 account
    health_analytics: 0,      // No analytics
    data_export: 0,           // No export
    advanced_goals: 1,        // 1 objective
    review_page: 0,           // No review
  };

  return freeLimits[feature] ?? 0;
}

/**
 * Get user-friendly feature descriptions
 */
export function getFeatureDescription(feature: ProFeature): string {
  const descriptions: Record<ProFeature, string> = {
    unlimited_ai: '15 AI assistant messages per day',
    finances: 'Advanced financial tracking and analytics',
    health_analytics: 'Detailed health insights and trends',
    data_export: 'Export all your data anytime',
    advanced_goals: 'Create unlimited objectives and goals',
    review_page: 'Weekly review and reflection tools',
  };

  return descriptions[feature] ?? 'Premium feature';
}

// ── Dev Features — Owner-only gated features in development ──

export const DEV_FEATURES = [
  'goals_smart_scheduler',
] as const;
export type DevFeature = typeof DEV_FEATURES[number];

export function isDevFeatureEnabled(_feature: DevFeature, userId: string | null | undefined): boolean {
  return isAppOwner(userId);
}

// ── AI Usage Tracking Helper ─────────────────────────────────────────────

/**
 * Track daily AI message usage in localStorage for free-tier limiting.
 * This is a client-side limit; server enforcement is the real gate.
 */
export function getAIUsageToday(): number {
  try {
    const stored = localStorage.getItem('lifeos-ai-usage');
    if (!stored) return 0;
    const { date, count } = JSON.parse(stored) as { date: string; count: number };
    const today = new Date().toISOString().slice(0, 10);
    if (date !== today) return 0;
    return count;
  } catch {
    return 0;
  }
}

export function incrementAIUsage(): number {
  const today = new Date().toISOString().slice(0, 10);
  const current = getAIUsageToday();
  const newCount = current + 1;
  localStorage.setItem('lifeos-ai-usage', JSON.stringify({ date: today, count: newCount }));
  return newCount;
}