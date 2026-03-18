/**
 * sw-register.ts — Service Worker registration, update detection, and install prompt
 *
 * DEPRECATED — SW is disabled. Service worker registration is a no-op.
 * Only version.json polling (onUpdateAvailable / applyUpdate) remains active,
 * used by UpdateBanner.tsx to detect new deploys.
 * Do NOT call registerServiceWorker().
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

// ── Registration ──

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function registerServiceWorker() {
  // DEPRECATED — no-op. SW is disabled to prevent caching auth issues.
  // main.tsx actively unregisters any lingering SWs on startup.
}

// ── Background Sync Registration ──

export function requestBackgroundSync() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((registration) => {
    if (registration.active) {
      registration.active.postMessage('REGISTER_SYNC');
    }
  });
}

// ── Update Detection ──

export function onUpdateAvailable(callback: SWCallback) {
  _updateCallback = callback;
}

export function applyUpdate(registration: ServiceWorkerRegistration) {
  if (registration.waiting) {
    registration.waiting.postMessage('SKIP_WAITING');
  }
}

// ── Install Prompt ──

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
  // Check if running as PWA (cross-browser)
  try {
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true; // iOS Safari standalone mode
  } catch {
    return false;
  }
}

// ── Capture install prompt ──
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
