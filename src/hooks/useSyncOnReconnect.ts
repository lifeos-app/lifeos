import { useEffect } from 'react';
import { initSyncEngine } from '../lib/sync-engine';
import { logger } from '../utils/logger';

/**
 * useSyncOnReconnect — Listen for service worker sync messages
 * and trigger data sync when coming back online.
 *
 * Works with the SW's background sync event and the 'online' browser event
 * to ensure local changes are pushed to the server when connectivity returns.
 */
export function useSyncOnReconnect() {
  useEffect(() => {
    // Sync when browser detects connectivity
    const goOnline = () => {
      logger.log('[sync-on-reconnect] Back online, triggering sync');
      initSyncEngine();
    };

    window.addEventListener('online', goOnline);

    // Sync when service worker requests it (background sync)
    if ('serviceWorker' in navigator) {
      const handler = (event: MessageEvent) => {
        if (event.data === 'SYNC_NOW') {
          logger.log('[sync-on-reconnect] SW requested sync');
          initSyncEngine();
        }
      };

      navigator.serviceWorker.addEventListener('message', handler);

      return () => {
        window.removeEventListener('online', goOnline);
        navigator.serviceWorker.removeEventListener('message', handler);
      };
    }

    return () => {
      window.removeEventListener('online', goOnline);
    };
  }, []);
}