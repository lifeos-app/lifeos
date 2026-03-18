/**
 * User Store — Zustand
 *
 * Single source of truth for auth state, profile, and preferences.
 * Supports local-only mode (no auth required) with optional Supabase sync.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { getLocalUserId, migrateLocalUserToSupabase, localGet, localInsert } from '../lib/local-db';
import { triggerSync, setInitialSyncPromise } from '../lib/sync-engine';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile as DBUserProfile } from '../types/database';
import { logger } from '../utils/logger';

// Guard against sign-out race condition:
// signOut() and onAuthStateChange(SIGNED_OUT) both call clearLocalDB().
// This flag prevents the event handler from racing with the explicit sign-out flow.
let _signOutInProgress = false;

/**
 * Reset all data stores to initial state.
 * Uses dynamic imports to avoid circular dependencies.
 * 
 * ⚠️ CRITICAL: ALL STORES MUST BE LISTED HERE ⚠️
 * When adding a new Zustand store, it MUST be added to this list to prevent
 * data leakage between users on sign-out/user-switch.
 * 
 * Current stores (as of 2026-03-12):
 * - useScheduleStore (tasks, events)
 * - useHabitsStore (habits, logs)
 * - useGoalsStore (goals, businesses)
 * - useFinanceStore (income, expenses, bills, clients, businesses, categories, transactions, budgets)
 * - useHealthStore (health metrics)
 * - useJournalStore (journal entries)
 * - useInventoryStore (inventory items, pets)
 * - useAssetsStore (assets, maintenance, bills, documents)
 * - useAgentStore (ZeroClaw chat history)
 * - useLiveActivityStore (NOTE: intentionally NOT reset — preserves live timer across sign-out)
 * 
 * AI/LLM caches (must also be cleared):
 * - clearOrchestratorCache() (daily brief, goals, etc.)
 * - clearContextCache() (ZeroClaw context)
 */
async function resetAllDataStores(): Promise<void> {
  try {
    const [
      { useScheduleStore },
      { useHabitsStore },
      { useGoalsStore },
      { useFinanceStore },
      { useHealthStore },
      { useJournalStore },
      { useInventoryStore },
      { useAssetsStore },
      { useAgentStore },
      { clearOrchestratorCache },
      { clearContextCache },
    ] = await Promise.all([
      import('./useScheduleStore'),
      import('./useHabitsStore'),
      import('./useGoalsStore'),
      import('./useFinanceStore'),
      import('./useHealthStore'),
      import('./useJournalStore'),
      import('./useInventoryStore'),
      import('./useAssetsStore'),
      import('./useAgentStore'),
      import('../lib/llm/orchestrator'),
      import('../lib/zeroclaw-context'),
    ]);

    // Reset all Zustand data stores
    useScheduleStore.setState({ tasks: [], events: [], loading: false, lastFetched: null, isOffline: false });
    useHabitsStore.setState({ habits: [], logs: [], loading: false, lastFetched: null, isOffline: false });
    useGoalsStore.setState({ goals: [], businesses: [], loading: false, lastFetched: null });
    useFinanceStore.setState({ income: [], expenses: [], bills: [], businesses: [], clients: [], categories: [], transactions: [], budgets: [], loading: false, lastFetched: null, isOffline: false });
    useHealthStore.setState({ todayMetrics: null, loading: false, lastFetched: null, isOffline: false });
    useJournalStore.setState({ entries: [], entryDates: new Set(), entryCount: 0, loading: false, lastFetched: null });
    useInventoryStore.setState({ items: [], pets: [], loading: false, error: null, lastFetched: null });
    useAssetsStore.setState({ assets: [], maintenance: [], bills: [], documents: [], loading: false, error: null, lastFetched: null });
    // Clear ZeroClaw agent chat history — contains user-specific conversation
    useAgentStore.getState().clearHistory();

    // Clear AI/LLM caches — these hold user-specific data (daily brief, goals, etc.)
    clearOrchestratorCache();
    clearContextCache();
  } catch (e) {
    logger.warn('[Auth] Failed to reset some data stores:', e);
  }
}

/**
 * Store-specific UserProfile extends DB type with app fields
 */
export interface UserProfile extends Partial<DBUserProfile> {
  user_id: string;
  display_name: string | null; // Store-specific field
  occupation: string | null; // Store-specific field
  primary_focus: string | null; // Store-specific field
  onboarding_complete: boolean;
  preferences: Record<string, unknown>;
}

export type UserMode = 'local' | 'synced';

interface UserState {
  // Auth
  user: User | null;
  session: Session | null;
  authLoading: boolean;

  // Profile
  profile: UserProfile | null;
  profileLoading: boolean;

  // Derived
  firstName: string;

  // Mode
  mode: UserMode;
  localUserId: string;

  // Connection
  connectionError: boolean;
  setConnectionError: (v: boolean) => void;

  // Actions
  initAuth: () => () => void;         // returns cleanup function
  fetchProfile: () => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;

  // Cached session
  getSessionCached: () => Promise<{ data: { session: Session | null }; error: any }>;

  // Local mode
  initLocalMode: () => Promise<void>;
  switchToSyncMode: () => Promise<void>;
}

// ── Synchronous localStorage session reader ──
// Supabase JS v2 stores the session at this key.
// Derive the auth storage key from the Supabase URL ref
const _supaRef = (import.meta.env.VITE_SUPABASE_URL || '').match(/\/\/([^.]+)\./)?.[1] || 'app';
const SUPABASE_AUTH_KEY = `sb-${_supaRef}-auth-token`;
const PROFILE_CACHE_PREFIX = 'lifeos_profile_cache_';

function getStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SUPABASE_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // v2 client may wrap in { currentSession } or store directly
    const s = parsed?.currentSession ?? parsed;
    if (s?.access_token && s?.user) return s as Session;
    return null;
  } catch {
    return null;
  }
}

function getStoredProfile(userId?: string): UserProfile | null {
  try {
    // Try user-scoped key first, fall back to legacy key for migration
    if (userId) {
      const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`);
      if (raw) return JSON.parse(raw) as UserProfile;
    }
    // Legacy fallback (will be cleaned up on next cache write)
    const legacy = localStorage.getItem('lifeos_profile_cache');
    if (legacy) {
      const profile = JSON.parse(legacy) as UserProfile;
      // If the legacy profile matches this user, migrate it
      if (userId && profile.user_id === userId) {
        localStorage.setItem(`${PROFILE_CACHE_PREFIX}${userId}`, legacy);
        localStorage.removeItem('lifeos_profile_cache');
      } else if (userId) {
        // Wrong user's data — discard
        localStorage.removeItem('lifeos_profile_cache');
        return null;
      }
      return profile;
    }
    return null;
  } catch {
    return null;
  }
}

function cacheProfile(profile: UserProfile | null): void {
  try {
    if (profile?.user_id) {
      localStorage.setItem(`${PROFILE_CACHE_PREFIX}${profile.user_id}`, JSON.stringify(profile));
      // Clean up legacy key if present
      localStorage.removeItem('lifeos_profile_cache');
    } else if (!profile) {
      // On sign-out we don't know which user, but it's fine — cache stays scoped
    }
  } catch { /* Safari private browsing */ }
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  session: null,
  authLoading: true, // Wait for session check
  profile: null,
  profileLoading: false,
  firstName: 'Commander',
  mode: 'synced', // Default: require login (desktop can switch to 'local')
  localUserId: getLocalUserId(),
  connectionError: false,

  setConnectionError: (v) => set({ connectionError: v }),

  getSessionCached: async () => {
    const state = get();
    const session = state.session;
    if (session?.expires_at && session.expires_at > Date.now() / 1000 - 60) {
      return { data: { session }, error: null };
    }
    const result = await supabase.auth.getSession();
    if (result.data.session) {
      set({ session: result.data.session });
    }
    return result;
  },

  initAuth: () => {
    // ── Step 1: Synchronous restore ──
    // Read the Supabase session from localStorage immediately.
    // This lets the app render the authenticated UI without any network round-trip.
    const storedSession = getStoredSession();

    if (storedSession?.user) {
      // Restore user state instantly from the cached session (scoped to this user)
      const cachedProfile = getStoredProfile(storedSession.user.id);
      const firstName = cachedProfile?.display_name
        || storedSession.user.user_metadata?.full_name?.split(' ')[0]
        || 'Commander';

      set({
        session: storedSession,
        user: storedSession.user,
        authLoading: false,
        mode: 'synced',
        // Use cached profile for display (name, etc.) but keep profileLoading true
        // so App.tsx waits for the fresh fetch before making onboarding decisions.
        // This prevents stale onboarding_complete from skipping the quest.
        ...(cachedProfile ? { profile: cachedProfile, firstName, profileLoading: true } : {}),
      });

      localStorage.setItem('lifeos_user_mode', 'synced');
      // Fetch fresh profile — this will set profileLoading=false when done
      get().fetchProfile();
    } else {
      // No stored session — check local mode preference
      const savedMode = localStorage.getItem('lifeos_user_mode');
      if (savedMode === 'local') {
        get().initLocalMode();
      }
      // authLoading stays true until getSession() below resolves
    }

    // ── Step 2: Background validation ──
    // Validate/refresh the session with the server. If we already have a user
    // from the sync read above, this runs silently. If not, this is the primary
    // path that sets authLoading = false.
    // Safety timeout: if getSession hangs (network issue, AbortError), force authLoading=false
    // after 10s so the app doesn't stay stuck on the loading screen forever.
    const authSafetyTimer = setTimeout(() => {
      if (get().authLoading) {
        logger.warn('[Auth] getSession safety timeout — forcing authLoading=false');
        set({ authLoading: false, connectionError: true });
      }
    }, 10000);
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      clearTimeout(authSafetyTimer);
      if (error) {
        logger.warn('[Auth] getSession error:', error.message);
        if (!storedSession?.user) {
          set({ authLoading: false });
        }
        set({ connectionError: true });
        return;
      }

      const user = s?.user ?? null;
      if (user) {
        set({
          session: s,
          user,
          authLoading: false,
          mode: 'synced',
          connectionError: false,
        });
        localStorage.setItem('lifeos_user_mode', 'synced');
        // Only fetch profile if we didn't already do it from the sync read
        if (!storedSession?.user) {
          get().fetchProfile();
        }
      } else if (!storedSession?.user) {
        // Genuinely no session — show login
        set({ authLoading: false });
      }
    }).catch((err) => {
      clearTimeout(authSafetyTimer);
      logger.error('[Auth] getSession failed:', err);
      if (!storedSession?.user) {
        set({ authLoading: false });
      }
      set({ connectionError: true });
    });

    // ── Step 3: Single onAuthStateChange listener ──
    // This is the ONLY place auth state changes are handled after startup.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (ev, s) => {
      // Token refresh failed — show banner, never sign out automatically
      if (ev === 'TOKEN_REFRESHED' && !s) {
        logger.warn('[Auth] Token refresh failed — showing connection error banner');
        set({ connectionError: true });
        return;
      }

      const user = s?.user ?? null;

      if (user) {
        // Detect user switch (different authenticated user, not initial local→supabase migration)
        const previousAuthId = localStorage.getItem('lifeos_current_user_id');
        const isUserSwitch = previousAuthId && previousAuthId !== user.id;
        if (isUserSwitch) {
          // Different authenticated user — clear ALL local data to prevent data leakage
          logger.log(`[Auth] User switch detected: ${previousAuthId?.slice(0, 8)} → ${user.id.slice(0, 8)}`);
          try {
            const { clearLocalDB } = await import('../lib/local-db');
            await clearLocalDB();
          } catch { /* non-critical */ }
          await resetAllDataStores();
          // Also clear localStorage caches that hold user-specific data
          const keysToRemove = Object.keys(localStorage).filter(k =>
            k.startsWith('lifeos_orch_') ||
            k.startsWith('lifeos_sync_retry_queue') ||
            k.startsWith('lifeos_zeroclaw_')
          );
          keysToRemove.forEach(k => localStorage.removeItem(k));
        }
        localStorage.setItem('lifeos_current_user_id', user.id);

        set({
          session: s,
          user,
          authLoading: false,
          mode: 'synced',
          connectionError: false,
        });
        localStorage.setItem('lifeos_user_mode', 'synced');

        // Migrate local data to Supabase user ID if needed.
        // SKIP migration on user switch — clearLocalDB already wiped everything.
        // Migration is only for the case: anonymous local user → first sign-up.
        if (!isUserSwitch) {
          const localUserId = get().localUserId;
          if (localUserId !== user.id) {
            await migrateLocalUserToSupabase(user.id);
          }
        }
        // Always update localUserId to match the current auth user
        set({ localUserId: user.id });
        // Update LOCAL_USER_KEY in localStorage so getEffectiveUserId() returns the right user
        localStorage.setItem('lifeos_local_user_id', user.id);

        // Trigger sync via single exported function (no duplicate listener in sync-engine)
        // Wrap in setInitialSyncPromise so stores can await it before first load
        setInitialSyncPromise(triggerSync(user.id));

        get().fetchProfile();
      } else if (ev === 'SIGNED_OUT') {
        // Skip if signOut() is already handling cleanup (prevent race)
        if (_signOutInProgress) return;

        // Only clear state on explicit sign-out event
        localStorage.removeItem('lifeos_user_mode');
        localStorage.removeItem('lifeos_current_user_id');
        cacheProfile(null);

        // Clear local DB + reset stores (signOut() and SIGNED_OUT can race)
        try {
          const { clearLocalDB } = await import('../lib/local-db');
          await clearLocalDB();
        } catch { /* non-critical */ }
        await resetAllDataStores();

        set({
          session: null,
          user: null,
          authLoading: false,
          mode: 'synced',
          profile: null,
          firstName: 'Commander',
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  fetchProfile: async () => {
    const { user, mode, localUserId } = get();

    if (mode === 'local') {
      // Load profile from local DB
      set({ profileLoading: true });
      const localProfile = await localGet<UserProfile>('user_profile', localUserId);

      if (!localProfile) {
        // Create default local profile
        const newProfile: UserProfile = {
          user_id: localUserId,
          display_name: null,
          occupation: null,
          primary_focus: null,
          onboarding_complete: false,
          preferences: {},
        };
        await localInsert('user_profile', newProfile);
        set({ profile: newProfile, profileLoading: false, firstName: 'Commander' });
      } else {
        set({
          profile: localProfile,
          profileLoading: false,
          firstName: localProfile.display_name || 'Commander',
        });
      }
      return;
    }

    // Synced mode — fetch from Supabase
    if (!user) {
      set({ profile: null, profileLoading: false });
      return;
    }

    // Show cached profile immediately (already set in initAuth if available),
    // but still mark profileLoading=true so callers know a fresh fetch is in progress.
    set({ profileLoading: true });

    const controller = new AbortController();
    const abortTimer = setTimeout(() => {
      controller.abort();
      logger.warn('[Auth] Profile fetch timed out — using fallback');
    }, 8000);

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id,display_name,occupation,primary_focus,onboarding_complete,preferences')
        .eq('user_id', user.id)
        .abortSignal(controller.signal)
        .maybeSingle();

      clearTimeout(abortTimer);

      if (error) {
        // aborted or network error — keep whatever we had cached
        logger.warn('[Auth] Profile fetch error:', error.message);
        set({ profileLoading: false });
        return;
      }

      if (!data) {
        // New user — auto-create profile row
        logger.log('[Auth] No profile found — creating for', user.id);
        try {
          await supabase.from('user_profiles').upsert({
            user_id: user.id,
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            onboarding_complete: false,
            preferences: {},
          }, { onConflict: 'user_id' });

          // Mark as new signup for tour system
          try { sessionStorage.setItem('lifeos_new_signup', 'true'); } catch { /* Safari private */ }
          try { localStorage.removeItem('lifeos_completed_tours'); } catch { /* Safari private */ }

          // Re-fetch the newly created profile
          const { data: newData } = await supabase
            .from('user_profiles')
            .select('user_id,display_name,occupation,primary_focus,onboarding_complete,preferences')
            .eq('user_id', user.id)
            .maybeSingle();

          const newProfile = newData as UserProfile | null;
          const firstName = newProfile?.display_name
            || user.user_metadata?.full_name?.split(' ')[0]
            || 'Commander';

          cacheProfile(newProfile);
          set({ profile: newProfile, profileLoading: false, firstName });
        } catch (createErr) {
          logger.error('[Auth] Profile creation failed:', createErr);
          set({ profileLoading: false });
        }
        return;
      }

      const profile = data as UserProfile;
      const firstName = profile?.display_name
        || user.user_metadata?.full_name?.split(' ')[0]
        || 'Commander';

      // Guard: never revert onboarding_complete from true → false.
      // This prevents a stale in-flight fetch from undoing a skip/complete action.
      const currentProfile = get().profile;
      if (currentProfile?.onboarding_complete && !profile.onboarding_complete) {
        profile.onboarding_complete = true;
      }

      cacheProfile(profile);
      set({ profile, profileLoading: false, firstName });
    } catch (err) {
      clearTimeout(abortTimer);
      // AbortError is expected on timeout — don't log as error
      if ((err as Error)?.name !== 'AbortError') {
        logger.error('[Auth] Profile fetch exception:', err);
      }
      set({ profileLoading: false });
    }
  },

  signUp: async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: fullName ? { data: { full_name: fullName } } : undefined,
    });
    if (error) throw error;
    // Auth state change listener will trigger migration + sync
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Auth state change listener will trigger migration + sync
  },

  signInWithGoogle: async () => {
    // Don't request sensitive scopes (calendar, gmail) at sign-in —
    // they trigger Google's "app not verified" warning.
    // Calendar/Gmail scopes are requested later via useGoogleIntegration
    // when the user explicitly opts in from Settings.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/app/',
      },
    });
    if (error) throw error;
    // Auth state change listener will trigger migration + sync
  },

  signOut: async () => {
    _signOutInProgress = true;

    // Flush all unsynced local data to Supabase BEFORE destroying the session
    try {
      const { syncNowImmediate } = await import('../lib/sync-engine');
      logger.log('[Auth] Syncing before sign-out...');
      const result = await syncNowImmediate();
      logger.log(`[Auth] Pre-logout sync: pushed ${result.pushedCount}, pulled ${result.pulledCount}`);
    } catch (e) {
      logger.warn('[Auth] Pre-logout sync failed (data may be lost):', e);
    }

    await supabase.auth.signOut();
    cacheProfile(null);

    // Clear all local state so user returns to login screen
    localStorage.removeItem('lifeos_user_mode');
    localStorage.removeItem('lifeos_local_user_id');
    localStorage.removeItem('lifeos_current_user_id');
    localStorage.removeItem('lifeos_sync_retry_queue');

    // Clear offline caches (IndexedDB + localStorage queue)
    try {
      const { clearAllCache } = await import('../lib/offline-cache');
      await clearAllCache();
    } catch { /* non-critical */ }
    localStorage.removeItem('lifeos_offline_queue');

    // Clear local-first IndexedDB to prevent data leakage to next user
    try {
      const { clearLocalDB } = await import('../lib/local-db');
      await clearLocalDB();
    } catch { /* non-critical */ }

    // Reset data stores to prevent stale data leaking to next user
    await resetAllDataStores();

    _signOutInProgress = false;

    set({
      user: null,
      session: null,
      profile: null,
      firstName: 'Commander',
      mode: 'synced',    // Stay in synced mode → shows login page
      authLoading: false,
    });
  },

  initLocalMode: async () => {
    const localUserId = getLocalUserId();
    set({
      mode: 'local',
      localUserId,
      authLoading: false,
    });
    // Persist choice — next launch skips login wall
    localStorage.setItem('lifeos_user_mode', 'local');
    await get().fetchProfile();
    logger.log('[Auth] Local mode initialized —', localUserId);
  },

  switchToSyncMode: async () => {
    // User wants to enable sync — redirect to login
    window.location.href = '/app/settings?tab=account';
  },
}));
