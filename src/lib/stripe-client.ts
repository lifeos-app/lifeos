/**
 * Stripe Client — Checkout + Webhook integration for LifeOS Pro.
 *
 * Two modes:
 * 1. VITE_STRIPE_ENABLED=true — real Stripe Checkout via Supabase Edge Function
 * 2. Default (disabled) — returns placeholder, canAccess stays open (early adopter)
 *
 * When ready to monetise:
 * 1. Set VITE_STRIPE_ENABLED=true in .env
 * 2. Set VITE_STRIPE_PRO_PRICE_ID=price_xxx in .env
 * 3. Deploy Supabase Edge Function: supabase/functions/v1/stripe-checkout/
 * 4. Set STRIPE_SECRET_KEY in Supabase secrets
 * 5. Configure Stripe webhook to POST /supabase/functions/v1/stripe-webhook
 * 6. Remove `return true` early exit from canAccess() in feature-gates.ts
 */

import { supabase } from './data-access';

// ── Price IDs ──────────────────────────────────────────────────────────

const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED === 'true';
const PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_PRICE_ID || '';

// ── Types ─────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'pro';

export interface CheckoutResult {
  url: string | null;
  error: string | null;
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'none';
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
}

// ── Checkout ──────────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout session for Pro subscription.
 * Returns the Checkout URL to redirect the user to.
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  priceId?: string,
): Promise<CheckoutResult> {
  if (!STRIPE_ENABLED) {
    return {
      url: null,
      error: 'Monetisation not yet active. LifeOS Pro is free during early access.',
    };
  }

  const targetPriceId = priceId || PRO_PRICE_ID;
  if (!targetPriceId) {
    return { url: null, error: 'No price ID configured.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        price_id: targetPriceId,
        user_id: userId,
        email,
        success_url: `${window.location.origin}/settings?checkout=success`,
        cancel_url: `${window.location.origin}/settings?checkout=canceled`,
      },
    });

    if (error) {
      return { url: null, error: error.message || 'Checkout creation failed.' };
    }

    return { url: data?.url || null, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Checkout failed';
    return { url: null, error: msg };
  }
}

/**
 * Create a billing portal session for existing subscribers.
 */
export async function createBillingPortalSession(
  userId: string,
): Promise<CheckoutResult> {
  if (!STRIPE_ENABLED) {
    return { url: null, error: 'Billing portal not available during early access.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        mode: 'portal',
        user_id: userId,
        return_url: `${window.location.origin}/settings`,
      },
    });

    if (error) {
      return { url: null, error: error.message || 'Portal creation failed.' };
    }

    return { url: data?.url || null, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Portal failed';
    return { url: null, error: msg };
  }
}

// ── Subscription Status ───────────────────────────────────────────────

const SUBSCRIPTION_CACHE_KEY = 'lifeos-subscription-status';

/**
 * Get the current user's subscription tier and status.
 * Cached in localStorage for 5 minutes.
 */
export async function getSubscriptionStatus(
  userId: string,
): Promise<SubscriptionStatus> {
  // Check cache
  const cached = localStorage.getItem(SUBSCRIPTION_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.cachedAt && Date.now() - parsed.cachedAt < 300000) {
        return parsed.status;
      }
    } catch { /* expired */ }
  }

  // If Stripe isn't enabled, everyone is Pro (early adopter)
  if (!STRIPE_ENABLED) {
    const freeStatus: SubscriptionStatus = {
      tier: 'pro',
      status: 'active',
      currentPeriodEnd: null,
      trialEnd: null,
    };
    return freeStatus;
  }

  try {
    // Fetch from user_profiles subscription_tier column
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier, subscription_status, subscription_current_period_end, subscription_trial_end')
      .eq('id', userId)
      .single();

    const status: SubscriptionStatus = {
      tier: (profile?.subscription_tier as SubscriptionTier) || 'free',
      status: (profile?.subscription_status as SubscriptionStatus['status']) || 'none',
      currentPeriodEnd: profile?.subscription_current_period_end
        ? new Date(profile.subscription_current_period_end) : null,
      trialEnd: profile?.subscription_trial_end
        ? new Date(profile.subscription_trial_end) : null,
    };

    // Cache
    localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify({
      cachedAt: Date.now(),
      status,
    }));

    return status;
  } catch {
    return {
      tier: 'free',
      status: 'none',
      currentPeriodEnd: null,
      trialEnd: null,
    };
  }
}

// ── Feature Gate Integration ──────────────────────────────────────────

/**
 * Check if a user can access a Pro feature.
 * When VITE_STRIPE_ENABLED, respects tier from getSubscriptionStatus.
 * Otherwise, returns true (early adopter free-for-all).
 */
export async function canAccessProFeature(
  feature: string,
  userId: string,
): Promise<boolean> {
  if (!STRIPE_ENABLED) return true;

  const status = await getSubscriptionStatus(userId);
  if (status.tier === 'pro' && status.status === 'active') return true;
  if (status.status === 'trialing' && status.trialEnd && status.trialEnd > new Date()) return true;

  // Free tier check
  const FREE_LIMITS: Record<string, number> = {
    unlimited_ai: 5,
    finances: 1,
    health_analytics: 0,
    data_export: 0,
    advanced_goals: 1,
    review_page: 0,
  };

  return (FREE_LIMITS[feature] ?? 0) > 0;
}

// ── Webhook Handler (server-side, documented here) ────────────────────
//
// Supabase Edge Function: supabase/functions/v1/stripe-webhook
//
// Expected events:
//   checkout.session.completed → Update user_profiles.subscription_tier = 'pro'
//   customer.subscription.updated → Update status, period end
//   customer.subscription.deleted → Set tier = 'free', status = 'canceled'
//   customer.subscription.trial_will_end → Notification (optional)
//
// The webhook should:
// 1. Verify Stripe signature (STRIPE_WEBHOOK_SECRET env)
// 2. Extract customer_id → find user_id from subscriptions table
// 3. Update user_profiles SET subscription_tier, subscription_status, etc.