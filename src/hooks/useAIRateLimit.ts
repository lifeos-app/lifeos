/**
 * useAIRateLimit — React hook for components to display rate limit status.
 *
 * Returns reactive state for messages used/remaining, cost cap usage,
 * and whether the user is currently rate-limited. Also listens for
 * the 'lifeos:ai-rate-limited' custom event to update when blocked.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  checkRateLimit,
  recordAIUsage,
  getRateLimitStats,
  getCostCaps,
  type RateLimitResult,
  type RateLimitError,
} from '../lib/ai-rate-limiter';

export interface AIRateLimitState {
  /** Number of AI messages used today */
  messagesUsed: number;
  /** Maximum AI messages per day */
  messagesLimit: number;
  /** Cost used today (in cents) */
  costUsedCents: number;
  /** Cost cap per day (in cents) */
  costLimitCents: number;
  /** Remaining messages for today */
  remaining: number;
  /** When the rate limit window resets */
  resetAt: Date;
  /** Whether the user is currently blocked */
  isLimited: boolean;
  /** Reason for the block (if limited) */
  reason: string | undefined;
}

export function useAIRateLimit(): AIRateLimitState & {
  /** Re-check rate limit from scratch (refetches localStorage) */
  refresh: () => void;
  /** Record a successful AI call (updates usage counters) */
  recordUsage: (costCents?: number) => void;
  /** Check and possibly throw RateLimitError */
  enforce: () => RateLimitResult;
} {
  const [state, setState] = useState<AIRateLimitState>(() => computeState());

  function computeState(): AIRateLimitState {
    const result = getRateLimitStats();
    return {
      messagesUsed: result.messagesUsed,
      messagesLimit: result.messagesLimit,
      costUsedCents: result.costUsedCents,
      costLimitCents: result.costLimitCents,
      remaining: result.remaining,
      resetAt: result.resetAt,
      isLimited: !result.allowed,
      reason: result.reason,
    };
  }

  const refresh = useCallback(() => {
    setState(computeState());
  }, []);

  const recordUsage = useCallback((costCents: number = 0) => {
    recordAIUsage(costCents);
    setState(computeState());
  }, []);

  const enforce = useCallback((): RateLimitResult => {
    const result = checkRateLimit('ai-chat');
    setState(computeState());
    return result;
  }, []);

  // Listen for rate-limited events (e.g., from llm-proxy blocking)
  useEffect(() => {
    const handler = () => {
      setState(computeState());
    };
    document.addEventListener('lifeos:ai-rate-limited', handler);
    return () => document.removeEventListener('lifeos:ai-rate-limited', handler);
  }, []);

  // Refresh on window focus (user may have used AI in another tab)
  useEffect(() => {
    const handler = () => {
      setState(computeState());
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  // Periodic refresh every 60 seconds (for reset timer)
  useEffect(() => {
    const interval = setInterval(() => {
      setState(computeState());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return {
    ...state,
    refresh,
    recordUsage,
    enforce,
  };
}