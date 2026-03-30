import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';

declare const __IS_TAURI__: boolean;
declare const __IS_ELECTRON__: boolean;
const isDesktop = (typeof __IS_TAURI__ !== 'undefined' && __IS_TAURI__) ||
  (typeof __IS_ELECTRON__ !== 'undefined' && __IS_ELECTRON__) ||
  '__TAURI_INTERNALS__' in window || '__TAURI__' in window ||
  !!(window as any).electronAPI;
const Router = isDesktop ? HashRouter : BrowserRouter;
import { Mail } from 'lucide-react';
import { useUserStore } from './stores/useUserStore';
import { useScheduleStore } from './stores/useScheduleStore';
import { useHealthStore } from './stores/useHealthStore';
import { useHabitsStore } from './stores/useHabitsStore';
import { useFinanceStore } from './stores/useFinanceStore';
import { useGoalsStore } from './stores/useGoalsStore';
import { useAssetsStore } from './stores/useAssetsStore';
import { useJournalStore } from './stores/useJournalStore';
import { useLiveActivityStore } from './stores/useLiveActivityStore';
// Profile comes from useUserStore now
import { supabase } from './lib/data-access';
// sync-engine is dynamically imported after auth to reduce initial bundle
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateBanner } from './components/UpdateBanner';
import { ConnectionBanner } from './components/ConnectionBanner';
import { WhatsNew } from './components/WhatsNew';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { GlobalLoadingSpinner } from './components/GlobalLoadingSpinner';
import {
  DashboardSkeleton, ScheduleSkeleton, HealthSkeleton, FinancesSkeleton,
  HabitsSkeleton, GoalsSkeleton, JournalSkeleton, JunctionSkeleton,
  PageSkeleton, SocialSkeleton, ReflectSkeleton, CharacterSkeleton,
  WorkSkeleton, StorySkeleton, InboxSkeleton,
} from './components/skeletons';
import '@fontsource/poppins/latin-300.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/orbitron/latin-400.css';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-900.css';
import './styles/theme.css';
import './styles/design-system.css';
import './styles/mobile.css';
import './styles/tour.css';
import './styles/onboarding-animations.css';
import './realm/onboarding/onboarding.css';
import { logger } from './utils/logger';

// Lazy load pages (with retry on chunk load failure)
const Login = lazyRetry(() => import('./pages/Login').then(m => ({ default: m.Login })));
const SetupHub = lazyRetry(() => import('./pages/SetupHub').then(m => ({ default: m.SetupHub })));
const HealthOnboarding = lazyRetry(() => import('./pages/HealthOnboarding').then(m => ({ default: m.HealthOnboarding })));
const FinanceOnboarding = lazyRetry(() => import('./pages/FinanceOnboarding').then(m => ({ default: m.FinanceOnboarding })));
const LifeOnboarding = lazyRetry(() => import('./pages/LifeOnboarding').then(m => ({ default: m.LifeOnboarding })));
const Layout = lazyRetry(() => import('./components/Layout').then(m => ({ default: m.Layout })));
const Dashboard = lazyRetry(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Schedule = lazyRetry(() => import('./pages/Schedule').then(m => ({ default: m.Schedule })));
const Goals = lazyRetry(() => import('./pages/Goals').then(m => ({ default: m.Goals })));
const Habits = lazyRetry(() => import('./pages/Habits').then(m => ({ default: m.Habits })));
const Finances = lazyRetry(() => import('./pages/Finances').then(m => ({ default: m.Finances })));
const Health = lazyRetry(() => import('./pages/Health').then(m => ({ default: m.Health })));
const Journal = lazyRetry(() => import('./pages/Journal').then(m => ({ default: m.Journal })));
const InboxPage = lazyRetry(() => import('./pages/InboxPage').then(m => ({ default: m.InboxPage })));
const Settings = lazyRetry(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Review = lazyRetry(() => import('./pages/Review').then(m => ({ default: m.Review })));
const WorkPage = lazyRetry(() => import('./pages/WorkPage').then(m => ({ default: m.WorkPage })));
const SocialPage = lazyRetry(() => import('./pages/SocialPage').then(m => ({ default: m.SocialPage })));
const ProfileSetupPage = lazyRetry(() => import('./pages/ProfileSetupPage').then(m => ({ default: m.ProfileSetupPage })));
const Junction = lazyRetry(() => import('./pages/Junction').then(m => ({ default: m.Junction })));

const EquipmentPage = lazyRetry(() => import('./pages/health-tabs/EquipmentTab').then(m => ({ default: m.EquipmentTab })));
const CharacterHub = lazyRetry(() => import('./pages/CharacterHub').then(m => ({ default: m.CharacterHub })));
const ReflectHub = lazyRetry(() => import('./pages/ReflectHub').then(m => ({ default: m.ReflectHub })));
const Story = lazyRetry(() => import('./pages/Story').then(m => ({ default: m.Story })));
const AssetDetail = lazyRetry(() => import('./pages/AssetDetail').then(m => ({ default: m.AssetDetail })));
const Academy = lazyRetry(() => import('./pages/Academy'));
const TeddysLessons = lazyRetry(() => import('./pages/TeddysLessons'));
const Replicator = lazyRetry(() => import('./pages/Replicator'));
const LazyFeedbackButton = lazyRetry(() => import('./components/FeedbackButton').then(m => ({ default: m.FeedbackButton })));
const LazyFlipperCheckin = lazyRetry(() => import('./components/FlipperCheckin').then(m => ({ default: m.FlipperCheckin })));
const LazyLifePulseModal = lazyRetry(() => import('./components/LifePulseModal').then(m => ({ default: m.LifePulseModal })));

// Retry wrapper for lazy imports — retries up to 3 times on chunk load failure
function lazyRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3,
): React.LazyExoticComponent<T> {
  return lazy(() => {
    const attempt = (remaining: number): Promise<{ default: T }> =>
      factory().catch((err) => {
        if (remaining <= 0) throw err;
        // Wait 1 second then retry — chunk might be available on next attempt
        return new Promise<{ default: T }>((resolve) =>
          setTimeout(() => resolve(attempt(remaining - 1)), 1000)
        );
      });
    return attempt(retries);
  });
}

// Lazy-load providers — they pull in large engine code (gamification, system bus)
const SystemBusProvider = lazyRetry(() => import('./lib/systems/context').then(m => ({ default: m.SystemBusProvider })));
const GamificationProvider = lazyRetry(() => import('./lib/gamification/context').then(m => ({ default: m.GamificationProvider })));

/**
 * Hook: wait for Supabase to finish processing any OAuth callback in the URL.
 *
 * With `detectSessionInUrl: true` and `flowType: 'pkce'` in supabase.ts,
 * Supabase's client automatically detects ?code= in the URL, exchanges it
 * via PKCE, establishes the session, and cleans up the URL.
 *
 * We previously had a manual exchangeCodeForSession call here that RACED
 * with Supabase's built-in handler, causing "PKCE code verifier not found"
 * errors. Removed in v1.19.4 — let Supabase handle it natively.
 *
 * This hook now just detects if an OAuth callback is in progress and waits
 * for the auth state to settle before rendering the app.
 */
function useOAuthCallbackHandler() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hasCode = url.searchParams.has('code');

    if (hasCode) {
      // OAuth callback in progress — Supabase is handling the PKCE exchange.
      // Wait for onAuthStateChange to fire (SIGNED_IN or error),
      // then clean up the URL and mark ready.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          // Clean up OAuth params from URL
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('code');
          window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
          subscription.unsubscribe();
          setReady(true);
        }
      });

      // Safety timeout — if Supabase doesn't fire an event within 8s,
      // proceed anyway (user will land on login page).
      const timeout = setTimeout(() => {
        // Clean up URL regardless
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('code');
        window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
        subscription.unsubscribe();
        setReady(true);
      }, 8000);

      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    } else {
      // No code in URL — normal page load
      setReady(true);
    }
  }, []);

  return ready;
}

function AppRoutes() {
  const user = useUserStore(s => s.user);
  const authLoading = useUserStore(s => s.authLoading);
  const mode = useUserStore(s => s.mode);
  const initAuth = useUserStore(s => s.initAuth);
  const profile = useUserStore(s => s.profile);
  const profileLoading = useUserStore(s => s.profileLoading);
  const refreshProfile = useUserStore(s => s.fetchProfile);

  // Initialize auth listener (single subscription for whole app)
  useEffect(() => {
    const cleanup = initAuth();
    return cleanup;
  }, [initAuth]);

  // Sync completed tours from Supabase → localStorage on login
  // ONLY sync after profile exists — otherwise we race with the profile INSERT
  // which clears localStorage for new users
  useEffect(() => {
    if (user && profile) {
      import('./components/SpotlightTour').then(m => m.syncToursFromSupabase());
      import('./utils/ui-state').then(m => m.syncUIStateFromSupabase());
    }
  }, [user?.id, profile?.onboarding_complete]);

  // Hydrate all stores once user is authenticated — makes page navigation instant
  // skipSync: true prevents 6 individual syncs; we fire a single sync after all hydrate
  useEffect(() => {
    if (!user) return;
    const skipSync = { skipSync: true };
    Promise.allSettled([
      useScheduleStore.getState().fetchAll(skipSync),
      useHealthStore.getState().fetchToday(skipSync),
      useHabitsStore.getState().fetchAll(skipSync),
      useFinanceStore.getState().fetchAll(skipSync),
      useGoalsStore.getState().fetchAll(skipSync),
      useJournalStore.getState().fetchRecent(50, skipSync),
      useLiveActivityStore.getState().hydrate(),
      useAssetsStore.getState().fetchAll(skipSync),
    ]).then(() => {
      import('./lib/sync-engine').then(m => m.syncNowImmediate(user.id)).catch(e => logger.warn('[app] initial sync failed:', e));
    });
  }, [user?.id]);

  // Listen for lifeos-refresh events and invalidate all stores (debounced)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        useScheduleStore.getState().invalidate();
        useHealthStore.getState().invalidate();
        useHabitsStore.getState().invalidate();
        useFinanceStore.getState().invalidate();
        useGoalsStore.getState().invalidate();
        useJournalStore.getState().invalidate();
      }, 300);
    };
    window.addEventListener('lifeos-refresh', handler);
    return () => {
      window.removeEventListener('lifeos-refresh', handler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const showSpinner = <GlobalLoadingSpinner />;

  // 1. Wait for auth to resolve
  if (authLoading) return showSpinner;

  // 2. No user → show login (desktop users can choose "Use Offline" from Login page)
  if (!user && mode !== 'local') {
    return <Suspense fallback={showSpinner}><Login /></Suspense>;
  }

  // 2b. User exists but email not confirmed (synced mode only) → show confirmation notice
  //     Skip for OAuth users (Google etc.) — their email is verified by the provider
  //     Skip for desktop mode (local user has no email to confirm)
  if (user && !isDesktop && mode === 'synced') {
    const isOAuth = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
    if (!user.email_confirmed_at && !isOAuth) {
      return (
        <div style={{
          minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#050E1A', fontFamily: "'Poppins', sans-serif",
        }}>
          <div style={{
            textAlign: 'center', maxWidth: 440, padding: '48px 40px',
            background: '#0F2D4A', border: '1px solid #1A3A5C', borderRadius: 12,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16, display: 'flex', justifyContent: 'center' }}><Mail size={48} color="#00D4FF" /></div>
            <h2 style={{ color: '#00D4FF', fontSize: 22, fontWeight: 600, marginBottom: 12 }}>
              Check your email
            </h2>
            <p style={{ color: '#8BA4BE', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
              We've sent a confirmation link to <strong style={{ color: '#fff' }}>{user.email}</strong>.
              Click the link to activate your account.
            </p>
            <p style={{ color: '#5A7A9A', fontSize: 13, marginBottom: 24 }}>
              Didn't receive it? Check your spam folder or try again.
            </p>
            <button
              onClick={async () => {
                if (user.email) {
                  await supabase.auth.resend({ type: 'signup', email: user.email });
                  alert('Confirmation email resent!');
                }
              }}
              aria-label="Resend confirmation email"
              style={{
                padding: '10px 24px', background: 'transparent', border: '1px solid #1A3A5C',
                color: '#00D4FF', borderRadius: 8, cursor: 'pointer', fontSize: 14, marginRight: 12,
              }}
            >
              Resend Email
            </button>
            <button
              onClick={async () => { await useUserStore.getState().signOut(); }}
              aria-label="Sign out of account"
              style={{
                padding: '10px 24px', background: 'transparent', border: '1px solid #1A3A5C',
                color: '#8BA4BE', borderRadius: 8, cursor: 'pointer', fontSize: 14,
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    // 3. Synced mode: wait for profile to finish loading.
    // Profile creation (for new users) happens inside fetchProfile() in the store.
    if (profileLoading) return showSpinner;

    // 4. Auto-mark onboarding complete for new users — they'll see Dashboard + SpotlightTour
    //    Realm onboarding is now opt-in via DashboardRealmInvite card
    if (profile && !profile.onboarding_complete) {
      // Mark complete in store immediately so we fall through to routes
      profile.onboarding_complete = true;
      // Persist to Supabase in background (don't block render)
      supabase.from('user_profiles')
        .update({ onboarding_complete: true })
        .eq('user_id', user.id)
        .then(() => refreshProfile());
    }
  } else {
    // 3. Local mode: wait for profile to load
    if (profileLoading) return showSpinner;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={showSpinner}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<PageErrorBoundary pageName="Dashboard"><Suspense fallback={<DashboardSkeleton />}><Dashboard /></Suspense></PageErrorBoundary>} />
            <Route path="/schedule" element={<PageErrorBoundary pageName="Schedule"><Suspense fallback={<ScheduleSkeleton />}><Schedule /></Suspense></PageErrorBoundary>} />
            <Route path="/goals" element={<PageErrorBoundary pageName="Goals"><Suspense fallback={<GoalsSkeleton />}><Goals /></Suspense></PageErrorBoundary>} />
            <Route path="/habits" element={<PageErrorBoundary pageName="Habits"><Suspense fallback={<HabitsSkeleton />}><Habits /></Suspense></PageErrorBoundary>} />
            <Route path="/finances" element={<PageErrorBoundary pageName="Finances"><Suspense fallback={<FinancesSkeleton />}><Finances /></Suspense></PageErrorBoundary>} />
            <Route path="/health" element={<PageErrorBoundary pageName="Health"><Suspense fallback={<HealthSkeleton />}><Health /></Suspense></PageErrorBoundary>} />
            <Route path="/clients" element={<Navigate to="/finances?tab=work" replace />} />
            
            {/* Character Hub & Sub-pages */}
            <Route path="/character" element={<PageErrorBoundary pageName="Character"><Suspense fallback={<CharacterSkeleton />}><CharacterHub /></Suspense></PageErrorBoundary>} />
            <Route path="/character/equipment" element={<PageErrorBoundary pageName="Equipment"><Suspense fallback={<CharacterSkeleton />}><EquipmentPage /></Suspense></PageErrorBoundary>} />
            <Route path="/character/junction" element={<PageErrorBoundary pageName="Junction"><Suspense fallback={<JunctionSkeleton />}><Junction /></Suspense></PageErrorBoundary>} />
            <Route path="/character/asset/:id" element={<PageErrorBoundary pageName="Asset"><Suspense fallback={<PageSkeleton />}><AssetDetail /></Suspense></PageErrorBoundary>} />
            
            {/* Reflect Hub & Sub-pages */}
            <Route path="/reflect" element={<PageErrorBoundary pageName="Reflect"><Suspense fallback={<ReflectSkeleton />}><ReflectHub /></Suspense></PageErrorBoundary>} />
            <Route path="/reflect/journal" element={<PageErrorBoundary pageName="Journal"><Suspense fallback={<JournalSkeleton />}><Journal /></Suspense></PageErrorBoundary>} />
            <Route path="/reflect/review" element={<PageErrorBoundary pageName="Review"><Suspense fallback={<PageSkeleton />}><Review /></Suspense></PageErrorBoundary>} />
            <Route path="/reflect/inbox" element={<PageErrorBoundary pageName="Inbox"><Suspense fallback={<InboxSkeleton />}><InboxPage /></Suspense></PageErrorBoundary>} />
            <Route path="/reflect/story" element={<PageErrorBoundary pageName="Story"><Suspense fallback={<StorySkeleton />}><Story /></Suspense></PageErrorBoundary>} />
            
            {/* Public Story Routes (for sharing) */}
            <Route path="/story/:slug" element={<PageErrorBoundary pageName="Story"><Suspense fallback={<StorySkeleton />}><Story /></Suspense></PageErrorBoundary>} />
            
            {/* Legacy route redirects — preserve bookmarks */}
            <Route path="/equipment" element={<Navigate to="/character?tab=equipment" replace />} />
            <Route path="/junction" element={<Navigate to="/character?tab=junction" replace />} />
            <Route path="/journal" element={<Navigate to="/reflect?tab=journal" replace />} />
            <Route path="/review" element={<Navigate to="/reflect?tab=review" replace />} />
            <Route path="/inbox" element={<Navigate to="/reflect?tab=inbox" replace />} />
            <Route path="/story" element={<Navigate to="/reflect?tab=story" replace />} />
            <Route path="/realm" element={<Navigate to="/character?tab=realm" replace />} />

            <Route path="/academy" element={<PageErrorBoundary pageName="Academy"><Suspense fallback={<PageSkeleton />}><Academy /></Suspense></PageErrorBoundary>} />
            <Route path="/lessons" element={<PageErrorBoundary pageName="TeddysLessons"><Suspense fallback={<PageSkeleton />}><TeddysLessons /></Suspense></PageErrorBoundary>} />
            <Route path="/replicator" element={<PageErrorBoundary pageName="Replicator"><Suspense fallback={<PageSkeleton />}><Replicator /></Suspense></PageErrorBoundary>} />
            <Route path="/settings" element={<PageErrorBoundary pageName="Settings"><Settings /></PageErrorBoundary>} />
            <Route path="/work" element={<PageErrorBoundary pageName="Work"><Suspense fallback={<WorkSkeleton />}><WorkPage /></Suspense></PageErrorBoundary>} />
            <Route path="/work/*" element={<PageErrorBoundary pageName="Work"><Suspense fallback={<WorkSkeleton />}><WorkPage /></Suspense></PageErrorBoundary>} />
            <Route path="/social" element={<PageErrorBoundary pageName="Social"><Suspense fallback={<SocialSkeleton />}><SocialPage /></Suspense></PageErrorBoundary>} />
            <Route path="/social/profile" element={<PageErrorBoundary pageName="ProfileSetup"><ProfileSetupPage /></PageErrorBoundary>} />
          </Route>
          {/* Setup routes — accessible from dashboard phase tracker */}
          <Route path="/setup" element={<SetupHub />} />
          <Route path="/setup/health" element={<HealthOnboarding />} />
          <Route path="/setup/finance" element={<FinanceOnboarding />} />
          <Route path="/setup/life" element={<LifeOnboarding />} />
        </Routes>
      </Suspense>
      <Suspense fallback={null}><LazyFeedbackButton /></Suspense>
      <Suspense fallback={null}><LazyFlipperCheckin /></Suspense>
      <Suspense fallback={null}><LazyLifePulseModal /></Suspense>
    </ErrorBoundary>
  );
}

function App() {
  const oauthReady = useOAuthCallbackHandler();

  if (!oauthReady) return <GlobalLoadingSpinner />;

  return (
    <Router {...(isDesktop ? {} : { basename: "/app" })}>
      {!isDesktop && <UpdateBanner />}
      <ConnectionBanner />
      <WhatsNew />
      <ErrorBoundary>
        <Suspense fallback={<GlobalLoadingSpinner />}>
          <SystemBusProvider>
            <GamificationProvider>
              <AppRoutes />
            </GamificationProvider>
          </SystemBusProvider>
        </Suspense>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
