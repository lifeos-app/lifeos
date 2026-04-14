/**
 * sw-register.ts — Service Worker registration, update detection, and install prompt
 *
 * Service worker provides offline-first support:
 *   - Stale-while-revalidate for static assets (JS, CSS, images, fonts)
 *   - Network-first for API calls (with cache fallback)
 *   - Offline fallback page for navigation requests
 *
 * In development (localhost): SW is auto-unregistered by index.html boot script.
 * In production: SW registers on window load and checks for updates every 30 min.
 */

import { logger } from '../utils/logger';

type SWCallback = (registration: ServiceWorkerRegistration) => void;

let _updateCallback: SWCallback | null = null;
let _installedCallback: (() => void) | null = null;
let _deferredPrompt: BeforeInstallPromptEvent | null = null;

// BeforeInstallPromptEvent is not in standard TS types
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ── Registration ──────────────────────────────────────────────────

/**
 * Register the service worker for offline-first caching.
 * Only registers in production builds (Vite handles HMR in dev).
 * The index.html boot script already unregisters SWs on localhost.
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    logger.log('[SW] Registered successfully, scope:', registration.scope);

    // Check for updates every 30 minutes
    setInterval(() => {
      registration.update();
    }, 30 * 60 * 1000);

    // Handle updates: activate new SW immediately
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          logger.log('[SW] New version available, activating...');
          newWorker.postMessage('SKIP_WAITING');
        }
      });
    });

    // Notify callback when update is available
    if (_updateCallback) {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              _updateCallback?.(registration);
            }
          });
        }
      });
    }
  } catch (error) {
    logger.error('[SW] Registration failed:', error);
  }

  // Reload page when new SW takes control (seamless update)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      logger.log('[SW] Controller changed, reloading...');
      window.location.reload();
    }
  });
}

// ── Background Sync Registration ─────────────────────────────────

export function requestBackgroundSync() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((registration) => {
    if (registration.active) {
      registration.active.postMessage('REGISTER_SYNC');
    }
  });
}

// ── Update Detection ─────────────────────────────────────────────

export function onUpdateAvailable(callback: SWCallback) {
  _updateCallback = callback;
}

export function applyUpdate(registration: ServiceWorkerRegistration) {
  if (registration.waiting) {
    registration.waiting.postMessage('SKIP_WAITING');
  }
}

// ── Install Prompt ────────────────────────────────────────────────

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return _deferredPrompt;
}

export function clearDeferredPrompt() {
  _deferredPrompt = null;
}

export function onAppInstalled(callback: () => void) {
  _installedCallback = callback;
}

export function isAppInstalled(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as Record<string, unknown>).standalone === true;
  } catch {
    return false;
  }
}

// ── Capture install prompt ────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e as BeforeInstallPromptEvent;
    logger.log('[SW] Install prompt captured');
  });

  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    _installedCallback?.();
    logger.log('[SW] App installed');
  });
}