import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { installGlobalErrorHandlers } from './lib/error-reporter'
import { openLocalDB } from './lib/local-db'
import { initSyncEngine } from './lib/sync-engine'
import { logger } from './utils/logger';

// Install global error handlers (catches unhandled errors + promise rejections)
installGlobalErrorHandlers()

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

// Service worker DISABLED — was caching bad responses and breaking auth flow
// Force-unregister any lingering old SW that might serve stale cached assets
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
  });
  // Clear any stale caches left behind
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
  }
}
