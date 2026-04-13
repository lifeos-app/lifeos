import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
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

const ALL_TOUR_IDS: TourId[] = ['dashboard', 'goals', 'habits', 'schedule', 'finance', 'health', 'junction', 'gamification'];
import './GamificationModal.css';

const GamificationModal = lazy(() => import('./GamificationModal').then(m => ({ default: m.GamificationModal })));
const MiniCharacter = lazy(() => import('../realm/ui/MiniCharacter').then(m => ({ default: m.MiniCharacter })));
import {
  LayoutDashboard, Calendar, Target, Flame, Wallet, Heart,
  BookOpen, ChevronLeft, ChevronRight,
  LogOut, Zap, Settings, BarChart3, MessageSquarePlus, Crown, Users,
  CreditCard, Loader2, Sparkles, Swords, Inbox, GraduationCap, Music, Package,
  type LucideIcon,
} from 'lucide-react';
import { getUnreadCount } from '../lib/social/messaging';
import { getNavFeatures } from '../lib/feature-registry';
import './Sidebar.css';

/** Map icon name strings from the feature registry to Lucide components. */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Calendar, Target, Flame, Wallet, Heart,
  BookOpen, Users, Swords, Settings, BarChart3, GraduationCap, Music, Package,
};

const NAV_ITEMS = getNavFeatures('sidebar').map(f => ({
  to: f.route,
  icon: ICON_MAP[f.icon] || LayoutDashboard,
  label: f.name,
  color: f.color,
}));

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
  const [upgrading, setUpgrading] = useState(false);
  const [tutorialListOpen, setTutorialListOpen] = useState(false);
  const [setupListOpen, setSetupListOpen] = useState(false);
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const signOut = useUserStore(s => s.signOut);
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
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Main navigation">
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
        <div className="sb-xp-bar" style={{ padding: '0 12px 8px', cursor: 'pointer' }} onClick={() => setGamOpen(true)} title="View Player Stats">
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
      <nav className="sb-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`sb-link ${active ? 'active' : ''}`}
              title={item.label}
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
        <NavLink to="/settings" className="sb-link sb-settings-link" title="Settings">
          <div className="sb-icon-wrap" style={{ '--link-color': '#64748B' } as React.CSSProperties}>
            <Settings size={18} />
          </div>
          <span className="sb-label">Settings</span>
        </NavLink>
        <button
          className="sb-link sb-tutorials-btn"
          onClick={() => setTutorialListOpen(true)}
          title={`Tutorials (${tutorialProgress.done}/${tutorialProgress.total})`}
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
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', margin: '0 8px 8px',
            background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))',
            border: '1px solid rgba(0,212,255,0.2)', borderRadius: 10, color: '#00D4FF',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
            width: 'calc(100% - 16px)',
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
