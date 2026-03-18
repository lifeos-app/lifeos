/**
 * UI State Persistence — Supabase-backed with localStorage cache.
 *
 * Stores boolean UI flags (first-view, tutorial-done, discovery-hint-seen)
 * in user_profiles.preferences.ui_state on Supabase, with localStorage
 * as the fast hot path for zero-latency reads.
 *
 * Pattern:
 *   getUIState(key)            → read localStorage (instant)
 *   setUIState(key)            → write localStorage + fire-and-forget Supabase
 *   syncUIStateFromSupabase()  → pull from Supabase, merge into localStorage (app load)
 */

import { supabase } from '../lib/supabase';

const LS_PREFIX = 'lifeos_ui_state_';

// Legacy localStorage keys → new ui_state keys (for migration)
const LEGACY_KEYS: Record<string, string> = {
  'lifeos_junction_tutorial_done': 'junction_tutorial_done',
  'lifeos_health_ai_seen': 'health_ai_seen',
  'lifeos_finance_ai_holo_seen': 'finance_ai_seen',
  'ed-toggle-discovered': 'event_drawer_discovered',
  'lifeos_lifetown_guide_complete': 'lifetown_guide_complete',
};

// ── Read ──

/** Check if a UI state flag is set. Zero-latency (localStorage only). */
export function getUIState(key: string): boolean {
  try {
    return localStorage.getItem(LS_PREFIX + key) !== null;
  } catch {
    return false;
  }
}

// ── Write ──

/** Mark a UI state flag as set. Writes localStorage immediately + Supabase fire-and-forget. */
export function setUIState(key: string): void {
  try {
    localStorage.setItem(LS_PREFIX + key, Date.now().toString());
  } catch { /* Safari private mode */ }

  // Fire-and-forget Supabase update
  persistUIStateToSupabase(key).catch(() => {});
}

/** Persist a single flag to Supabase user_profiles.preferences.ui_state */
async function persistUIStateToSupabase(key: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle();

    const prefs = (profile?.preferences || {}) as Record<string, any>;
    const uiState: Record<string, number> = prefs.ui_state || {};
    uiState[key] = Date.now();

    await supabase
      .from('user_profiles')
      .update({ preferences: { ...prefs, ui_state: uiState } })
      .eq('user_id', user.id);
  } catch {
    // Non-critical — localStorage is the source of truth for reads
  }
}

// ── Sync ──

/** Pull ui_state from Supabase → localStorage. Called once on app load. Also migrates legacy keys. */
export async function syncUIStateFromSupabase(): Promise<void> {
  // 1. Migrate legacy localStorage keys first (always, even before Supabase fetch)
  migrateLegacyKeys();

  // 2. Pull from Supabase and merge
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle();

    const prefs = (profile?.preferences || {}) as Record<string, any>;
    const serverState: Record<string, number> = prefs.ui_state || {};

    // Merge server state into localStorage (server wins for keys not yet local)
    for (const [key, timestamp] of Object.entries(serverState)) {
      if (typeof timestamp === 'number') {
        try {
          // Only set if not already in localStorage (local is canonical for reads)
          if (!localStorage.getItem(LS_PREFIX + key)) {
            localStorage.setItem(LS_PREFIX + key, timestamp.toString());
          }
        } catch { /* Safari private */ }
      }
    }

    // 3. Push any local-only keys back to Supabase (full merge)
    const localKeys = collectLocalUIStateKeys();
    let needsPush = false;
    for (const key of localKeys) {
      if (!(key in serverState)) {
        needsPush = true;
        try {
          const val = localStorage.getItem(LS_PREFIX + key);
          serverState[key] = val ? parseInt(val, 10) || Date.now() : Date.now();
        } catch { /* ignore */ }
      }
    }

    if (needsPush) {
      await supabase
        .from('user_profiles')
        .update({ preferences: { ...prefs, ui_state: serverState } })
        .eq('user_id', user.id);
    }
  } catch {
    // Non-critical — localStorage has the data from migration
  }
}

/** Migrate legacy localStorage keys to the new LS_PREFIX format. */
function migrateLegacyKeys(): void {
  for (const [legacyKey, newKey] of Object.entries(LEGACY_KEYS)) {
    try {
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue !== null && !localStorage.getItem(LS_PREFIX + newKey)) {
        localStorage.setItem(LS_PREFIX + newKey, legacyValue === 'true' ? Date.now().toString() : legacyValue);
      }
    } catch { /* ignore */ }
  }
}

/** Collect all ui_state keys currently in localStorage. */
function collectLocalUIStateKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) {
        keys.push(k.slice(LS_PREFIX.length));
      }
    }
  } catch { /* ignore */ }
  return keys;
}
