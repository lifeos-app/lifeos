/**
 * Unified Data Access Layer — Build-Time Alias Injection (TD-016)
 *
 * This barrel file re-exports { db, supabase, dedup, getEnvironment } from
 * the correct platform adapter. The adapter is selected at build time via
 * Vite's resolve.alias, so only ONE adapter's code is included in each build.
 *
 * Usage (unchanged from legacy data-access.ts):
 *   import { db, supabase, dedup, getEnvironment } from '../lib/data-access';
 *   import { supabase } from '../lib/data-access';       // backward compat
 *   import { db as supabase } from '../lib/data-access'; // backward compat
 *
 * The alias '@lifeos/db-adapter' is resolved by Vite to the correct
 * adapter barrel file based on the build mode. See vite.config.ts
 * resolve.alias configuration.
 */

import { db as _db, supabase as _supabase, dedup as _dedup } from '@lifeos/db-adapter';

export { _db as db, _supabase as supabase, _dedup as dedup };

// ─── Environment Detection ──────────────────────────────────────────

export type DataEnvironment = 'supabase' | 'local-api' | 'tauri' | 'electron' | 'capacitor';

/**
 * Build-time environment constant.
 *
 * Unlike the legacy runtime detection (data-access-legacy.ts), this is
 * resolved at build time via Vite's define plugin. The correct adapter is
 * already baked in, so getEnvironment() simply returns the corresponding
 * string constant — no runtime probing of globals needed.
 *
 * The __DATA_ENV__ constant is defined in vite.config.ts's define block.
 */
declare const __DATA_ENV__: DataEnvironment;

/**
 * Returns the active data environment as a string.
 * The value is baked in at build time by Vite's define substitution.
 */
export function getEnvironment(): DataEnvironment {
  return __DATA_ENV__;
}

// ─── Convenience API (higher-level operations) ──────────────────────
// Re-exported from legacy data-access.ts for backward compatibility

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
  let q: any = _db.from(table).select(options?.select || '*');
  
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
  let q: any = _db.from(table).insert(data);
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
  let q: any = _db.from(table).update(data);
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
  let q: any = _db.from(table).delete();
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
  const dbAny = _db as any;
  const channel = dbAny
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
    dbAny.removeChannel(channel);
  };
}