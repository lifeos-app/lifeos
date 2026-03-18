/**
 * UpdateBanner — Shows a banner when a new app version is available.
 * 
 * Detection: polls /app/version.json (no-cache) every 5 min.
 * version.json contains the buildId (index.js chunk hash).
 * If the server buildId differs from what's in the current HTML, show banner.
 * 
 * Update flow:
 * 1. Poll version.json → detect mismatch with loaded JS buildId
 * 2. Show "New version available!" banner
 * 3. User clicks "Update Now" → set `lifeos_update_pending` flag → reload
 * 4. After reload, WhatsNew component picks up the pending flag and shows release notes
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { onUpdateAvailable, applyUpdate } from '../lib/sw-register';

const VERSION_CHECK_URL = (() => {
  // Detect the base path from the current page URL
  const path = window.location.pathname;
  if (path.startsWith('/lifeos-app')) return '/lifeos-app/version.json';
  if (path.startsWith('/lifeos')) return '/lifeos/version.json';
  return '/app/version.json';
})();
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Extract buildId from the currently loaded page's script tags */
function getCurrentBuildId(): string | null {
  const scripts = document.querySelectorAll('script[src]');
  for (const s of scripts) {
    const match = s.getAttribute('src')?.match(/index-([A-Za-z0-9_-]+)\.js/);
    if (match) return match[1];
  }
  return null;
}

export function UpdateBanner() {
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [serverUpdateAvailable, setServerUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('lifeos_update_dismissed') === 'true');

  // Listen for SW update events
  useEffect(() => {
    onUpdateAvailable((reg) => {
      setSwRegistration(reg);
    });
  }, []);

  // On mount: persist the current buildId and clear stale pending flags
  useEffect(() => {
    const currentBuildId = getCurrentBuildId();
    if (currentBuildId) {
      localStorage.setItem('lifeos_current_build_id', currentBuildId);
    }
    // If we just loaded fresh code, the update already happened — clear pending flag
    // (WhatsNew will handle showing the modal if needed)
    const pending = localStorage.getItem('lifeos_update_pending');
    if (pending === 'true') {
      // Give WhatsNew 100ms to pick it up, then clear if it's still there
      setTimeout(() => {
        localStorage.removeItem('lifeos_update_pending');
      }, 3000);
    }
  }, []);

  // Poll server version file for updates
  useEffect(() => {
    let mounted = true;
    const currentBuildId = getCurrentBuildId();
    if (!currentBuildId) return;

    const checkVersion = async () => {
      try {
        const resp = await fetch(VERSION_CHECK_URL, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.buildId && data.buildId !== currentBuildId && mounted) {
          setServerUpdateAvailable(true);
        }
      } catch {
        // Offline or missing — ignore
      }
    };

    // Check after 3 seconds (faster first check) then every 5 min
    const initialTimeout = setTimeout(checkVersion, 3_000);
    const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);

    return () => {
      mounted = false;
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const handleUpdate = useCallback(() => {
    // Set pending flag so WhatsNew knows to show after reload
    localStorage.setItem('lifeos_update_pending', 'true');
    sessionStorage.removeItem('lifeos_update_dismissed');

    if (swRegistration) {
      applyUpdate(swRegistration);
    } else {
      // Nuclear: unregister SW, clear caches, reload
      navigator.serviceWorker?.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
      caches?.keys().then(names => {
        names.forEach(n => caches.delete(n));
      });
      window.location.reload();
    }
  }, [swRegistration]);

  const showBanner = !dismissed && (swRegistration || serverUpdateAvailable);
  if (!showBanner) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: 'linear-gradient(135deg, #0099CC 0%, #00D4FF 100%)',
      color: '#050E1A',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      fontSize: '13px',
      fontWeight: 600,
      boxShadow: '0 2px 12px rgba(0, 212, 255, 0.3)',
      animation: 'slideDown 0.3s ease-out',
    }}>
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <RefreshCw size={16} />
        New version available!
      </span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleUpdate}
          style={{
            background: '#050E1A',
            color: '#00D4FF',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Update Now
        </button>
        <button
          onClick={() => { setDismissed(true); sessionStorage.setItem('lifeos_update_dismissed', 'true'); }}
          style={{
            background: 'transparent',
            color: '#050E1A',
            border: '1px solid rgba(5, 14, 26, 0.3)',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
