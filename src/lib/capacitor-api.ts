/**
 * Capacitor-Native API Adapter — drop-in replacement for Supabase client
 *
 * When running inside a Capacitor app (Android/iOS): uses @capacitor-community/sqlite
 * to execute queries against the on-device SQLite database.
 *
 * Provides the same chainable Supabase-like interface:
 *   supabase.from('table').select('*').eq('id', 1).single()
 *   supabase.from('table').insert({...}).select().single()
 *   supabase.from('table').update({...}).eq('id', 1)
 *   supabase.from('table').delete().eq('id', 1)
 *   supabase.from('table').upsert({...}, { onConflict: 'id' })
 *   supabase.rpc('function_name', params)
 *   supabase.auth.getUser() / getSession() / signIn / signOut etc.
 *
 * Architecture mirrors electron-api.ts exactly — same QueryParams interface,
 * same auth objects, same response format. Only the transport layer differs:
 * Electron uses window.electronAPI IPC, Capacitor uses capacitor-db.ts async calls.
 */

import { execQuery as capacitorExecQuery, execRpc as capacitorExecRpc, initCapacitorDB } from './capacitor-db';
import type { QueryParams, QueryFilter, FilterOperator, PostgrestResponse } from './capacitor-db';

// ─── Capacitor Detection ──────────────────────────────────────────────

declare const __IS_CAPACITOR__: boolean;

let _isCapacitorCached: boolean | null = null;
function isCapacitorCheck(): boolean {
  if (_isCapacitorCached !== null) return _isCapacitorCached;

  // Build-time detection
  if (typeof __IS_CAPACITOR__ !== 'undefined' && __IS_CAPACITOR__) {
    _isCapacitorCached = true;
    return true;
  }

  // Runtime detection — Capacitor injects globalThis.Capacitor
  _isCapacitorCached = typeof (globalThis as any).Capacitor !== 'undefined' &&
    !!(globalThis as any).Capacitor?.isNativePlatform?.();
  return _isCapacitorCached;
}

// ─── DB Init Guard ────────────────────────────────────────────────────
// Ensure the database is ready before the first query.

let _dbReady: Promise<void> | null = null;
function ensureDb(): Promise<void> {
  if (!_dbReady) _dbReady = initCapacitorDB();
  return _dbReady;
}

// ─── Transport Layer ──────────────────────────────────────────────────

async function capacitorQuery<T = any>(params: QueryParams): Promise<PostgrestResponse<T>> {
  try {
    await ensureDb();
    return await capacitorExecQuery<T>(params);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      data: null,
      error: {
        message: msg || 'Capacitor SQLite error',
        details: String(err),
        hint: 'Check capacitor-db.ts',
        code: 'CAPACITOR_ERROR',
      },
      status: 500,
      statusText: 'Capacitor Error',
    };
  }
}

// ─── Chainable Query Builder ──────────────────────────────────────────

class QueryBuilder<T = any> implements PromiseLike<PostgrestResponse<T>> {
  private _table: string;
  private _method: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private _columns: string = '*';
  private _filters: QueryFilter[] = [];
  private _orFilter?: string;
  private _orderCol?: string;
  private _orderAsc: boolean = true;
  private _limitVal?: number;
  private _offsetVal?: number;
  private _body?: any;
  private _single: boolean = false;
  private _maybeSingle: boolean = false;
  private _count?: 'exact' | 'planned' | 'estimated';
  private _upsertConflict?: string;
  private _returnSelect: boolean = false;

  constructor(table: string) {
    this._table = table;
  }

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated' }): this {
    this._method = 'select';
    this._columns = columns;
    if (options?.count) this._count = options.count;
    if (this._body) this._returnSelect = true;
    return this;
  }

  insert(data: any): QueryBuilder<T> {
    this._method = 'insert';
    this._body = data;
    return this;
  }

  update(data: any): this {
    this._method = 'update';
    this._body = data;
    return this;
  }

  upsert(data: any, options?: { onConflict?: string }): QueryBuilder<T> {
    this._method = 'upsert';
    this._body = data;
    if (options?.onConflict) this._upsertConflict = options.onConflict;
    return this;
  }

  delete(): this {
    this._method = 'delete';
    return this;
  }

  // ── Filters ──
  eq(column: string, value: any): this { this._filters.push({ column, operator: 'eq' as FilterOperator, value }); return this; }
  neq(column: string, value: any): this { this._filters.push({ column, operator: 'neq' as FilterOperator, value }); return this; }
  gt(column: string, value: any): this { this._filters.push({ column, operator: 'gt' as FilterOperator, value }); return this; }
  gte(column: string, value: any): this { this._filters.push({ column, operator: 'gte' as FilterOperator, value }); return this; }
  lt(column: string, value: any): this { this._filters.push({ column, operator: 'lt' as FilterOperator, value }); return this; }
  lte(column: string, value: any): this { this._filters.push({ column, operator: 'lte' as FilterOperator, value }); return this; }
  like(column: string, pattern: string): this { this._filters.push({ column, operator: 'like' as FilterOperator, value: pattern }); return this; }
  ilike(column: string, pattern: string): this { this._filters.push({ column, operator: 'ilike' as FilterOperator, value: pattern }); return this; }
  is(column: string, value: any): this { this._filters.push({ column, operator: 'is' as FilterOperator, value }); return this; }
  in(column: string, values: any[]): this { this._filters.push({ column, operator: 'in' as FilterOperator, value: values }); return this; }
  contains(column: string, value: any): this { this._filters.push({ column, operator: 'contains' as FilterOperator, value }); return this; }
  or(filterString: string, _opts?: { foreignTable?: string }): this { this._orFilter = filterString; return this; }
  filter(column: string, operator: string, value: any): this { this._filters.push({ column, operator: operator as FilterOperator, value }); return this; }

  // ── Modifiers ──
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this._orderCol = column;
    this._orderAsc = options?.ascending ?? true;
    return this;
  }
  limit(count: number): this { this._limitVal = count; return this; }
  range(from: number, to: number): this { this._offsetVal = from; this._limitVal = to - from + 1; return this; }
  single(): this { this._single = true; return this; }
  maybeSingle(): this { this._maybeSingle = true; return this; }
  abortSignal(_signal?: AbortSignal): this { return this; } // no-op

  // ── Execute ──
  private _buildQueryParams(): QueryParams {
    return {
      table: this._table,
      method: this._method,
      columns: this._columns !== '*' ? this._columns : undefined,
      filters: this._filters.length > 0 ? this._filters : undefined,
      order_col: this._orderCol,
      order_asc: this._orderCol ? this._orderAsc : undefined,
      limit: this._limitVal,
      offset: this._offsetVal,
      single: this._single || this._maybeSingle || undefined,
      body: this._body,
      upsert_conflict: this._upsertConflict,
      return_select: this._returnSelect || undefined,
      count: this._count,
      or_filter: this._orFilter,
    };
  }

  private async _execute(): Promise<PostgrestResponse<T>> {
    const result = await capacitorQuery<T>(this._buildQueryParams());

    if (result.data && Array.isArray(result.data)) {
      if (this._single) {
        if (result.data.length === 0) {
          return {
            ...result,
            data: null,
            error: { message: 'Row not found', details: '', hint: '', code: 'PGRST116' },
          };
        }
        (result as any).data = result.data[0];
      } else if (this._maybeSingle) {
        (result as any).data = result.data.length > 0 ? result.data[0] : null;
      }
    }

    return result;
  }

  then<TResult1 = PostgrestResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: PostgrestResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this._execute().then(onfulfilled, onrejected);
  }
}

// ─── Auth Adapter ─────────────────────────────────────────────────────
// Capacitor is single-user local mode — same pattern as Electron.

interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  created_at?: string;
}

interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  user: AuthUser;
}

type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'INITIAL_SESSION';
type AuthChangeCallback = (event: AuthChangeEvent, session: AuthSession | null) => void;

const _authListeners = new Set<AuthChangeCallback>();

const LOCAL_USER: AuthUser = {
  id: 'local-user-001',
  email: 'local@lifeos.app',
  user_metadata: { full_name: 'Local User' },
  app_metadata: { provider: 'local' },
  created_at: new Date().toISOString(),
};

const LOCAL_SESSION: AuthSession = {
  access_token: 'capacitor-local-token',
  refresh_token: 'capacitor-local-refresh',
  expires_in: 999999999,
  expires_at: Date.now() + 999999999000,
  user: LOCAL_USER,
};

const localAuth = {
  async getUser(): Promise<{ data: { user: AuthUser | null }; error: any }> {
    return { data: { user: LOCAL_USER }, error: null };
  },

  async getSession(): Promise<{ data: { session: AuthSession | null }; error: any }> {
    return { data: { session: LOCAL_SESSION }, error: null };
  },

  async signUp(_opts: any): Promise<{ data: any; error: any }> {
    return { data: { session: LOCAL_SESSION, user: LOCAL_USER }, error: null };
  },

  async signInWithPassword(_opts: any): Promise<{ data: any; error: any }> {
    return { data: { session: LOCAL_SESSION, user: LOCAL_USER }, error: null };
  },

  async signInWithOAuth({ provider }: { provider: string; options?: any }): Promise<{ data: any; error: any }> {
    return {
      data: null,
      error: {
        message: `OAuth (${provider}) is not available in Capacitor local mode.`,
        details: '', hint: 'Local mode uses single-user auth', code: 'LOCAL_NO_OAUTH',
      },
    };
  },

  async signOut(): Promise<{ error: any }> {
    return { error: null };
  },

  async refreshSession(): Promise<{ data: { session: AuthSession | null }; error: any }> {
    return { data: { session: LOCAL_SESSION }, error: null };
  },

  async resetPasswordForEmail(_email: string, _options?: any): Promise<{ data: any; error: any }> {
    return { data: null, error: { message: 'Password reset not needed in local mode', details: '', hint: '', code: 'LOCAL_NO_RESET' } };
  },

  async resend(_opts: any): Promise<{ data: any; error: any }> {
    return { data: null, error: { message: 'Email resend not available in local mode', details: '', hint: '', code: 'LOCAL_NO_RESEND' } };
  },

  onAuthStateChange(callback: AuthChangeCallback): { data: { subscription: { unsubscribe: () => void } } } {
    _authListeners.add(callback);
    setTimeout(() => callback('INITIAL_SESSION', LOCAL_SESSION), 0);
    return {
      data: {
        subscription: {
          unsubscribe: () => { _authListeners.delete(callback); },
        },
      },
    };
  },
};

// ─── Main export: drop-in replacement for `supabase` ─────────────────

export const supabase = {
  from<T = any>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table);
  },

  async rpc(fn: string, params?: Record<string, any>): Promise<PostgrestResponse> {
    try {
      await ensureDb();
      return await capacitorExecRpc(fn, params || {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        data: null,
        error: { message: msg, details: '', hint: '', code: 'RPC_ERROR' },
        status: 500,
        statusText: 'RPC Error',
      };
    }
  },

  // Real-time stubs — no WebSocket in native Capacitor mode
  channel(_name: string, _opts?: any) {
    const noopChannel = {
      on: () => noopChannel,
      subscribe: () => noopChannel,
      unsubscribe: () => {},
    };
    return noopChannel;
  },
  removeChannel(_channel: any) {},

  auth: localAuth,
};

// ─── Dedup helper ─────────────────────────────────────────────────────

const _inflight = new Map<string, { promise: Promise<any>; timestamp: number }>();
const DEDUP_TTL = 2000;

export function dedup<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
  const existing = _inflight.get(key);
  if (existing && Date.now() - existing.timestamp < DEDUP_TTL) {
    return existing.promise as Promise<T>;
  }
  const promise = queryFn().finally(() => {
    setTimeout(() => _inflight.delete(key), DEDUP_TTL);
  });
  _inflight.set(key, { promise, timestamp: Date.now() });
  return promise;
}

// ─── Runtime info ─────────────────────────────────────────────────────

export const runtime = {
  get isCapacitor() { return isCapacitorCheck(); },
  get backend() { return 'capacitor' as const; },
  get apiBase() { return null; },
};

export default supabase;
