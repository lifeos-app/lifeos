/**
 * WhatsNew Modal — Post-Update Release Notes
 * 
 * Shows after the app updates to a new version, displaying highlights
 * of what's new.
 * 
 * Update flow (works with UpdateBanner):
 * 1. UpdateBanner detects new version → user clicks "Update Now"
 * 2. UpdateBanner sets `lifeos_update_pending` flag in localStorage → reloads
 * 3. After reload with new code, WhatsNew detects the pending flag
 * 4. Fetches version.json to get the new version string
 * 5. Shows release notes modal if version has notes defined
 * 6. Clears pending flag and stores last seen version on dismiss
 * 
 * Also handles the case where user manually refreshes (no pending flag):
 * - Compares stored version with server version
 * - If different and user has seen a previous version, shows modal
 */

import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { releaseNotes } from '../data/release-notes';
import './WhatsNew.css';

const VERSION_URL = (() => {
  const path = window.location.pathname;
  if (path.startsWith('/lifeos-app')) return '/lifeos-app/version.json';
  if (path.startsWith('/lifeos')) return '/lifeos/version.json';
  return '/app/version.json';
})();
const STORAGE_KEY = 'lifeos_last_seen_version';
const PENDING_KEY = 'lifeos_update_pending';

export function WhatsNew() {
  const [show, setShow] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkVersion = async () => {
      try {
        // Don't show during onboarding
        if (document.querySelector('.realm-onboarding-container')) return;

        // Check if we just came through the update flow
        const updatePending = localStorage.getItem(PENDING_KEY) === 'true';
        // Clear the pending flag immediately (only use once)
        localStorage.removeItem(PENDING_KEY);

        // Fetch current version from server
        const resp = await fetch(VERSION_URL, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (!resp.ok) return;

        const data = await resp.json();
        const serverVersion = data.version;

        if (!serverVersion || !mounted) return;

        // Get last seen version from localStorage
        let lastSeen: string | null = null;
        try {
          lastSeen = localStorage.getItem(STORAGE_KEY);
        } catch {
          // Safari private browsing — can't access localStorage
          return;
        }

        // Show What's New if:
        // A) User just clicked "Update Now" (pending flag was set), OR
        // B) Version changed since last seen (manual refresh / reopened app)
        const shouldShow = updatePending || (lastSeen && lastSeen !== serverVersion);

        if (shouldShow) {
          setCurrentVersion(serverVersion);
          setShow(true);
          // Immediately mark this version as seen so refreshing doesn't re-show
          try {
            localStorage.setItem(STORAGE_KEY, serverVersion);
          } catch {
            // Safari private browsing
          }
        }

        // First-time user (no stored version)?
        // Store current version immediately so they don't see modal during onboarding
        if (!lastSeen) {
          try {
            localStorage.setItem(STORAGE_KEY, serverVersion);
          } catch {
            // Safari private browsing
          }
        }
      } catch {
        // Silently fail — not critical
      }
    };

    // Check 2 seconds after mount (let the app settle)
    const timeout = setTimeout(checkVersion, 2000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  const handleDismiss = () => {
    if (currentVersion) {
      try {
        localStorage.setItem(STORAGE_KEY, currentVersion);
      } catch {
        // Safari private browsing
      }
    }
    setShow(false);
  };

  if (!show || !currentVersion) return null;

  // Find the release note for current version
  const currentRelease = releaseNotes.find(r => r.version === currentVersion);

  // No release notes defined for this version? Don't show modal
  if (!currentRelease) {
    handleDismiss(); // Mark as seen anyway
    return null;
  }

  return (
    <div className="wn-overlay" onClick={handleDismiss}>
      <div className="wn-modal" onClick={e => e.stopPropagation()}>
        <div className="wn-header">
          <div className="wn-title">
            <Sparkles size={20} className="wn-icon" />
            <h3>What's New in v{currentRelease.version}</h3>
          </div>
          <button className="wn-close" onClick={handleDismiss} aria-label="Close what's new">
            <X size={16} />
          </button>
        </div>

        <div className="wn-release-title">{currentRelease.title}</div>
        <div className="wn-date">{currentRelease.date}</div>

        <ul className="wn-highlights">
          {currentRelease.highlights.map((item, i) => (
            <li key={i} className="wn-highlight">
              <span className="wn-highlight-icon">{item.icon}</span>
              <span className="wn-highlight-text">{item.text}</span>
            </li>
          ))}
        </ul>

        <button className="wn-dismiss" onClick={handleDismiss}>
          Got it!
        </button>

        <a href="#" className="wn-changelog" onClick={(e) => { e.preventDefault(); }}>
          Full Changelog
        </a>
      </div>
    </div>
  );
}
