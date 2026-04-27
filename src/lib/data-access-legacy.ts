/**
 * DEPRECATED: use build-time alias injection via data-access/index.ts
 *
 * This file is kept for reference only. The new data-access barrel
 * (src/lib/data-access/index.ts) selects the correct adapter at build
 * time via Vite resolve.alias, eliminating runtime environment detection
 * bugs and removing dead code paths from each platform build.
 *
 * See TD-016 for the architectural rationale.
 *
 * ---- Original header below ----
 *
 * Unified Data Access Layer
 * 
 * Auto-detects environment and routes to the correct adapter:
 * - Supabase Cloud: VITE_SUPABASE_URL is set and no VITE_USE_LOCAL_API
 * - Local API: VITE_USE_LOCAL_API=true or VITE_API_BASE_URL is set
 * - Tauri: window.__TAURI_INTERNALS__ or window.__TAURI__ is available
 * 
 * All adapters expose a Supabase-compatible client interface, so consumers
 * use the same .from().select().eq() chain regardless of backend.
 * 
 * Usage:
 *   import { db, dedup, getEnvironment } from '../lib/data-access';
 *   // db is a drop-in replacement for supabase
 *   const { data, error } = await db.from('tasks').select('*');
 */

// ─── Environment Detection ──────────────────────────────────────────

export type DataEnvironment = 'supabase' | 'local-api' | 'tauri' | 'electron' | 'capacitor';

declare const __IS_TAURI__: boolean;
declare const __IS_ELECTRON__: boolean;
declare const __IS_CAPACITOR__: boolean;

let _detectedEnv: DataEnvironment | null = null;

export function getEnvironment(): DataEnvironment {
  if (_detectedEnv) return _detectedEnv;

  // Build-time Capacitor detection (set by CAPACITOR_ENV via Vite define)
  if (typeof __IS_CAPACITOR__ !== 'undefined' && __IS_CAPACITOR__) {
    _detectedEnv = 'capacitor';
    return 'capacitor';
  }

  // Runtime Capacitor detection (globalThis.Capacitor injected by native runtime)
  if (typeof (globalThis as any).Capacitor !== 'undefined' &&
    !!(globalThis as any).Capacitor?.isNativePlatform?.()) {
    _detectedEnv = 'capacitor';
    return 'capacitor';
  }

  // Build-time Electron detection (set by ELECTRON_ENV via Vite define)
  if (typeof __IS_ELECTRON__ !== 'undefined' && __IS_ELECTRON__) {
    _detectedEnv = 'electron';
    return 'electron';
  }

  // Runtime Electron detection (window.electronAPI from preload.js)
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    _detectedEnv = 'electron';
    return 'electron';
  }

  // Build-time Tauri detection (set by cargo tauri dev/build via Vite define)
  if (typeof __IS_TAURI__ !== 'undefined' && __IS_TAURI__) {
    _detectedEnv = 'tauri';
    return 'tauri';
  }

  // Runtime Tauri detection (fallback for edge cases)
  if (typeof window !== 'undefined' && (
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__
  )) {
    _detectedEnv = 'tauri';
    return 'tauri';
  }

  // Explicit local API flag
  if (import.meta.env.VITE_USE_LOCAL_API === 'true') {
    _detectedEnv = 'local-api';
    return 'local-api';
  }

  // If API base URL is set, use local API
  if (import.meta.env.VITE_API_BASE_URL) {
    _detectedEnv = 'local-api';
    return 'local-api';
  }

  // Default: Supabase cloud
  _detectedEnv = 'supabase';
  return 'supabase';
}

// ─── Unified Client Export ──────────────────────────────────────────

// Lazy evaluation to avoid module-load-time race with Tauri injection
let _env: DataEnvironment | null = null;
function env(): DataEnvironment {
  if (!_env) _env = getEnvironment();
  return _env;
}

// All adapters are statically imported. Only the active one is used at runtime.
import { supabase as supabaseCloud, dedup as dedupCloud } from './supabase';
import { supabase as supabaseLocal, dedup as dedupLocal } from './local-api';
import { supabase as supabaseTauri, dedup as dedupTauri } from './tauri-api';
import { supabase as supabaseElectron, dedup as dedupElectron } from './electron-api';
import { supabase as supabaseCapacitor, dedup as dedupCapacitor } from './capacitor-api';

/**
 * Get the correct db adapter based on detected environment.
 */
function getDb() {
  const e = env();
  return e === 'capacitor' ? supabaseCapacitor
       : e === 'electron' ? supabaseElectron
       : e === 'tauri' ? supabaseTauri
       : e === 'local-api' ? supabaseLocal
       : supabaseCloud;
}

/**
 * The unified database client. Drop-in replacement for `supabase`.
 * Routes to Tauri IPC, Local API, or Supabase Cloud based on environment.
 * Uses a Proxy to defer adapter selection until first use.
 */
export const db: typeof supabaseTauri = new Proxy({} as any, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  }
});

/**
 * Deduplicated query helper — prevents identical queries from firing simultaneously.
 */
export const dedup = (...args: any[]) => {
  const e = env();
  const d = e === 'capacitor' ? dedupCapacitor
          : e === 'electron' ? dedupElectron
          : e === 'tauri' ? dedupTauri
          : e === 'local-api' ? dedupLocal
          : dedupCloud;
  return (d as any)(...args);
};

// ─── Convenience API (higher-level operations) ──────────────────────

export interface QueryResult<T = any> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number;
}

/**
 * Query records from a table with optional filters.
 */
export async function query<T = any>(
  table: string,
  options?: {
    select?: string;
    filters?: Record<string, any>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
    single?: boolean;
  }
): Promise<QueryResult<T>> {
  let q = db.from(table).select(options?.select || '*');
  
  if (options?.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (value === null) {
        q = q.is(key, null);
      } else if (Array.isArray(value)) {
        q = q.in(key, value);
      } else {
        q = q.eq(key, value);
      }
    }
  }
  
  if (options?.order) {
    q = q.order(options.order.column, { ascending: options.order.ascending ?? true });
  }
  
  if (options?.limit) {
    q = q.limit(options.limit);
  }
  
  if (options?.single) {
    q = q.single();
  }
  
  return q;
}

/**
 * Insert one or more records into a table.
 */
export async function insert<T = any>(
  table: string,
  data: Record<string, any> | Record<string, any>[],
  options?: { returning?: boolean }
): Promise<QueryResult<T>> {
  let q = db.from(table).insert(data);
  if (options?.returning !== false) {
    q = q.select();
  }
  return q;
}

/**
 * Update records matching filters.
 */
export async function update<T = any>(
  table: string,
  data: Record<string, any>,
  filters: Record<string, any>
): Promise<QueryResult<T>> {
  let q = db.from(table).update(data);
  for (const [key, value] of Object.entries(filters)) {
    q = q.eq(key, value);
  }
  return q;
}

/**
 * Delete records matching filters.
 */
export async function remove<T = any>(
  table: string,
  filters: Record<string, any>
): Promise<QueryResult<T>> {
  let q = db.from(table).delete();
  for (const [key, value] of Object.entries(filters)) {
    q = q.eq(key, value);
  }
  return q;
}

/**
 * Subscribe to real-time changes on a table.
 * Returns an unsubscribe function.
 */
export function subscribe(
  table: string,
  callback: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void,
  options?: { event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'; filter?: string }
): () => void {
  const channel = db
    .channel(`${table}-changes-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: options?.event || '*',
        schema: 'public',
        table,
        filter: options?.filter,
      },
      (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
        callback({
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
        });
      }
    )
    .subscribe();

  return () => {
    db.removeChannel(channel);
  };
}

// ─── Re-export for backwards compatibility ──────────────────────────
// Files that import { supabase } from '../lib/data-access' will work
export { db as supabase };
