import { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, MoreVertical } from 'lucide-react';
import { getDeferredPrompt, clearDeferredPrompt, isAppInstalled } from '../lib/sw-register';
import './InstallPrompt.css';
import { logger } from '../utils/logger';

const DISMISSED_KEY = 'lifeos_install_dismissed';
const DISMISS_DAYS = 14; // Don't show again for 2 weeks after dismissal

/** Detect iOS Safari (not Chrome/Firefox on iOS — they can't install PWAs) */
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

/** Check if running as installed PWA (standalone mode) */
function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (isAppInstalled() || isStandalone()) return;

    // Don't show if recently dismissed
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed) {
        const dismissedAt = parseInt(dismissed, 10);
        if (Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
      }
    } catch { /* Safari private browsing */ }

    const isiOSSafari = isIOSSafari();
    setIsIOS(isiOSSafari);

    if (isiOSSafari) {
      // iOS Safari — show after 15 seconds (no beforeinstallprompt on iOS)
      const timer = setTimeout(() => setShow(true), 15000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop — check for deferred prompt
    const timer = setTimeout(() => {
      if (getDeferredPrompt()) {
        setShow(true);
      }
    }, 30000);

    const checkInterval = setInterval(() => {
      if (getDeferredPrompt() && !isAppInstalled()) {
        setShow(true);
        clearInterval(checkInterval);
      }
    }, 10000);

    return () => {
      clearTimeout(timer);
      clearInterval(checkInterval);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    const prompt = getDeferredPrompt();
    if (!prompt) return;

    setInstalling(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
      }
    } catch (e) {
      logger.error('[InstallPrompt] Error:', e);
    }
    setInstalling(false);
    clearDeferredPrompt();
  };

  const handleDismiss = () => {
    setShow(false);
    setShowIOSGuide(false);
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* Safari private */ }
  };

  if (!show) return null;

  // iOS Safari instruction guide
  if (showIOSGuide) {
    return (
      <div className="install-prompt install-prompt-ios-guide">
        <button className="install-prompt-dismiss install-guide-close" onClick={handleDismiss} aria-label="Dismiss install prompt">
          <X size={16} />
        </button>
        <div className="install-guide-title">Install LifeOS</div>
        <div className="install-guide-steps">
          <div className="install-guide-step">
            <div className="install-guide-step-num">1</div>
            <div className="install-guide-step-text">
              Tap the <Share size={14} style={{ display: 'inline', verticalAlign: 'middle', color: '#007AFF' }} /> <strong>Share</strong> button in Safari's toolbar
            </div>
          </div>
          <div className="install-guide-step">
            <div className="install-guide-step-num">2</div>
            <div className="install-guide-step-text">
              Scroll down and tap <PlusSquare size={14} style={{ display: 'inline', verticalAlign: 'middle', color: '#007AFF' }} /> <strong>Add to Home Screen</strong>
            </div>
          </div>
          <div className="install-guide-step">
            <div className="install-guide-step-num">3</div>
            <div className="install-guide-step-text">
              Tap <strong>Add</strong> — LifeOS will appear on your home screen like a real app
            </div>
          </div>
        </div>
        <div className="install-guide-footer">
          Works offline • Full screen • Push notifications
        </div>
      </div>
    );
  }

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <Download size={16} className="install-prompt-icon" />
        <span className="install-prompt-text">
          {isIOS
            ? 'Add LifeOS to your Home Screen for the full experience'
            : 'Install LifeOS for quick access & offline use'
          }
        </span>
      </div>
      <div className="install-prompt-actions">
        <button
          className="install-prompt-btn"
          onClick={handleInstall}
          disabled={installing}
        >
          {installing ? 'Installing...' : isIOS ? 'Show Me How' : 'Install'}
        </button>
        <button className="install-prompt-dismiss" onClick={handleDismiss}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
