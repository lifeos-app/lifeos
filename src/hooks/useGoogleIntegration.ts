/**
 * useGoogleIntegration — Manages Google OAuth scopes and integration status
 *
 * Checks if the user has a Google provider token with extended scopes.
 * Provides methods to connect/disconnect Gmail and Google Calendar.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { logger } from '../utils/logger';

interface GoogleIntegrationState {
  isGmailConnected: boolean;
  isCalendarConnected: boolean;
  hasProviderToken: boolean;
  loading: boolean;
  connectGoogle: (scopes?: string[]) => Promise<void>;
  disconnectGoogle: () => Promise<void>;
}

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

export function useGoogleIntegration(): GoogleIntegrationState {
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const [hasProviderToken, setHasProviderToken] = useState(false);
  const [loading, setLoading] = useState(true);

  // Read integration status from user preferences
  const prefs = (profile?.preferences || {}) as Record<string, unknown>;
  const integrations = (prefs.integrations || {}) as Record<string, boolean>;
  const isGmailConnected = !!integrations.gmail;
  const isCalendarConnected = !!integrations.google_calendar;

  // Check if provider token exists on mount
  useEffect(() => {
    const checkToken = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        setHasProviderToken(!!session?.provider_token);
      } catch {
        setHasProviderToken(false);
      }
      setLoading(false);
    };

    if (user) checkToken();
    else setLoading(false);
  }, [user]);

  const connectGoogle = useCallback(async (scopes?: string[]) => {
    const requestedScopes = scopes || [GMAIL_SCOPE, CALENDAR_SCOPE];

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/app/settings?tab=integrations',
          scopes: requestedScopes.join(' '),
        },
      });

      if (error) throw error;
      // OAuth redirect will happen — update preferences after redirect callback
    } catch (err) {
      logger.error('[GoogleIntegration] Connect failed:', err);
      setLoading(false);
    }
  }, []);

  const disconnectGoogle = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const existingPrefs = profile?.preferences || {};
      await supabase.from('user_profiles').update({
        preferences: {
          ...existingPrefs,
          integrations: {
            ...(existingPrefs as Record<string, unknown>).integrations as Record<string, unknown> || {},
            gmail: false,
            google_calendar: false,
          },
        },
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);

      // Refresh profile
      useUserStore.getState().fetchProfile();
    } catch (err) {
      logger.error('[GoogleIntegration] Disconnect failed:', err);
    }
    setLoading(false);
  }, [user?.id, profile?.preferences]);

  return {
    isGmailConnected,
    isCalendarConnected,
    hasProviderToken,
    loading,
    connectGoogle,
    disconnectGoogle,
  };
}
