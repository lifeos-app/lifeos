import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { installGlobalErrorHandlers } from './lib/error-reporter'
import { initErrorMonitor, addBreadcrumb, setErrorUserId } from './lib/error-monitor'
import { openLocalDB } from './lib/local-db'
import { initSyncEngine } from './lib/sync-engine'
import { registerServiceWorker } from './lib/sw-register'
import { logger } from './utils/logger';
import { loadDeferredFonts } from './utils/lazy-fonts';
import { setupRoutePrefetching } from './utils/route-prefetch';
import { initTheme } from './lib/themes';

// Design tokens — must load before any other CSS so var(--token) is available everywhere
import './styles/tokens.css';

// Install global error handlers (catches unhandled errors + promise rejections)
installGlobalErrorHandlers()

// Initialize local-first error monitor (captures unhandled errors to localStorage)
initErrorMonitor()

// Track route changes as breadcrumbs for error monitoring
;(() => {
  try {
    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;
    history.pushState = function(...args) {
      addBreadcrumb(`Navigate: ${window.location.pathname}`, 'navigation');
      return origPushState.apply(this, args);
    };
    history.replaceState = function(...args) {
      addBreadcrumb(`Replace: ${window.location.pathname}`, 'navigation');
      return origReplaceState.apply(this, args);
    };
    window.addEventListener('popstate', () => {
      addBreadcrumb(`Popstate: ${window.location.pathname}`, 'navigation');
    });
  } catch {
    // Must not throw
  }
})();

// Apply saved theme on startup (before render to avoid flash)
initTheme()

// Initialize local database and sync engine
openLocalDB().then(() => {
  logger.log('[main] Local DB initialized');
  initSyncEngine();
}).catch((err) => {
  logger.error('[main] Failed to initialize local DB:', err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ─── Service Worker Registration ────────────────────────────────────
// Offline-first: stale-while-revalidate for static assets, network-first
// for API calls, offline fallback page for navigation.
// Dev SWs are auto-cleaned by index.html boot script + registerServiceWorker
// only activates in production builds.
window.addEventListener('load', () => {
  registerServiceWorker();
  // Load fonts after initial render — avoids blocking FCP
  loadDeferredFonts();
  // Set up route chunk prefetching on hover/focus
  setupRoutePrefetching();
});