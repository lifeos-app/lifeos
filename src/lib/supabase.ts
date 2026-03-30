import { createClient } from '@supabase/supabase-js';

declare const __IS_TAURI__: boolean;
declare const __IS_ELECTRON__: boolean;
const _IS_TAURI = typeof __IS_TAURI__ !== 'undefined' && __IS_TAURI__;
const _IS_ELECTRON = typeof __IS_ELECTRON__ !== 'undefined' && __IS_ELECTRON__;

// In Tauri mode, the Supabase cloud client is never used (data-access routes to
// tauri-api.ts). Use a dummy URL and disable all background network activity to
// prevent "Connection refused" errors from autoRefreshToken hitting localhost:8080.
// In Electron mode, we NEED the real Supabase client for Google OAuth token exchange.
const _NOOP_MODE = _IS_TAURI && !_IS_ELECTRON;
const SUPABASE_URL = _NOOP_MODE ? 'https://noop.invalid' : (import.meta.env.VITE_SUPABASE_URL || '');
const SUPABASE_ANON_KEY = _NOOP_MODE ? 'noop' : (import.meta.env.VITE_SUPABASE_ANON_KEY || '');

// Warn but don't throw — local-api mode may import this module but never use it
if (!_IS_TAURI && !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  if (!import.meta.env.VITE_USE_LOCAL_API && !import.meta.env.VITE_API_BASE_URL) {
    console.error('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — Supabase client will not work');
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: !_IS_TAURI,
    persistSession: !_IS_TAURI,
    detectSessionInUrl: !_IS_TAURI,
    // Keep session alive — refresh before expiry
    flowType: 'pkce',
  },
});

// ═══════════════════════════════════════════════════════════
// Request Deduplication
// If the same query is already in-flight, return the existing promise
// ═══════════════════════════════════════════════════════════

const _inflight = new Map<string, { promise: Promise<unknown>; timestamp: number }>();
const DEDUP_TTL = 2000; // 2s — same query within 2s returns cached promise

/**
 * Deduplicated fetch — prevents identical Supabase queries from firing simultaneously.
 * Usage: const data = await dedup('tasks-list', () => supabase.from('tasks').select('*'));
 */
export function dedup<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
  const existing = _inflight.get(key);
  if (existing && Date.now() - existing.timestamp < DEDUP_TTL) {
    return existing.promise as Promise<T>;
  }

  const promise = queryFn().finally(() => {
    // Clean up after resolution + TTL
    setTimeout(() => _inflight.delete(key), DEDUP_TTL);
  });

  _inflight.set(key, { promise, timestamp: Date.now() });
  return promise;
}
