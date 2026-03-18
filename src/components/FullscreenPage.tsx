/**
 * FullscreenPage — Reusable fullscreen immersive wrapper
 *
 * Portals content to document.body with:
 * - Fullscreen fixed container (z-index 9998)
 * - Hamburger menu → sidebar
 * - Level badge + Messages button in header
 * - Floating bottom tab bar
 * - Scrollable content area
 * - Body class to hide app chrome
 *
 * Used by CharacterHub, Health, Finances (and future pages).
 */

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Menu, MessageCircle } from 'lucide-react';
import { useGamificationContext } from '../lib/gamification/context';
import { GamificationModal } from './GamificationModal';
import './FullscreenPage.css';

interface TabConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  color: string;
}

interface FullscreenPageProps {
  /** Page title shown in header */
  title: string;
  /** Icon shown next to title */
  titleIcon: ReactNode;
  /** Tab configuration */
  tabs: TabConfig[];
  /** Currently active tab id */
  activeTab: string;
  /** Called when tab changes */
  onTabChange: (tabId: string) => void;
  /** Tab content to render */
  children: ReactNode;
  /** Slide direction for tab transitions */
  slideDir?: 'left' | 'right' | 'none';
  /** Active tab color for header theming */
  activeColor?: string;
  /** Extra elements to render in header (between title and right buttons) */
  headerExtra?: ReactNode;
  /** Extra elements to render above tabs in content area */
  contentExtra?: ReactNode;
  /** Whether to hide the bottom nav and header (e.g. for Realm) */
  chromeHidden?: boolean;
}

export function FullscreenPage({
  title,
  titleIcon,
  tabs,
  activeTab,
  onTabChange,
  children,
  slideDir = 'none',
  activeColor = '#F97316',
  headerExtra,
  contentExtra,
  chromeHidden = false,
}: FullscreenPageProps) {
  const navigate = useNavigate();
  const [entered, setEntered] = useState(false);
  const [gamOpen, setGamOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const gam = useGamificationContext();

  // ── Sidebar toggle ──
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev;
      const wrap = document.querySelector('.sidebar-wrap');
      if (wrap) wrap.classList.toggle('mobile-open', next);
      return next;
    });
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    document.querySelector('.sidebar-wrap')?.classList.remove('mobile-open');
  }, []);

  // ── Fullscreen lifecycle ──
  useEffect(() => {
    document.body.classList.add('fsp-active');
    requestAnimationFrame(() => setEntered(true));
    return () => {
      document.body.classList.remove('fsp-active');
      document.querySelector('.sidebar-wrap')?.classList.remove('mobile-open');
    };
  }, []);

  const ui = (
    <div
      className={`fsp ${entered ? 'fsp--entered' : ''}`}
      style={{ '--fsp-color': activeColor } as React.CSSProperties}
    >
      {/* ── Header ── */}
      {!chromeHidden && (
        <div className="fsp-header">
          <button className="fsp-hamburger" onClick={toggleSidebar} aria-label="Toggle menu">
            <Menu size={20} />
          </button>
          <div className="fsp-title">
            {titleIcon}
            <span>{title}</span>
          </div>
          {headerExtra}
          <div className="fsp-header-right">
            {!gam.loading && (
              <button className="fsp-level-badge" onClick={() => setGamOpen(true)} aria-label={`Level ${gam.level}, ${Math.round(gam.xpProgress * 100)}% to next level`}>
                <div className="fsp-level-circle">{gam.level}</div>
                <span className="fsp-level-xp" role="status">{Math.round(gam.xpProgress * 100)}%</span>
              </button>
            )}
            <button className="fsp-icon-btn" onClick={() => navigate('/social?tab=messages')} aria-label="Messages">
              <MessageCircle size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Content area ── */}
      {!chromeHidden && (
        <div className={`fsp-content fsp-slide fsp-slide--${slideDir}`} key={activeTab}>
          {contentExtra}
          {children}
        </div>
      )}

      {/* ── Content when chrome hidden (e.g. Realm) ── */}
      {chromeHidden && children}

      {/* ── Floating bottom tab bar ── */}
      {!chromeHidden && (
        <nav className="fsp-nav" role="tablist" aria-label={`${title} sections`}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`fsp-tab ${isActive ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
                style={{ '--tab-color': tab.color } as React.CSSProperties}
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                title={tab.label}
              >
                <Icon size={20} aria-hidden />
                <span className="fsp-tab-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* ── Sidebar overlay ── */}
      {sidebarOpen && (
        <div className="fsp-sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />
      )}

      <GamificationModal open={gamOpen} onClose={() => setGamOpen(false)} />
    </div>
  );

  return createPortal(ui, document.body);
}
