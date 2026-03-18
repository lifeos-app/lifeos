import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { canAccess, type ProFeature } from '../lib/feature-gates';
import { logger } from '../utils/logger';

interface SubscriptionData {
  tier: 'free' | 'pro';
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  expiresAt: string | null;
}

export function useSubscription() {
  const user = useUserStore(s => s.user);
  const [subscription, setSubscription] = useState<SubscriptionData>({
    tier: 'free',
    stripeCustomerId: null,
    subscriptionId: null,
    expiresAt: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('subscription_tier, stripe_customer_id, subscription_id, subscription_expires_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSubscription({
            tier: (data.subscription_tier as 'free' | 'pro') || 'free',
            stripeCustomerId: data.stripe_customer_id,
            subscriptionId: data.subscription_id,
            expiresAt: data.subscription_expires_at,
          });
        }
      } catch (error) {
        logger.error('Error fetching subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          setSubscription({
            tier: (newData.subscription_tier as 'free' | 'pro') || 'free',
            stripeCustomerId: newData.stripe_customer_id,
            subscriptionId: newData.subscription_id,
            expiresAt: newData.subscription_expires_at,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  /**
   * Check if user can access a pro feature
   */
  const isProFeature = (feature: ProFeature): boolean => {
    return !canAccess(feature, subscription.tier);
  };

  /**
   * Initiate upgrade flow
   */
  const upgrade = async () => {
    try {
      const { data: { session } } = await useUserStore.getState().getSessionCached();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/stripe-checkout.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { sessionUrl } = await response.json();
      window.location.href = sessionUrl;
    } catch (error) {
      logger.error('Error starting upgrade:', error);
      throw error;
    }
  };

  /**
   * Open Stripe Customer Portal
   */
  const manageSubscription = async () => {
    try {
      const { data: { session } } = await useUserStore.getState().getSessionCached();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/stripe-portal.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to open portal');
      }

      const { portalUrl } = await response.json();
      window.location.href = portalUrl;
    } catch (error) {
      logger.error('Error opening portal:', error);
      throw error;
    }
  };

  return {
    ...subscription,
    loading,
    isProFeature,
    upgrade,
    manageSubscription,
  };
}
