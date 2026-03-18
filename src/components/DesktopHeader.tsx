import { useState, useEffect, Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, MessageCircle, Swords } from 'lucide-react';
import { useGamificationContext } from '../lib/gamification/context';
import { GamificationModal } from './GamificationModal';
import { RealmEventBus } from '../realm/bridge/RealmEventBus';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationPanel } from './NotificationPanel';
import { FeatureErrorBoundary } from './FeatureErrorBoundary';

const MiniCharacter = lazy(() => import('../realm/ui/MiniCharacter').then(m => ({ default: m.MiniCharacter })));
import './DesktopHeader.css';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Today',
  '/schedule': 'Schedule',
  '/goals': 'Goals',
  '/habits': 'Habits',
  '/finances': 'Finances',
  '/health': 'Health',
  '/reflect': 'Reflect',
  '/reflect/journal': 'Journal',
  '/reflect/review': 'Review',
  '/reflect/inbox': 'Inbox',
  '/reflect/story': 'Story',
  '/social': 'Social',
  '/settings': 'Settings',
  '/character': 'Character',
  '/character/equipment': 'Equipment',
  '/character/junction': 'Junction',
};

function getPageTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  for (const [route, title] of Object.entries(ROUTE_TITLES)) {
    if (route !== '/' && pathname.startsWith(route)) return title;
  }
  return 'LifeOS';
}

export function DesktopHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const gam = useGamificationContext();
  const [gamOpen, setGamOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [levelUpGlow, setLevelUpGlow] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead, dismiss, clearAll, history } = useNotifications();

  // Level-up glow
  useEffect(() => {
    return RealmEventBus.on('level_up', () => {
      setLevelUpGlow(true);
      setTimeout(() => setLevelUpGlow(false), 2000);
    });
  }, []);

  const pageTitle = getPageTitle(location.pathname);

  return (
    <>
      <header className="desktop-header" role="banner">
        <h1 className="dh-title">{pageTitle}</h1>

        <div className="dh-actions">
          {/* Level badge */}
          {!gam.loading && (
            <button className="dh-level-badge" onClick={() => setGamOpen(true)} aria-label={`Level ${gam.level} ${gam.title}, ${Math.round(gam.xpProgress * 100)}% to next level`}>
              <div className="dh-level-circle" aria-hidden="true">{gam.level}</div>
              <span className="dh-level-title" aria-hidden="true">{gam.title}</span>
              <span className="dh-xp-pct" aria-hidden="true">{Math.round(gam.xpProgress * 100)}%</span>
            </button>
          )}

          {/* Notifications bell */}
          <button className="dh-notif-btn" onClick={() => setNotifOpen(prev => !prev)} aria-label="Notifications">
            <Bell size={16} />
            {unreadCount > 0 && <span className="dh-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>

          {/* Messages */}
          <button className="dh-messages-btn" onClick={() => navigate('/social?tab=messages')} aria-label="Messages" title="Messages">
            <MessageCircle size={16} />
          </button>

          {/* Character page */}
          <button className="dh-character-btn" onClick={() => navigate('/character')} aria-label="Character" title="Character">
            <Swords size={16} />
          </button>

          {/* Character avatar */}
          <div style={{
            borderRadius: '50%',
            boxShadow: levelUpGlow ? '0 0 12px 4px rgba(255,215,0,0.6)' : 'none',
            transition: 'box-shadow 0.3s',
          }}>
            <Suspense fallback={<div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(100,100,100,0.15)' }} />}>
              <MiniCharacter
                size={28}
                animate
                fps={15}
                onClick={() => navigate('/character?tab=realm')}
              />
            </Suspense>
          </div>
        </div>
      </header>
      <GamificationModal open={gamOpen} onClose={() => setGamOpen(false)} />
      {notifOpen && (
        <FeatureErrorBoundary feature="Notifications" compact>
          <NotificationPanel
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onDismiss={dismiss}
            onClearAll={clearAll}
            history={history}
            onClose={() => setNotifOpen(false)}
            onNavigate={(route) => { navigate(route); setNotifOpen(false); }}
          />
        </FeatureErrorBoundary>
      )}
    </>
  );
}
