/**
 * React hook for Pro feature access checks with usage tracking.
 * Extracted from feature-gates.ts to avoid circular dependencies
 * (feature-gates.ts is imported by useSubscription.ts).
 */

// Re-export utility functions from feature-gates so consumers
// can import everything from this single module
export {
  getAIUsageToday,
  incrementAIUsage,
  type ProFeature,
  type AccessResult,
  canAccess,
  getFeatureLimit,
  getFeatureDescription,
  PRO_FEATURES,
} from '../lib/feature-gates';

import { useMemo } from 'react';
import { useUserStore } from '../stores/useUserStore';
import { useSubscription } from './useSubscription';
import {
  type ProFeature,
  canAccess,
  getFeatureLimit,
} from '../lib/feature-gates';

/**
 * Hook for components to check Pro feature access with usage tracking.
 *
 * @param feature - The Pro feature to check
 * @param usageCount - Current usage count (e.g., AI messages sent today)
 * @returns Object with canUse, limit, used, remaining, showUpgrade
 *
 * Example:
 *   const { canUse, remaining, showUpgrade } = useProFeatureCheck('unlimited_ai', messagesSentToday);
 *   if (!canUse) return <ProGateOverlay feature="unlimited_ai" />;
 */
export function useProFeatureCheck(
  feature: ProFeature,
  usageCount: number = 0,
): {
  canUse: boolean;
  limit: number | 'unlimited';
  used: number;
  remaining: number;
  showUpgrade: boolean;
  reason: string | undefined;
  earlyAdopterFree: boolean;
} {
  const user = useUserStore(s => s.user);
  const { tier } = useSubscription();
  const userEmail = user?.email;

  return useMemo(() => {
    const access = canAccess(feature, tier, {
      userId: user?.id,
      userEmail,
      usageCount,
    });

    const limit = getFeatureLimit(feature, tier);

    const remaining = typeof limit === 'number'
      ? Math.max(0, limit - usageCount)
      : Infinity;

    return {
      canUse: access.allowed,
      limit,
      used: usageCount,
      remaining,
      showUpgrade: !access.allowed,
      reason: access.reason,
      earlyAdopterFree: access.earlyAdopterFree,
    };
  }, [feature, tier, user?.id, userEmail, usageCount]);
}