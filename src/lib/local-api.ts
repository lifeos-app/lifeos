/**
 * Local API Adapter — drop-in replacement for Supabase client
 * 
 * Replaces `import { supabase } from './supabase'` with a chainable query builder
 * that talks to a local Flask API at localhost:8080/api/ instead of Supabase.
 * 
 * Mimics the Supabase PostgREST chainable interface:
 *   supabase.from('table').select('*').eq('id', 1).single()
 *   supabase.from('table').insert({...}).select().single()
 *   supabase.from('table').update({...}).eq('id', 1)
 *   supabase.from('table').delete().eq('id', 1)
 *   supabase.from('table').upsert({...}, { onConflict: 'id' })
 *   supabase.rpc('function_name', params)
 *   supabase.auth.getUser() / getSession() / signIn / signOut etc.
 * 
 * Created: 2026-03-27 for LifeOS local-mode migration
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL
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

// ─── Helper: wrap fetch with Supabase-shaped response ────────────────

async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<PostgrestResponse<T>> {
  try {
    // Attach auth token if we have one
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
        hint: 'Is the local API server running?',
        code: 'NETWORK_ERROR',
      },
      status: 0,
      statusText: 'Network Error',
    };
  }
}

// ─── Chainable Query Builder ─────────────────────────────────────────
// Mimics Supabase PostgREST builder: .select().eq().order().limit() etc.
// The chain is lazy — it only fires when awaited (via .then()).

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'contains';

interface QueryFilter {
  column: string;
  operator: FilterOperator;
  value: any;
}

class QueryBuilder<T = any> implements PromiseLike<PostgrestResponse<T>> {
  private _table: string;
  private _method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET';
  private _columns: string = '*';
  private _filters: QueryFilter[] = [];
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
    this._method = 'GET';
    this._columns = columns;
    if (options?.count) this._count = options.count;
    // If called after insert/upsert, it means "return the inserted row"
    if (this._body && (this._method === 'POST' || this._method === 'PUT')) {
      this._returnSelect = true;
    }
    return this;
  }

  insert(data: any): QueryBuilder<T> {
    this._method = 'POST';
    this._body = data;
    // Return a new-ish builder that supports .select().single()
    return this;
  }

  update(data: any): this {
    this._method = 'PATCH';
    this._body = data;
    return this;
  }

  upsert(data: any, options?: { onConflict?: string }): QueryBuilder<T> {
    this._method = 'PUT';
    this._body = data;
    if (options?.onConflict) this._upsertConflict = options.onConflict;
    return this;
  }

  delete(): this {
    this._method = 'DELETE';
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

  or(filterString: string, { foreignTable }: { foreignTable?: string } = {}): this {
    // Supabase .or() takes a string like "status.eq.active,status.eq.pending"
    // We pass it as a special filter the API can parse
    this._filters.push({ column: '_or', operator: 'eq', value: filterString });
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

  // ── Build URL and execute ──

  private _buildUrl(): string {
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
    const url = this._buildUrl();
    const options: RequestInit = { method: this._method };

    if (this._body !== undefined) {
      options.body = JSON.stringify(this._body);
    }

    const result = await apiRequest<any>(url, options);

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
        result.data = result.data[0];
      } else if (this._maybeSingle) {
        result.data = result.data.length > 0 ? result.data[0] : null;
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
// Mimics supabase.auth.* methods with local JWT-based auth

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

const localAuth = {
  async getUser(): Promise<{ data: { user: AuthUser | null }; error: any }> {
    const session = _getStoredSession();
    if (!session) return { data: { user: null }, error: null };

    const res = await apiRequest<AuthUser>(`${API_BASE}/auth/user`);
    if (res.error) {
      return { data: { user: session.user }, error: null }; // fallback to cached
    }
    return { data: { user: res.data }, error: null };
  },

  async getSession(): Promise<{ data: { session: AuthSession | null }; error: any }> {
    const session = _getStoredSession();
    return { data: { session }, error: null };
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: any }): Promise<{ data: any; error: any }> {
    const res = await apiRequest<{ session: AuthSession; user: AuthUser }>(`${API_BASE}/auth/signup`, {
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
    const res = await apiRequest<{ session: AuthSession; user: AuthUser }>(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.data?.session) {
      _setStoredSession(res.data.session);
      _notifyAuthChange('SIGNED_IN', res.data.session);
    }
    return { data: res.data, error: res.error };
  },

  async signInWithOAuth({ provider, options }: { provider: string; options?: any }): Promise<{ data: any; error: any }> {
    // In local mode, OAuth is not supported — return a helpful error
    return {
      data: null,
      error: {
        message: `OAuth (${provider}) is not available in local mode. Use email/password.`,
        details: '',
        hint: 'Set up a local account via /api/auth/signup',
        code: 'LOCAL_NO_OAUTH',
      },
    };
  },

  async signOut(): Promise<{ error: any }> {
    await apiRequest(`${API_BASE}/auth/logout`, { method: 'POST' }).catch(() => {});
    _setStoredSession(null);
    _notifyAuthChange('SIGNED_OUT', null);
    return { error: null };
  },

  async refreshSession(): Promise<{ data: { session: AuthSession | null }; error: any }> {
    const session = _getStoredSession();
    if (!session) return { data: { session: null }, error: null };

    const res = await apiRequest<{ session: AuthSession }>(`${API_BASE}/auth/refresh`, {
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
    const res = await apiRequest(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ email, ...options }),
    });
    return { data: res.data, error: res.error };
  },

  onAuthStateChange(callback: AuthChangeCallback): { data: { subscription: { unsubscribe: () => void } } } {
    _authListeners.add(callback);

    // Fire initial session event (like Supabase does)
    const session = _getStoredSession();
    setTimeout(() => callback('INITIAL_SESSION', session), 0);

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

  /** RPC call — maps to POST /api/rpc/{function_name} */
  async rpc(fn: string, params?: Record<string, any>): Promise<PostgrestResponse> {
    return apiRequest(`${API_BASE}/rpc/${fn}`, {
      method: 'POST',
      body: params ? JSON.stringify(params) : undefined,
    });
  },

  auth: localAuth,
};

// ─── Dedup helper (same as original supabase.ts) ─────────────────────

const _inflight = new Map<string, { promise: Promise<any>; timestamp: number }>();
const DEDUP_TTL = 2000;

/**
 * Deduplicated fetch — prevents identical queries from firing simultaneously.
 * Usage: const data = await dedup('tasks-list', () => supabase.from('tasks').select('*'));
 */
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

// ─── Default export for convenience ──────────────────────────────────
export default supabase;
