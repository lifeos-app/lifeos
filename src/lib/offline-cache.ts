/**
 * offline-cache.ts — IndexedDB-based data cache for offline reads
 *
 * Caches Supabase data so users can view schedule, habits, health, and
 * finance data even without internet. Uses raw IndexedDB (no dependencies).
 *
 * Cache keys follow the pattern: store_name (e.g., 'schedule_tasks', 'habits')
 * Each entry stores { data, cachedAt } so we can show cache timestamps.
 */

import { logger } from '../utils/logger';

const DB_NAME = 'lifeos-offline';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

// Default max cache age: 24 hours
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

let _db: IDBDatabase | null = null;
let _dbPromise: Promise<IDBDatabase> | null = null;

interface CacheEntry {
  key: string;
  data: any;
  cachedAt: number;
}

// ── Database Setup ──

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      _db = request.result;
      // Handle unexpected close
      _db.onclose = () => { _db = null; _dbPromise = null; };
      resolve(_db);
    };

    request.onerror = () => {
      _dbPromise = null;
      reject(request.error);
    };
  });

  return _dbPromise;
}

// ── Public API ──

/**
 * Save data to the offline cache with a timestamp.
 */
export async function cacheData(key: string, data: any): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry: CacheEntry = { key, data, cachedAt: Date.now() };
    store.put(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    logger.warn('[offline-cache] Failed to cache:', key, e);
  }
}

/**
 * Retrieve cached data. Returns null if not found.
 */
export async function getCachedData<T = any>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    return new Promise<T | null>((resolve, reject) => {
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        resolve(entry ? entry.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    logger.warn('[offline-cache] Failed to read:', key, e);
    return null;
  }
}

/**
 * Get the timestamp when data was cached. Returns null if not found.
 */
export async function getCacheTimestamp(key: string): Promise<number | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    return new Promise<number | null>((resolve, reject) => {
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        resolve(entry ? entry.cachedAt : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Check if cached data exists and is fresh (within maxAgeMs).
 */
export async function isCacheValid(key: string, maxAgeMs: number = DEFAULT_MAX_AGE_MS): Promise<boolean> {
  const ts = await getCacheTimestamp(key);
  if (ts === null) return false;
  return Date.now() - ts < maxAgeMs;
}

/**
 * Delete a specific cache entry.
 */
export async function deleteCachedData(key: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    logger.warn('[offline-cache] Failed to delete:', key, e);
  }
}

/**
 * Clear all cache entries older than maxAgeMs.
 */
export async function clearExpiredCache(maxAgeMs: number = DEFAULT_MAX_AGE_MS): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        const now = Date.now();
        for (const entry of entries) {
          if (now - entry.cachedAt > maxAgeMs) {
            store.delete(entry.key);
          }
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    logger.warn('[offline-cache] Failed to clear expired cache:', e);
  }
}

/**
 * Clear all cached data.
 */
export async function clearAllCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    logger.warn('[offline-cache] Failed to clear all cache:', e);
  }
}

// ── Cache Keys (constants for consistency) ──

export const CACHE_KEYS = {
  SCHEDULE_TASKS: 'schedule_tasks',
  SCHEDULE_EVENTS: 'schedule_events',
  SCHEDULE_GOALS: 'schedule_goals',
  HABITS: 'habits',
  HABIT_LOGS: 'habit_logs',
  HEALTH_TODAY: 'health_today',
  FINANCE_INCOME: 'finance_income',
  FINANCE_EXPENSES: 'finance_expenses',
  FINANCE_BILLS: 'finance_bills',
  FINANCE_BUSINESSES: 'finance_businesses',
  FINANCE_CLIENTS: 'finance_clients',
  FINANCE_CATEGORIES: 'finance_categories',
  FINANCE_TRANSACTIONS: 'finance_transactions',
  FINANCE_BUDGETS: 'finance_budgets',
} as const;
