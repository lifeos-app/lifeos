/**
 * offline.ts — Basic Offline Support for LifeOS
 * 
 * Detects online/offline state, queues mutations when offline,
 * and replays them when back online.
 */

import { genId } from '../utils/date';
import { getErrorMessage } from '../utils/error';
import { logger } from '../utils/logger';

const QUEUE_KEY = 'lifeos_offline_queue';
const OFFLINE_BANNER_EVENT = 'lifeos-offline-change';

// ── State Management ──

let _isOnline = navigator.onLine;
const _listeners: Set<(online: boolean) => void> = new Set();

export function isOnline(): boolean {
  return _isOnline;
}

export function onOnlineChange(cb: (online: boolean) => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function _notifyListeners() {
  _listeners.forEach(cb => cb(_isOnline));
  window.dispatchEvent(new CustomEvent(OFFLINE_BANNER_EVENT, { detail: { online: _isOnline } }));
}

// Listen for browser online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    _isOnline = true;
    _notifyListeners();
    logger.log('[offline] Back online — replaying queue...');
    replayQueue().then(() => {
      // Trigger global refresh so stores re-fetch fresh data
      window.dispatchEvent(new Event('lifeos-refresh'));
    });
  });

  window.addEventListener('offline', () => {
    _isOnline = false;
    _notifyListeners();
    logger.log('[offline] Gone offline — mutations will be queued');
  });
}

// ── Mutation Queue ──

interface QueuedMutation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete' | 'upsert';
  data: any;
  match?: Record<string, any>;
  timestamp: number;
}

function getQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedMutation[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    logger.error('[offline] Failed to save queue:', e);
  }
}

export function queueMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>) {
  const queue = getQueue();
  queue.push({
    ...mutation,
    id: genId(),
    timestamp: Date.now(),
  });
  saveQueue(queue);
  logger.log(`[offline] Queued ${mutation.operation} on ${mutation.table} (${queue.length} pending)`);

  // Request background sync so queued mutations replay when back online
  try {
    import('./sw-register').then(({ requestBackgroundSync }) => requestBackgroundSync());
  } catch {
    // Non-critical — sync will happen on next online event anyway
  }
}

export function getQueueSize(): number {
  return getQueue().length;
}

export async function replayQueue(): Promise<{ replayed: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { replayed: 0, failed: 0 };

  logger.log(`[offline] Replaying ${queue.length} queued mutations...`);

  // Dynamic import to avoid circular dependency
  const { supabase } = await import('./supabase');
  
  let replayed = 0;
  let failed = 0;
  const remaining: QueuedMutation[] = [];

  for (const mutation of queue) {
    try {
      let query;
      switch (mutation.operation) {
        case 'insert':
          query = supabase.from(mutation.table).insert(mutation.data);
          break;
        case 'update':
          query = supabase.from(mutation.table).update(mutation.data);
          if (mutation.match) {
            for (const [key, val] of Object.entries(mutation.match)) {
              query = query.eq(key, val);
            }
          }
          break;
        case 'upsert':
          query = supabase.from(mutation.table).upsert(mutation.data);
          break;
        case 'delete':
          query = supabase.from(mutation.table).delete();
          if (mutation.match) {
            for (const [key, val] of Object.entries(mutation.match)) {
              query = query.eq(key, val);
            }
          }
          break;
      }

      const { error } = await query;
      if (error) {
        logger.warn(`[offline] Failed to replay ${mutation.operation} on ${mutation.table}:`, error.message);
        // Don't retry permanent failures (constraint violations, etc.)
        if (error.code === '23505' || error.code === '23503') {
          failed++;
        } else {
          remaining.push(mutation);
          failed++;
        }
      } else {
        replayed++;
      }
    } catch (e) {
      remaining.push(mutation);
      failed++;
    }
  }

  saveQueue(remaining);
  
  if (replayed > 0) {
    logger.log(`[offline] Replayed ${replayed} mutations, ${failed} failed, ${remaining.length} remaining`);
    // Trigger refresh so UI updates
    window.dispatchEvent(new Event('lifeos-refresh'));
  }

  return { replayed, failed };
}

// ── Offline-Aware Supabase Mutation ──
// Wraps a supabase mutation: tries online first, queues if offline/network fails

export async function offlineMutation(
  table: string,
  operation: 'insert' | 'update' | 'delete' | 'upsert',
  data: any,
  match?: Record<string, any>,
  onlineAction?: () => Promise<{ error: any }>,
): Promise<{ error: any; queued: boolean }> {
  // If online and we have an action, try it
  if (_isOnline && onlineAction) {
    try {
      const result = await onlineAction();
      if (!result.error) return { error: null, queued: false };
      // If it's a network error, queue it
      if (result.error.message?.includes('fetch') || result.error.message?.includes('network')) {
        queueMutation({ table, operation, data, match });
        return { error: null, queued: true };
      }
      return { error: result.error, queued: false };
    } catch (e: unknown) {
      // Network error — queue it
      queueMutation({ table, operation, data, match });
      return { error: null, queued: true };
    }
  }

  // Offline — queue immediately
  queueMutation({ table, operation, data, match });
  return { error: null, queued: true };
}

// ── Offline Banner Component Hook ──

export function useOfflineStatus() {
  // This is a simple hook pattern — import useState/useEffect in the component
  return { isOnline: _isOnline, queueSize: getQueueSize() };
}
