import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { DesktopHeader } from './DesktopHeader';
import { MobileHeader } from './MobileHeader';
import { MobileNav } from './MobileNav';
import { ToastContainer } from './Toast';
import { OfflineBanner } from './OfflineBanner';
import { SyncPromptBanner } from './SyncPromptBanner';
import { InstallPrompt } from './InstallPrompt';
import { UpdateNotification } from './UpdateNotification';
import { PageTransition } from './PageTransition';
import { ErrorBoundary } from './ErrorBoundary';
import { EventOverlayProvider } from './EventOverlay';
import { EventDrawerSkeleton } from './skeletons';
import { OverlayPortal } from './OverlayPortal';
import { FeatureErrorBoundary } from './FeatureErrorBoundary';
import { SmartNotificationToast } from './SmartNotificationToast';
import { useNotifications } from '../hooks/useNotifications';
import './Layout.css';

// Lazy load heavy overlay/modal components — not needed on initial render
const AIChat = lazy(() => import('./AIChat').then(m => ({ default: m.AIChat })));
const VoiceFAB = lazy(() => import('./VoiceFAB').then(m => ({ default: m.VoiceFAB })));
// AgentChatFAB removed — merged into AIChat (Deep Think mode)
const GamificationOverlay = lazy(() => import('./gamification/GamificationOverlay').then(m => ({ default: m.GamificationOverlay })));
const CommandPalette = lazy(() => import('./CommandPalette').then(m => ({ default: m.CommandPalette })));
const EventDrawer = lazy(() => import('./EventDrawer').then(m => ({ default: m.EventDrawer })));
// RPG Overlay removed — all game interaction lives inside the Realm now
// const RPGOverlay = lazy(() => import('../rpg/RPGOverlay').then(m => ({ default: m.RPGOverlay })));
const RealmCelebration = lazy(() => import('../realm/ui/RealmCelebration').then(m => ({ default: m.RealmCelebration })));

function LayoutInner() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem('lifeos-sidebar-expanded');
      if (stored !== null) return stored === 'true';
    } catch {}
    return window.innerWidth > 900;
  });
  const location = useLocation();
  const { highPriorityNotifications, dismiss } = useNotifications();

  // ResizeObserver: auto-collapse/expand sidebar if user hasn't set a preference
  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const userPref = localStorage.getItem('lifeos-sidebar-expanded');
      if (userPref === null) {
        setSidebarExpanded(w > 900);
      }
    });
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, []);

  // Set --sidebar-w on <html> so FSP portal can also read it
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', sidebarExpanded ? '240px' : '64px');
  }, [sidebarExpanded]);

  const handleSidebarToggle = useCallback(() => {
    setSidebarExpanded(prev => {
      const next = !prev;
      try { localStorage.setItem('lifeos-sidebar-expanded', String(next)); } catch {}
      return next;
    });
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Safety: clean up stuck driver.js tour overlay on route change
  useEffect(() => {
    document.body.classList.remove('driver-active');
    document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
  }, [location.pathname]);

  return (
    <>
    <div className="layout">
      {/* Skip to content link for keyboard users */}
      <a href="#main-content" className="skip-to-content" style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>Skip to content</a>

      {/* Desktop sidebar — hidden on mobile, slides in via CSS transform */}
      <div className={`sidebar-wrap ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <Sidebar expanded={mobileMenuOpen || sidebarExpanded} onToggle={handleSidebarToggle} forceFull={mobileMenuOpen} />
      </div>
      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}

      <div className="layout-main">
        <DesktopHeader />
        <MobileHeader onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <UpdateNotification />
        <SyncPromptBanner />
        <OfflineBanner />
        <InstallPrompt />
        <main id="main-content" className="layout-content" role="main">
          <ErrorBoundary>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </ErrorBoundary>
        </main>
      </div>

      <MobileNav />
    </div>

    {/* Overlays — portaled outside .layout to avoid stacking context issues */}
    <OverlayPortal tier="fab">
      <Suspense fallback={null}>
        <FeatureErrorBoundary feature="Voice FAB" compact>
          <VoiceFAB />
        </FeatureErrorBoundary>
      </Suspense>
    </OverlayPortal>
    <OverlayPortal tier="chat">
      <Suspense fallback={null}>
        <FeatureErrorBoundary feature="AI Chat" compact>
          <AIChat />
        </FeatureErrorBoundary>
      </Suspense>
    </OverlayPortal>
    <OverlayPortal tier="toast">
      <ToastContainer />
      <SmartNotificationToast
        highPriorityNotifications={highPriorityNotifications}
        onDismiss={dismiss}
      />
    </OverlayPortal>
    <OverlayPortal tier="celebration">
      <Suspense fallback={null}>
        <FeatureErrorBoundary feature="Gamification" compact>
          <GamificationOverlay />
        </FeatureErrorBoundary>
        <FeatureErrorBoundary feature="Realm Celebration" compact>
          <RealmCelebration />
        </FeatureErrorBoundary>
      </Suspense>
    </OverlayPortal>
    <OverlayPortal tier="command">
      <Suspense fallback={null}>
        <FeatureErrorBoundary feature="Command Palette" compact>
          <CommandPalette />
        </FeatureErrorBoundary>
      </Suspense>
    </OverlayPortal>
    <OverlayPortal tier="drawer">
      <Suspense fallback={<EventDrawerSkeleton />}>
        <FeatureErrorBoundary feature="Event Drawer" compact>
          <EventDrawer />
        </FeatureErrorBoundary>
      </Suspense>
    </OverlayPortal>
    </>
  );
}

export function Layout() {
  return (
    <EventOverlayProvider>
      <LayoutInner />
    </EventOverlayProvider>
  );
}
