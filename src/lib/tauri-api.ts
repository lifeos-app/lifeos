/**
 * Tauri-Native API Adapter — drop-in replacement for Supabase client
 * 
 * When running inside Tauri: uses invoke() to call Rust commands directly
 * (no HTTP overhead, direct SQLite access via Rust backend).
 * 
 * When running in browser (dev mode): falls back to Flask HTTP API at
 * localhost:8080/api/ — same behavior as local-api.ts.
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
 * Created: 2026-03-27 for LifeOS Tauri migration
 */

// ─── Tauri Detection ─────────────────────────────────────────────────
// Lazy detection — never evaluated at module load time to avoid race conditions
// with Tauri's injection of __TAURI_INTERNALS__ into the webview.

declare const __IS_TAURI__: boolean;

let _isTauriCached: boolean | null = null;
function isTauriCheck(): boolean {
  if (_isTauriCached !== null) return _isTauriCached;

  // Build-time detection (most reliable)
  if (typeof __IS_TAURI__ !== 'undefined' && __IS_TAURI__) {
    _isTauriCached = true;
    return true;
  }

  // Runtime detection (fallback)
  _isTauriCached = typeof window !== 'undefined' && (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window
  );
  return _isTauriCached;
}

let _invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

async function getTauriInvoke() {
  if (_invoke) return _invoke;
  if (!isTauriCheck()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    _invoke = invoke;
    return _invoke;
  } catch {
    console.warn('[tauri-api] Failed to load @tauri-apps/api/core, falling back to HTTP');
    return null;
  }
}

// ─── Flask HTTP fallback base URL ────────────────────────────────────

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

// ─── Types ───────────────────────────────────────────────────────────

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

// ─── Transport Layer ─────────────────────────────────────────────────
// Two paths: Tauri invoke (direct Rust) or HTTP fetch (Flask fallback)

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

/**
 * Execute a query via Tauri invoke (Rust backend) — zero HTTP overhead.
 * The Rust side receives a typed QueryParams and runs it against SQLite.
 */
async function tauriQuery<T = any>(params: QueryParams): Promise<PostgrestResponse<T>> {
  try {
    const invoke = await getTauriInvoke();
    if (!invoke) throw new Error('Tauri not available');

    const result = await invoke('db_query', { params }) as PostgrestResponse<T>;
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      data: null,
      error: {
        message: msg || 'Tauri invoke error',
        details: String(err),
        hint: 'Check Rust backend db_query command',
        code: 'TAURI_ERROR',
      },
      status: 500,
      statusText: 'Tauri Error',
    };
  }
}

/**
 * Execute a query via HTTP fetch (Flask API fallback for dev mode).
 */
async function httpQuery<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<PostgrestResponse<T>> {
  try {
    const token = localStorage.getItem('local_auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg = body?.error?.message || body?.message ||
        (typeof body?.error === 'string' ? body.error : res.statusText);
      return {
        data: null,
        error: {
          message: errMsg,
          details: body?.error?.details || body?.details || '',
          hint: body?.error?.hint || body?.hint || '',
          code: body?.error?.code || String(res.status),
        },
        status: res.status,
        statusText: res.statusText,
      };
    }

    // Unwrap Supabase-compatible {data, error, count} response format
    const hasDataKey = body && typeof body === 'object' && 'data' in body;
    return {
      data: (hasDataKey ? body.data : body) as T,
      error: hasDataKey ? (body.error || null) : null,
      count: hasDataKey ? body.count : undefined,
      status: res.status,
      statusText: res.statusText,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      data: null,
      error: {
        message: msg || 'Network error',
        details: '',
        hint: 'Is the local API server running at ' + API_BASE + '?',
        code: 'NETWORK_ERROR',
      },
      status: 0,
      statusText: 'Network Error',
    };
  }
}

// ─── Chainable Query Builder ─────────────────────────────────────────

class QueryBuilder<T = any> implements PromiseLike<PostgrestResponse<T>> {
  private _table: string;
  private _method: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private _httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET';
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

  // ── Query type setters ──

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated' }): this {
    this._method = 'select';
    this._httpMethod = 'GET';
    this._columns = columns;
    if (options?.count) this._count = options.count;
    if (this._body && (this._httpMethod === 'POST' || this._httpMethod === 'PUT')) {
      this._returnSelect = true;
    }
    return this;
  }

  insert(data: any): QueryBuilder<T> {
    this._method = 'insert';
    this._httpMethod = 'POST';
    this._body = data;
    return this;
  }

  update(data: any): this {
    this._method = 'update';
    this._httpMethod = 'PATCH';
    this._body = data;
    return this;
  }

  upsert(data: any, options?: { onConflict?: string }): QueryBuilder<T> {
    this._method = 'upsert';
    this._httpMethod = 'PUT';
    this._body = data;
    if (options?.onConflict) this._upsertConflict = options.onConflict;
    return this;
  }

  delete(): this {
    this._method = 'delete';
    this._httpMethod = 'DELETE';
    return this;
  }

  // ── Filters (chainable) ──

  eq(column: string, value: any): this {
    this._filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: any): this {
    this._filters.push({ column, operator: 'neq', value });
    return this;
  }

  gt(column: string, value: any): this {
    this._filters.push({ column, operator: 'gt', value });
    return this;
  }

  gte(column: string, value: any): this {
    this._filters.push({ column, operator: 'gte', value });
    return this;
  }

  lt(column: string, value: any): this {
    this._filters.push({ column, operator: 'lt', value });
    return this;
  }

  lte(column: string, value: any): this {
    this._filters.push({ column, operator: 'lte', value });
    return this;
  }

  like(column: string, pattern: string): this {
    this._filters.push({ column, operator: 'like', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this._filters.push({ column, operator: 'ilike', value: pattern });
    return this;
  }

  is(column: string, value: any): this {
    this._filters.push({ column, operator: 'is', value });
    return this;
  }

  in(column: string, values: any[]): this {
    this._filters.push({ column, operator: 'in', value: values });
    return this;
  }

  contains(column: string, value: any): this {
    this._filters.push({ column, operator: 'contains', value });
    return this;
  }

  or(filterString: string, _opts?: { foreignTable?: string }): this {
    this._orFilter = filterString;
    return this;
  }

  filter(column: string, operator: string, value: any): this {
    this._filters.push({ column, operator: operator as FilterOperator, value });
    return this;
  }

  // ── Modifiers ──

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this._orderCol = column;
    this._orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(count: number): this {
    this._limitVal = count;
    return this;
  }

  range(from: number, to: number): this {
    this._offsetVal = from;
    this._limitVal = to - from + 1;
    return this;
  }

  single(): this {
    this._single = true;
    return this;
  }

  maybeSingle(): this {
    this._maybeSingle = true;
    return this;
  }

  abortSignal(_signal?: AbortSignal): this { return this; } // no-op: Tauri IPC cannot be aborted

  // ── Build and execute ──

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

  private _buildHttpUrl(): string {
    const params = new URLSearchParams();

    if (this._columns !== '*') {
      params.set('select', this._columns);
    }

    for (const f of this._filters) {
      if (f.column === '_or') {
        params.set('or', f.value);
      } else if (f.operator === 'in') {
        params.set(`${f.column}`, `in.(${f.value.join(',')})`);
      } else if (f.operator === 'is') {
        params.set(`${f.column}`, `is.${f.value}`);
      } else {
        params.set(`${f.column}`, `${f.operator}.${f.value}`);
      }
    }

    if (this._orFilter) {
      params.set('or', this._orFilter);
    }

    if (this._orderCol) {
      params.set('order', `${this._orderCol}.${this._orderAsc ? 'asc' : 'desc'}`);
    }

    if (this._limitVal !== undefined) {
      params.set('limit', String(this._limitVal));
    }

    if (this._offsetVal !== undefined) {
      params.set('offset', String(this._offsetVal));
    }

    if (this._single || this._maybeSingle) {
      params.set('single', 'true');
    }

    if (this._count) {
      params.set('count', this._count);
    }

    if (this._upsertConflict) {
      params.set('on_conflict', this._upsertConflict);
    }

    if (this._returnSelect) {
      params.set('return', 'representation');
    }

    const qs = params.toString();
    return `${API_BASE}/${this._table}${qs ? '?' + qs : ''}`;
  }

  private async _execute(): Promise<PostgrestResponse<T>> {
    let result: PostgrestResponse<T>;

    if (isTauriCheck()) {
      // ── Tauri path: invoke Rust command directly ──
      result = await tauriQuery<T>(this._buildQueryParams());
    } else {
      // ── HTTP fallback path: Flask API ──
      const url = this._buildHttpUrl();
      const options: RequestInit = { method: this._httpMethod };
      if (this._body !== undefined) {
        options.body = JSON.stringify(this._body);
      }
      result = await httpQuery<T>(url, options);
    }

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

  // Make the builder thenable (await-able)
  then<TResult1 = PostgrestResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: PostgrestResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this._execute().then(onfulfilled, onrejected);
  }
}

// ─── Auth Adapter ────────────────────────────────────────────────────
// In Tauri mode: auth is handled locally (single-user, no remote auth needed).
// In HTTP mode: delegates to Flask /api/auth/* endpoints.

type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'INITIAL_SESSION';
type AuthChangeCallback = (event: AuthChangeEvent, session: AuthSession | null) => void;

const _authListeners = new Set<AuthChangeCallback>();

function _notifyAuthChange(event: AuthChangeEvent, session: AuthSession | null) {
  for (const cb of _authListeners) {
    try { cb(event, session); } catch {}
  }
}

function _getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem('local_auth_session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function _setStoredSession(session: AuthSession | null) {
  if (session) {
    localStorage.setItem('local_auth_session', JSON.stringify(session));
    localStorage.setItem('local_auth_token', session.access_token);
  } else {
    localStorage.removeItem('local_auth_session');
    localStorage.removeItem('local_auth_token');
  }
}

// In Tauri mode, we auto-create a local session (single-user, no login needed)
const LOCAL_USER: AuthUser = {
  id: 'local-user-001',
  email: 'local@lifeos.app',
  user_metadata: { full_name: 'Local User' },
  app_metadata: { provider: 'local' },
  created_at: new Date().toISOString(),
};

const LOCAL_SESSION: AuthSession = {
  access_token: 'tauri-local-token',
  refresh_token: 'tauri-local-refresh',
  expires_in: 999999999,
  expires_at: Date.now() + 999999999000,
  user: LOCAL_USER,
};

async function _authRequest<T = any>(endpoint: string, options?: RequestInit): Promise<PostgrestResponse<T>> {
  if (isTauriCheck()) {
    try {
      const invoke = await getTauriInvoke();
      if (invoke) {
        const result = await invoke('auth_request', {
          endpoint,
          body: options?.body ? JSON.parse(options.body as string) : null,
        }) as PostgrestResponse<T>;
        return result;
      }
    } catch {
      // Fall through to HTTP
    }
  }
  return httpQuery<T>(`${API_BASE}/${endpoint}`, options);
}

const localAuth = {
  async getUser(): Promise<{ data: { user: AuthUser | null }; error: any }> {
    if (isTauriCheck()) {
      // In Tauri mode, always return the local user (single-user app)
      return { data: { user: LOCAL_USER }, error: null };
    }
    const session = _getStoredSession();
    if (!session) return { data: { user: null }, error: null };

    const res = await httpQuery<AuthUser>(`${API_BASE}/auth/user`);
    if (res.error) {
      return { data: { user: session.user }, error: null };
    }
    return { data: { user: res.data }, error: null };
  },

  async getSession(): Promise<{ data: { session: AuthSession | null }; error: any }> {
    if (isTauriCheck()) {
      // In Tauri mode, always have a valid session
      return { data: { session: LOCAL_SESSION }, error: null };
    }
    const session = _getStoredSession();
    return { data: { session }, error: null };
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: any }): Promise<{ data: any; error: any }> {
    if (isTauriCheck()) {
      // Single-user Tauri app — auto-succeed
      _setStoredSession(LOCAL_SESSION);
      _notifyAuthChange('SIGNED_IN', LOCAL_SESSION);
      return { data: { session: LOCAL_SESSION, user: LOCAL_USER }, error: null };
    }
    const res = await httpQuery<{ session: AuthSession; user: AuthUser }>(`${API_BASE}/auth/signup`, {
      method: 'POST',
      body: JSON.stringify({ email, password, ...options }),
    });
    if (res.data?.session) {
      _setStoredSession(res.data.session);
      _notifyAuthChange('SIGNED_IN', res.data.session);
    }
    return { data: res.data, error: res.error };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }): Promise<{ data: any; error: any }> {
    if (isTauriCheck()) {
      _setStoredSession(LOCAL_SESSION);
      _notifyAuthChange('SIGNED_IN', LOCAL_SESSION);
      return { data: { session: LOCAL_SESSION, user: LOCAL_USER }, error: null };
    }
    const res = await httpQuery<{ session: AuthSession; user: AuthUser }>(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.data?.session) {
      _setStoredSession(res.data.session);
      _notifyAuthChange('SIGNED_IN', res.data.session);
    }
    return { data: res.data, error: res.error };
  },

  async signInWithOAuth({ provider }: { provider: string; options?: any }): Promise<{ data: any; error: any }> {
    return {
      data: null,
      error: {
        message: `OAuth (${provider}) is not available in local/Tauri mode. Use email/password.`,
        details: '',
        hint: 'Local mode uses single-user auth',
        code: 'LOCAL_NO_OAUTH',
      },
    };
  },

  async signOut(): Promise<{ error: any }> {
    if (!isTauriCheck()) {
      await httpQuery(`${API_BASE}/auth/logout`, { method: 'POST' }).catch(() => {});
    }
    _setStoredSession(null);
    _notifyAuthChange('SIGNED_OUT', null);
    return { error: null };
  },

  async refreshSession(): Promise<{ data: { session: AuthSession | null }; error: any }> {
    if (isTauriCheck()) {
      return { data: { session: LOCAL_SESSION }, error: null };
    }
    const session = _getStoredSession();
    if (!session) return { data: { session: null }, error: null };

    const res = await httpQuery<{ session: AuthSession }>(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (res.data?.session) {
      _setStoredSession(res.data.session);
      _notifyAuthChange('TOKEN_REFRESHED', res.data.session);
      return { data: { session: res.data.session }, error: null };
    }
    return { data: { session }, error: res.error };
  },

  async resetPasswordForEmail(email: string, options?: any): Promise<{ data: any; error: any }> {
    if (isTauriCheck()) {
      return { data: null, error: { message: 'Password reset not needed in local mode', details: '', hint: '', code: 'LOCAL_NO_RESET' } };
    }
    const res = await httpQuery(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ email, ...options }),
    });
    return { data: res.data, error: res.error };
  },

  async resend(_opts: any): Promise<{ data: any; error: any }> {
    return { data: null, error: { message: 'Email resend not available in local mode', details: '', hint: '', code: 'LOCAL_NO_RESEND' } };
  },

  onAuthStateChange(callback: AuthChangeCallback): { data: { subscription: { unsubscribe: () => void } } } {
    _authListeners.add(callback);

    // Fire initial session event
    if (isTauriCheck()) {
      setTimeout(() => callback('INITIAL_SESSION', LOCAL_SESSION), 0);
    } else {
      const session = _getStoredSession();
      setTimeout(() => callback('INITIAL_SESSION', session), 0);
    }

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

  /** RPC call — maps to Tauri invoke or POST /api/rpc/{fn} */
  async rpc(fn: string, params?: Record<string, any>): Promise<PostgrestResponse> {
    if (isTauriCheck()) {
      try {
        const invoke = await getTauriInvoke();
        if (invoke) {
          const result = await invoke('db_rpc', { fn, params: params || {} }) as PostgrestResponse;
          return result;
        }
      } catch {
        // Fall through to HTTP
      }
    }
    return httpQuery(`${API_BASE}/rpc/${fn}`, {
      method: 'POST',
      body: params ? JSON.stringify(params) : undefined,
    });
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

// ─── Dedup helper (same interface as supabase.ts / local-api.ts) ─────

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
  get isTauri() { return isTauriCheck(); },
  get backend() { return isTauriCheck() ? 'tauri' as const : 'http' as const; },
  get apiBase() { return isTauriCheck() ? null : API_BASE; },
};

export default supabase;
