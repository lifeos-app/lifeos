import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../stores/useUserStore';
import { getUnreadCount, subscribeToInbox } from '../lib/social/messaging';
import {
  LayoutDashboard, Calendar, Target, Flame,
  Wallet, Heart, BookOpen, BarChart3, Inbox, Settings, MoreHorizontal, X, Users, LogOut, Sparkles, Swords, GraduationCap,
  type LucideIcon,
} from 'lucide-react';
import { SpaceAge } from './SpaceAge';
import { getMobileMainTabs, getMobileMoreGroups } from '../lib/feature-registry';
import './MobileNav.css';

/** Map icon name strings from the feature registry to Lucide components. */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Calendar, Target, Flame, Wallet, Heart,
  BookOpen, Users, Swords, Settings, BarChart3, GraduationCap,
};

interface Tab {
  to: string;
  icon: React.ElementType;
  label: string;
  color: string;
}

interface TabWithBadge extends Tab {
  badgeKey?: string;
}

interface MoreGroup {
  label: string;
  items: TabWithBadge[];
}

/** Compute account age in days from user's created_at timestamp. */
function getAccountAgeDays(createdAt?: string): number {
  if (!createdAt) return Infinity;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
}

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore(s => s.user);
  const signOut = useUserStore(s => s.signOut);
  const createdAt = useUserStore(s => s.session?.user?.created_at);

  // Progressive disclosure: compute account age to filter nav items
  const mainTabs = useMemo(() => {
    const accountDays = getAccountAgeDays(createdAt);
    return getMobileMainTabs(accountDays).map(f => ({
      to: f.route,
      icon: ICON_MAP[f.icon] || LayoutDashboard,
      label: f.id === 'dashboard' ? 'Home' : f.name,
      color: f.color,
    }));
  }, [createdAt]);

  const moreGroups = useMemo(() => {
    const accountDays = getAccountAgeDays(createdAt);
    return getMobileMoreGroups(accountDays);
  }, [createdAt]);

  const MORE_GROUPS: MoreGroup[] = useMemo(() => [
    {
      label: 'Life',
      items: moreGroups.life.map(f => ({
        to: f.route,
        icon: ICON_MAP[f.icon] || LayoutDashboard,
        label: f.name,
        color: f.color,
        ...(f.id === 'social' ? { badgeKey: 'social' } : {}),
      })),
    },
    {
      label: 'Growth',
      items: moreGroups.growth.map(f => ({
        to: f.route,
        icon: ICON_MAP[f.icon] || LayoutDashboard,
        label: f.name,
        color: f.color,
      })),
    },
  ], [moreGroups]);

  // Flat list for isActive checks
  const ALL_MORE_ITEMS: TabWithBadge[] = useMemo(() => [
    ...MORE_GROUPS.flatMap(g => g.items),
    { to: '__logout__', icon: LogOut, label: 'Log Out', color: '#EF4444' },
  ], [MORE_GROUPS]);
  const [showMore, setShowMore] = useState(false);
  const [socialUnread, setSocialUnread] = useState(0);

  // ── Space Age Easter Egg ──
  const [showSpaceAge, setShowSpaceAge] = useState(false);
  const [secretReady, setSecretReady] = useState(false);
  const secretTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number>(0);

  const clearSecretTimer = useCallback(() => {
    if (secretTimer.current) {
      clearTimeout(secretTimer.current);
      secretTimer.current = null;
    }
  }, []);

  const handleNavTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    clearSecretTimer();
    secretTimer.current = setTimeout(() => {
      setSecretReady(true);
      // Subtle haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(30);
    }, 3000);
  }, [clearSecretTimer]);

  const handleNavTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - touchStartY.current;
    // If they move before 3s, cancel the timer (normal interaction)
    if (!secretReady && Math.abs(deltaY) > 10) {
      clearSecretTimer();
      return;
    }
    // If secret is ready and they swipe UP
    if (secretReady && deltaY < -50) {
      setSecretReady(false);
      clearSecretTimer();
      setShowSpaceAge(true);
    }
  }, [secretReady, clearSecretTimer]);

  const handleNavTouchEnd = useCallback(() => {
    clearSecretTimer();
    // Remove glow after short delay if not triggered
    if (secretReady) {
      setTimeout(() => setSecretReady(false), 2000);
    }
  }, [secretReady, clearSecretTimer]);

  // Close more sheet on navigation
  useEffect(() => {
    setShowMore(false);
  }, [location.pathname]);

  // Track unread message count for Social badge
  useEffect(() => {
    if (!user?.id) return;
    getUnreadCount(user.id).then(setSocialUnread).catch(() => null);
    const interval = setInterval(() => {
      getUnreadCount(user.id).then(setSocialUnread).catch(() => null);
    }, 30_000);
    const unsub = subscribeToInbox(user.id, () => {
      setSocialUnread(prev => prev + 1);
    });
    return () => { clearInterval(interval); unsub(); };
  }, [user?.id]);

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  // Check if current path is in the "More" menu
  const isMoreActive = ALL_MORE_ITEMS.some(item => isActive(item.to));

  return (
    <>
      {showSpaceAge && <SpaceAge onClose={() => setShowSpaceAge(false)} />}
      <nav
        className={`mobile-nav ${secretReady ? 'mn-secret-glow' : ''}`}
        aria-label="Main navigation"
        onTouchStart={handleNavTouchStart}
        onTouchMove={handleNavTouchMove}
        onTouchEnd={handleNavTouchEnd}
      >
        {mainTabs.map(tab => {
          const Icon = tab.icon;
          const active = isActive(tab.to);
          return (
            <button
              key={tab.to}
              className={`mn-tab ${active ? 'active' : ''}`}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                if (active) {
                  const el = document.querySelector('.layout-main') || document.querySelector('.layout-content');
                  if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  navigate(tab.to);
                }
              }}
              style={{ '--tab-color': tab.color } as React.CSSProperties}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.5} />
              <span className="mn-label">{tab.label}</span>
              {active && <div className="mn-dot" />}
            </button>
          );
        })}
        <button
          className={`mn-tab ${isMoreActive || showMore ? 'active' : ''}`}
          onClick={() => setShowMore(!showMore)}
          aria-label={showMore ? 'Close more menu' : 'Open more menu'}
          aria-expanded={showMore}
          style={{ '--tab-color': '#8BA4BE', position: 'relative' } as React.CSSProperties}
        >
          {showMore ? <X size={20} /> : <MoreHorizontal size={20} />}
          <span className="mn-label">More</span>
          {isMoreActive && !showMore && <div className="mn-dot" />}
          {socialUnread > 0 && !showMore && (
            <span style={{
              position: 'absolute', top: 2, right: 8,
              width: 8, height: 8, borderRadius: '50%',
              background: '#F43F5E',
              boxShadow: '0 0 6px rgba(244,63,94,0.6)',
            }} />
          )}
        </button>
      </nav>

      {/* More sheet overlay */}
      {showMore && (
        <>
          <div className="mn-overlay" onClick={() => setShowMore(false)} aria-hidden="true" />
          <div className="mn-sheet" role="dialog" aria-label="More navigation options">
            <div className="mn-sheet-handle" />
            <div className="mn-sheet-groups" role="menu">
              {MORE_GROUPS.map(group => (
                <div key={group.label} className="mn-sheet-group">
                  <div className="mn-sheet-group-label">{group.label}</div>
                  <div className="mn-sheet-grid">
                    {group.items.map(item => {
                      const Icon = item.icon;
                      const active = isActive(item.to);
                      const badge = item.badgeKey === 'social' ? socialUnread : 0;
                      return (
                        <button
                          key={item.to}
                          className={`mn-sheet-item ${active ? 'active' : ''}`}
                          onClick={() => { navigate(item.to); setShowMore(false); }}
                          style={{ '--item-color': item.color } as React.CSSProperties}
                        >
                          <div className="mn-sheet-icon" style={{ position: 'relative' }}>
                            <Icon size={22} />
                            {badge > 0 && (
                              <span style={{
                                position: 'absolute', top: -4, right: -4,
                                background: '#F43F5E', color: '#fff',
                                fontSize: 9, fontWeight: 700, borderRadius: 20,
                                padding: '0 4px', minWidth: 14, textAlign: 'center',
                                lineHeight: '16px',
                              }}>
                                {badge > 99 ? '99+' : badge}
                              </span>
                            )}
                          </div>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* Log Out — standalone */}
              <div className="mn-sheet-group">
                <div className="mn-sheet-grid">
                  <button
                    className="mn-sheet-item"
                    onClick={() => { setShowMore(false); signOut(); }}
                    style={{ '--item-color': '#EF4444' } as React.CSSProperties}
                  >
                    <div className="mn-sheet-icon"><LogOut size={22} /></div>
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
