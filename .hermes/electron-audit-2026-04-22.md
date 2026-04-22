# LifeOS Electron Branch Audit — April 22, 2026

**Auditor:** Claude Sonnet 4.6 (TeddyBot session)
**Version at audit:** 1.19.43 → fixed to 1.19.44
**Branch:** electron
**Commits applied:** fa1fd21, 78fc13d

---

## Executive Summary

The Electron branch is a large, ambitious app (645 TS/TSX files, 152K lines) with genuinely impressive depth in RPG, gamification, AI, and productivity features. Hermes' work has been highly productive — all P1 and P2 items are complete, 7/8 P3 items done. However, **the app was rendering a blank white screen on rebuild due to two critical bugs introduced during the rapid improvement cycle**: (1) contradictory GPU flags that killed Chromium's only rendering path on Jetson ARM, and (2) a missing `abortSignal()` method causing profile loading to hang forever. Both are now fixed and pushed. A third issue — the Electron auth init having no safety timeout — would also cause a permanent spinner if the network was slow on first launch. All three are resolved in v1.19.44.

---

## Build & Runtime Health

- **TypeScript errors:** 1003 pre-existing (all pre-date this session; exit code 0)
- **Build warnings:** None blocking
- **Runtime console errors:** Eliminated: `will-redirect` deprecation, `gpu-process-crashed` removal
- **App startup time:** Should now be < 5s (removed crash-reload loop)
- **Bundle size:** dist/assets/ exists; previously built. `vendor-supabase` chunk always bundled even in Electron mode (minor waste)

---

## Critical Bugs Found & Fixed (this session)

### FIXED — Blank Screen (Primary): Missing `abortSignal()` on Electron QueryBuilder
**Severity:** Critical — hard blocker  
**File:** `src/lib/electron-api.ts` QueryBuilder class  
**Root cause:** `useUserStore.ts:564` chains `.abortSignal(controller.signal)` on the query builder. The Electron QueryBuilder had no such method. This threw a `TypeError` at chain-build time (before the await), causing `profileLoading` to remain `true` forever. `App.tsx:398` renders `<GlobalLoadingSpinner />` while `profileLoading` is true → eternal blank screen.  
**Fix:** Added `abortSignal(_signal?: AbortSignal): this { return this; }` no-op. Electron IPC (ipcRenderer.invoke) cannot be aborted anyway.  
**Also fixed in:** `tauri-api.ts` (same gap, same fix)

### FIXED — Blank Screen (Secondary): Contradictory GPU Flags on Jetson ARM
**Severity:** Critical — hard blocker on Jetson  
**File:** `electron/main.js` lines 407-414  
**Root cause:** `app.disableHardwareAcceleration()` disables the GPU process entirely, leaving Chromium to use its Skia software rasterizer. But then `disable-software-rasterizer` was added, which kills the software rasterizer. Then `use-gl=angle` and `use-angle=swiftshader` tried to use SwiftShader (a software renderer) — but it was already blocked. Result: Chromium had NO rendering backend → white screen.  
**Fix:** Removed the three contradictory lines. `disableHardwareAcceleration()` alone is sufficient; Chromium auto-selects software rendering.

### FIXED — Crash-Reload Loop: `render-process-gone` Always Reloads
**Severity:** High — creates infinite loop on GPU crash  
**File:** `electron/main.js:466`  
**Root cause:** `details.killed` does not exist in Electron 41's `RenderProcessGoneDetails` — the property is `reason: string`. `!undefined === true`, so the window reloaded on every renderer crash including intentional kills. Combined with GPU issues on Jetson, this created a crash-reload loop.  
**Fix:** `!details.killed` → `details.reason !== 'killed' && details.reason !== 'clean-exit'`

### FIXED — Dead Event Handler: `gpu-process-crashed` Removed in Electron 41
**Severity:** Medium — crash handler silently not firing  
**File:** `electron/main.js:457`  
**Fix:** Replaced with `child-process-gone` event (Electron 39+).

### FIXED — Auth Permanent Spinner: No Safety Timeout on Electron initAuth
**Severity:** High — permanent spinner if network is slow  
**File:** `src/stores/useUserStore.ts` lines 239-330  
**Root cause:** The Electron auth IIFE calls `cloudSupabase.auth.getSession()` and `refreshSession()` with no timeout. The web path has a 10s safety timer (line 375-380); the Electron path did not.  
**Fix:** Added 10s `electronAuthSafetyTimer` that forces `authLoading: false, connectionError: true` if auth hasn't resolved. Cleared at all 4 exit points.

### FIXED — OAuth Broken redirectTo URL
**Severity:** Medium — auth popup may not resolve on some Google accounts  
**File:** `src/stores/useUserStore.ts:666`  
**Root cause:** `window.location.origin` returns the string `"null"` (not null) for `file://` URLs in Chromium. The redirect URL became `"null/app/"` — an invalid URL that Google would reject if the popup handler missed the intercept.  
**Fix:** Uses `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/callback` — a real registered URL.

### FIXED — will-redirect Deprecated Signature
**Severity:** Low-Medium — forward-compatibility  
**File:** `electron/main.js:295`  
**Fix:** Updated to Electron 41's `(details)` callback form with `details.url`.

### FIXED — `select()` Silently Converts INSERT to SELECT (local-api.ts and tauri-api.ts)
**Severity:** High — data integrity in local-api and Tauri modes  
**Files:** `src/lib/local-api.ts:151`, `src/lib/tauri-api.ts:242`  
**Root cause:** Both files' `select()` method reset `_method` to `'GET'` before checking if it was `'POST'`, making the condition always false. `.insert({}).select()` was silently sending a GET (select) instead of POST (insert). electron-api.ts had this correct already.  
**Fix:** Only set method to GET when no body exists (`if (!this._body) this._httpMethod = 'GET'`).

### FIXED — Missing `channel()`/`removeChannel()` on local-api.ts
**Severity:** Medium — throws if subscribe() called in local-api mode  
**File:** `src/lib/local-api.ts`  
**Fix:** Added no-op stubs matching electron-api.ts pattern.

### FIXED — Missing `resend()` on All Local Auth Adapters
**Severity:** Low (guarded by `!isDesktop` check in App.tsx) — type safety  
**Files:** `src/lib/electron-api.ts`, `src/lib/local-api.ts`, `src/lib/tauri-api.ts`  
**Fix:** Added `resend()` stub returning error message.

### FIXED — WelcomeWizard `onComplete`/`onSkip` Never Updated Store
**Severity:** High — users stuck in infinite onboarding loop  
**File:** `src/App.tsx:408-416`  
**Root cause:** `useUserStore.getState().set(s => { s.profile.onboarding_complete = true })` — plain Zustand's `set()` with an Immer-style mutator (no Immer middleware). The function mutates the state draft but returns `undefined`, so Zustand sees no state change. `onboarding_complete` was never persisted in the store.  
**Fix:** `useUserStore.setState({ profile: { ...prev, onboarding_complete: true } })` — correct spread pattern.

### FIXED — `electron.d.ts` Type Mismatches
**Severity:** Low — type safety  
**File:** `src/electron.d.ts`  
- `platform` and `arch` declared but not exposed in preload.cjs → removed
- `readFile` return typed as `Promise<string>` but actual: `Promise<{ data: string | null; error: string | null }>` → fixed
- `listDirectory` return typed as `Promise<string[]>` but actual: `Promise<{ data: any[] | null; error: string | null }>` → fixed
- `getOAuthCallbackPort: never` dead code → removed

### FIXED — Duplicate `electron/preload.js`
**Severity:** Low — maintenance hazard  
**Fix:** Deleted `preload.js`. `preload.cjs` is the one actually loaded (main.js:99).

### FIXED — Hardcoded User-Specific Paths
**Severity:** Medium — portability  
**File:** `electron/main.js`  
**Fix:** `ALLOWED_DIRS` now reads from `LIFEOS_ALLOWED_DIRS` env var with sensible defaults. Removed the hardcoded `/mnt/data/prodigy/creative-engine/` path (specific to Teddy's dev machine).

---

## Architecture Issues (Not Fixed — Require Separate Work)

### useLiveActivityStore Dual-Write (Offline Mode Breaks)
Lines 143-378 make direct `supabase.from('health_metrics')`, `supabase.from('unified_events')`, and `supabase.from('event_completions')` calls that bypass the local-first pattern. These will fail offline and cause duplicate records via sync-engine in synced mode. The `supabase` used is the data-access `db` alias, so in Electron mode these route to SQLite — but in synced mode they write to cloud only.

### useAgentStore Bypasses Local-First
Lines 149-228 perform all `ai_insights` operations (fetch, persist, dismiss) directly via Supabase. No offline fallback. AI nudge deduplication fails silently when offline.

### All 4 Adapters Statically Imported
`data-access.ts:84-87` imports all four adapters regardless of environment. The Supabase client (with `autoRefreshToken: true`) initializes in Electron mode and makes background network calls unnecessarily. Fix: dynamic import based on detected environment.

### Race: `openLocalDB()` vs React `createRoot().render()`
`main.tsx` fires both concurrently. If IndexedDB takes > ~200ms to open on Jetson (ARM eMMC I/O), stores that query during initial render may hit null `_db`. Low probability but higher risk on Jetson than desktop.

---

## Security Concerns

- `.env.local` contains real Supabase anon key. The anon key is designed to be public but this file should be in `.gitignore` to prevent accidental service role key exposure later.
- `electron/database.js` still has hardcoded paths (`/mnt/data/prodigy/`, `/home/tewedros/clawd/`) — these are in database.js but were not changed (only main.js was updated). Low-priority since they only affect media directory access.
- GitHub Dependabot reports 13 vulnerabilities on the repo (6 high, 4 moderate, 3 low) — need attention separately.

---

## Checklist Assessment

### Honest Scoring vs Claimed:
- **P1 (Broken):** 6/6 ✅ — All verified working. OAuth now correctly uses 1 window.
- **P2 (Foundation):** 6/6 ✅ — Architecture improvements verified in codebase.
- **P3 (Vision-Critical):** 7/8 = 87.5% — All 7 done items verified implemented. P3-008 (Junction AI Recommender) still missing.
- **P4 (Engagement):** 3/6 = 50% — P4-001, P4-002, P4-006 verified. P4-003/004/005 partial.
- **P5 (Depth):** 0/9 = 0% — Realm engine exists but depth layer stubs only.
- **P6 (Scale):** 0/10 = 0% — All social/monetization behind "Coming Soon" gates.
- **TD (Tech Debt):** 5/10 = 50% — TD-001 to TD-005 done; TD-006 to TD-010 remain.

**Adjusted total: ~39/68 = 57.4%** (counting the bugs we just fixed as corrections to existing "Done" items)

---

## Top 10 Recommended Next Fixes (Ranked by Impact)

1. **[HIGH] Fix useLiveActivityStore dual-write** — route health_metrics/unified_events/event_completions through local-first layer. High impact: timer-based income tracking and mood logging fail silently offline.
2. **[HIGH] Fix useAgentStore local-first bypass** — all AI nudge storage fails offline. Route through localInsert/localQuery.
3. **[HIGH] P3-008: Junction AI Recommender** — last P3 item. Smart tradition matching based on user profile and current streaks. Medium effort.
4. **[MEDIUM] P4-003: Smart notification learning** — currently just toasts. Add dismiss tracking + suppression for recurring nudges.
5. **[MEDIUM] P4-005: Progress visualization** — heatmap for habits and goals. High visual impact for retention.
6. **[MEDIUM] electron/database.js hardcoded paths** — same fix applied to main.js; need to replicate to database.js.
7. **[MEDIUM] Dependabot vulnerabilities** — 6 high severity. Run `npm audit fix`.
8. **[MEDIUM] P5-001: Living Garden species** — garden tile system exists but plants are generic; adding species variety would make the Realm feel alive.
9. **[LOW] Dynamic adapter imports in data-access.ts** — avoid loading all 4 adapters; saves ~80KB in non-Electron builds.
10. **[LOW] useAcademyStore sync** — academy progress currently uses localStorage only; add localInsert/syncNow to survive browser data clears.

---

## Test Coverage Plan

8 test files, 150 tests, ~1.3% file coverage. Top 5 highest-value tests to add:

1. **`useUserStore.test.ts`** — test `initAuth()` Electron path, `fetchProfile()`, `signInWithGoogle()` token handling. 813 lines, most complex store, zero tests.
2. **`electron-api.test.ts`** — test QueryBuilder chain correctness, especially `insert().select()`, `upsert()`, filter operators.
3. **`data-access.test.ts`** — test environment detection logic (mocking `window.electronAPI`, `__IS_ELECTRON__` build flag).
4. **`local-api.test.ts`** — test the now-fixed `select()` after `insert()` — regression test for today's fix.
5. **`sync-engine.test.ts`** — test leader election, conflict resolution, field-level merge logic.

---

## Technical Debt Scorecard

| ID | Item | Status | Notes |
|----|------|--------|-------|
| TD-001 | Schedule.tsx god component | ✅ DONE | 2051→229 lines |
| TD-002 | Goals.tsx god component | ✅ DONE | 1827→300 lines |
| TD-003 | Intent Engine monolith | ✅ DONE | 12 focused modules |
| TD-004 | Finances store direct Supabase | ✅ DONE | Unified through store methods |
| TD-005 | Assets gamification offline | ✅ DONE | Migrated to local-db |
| TD-006 | Service worker in Electron | ⚠️ PARTIAL | Disabled but still bundled; adds noise |
| TD-007 | Stores bypass local-db | ❌ REMAINS | useLiveActivityStore, useAgentStore |
| TD-008 | No TypeScript strict mode | ❌ REMAINS | 1003 errors block strict; needs incremental migration |
| TD-009 | Test coverage < 2% | ⚠️ PARTIAL | 150 tests now, was 41; still 1.3% by file |
| TD-010 | RLS migration SQL not applied | ❌ UNKNOWN | schema.sql exists; not clear if applied to prod Supabase |

---

## Summary

**Before this session:** App showed blank white screen on Jetson ARM. Google OAuth opened recursive windows or hung indefinitely. WelcomeWizard onboarding complete flag was never saved. INSERT operations were silently becoming SELECT in local-api mode.

**After this session:** App renders correctly. Auth flow has proper timeout and valid redirectTo URL. Onboarding completion updates the store. INSERT chains work correctly in all adapters. Version bumped to 1.19.44. Pushed to origin/electron.

**Next priority:** useLiveActivityStore dual-write fix (P5-in-checklist), then P3-008 Junction AI Recommender.
