import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Zap, MessageCircle, Swords } from 'lucide-react';
import { useGamificationContext } from '../lib/gamification/context';
import { GamificationModal } from './GamificationModal';
import { RealmEventBus } from '../realm/bridge/RealmEventBus';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationPanel } from './NotificationPanel';
import { FeatureErrorBoundary } from './FeatureErrorBoundary';

const MiniCharacter = lazy(() => import('../realm/ui/MiniCharacter').then(m => ({ default: m.MiniCharacter })));
import './GamificationModal.css';
import './MobileHeader.css';

export function MobileHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
  const navigate = useNavigate();
  const gam = useGamificationContext();
  const [gamOpen, setGamOpen] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [levelUpGlow, setLevelUpGlow] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>();
  const { notifications, unreadCount, markRead, markAllRead, dismiss, dismissAll, clearAll, history, highPriorityNotifications } = useNotifications();

  // Scroll detection — pause animation while scrolling
  useEffect(() => {
    const el = document.querySelector('.layout-main') || window;
    const onScroll = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setIsScrolling(false), 150);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      clearTimeout(scrollTimer.current);
    };
  }, []);

  // Level-up glow
  useEffect(() => {
    return RealmEventBus.on('level_up', () => {
      setLevelUpGlow(true);
      setTimeout(() => setLevelUpGlow(false), 2000);
    });
  }, []);

  return (
    <>
      <header className="mobile-header">
        <button className="mh-hamburger" onClick={onMenuToggle} aria-label="Toggle menu">
          <Menu size={20} />
        </button>
        <div className="mh-logo" onClick={() => {
          const el = document.querySelector('.layout-main') || document.querySelector('.layout-content');
          if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          if (window.location.pathname !== '/') navigate('/');
        }} style={{ cursor: 'pointer' }}>
          <Zap size={16} className="mh-zap" />
          <span>LifeOS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Level badge — tapping opens Player Stats modal */}
          {!gam.loading && (
            <button
              onClick={() => setGamOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(255,215,0,0.06))',
                border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: 20, padding: '3px 8px 3px 4px',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: 'linear-gradient(135deg, #D4AF37, #FFD700)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Orbitron', monospace", fontWeight: 900,
                fontSize: 9, color: '#0A0E1A',
                boxShadow: '0 0 6px rgba(212,175,55,0.4)',
              }}>
                {gam.level}
              </div>
              <span style={{ fontSize: 10, color: '#D4AF37', fontWeight: 600, maxWidth: 55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {gam.title}
              </span>
              <span style={{ fontSize: 10, color: '#D4AF37', fontWeight: 600 }}>
                {Math.round(gam.xpProgress * 100)}%
              </span>
            </button>
          )}
          {/* Notifications bell */}
          <button
            aria-label="Notifications"
            className="mh-command mh-notif-btn"
            onClick={() => setNotifOpen(prev => !prev)}
          >
            <Bell size={16} />
            {unreadCount > 0 && <span className="mh-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          {/* Messages */}
          <button
            aria-label="Messages"
            className="mh-command"
            onClick={() => navigate('/social?tab=messages')}
          >
            <MessageCircle size={16} />
          </button>
          {/* Character page */}
          <button aria-label="Character" className="mh-command mh-character-btn" onClick={() => navigate('/character')}>
            <Swords size={14} />
          </button>
          {/* Character avatar */}
          <div style={{
            borderRadius: '50%',
            boxShadow: levelUpGlow ? '0 0 12px 4px rgba(255,215,0,0.6)' : 'none',
            transition: 'box-shadow 0.3s',
          }}>
            <Suspense fallback={<div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(100,100,100,0.15)' }} />}>
              <MiniCharacter
                size={32}
                animate={!isScrolling}
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
