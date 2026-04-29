import React, { useState, useEffect, useMemo, lazy, Suspense, useCallback } from 'react';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useUserStore } from '../stores/useUserStore';
import { useSubscription } from '../hooks/useSubscription';
import { useSystemBus } from '../lib/systems/context';
import { XPBar } from './gamification/XPBar';
import { useGamificationContext } from '../lib/gamification/context';
import { getErrorMessage } from '../utils/error';
import { TutorialList } from './TutorialList';
import { SetupList } from './SetupList';
import { isTourComplete, type TourId } from './SpotlightTour';
import { ProgressRing } from './ui/ProgressRing';
import { getOverallPercent } from '../lib/onboarding-phases';
import { preloadPage } from '../utils/preload';

const ALL_TOUR_IDS: TourId[] = ['dashboard', 'goals', 'habits', 'schedule', 'finance', 'health', 'junction', 'gamification'];
import './GamificationModal.css';

const GamificationModal = lazy(() => import('./GamificationModal').then(m => ({ default: m.GamificationModal })));
const MiniCharacter = lazy(() => import('../realm/ui/MiniCharacter').then(m => ({ default: m.MiniCharacter })));
import {
  LayoutDashboard, Calendar, Target, Flame, Wallet, Heart,
  BookOpen, ChevronLeft, ChevronRight,
  LogOut, Zap, Settings, BarChart3, MessageSquarePlus, Crown, Users,
  CreditCard, Loader2, Sparkles, Swords, Inbox, GraduationCap, Music, Package, Brain, Clock,
  type LucideIcon,
} from 'lucide-react';
import { getUnreadCount } from '../lib/social/messaging';
import { getNavFeatures } from '../lib/feature-registry';
import './Sidebar.css';

/** Map icon name strings from the feature registry to Lucide components. */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Calendar, Target, Flame, Wallet, Heart,
  BookOpen, Users, Swords, Settings, BarChart3, GraduationCap, Music, Package, Sparkles, Brain, Clock,
};

/** Compute account age in days from user's created_at timestamp. */
function getAccountAgeDays(createdAt?: string): number {
  if (!createdAt) return Infinity; // Unknown → show all features
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
}

interface SidebarProps {
  expanded?: boolean;
  onToggle?: () => void;
  /** When true, always render as expanded (full labels) regardless of expanded prop */
  forceFull?: boolean;
}

export const Sidebar = React.memo(function Sidebar({ expanded = true, onToggle, forceFull = false }: SidebarProps) {
  const collapsed = forceFull ? false : !expanded;
  const [gamOpen, setGamOpen] = useState(false);
  const [socialUnread, setSocialUnread] = useState(0);
  const userId = useUserStore(s => s.session?.user?.id);
  const createdAt = useUserStore(s => s.session?.user?.created_at);

  // Progressive disclosure: compute account age to filter nav items
  const navItems = useMemo(() => {
    const accountDays = getAccountAgeDays(createdAt);
    return getNavFeatures('sidebar', accountDays).map(f => ({
      to: f.route,
      icon: ICON_MAP[f.icon] || LayoutDashboard,
      label: f.name,
      color: f.color,
    }));
  }, [createdAt]);
  const [upgrading, setUpgrading] = useState(false);
  const [tutorialListOpen, setTutorialListOpen] = useState(false);
  const [setupListOpen, setSetupListOpen] = useState(false);
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const mode = useUserStore(s => s.mode);
  const signInWithGoogle = useUserStore(s => s.signInWithGoogle);
  const signOut = useUserStore(s => s.signOut);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const { tier, upgrade, manageSubscription } = useSubscription();
  const { systemPages } = useSystemBus();
  const gam = useGamificationContext();
  const location = useLocation();
  const navigate = useNavigate();

  // Tutorial completion progress — recheck when tutorial panel closes
  const tutorialProgress = useMemo(() => {
    const done = ALL_TOUR_IDS.filter(id => isTourComplete(id)).length;
    return { done, total: ALL_TOUR_IDS.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialListOpen]);

  // Load social unread count
  useEffect(() => {
    if (!user?.id) return;
    getUnreadCount(user.id).then(setSocialUnread).catch(() => null);
    const interval = setInterval(() => {
      if (user?.id) getUnreadCount(user.id).then(setSocialUnread).catch(() => null);
    }, 60_000);
    return () => clearInterval(interval);
  }, [user?.id]);

  /* ─────────────────────────────────────────────────────────────────
   * IMPORTANT: Never use {!collapsed && <element>} to hide sidebar
   * content. ALL elements must always be in the DOM. Visibility is
   * controlled ONLY by CSS via the .collapsed class scoped to the
   * desktop @media (min-width: 769px) query in Sidebar.css.
   *
   * This prevents the recurring mobile hamburger bug where labels
   * disappear because React conditionally omits them from the DOM.
   * ───────────────────────────────────────────────────────────────── */

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} role="navigation" aria-label="Main navigation">
      {/* Logo + collapse */}
      <div className="sb-top">
        <button className="sb-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }} aria-label="Go to dashboard">
          <Suspense fallback={<Zap size={22} className="sb-logo-icon" />}>
            <MiniCharacter size={28} animate fps={8} onClick={() => navigate('/')} />
          </Suspense>
          <span className="sb-brand">LifeOS</span>
        </button>
        <button className="sb-collapse" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* XP Bar — click to open full stats */}
      {!gam.loading && (
        <div className="sb-xp-bar" style={{ padding: '0 12px 8px', cursor: 'pointer' }} onClick={() => setGamOpen(true)} title="View Player Stats" role="button" tabIndex={0} aria-label="View Player Stats" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGamOpen(true); } }}>
          <XPBar
            compact
            level={gam.level}
            title={gam.title}
            xpProgress={gam.xpProgress}
            xpToNext={gam.xpToNext}
            totalXP={gam.xp}
          />
        </div>
      )}

      {/* Nav */}
      <nav className="sb-nav" aria-label="Page navigation">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`sb-link ${active ? 'active' : ''}`}
              title={item.label}
              aria-current={active ? 'page' : undefined}
              onMouseEnter={() => preloadPage(item.to === '/' ? '/' : item.to)}
            >
              <div className="sb-icon-wrap" style={{ '--link-color': item.color } as React.CSSProperties}>
                <Icon size={18} />
              </div>
              <span className="sb-label">{item.label}</span>
              {item.to === '/social' && socialUnread > 0 && (
                <span className="sb-badge" style={{
                  marginLeft: 'auto', background: '#00D4FF', color: '#0A2540',
                  borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700,
                }}>
                  {socialUnread}
                </span>
              )}
            </NavLink>
          );
        })}

        {/* Connected system pages */}
        {systemPages.length > 0 && (
          <>
            <div className="sb-section-label" style={{
              padding: '8px 16px 4px', fontSize: 10, fontWeight: 600,
              color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase',
              letterSpacing: '0.1em', marginTop: 4,
            }}>
              Systems
            </div>
            {systemPages
              .filter((p, i, arr) => arr.findIndex(x => x.path === p.path) === i)
              .map(page => {
                const active = location.pathname === page.path || location.pathname.startsWith(page.path + '/');
                return (
                  <NavLink
                    key={page.path}
                    to={page.path}
                    className={`sb-link ${active ? 'active' : ''}`}
                    title={page.label}
                    aria-current={active ? 'page' : undefined}
                    onMouseEnter={() => preloadPage(page.path)}
                  >
                    <div className="sb-icon-wrap" style={{ '--link-color': '#00D4FF' } as React.CSSProperties}>
                      <span style={{ fontSize: 16, lineHeight: 1 }}>{page.icon}</span>
                    </div>
                    <span className="sb-label">{page.label}</span>
                  </NavLink>
                );
              })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sb-footer">
        <NavLink to="/settings" className="sb-link sb-settings-link" title="Settings" aria-label="Settings" onMouseEnter={() => preloadPage('/settings')}>
          <div className="sb-icon-wrap" style={{ '--link-color': '#64748B' } as React.CSSProperties}>
            <Settings size={18} />
          </div>
          <span className="sb-label">Settings</span>
        </NavLink>
        <button
          className="sb-link sb-tutorials-btn"
          onClick={() => setTutorialListOpen(true)}
          title={`Tutorials (${tutorialProgress.done}/${tutorialProgress.total})`}
          aria-label={`Tutorials (${tutorialProgress.done}/${tutorialProgress.total})`}
        >
          <div className="sb-icon-wrap" style={{ '--link-color': '#D4AF37' } as React.CSSProperties}>
            <GraduationCap size={18} />
          </div>
          <span className="sb-label">Tutorials</span>
          {tutorialProgress.done < tutorialProgress.total && (
            <div className="sb-tutorials-ring">
              <ProgressRing
                value={(tutorialProgress.done / tutorialProgress.total) * 100}
                size={20}
                strokeWidth={2.5}
                color="#D4AF37"
                glow={false}
                animate={false}
                centerContent={
                  <span className="sb-tutorials-ring-text">
                    {tutorialProgress.done}/{tutorialProgress.total}
                  </span>
                }
              />
            </div>
          )}
          {tutorialProgress.done === tutorialProgress.total && (
            <span className="sb-tutorials-complete">✓</span>
          )}
        </button>
        {(() => {
          const prefs = (profile?.preferences || {}) as Record<string, unknown>;
          const setupPercent = getOverallPercent(prefs);
          return (
            <button
              className="sb-link sb-setup-btn"
              onClick={() => setSetupListOpen(true)}
              title={`Life Setup (${setupPercent}%)`}
              aria-label={`Life Setup (${setupPercent}%)`}
            >
              <div className="sb-icon-wrap" style={{ '--link-color': '#00D4FF' } as React.CSSProperties}>
                <Sparkles size={18} />
              </div>
              <span className="sb-label">Life Setup</span>
              {setupPercent < 100 && (
                <div className="sb-tutorials-ring">
                  <ProgressRing
                    value={setupPercent}
                    size={20}
                    strokeWidth={2.5}
                    color="#00D4FF"
                    glow={false}
                    animate={false}
                    centerContent={
                      <span className="sb-tutorials-ring-text">
                        {setupPercent}%
                      </span>
                    }
                  />
                </div>
              )}
              {setupPercent >= 100 && (
                <span className="sb-tutorials-complete">✓</span>
              )}
            </button>
          );
        })()}
        <button
          className="sb-upgrade-btn"
          title="Early Adopter — Pro Unlocked"
          aria-label="Early Adopter Pro"
          onClick={() => {
            alert('🎉 Early Adopter — Pro Unlocked!\n\nThank you for being one of the first to use LifeOS. All Pro features are yours for free.\n\nWe\'re building something special, and you\'re part of it from the beginning.');
          }}
        >
          <Crown size={16} /> <span>Pro — Early Adopter</span>
        </button>
        <button
          className="sb-link sb-feedback-btn"
          onClick={() => document.dispatchEvent(new CustomEvent('open-feedback'))}
          aria-label="Send feedback"
          title="Send feedback"
        >
          <div className="sb-icon-wrap" style={{ '--link-color': '#8BA4BE' } as React.CSSProperties}>
            <MessageSquarePlus size={18} />
          </div>
          <span className="sb-label">Feedback</span>
        </button>
        {mode === 'local' && (
          <div className="sb-google-signin">
            <span className="sb-google-signin-cta">Sign in to sync your data</span>
            <button
              className="sb-google-btn"
              onClick={async () => {
                setGoogleSigningIn(true);
                try {
                  await signInWithGoogle();
                } catch (err) {
                  console.error('[Sidebar] Google sign-in failed:', err);
                } finally {
                  setGoogleSigningIn(false);
                }
              }}
              disabled={googleSigningIn}
              aria-label="Sign in with Google"
              title="Sign in with Google to sync your data across devices"
            >
              {googleSigningIn ? (
                <Loader2 size={16} className="sb-google-spinner" />
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" className="sb-google-icon">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span className="sb-google-btn-label">Sign in with Google</span>
            </button>
          </div>
        )}
        <div className="sb-user">
          <span className="sb-email">{user?.email?.split('@')[0] || 'User'}</span>
          <button className="sb-signout" onClick={signOut} aria-label="Sign out" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
      {/* Gamification Modal */}
      {gamOpen && (
        <Suspense fallback={null}>
          <GamificationModal open={gamOpen} onClose={() => setGamOpen(false)} />
        </Suspense>
      )}
      {/* Tutorial List Panel */}
      <TutorialList open={tutorialListOpen} onClose={() => setTutorialListOpen(false)} />
      {/* Setup List Panel */}
      <SetupList open={setupListOpen} onClose={() => setSetupListOpen(false)} />
    </aside>
  );
});
