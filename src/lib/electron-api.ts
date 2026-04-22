/**
 * Electron-Native API Adapter — drop-in replacement for Supabase client
 *
 * When running inside Electron: uses window.electronAPI (exposed by preload.js)
 * to invoke IPC handlers in the main process, which execute queries against
 * the local SQLite database via better-sqlite3.
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
 * Architecture mirrors tauri-api.ts exactly — same QueryParams interface,
 * same auth objects, same response format. Only the transport layer differs:
 * Tauri uses invoke(), Electron uses window.electronAPI.dbQuery().
 */

// ─── Electron Detection ─────────────────────────────────────────────

declare const __IS_ELECTRON__: boolean;

let _isElectronCached: boolean | null = null;
function isElectronCheck(): boolean {
  if (_isElectronCached !== null) return _isElectronCached;

  // Build-time detection (most reliable)
  if (typeof __IS_ELECTRON__ !== 'undefined' && __IS_ELECTRON__) {
    _isElectronCached = true;
    return true;
  }

  // Runtime detection
  _isElectronCached = typeof window !== 'undefined' && !!(window as any).electronAPI;
  return _isElectronCached;
}

/** Get the electronAPI bridge from preload.js */
function getApi(): ElectronAPI | null {
  if (!isElectronCheck()) return null;
  return (window as any).electronAPI || null;
}

// ─── Types ───────────────────────────────────────────────────────────

interface ElectronAPI {
  dbQuery: (params: QueryParams) => Promise<PostgrestResponse>;
  dbRpc: (fnName: string, fnParams: Record<string, any>) => Promise<PostgrestResponse>;
  readFile: (path: string) => Promise<{ data: string | null; error: string | null }>;
  readMedia: (path: string) => Promise<{ data: ArrayBuffer | null; error: string | null }>;
  listDirectory: (path: string) => Promise<{ data: any[] | null; error: string | null }>;
  getAcademyOverview: () => Promise<any>;
  addXp: (params: any) => Promise<any>;
  getLifeContext: () => Promise<any>;
  getSteamStatus: () => Promise<any>;
  getAppInfo: () => Promise<any>;
}

interface PostgrestResponse<T = any> {
  data: T | null;
  error: PostgrestError | null;
  count?: number;
  status: number;
  statusText: string;
}

interface PostgrestError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

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

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'contains';

interface QueryFilter {
  column: string;
  operator: FilterOperator;
  value: any;
}

interface QueryParams {
  table: string;
  method: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  columns?: string;
  filters?: QueryFilter[];
  order_col?: string;
  order_asc?: boolean;
  limit?: number;
  offset?: number;
  single?: boolean;
  body?: any;
  upsert_conflict?: string;
  return_select?: boolean;
  count?: string;
  or_filter?: string;
}

// ─── Transport Layer ─────────────────────────────────────────────────

async function electronQuery<T = any>(params: QueryParams): Promise<PostgrestResponse<T>> {
  try {
    const api = getApi();
    if (!api) throw new Error('Electron API not available');
    return await api.dbQuery(params) as PostgrestResponse<T>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      data: null,
      error: {
        message: msg || 'Electron IPC error',
        details: String(err),
        hint: 'Check main process IPC handlers',
        code: 'ELECTRON_ERROR',
      },
      status: 500,
      statusText: 'Electron Error',
    };
  }
}

// ─── Chainable Query Builder ─────────────────────────────────────────

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
  eq(column: string, value: any): this { this._filters.push({ column, operator: 'eq', value }); return this; }
  neq(column: string, value: any): this { this._filters.push({ column, operator: 'neq', value }); return this; }
  gt(column: string, value: any): this { this._filters.push({ column, operator: 'gt', value }); return this; }
  gte(column: string, value: any): this { this._filters.push({ column, operator: 'gte', value }); return this; }
  lt(column: string, value: any): this { this._filters.push({ column, operator: 'lt', value }); return this; }
  lte(column: string, value: any): this { this._filters.push({ column, operator: 'lte', value }); return this; }
  like(column: string, pattern: string): this { this._filters.push({ column, operator: 'like', value: pattern }); return this; }
  ilike(column: string, pattern: string): this { this._filters.push({ column, operator: 'ilike', value: pattern }); return this; }
  is(column: string, value: any): this { this._filters.push({ column, operator: 'is', value }); return this; }
  in(column: string, values: any[]): this { this._filters.push({ column, operator: 'in', value: values }); return this; }
  contains(column: string, value: any): this { this._filters.push({ column, operator: 'contains', value }); return this; }
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
  abortSignal(_signal?: AbortSignal): this { return this; } // no-op: Electron IPC cannot be aborted

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
    let result = await electronQuery<T>(this._buildQueryParams());

    // Handle single/maybeSingle: unwrap array to single object
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

// ─── Auth Adapter ────────────────────────────────────────────────────
// Electron is always single-user local mode — same pattern as Tauri.

type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'INITIAL_SESSION';
type AuthChangeCallback = (event: AuthChangeEvent, session: AuthSession | null) => void;

const _authListeners = new Set<AuthChangeCallback>();

const LOCAL_USER: AuthUser = {
  id: 'local-user-001',
  email: 'local@lifeos.app',
  user_metadata: { full_name: 'Local User' },
  app_metadata: { provider: 'local' },
  created_at: '2020-01-01T00:00:00.000Z', // Fixed past date so progressive disclosure shows all features
};

const LOCAL_SESSION: AuthSession = {
  access_token: 'electron-local-token',
  refresh_token: 'electron-local-refresh',
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
        message: `OAuth (${provider}) is not available in Electron local mode. Use email/password.`,
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
      const api = getApi();
      if (!api) throw new Error('Electron API not available');
      return await api.dbRpc(fn, params || {});
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

  // Real-time stubs — no WebSocket subscriptions in desktop mode
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

// ─── Runtime info ────────────────────────────────────────────────────

export const runtime = {
  get isElectron() { return isElectronCheck(); },
  get backend() { return 'electron' as const; },
  get apiBase() { return null; },
};

export default supabase;
