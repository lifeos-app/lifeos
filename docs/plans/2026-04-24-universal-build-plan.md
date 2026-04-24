# LifeOS Feature Branch Plan — The Universal Build

**Date:** 2026-04-24
**Status:** Analysis + Plan
**Goal:** One canonical feature branch that contains ALL features and compiles into the format most easily converted to all other formats.

---

## The Core Question

What format is the BEST base that converts most easily to webapp, Electron, Android, and any future target?

## The Analysis

### What we have (5 build targets)

| Target | Format | DB Backend | Distribution |
|--------|--------|------------|-------------|
| Vite Webapp | Static SPA | Supabase Cloud / IndexedDB | Any HTTP server |
| PWA | Same SPA + Service Worker | Same | Installable from browser |
| Electron | Chromium + Node.js | better-sqlite3 | AppImage/deb/dmg/exe |
| Capacitor Android | WebView + Native | @capacitor-community/sqlite | APK/AAB |
| Tauri | Native webview + Rust | rusqlite | Native binary |

### Conversion difficulty between formats

```
        Webapp  PWA   Electron  Android  Tauri
Webapp    -     EASY   MEDIUM   MEDIUM   HARD
PWA      EASY    -     MEDIUM   MEDIUM   HARD
Electron MEDIUM  MED    -       MEDIUM   HARD
Android  MEDIUM  MED   MEDIUM    -       HARD
Tauri    HARD   HARD   HARD     HARD      -
```

### The key insight

**Webapp/PWA is the easiest base to convert FROM.** Here's why:

1. **Webapp → PWA**: Zero changes. Just add a service worker (we already have one).

2. **Webapp → Electron**: Add `electron/` directory + preload + main.js. The renderer IS the webapp. Electron is just Chromium + Node.js wrapped around the same `dist/`. Our `data-access.ts` already detects `window.electronAPI` and routes to SQLite. This is already working.

3. **Webapp → Android**: Add `capacitor.config.ts` + `android/` project. Capacitor wraps a WebView around the same `dist/`. Our `data-access.ts` already detects `globalThis.Capacitor` and routes to on-device SQLite. This is already working.

4. **Webapp → ANY future target**: Any new platform that can render HTML+JS in a webview can load the same `dist/`. The adapter pattern means you just write one new adapter file.

**Electron is NOT a good base** because it bundles Node.js runtime baggage that you then have to strip out for web. Android is not a good base because it injects Capacitor-specific deps. Tauri is definitely not — it requires Rust.

### The answer

**The Vite webapp (static SPA) is the universal base.** Every other format is a wrapper AROUND it. The electron/ directory, the android/ project, the src-tauri/ directory — these are all WRAPPERS, not sources.

```
                    ┌─────────────────────┐
                    │  FEATURE BRANCH      │
                    │  (develop)          │
                    │                     │
                    │  src/  — 98% shared │
                    │  adapters — 2% gate │
                    │                     │
                    └──────────┬──────────┘
                               │
                    npm run build (Vite)
                               │
                    ┌──────────▼──────────┐
                    │     dist/           │
                    │  (static SPA)       │
                    │  UNIVERSAL BASE     │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐ ┌───────▼────────┐ ┌─────▼──────────┐
    │  PWA           │ │  Electron      │ │  Android       │
    │  (add SW)      │ │  (add shell)   │ │  (add WebView) │
    │  ALREADY DONE  │ │  ALREADY DONE  │ │  ALREADY DONE  │
    └────────────────┘ └────────────────┘ └────────────────┘
```

## The Plan

### Phase 1: Create the `develop` branch (canonical feature branch)

The `capacitor` branch IS the feature branch — it has everything. But the NAME is wrong. "capacitor" implies it's Android-specific. It needs to be `develop` — the single source of truth.

```bash
# Create develop from capacitor (which has everything)
git checkout capacitor
git checkout -b develop
git push origin develop

# Also ensure electron stays in sync
git push origin develop:electron
```

### Phase 2: Clean the monolith

Right now one `package.json` has ALL platform deps. This makes `npm install` slow and confusing. Restructure:

```
lifeos/
  package.json          ← SHARED deps only (React, Vite, UI libs, engines)
  src/                   ← ALL shared code
  vite.config.ts         ← Primary build (webapp)
  
  platforms/
    electron/
      package.json       ← Electron-only deps (better-sqlite3, electron, electron-builder)
      main.js
      preload.cjs
      database.js
      schema.sql
      rebuild.js
      steam.js
    
    android/
      package.json       ← Android-only deps (@capacitor-community/sqlite, @capacitor/*)
      capacitor.config.ts
      android/           ← Generated Android project
      
    tauri/
      package.json       ← Tauri-only deps (@tauri-apps/*)
      src-tauri/         ← Rust code
```

But this is a BIG refactor. For now, keep monolithic but DOCUMENT which deps are platform-only with comments.

### Phase 3: Platform adapter isolation

Already 98% done. The 13 platform-aware files in src/ use clean detection. Just need to:

1. **Delete `src/lib/db.ts`** — confusing shortcut that re-exports tauri-api
2. **Ensure EnergyWave + QuickLogMood are imported** — audit shows them as orphaned but they're new components that need wiring
3. **Gate Steam behind Electron + x86_64** — already has graceful fallback, but document it
4. **Remove Flask backend from core** — it's a dev tool, not a deployment target

### Phase 4: Webapp as the universal build

**`npm run build` produces `dist/`** — this is the universal artifact.

- Webapp: Upload `dist/` to any static host
- PWA: Same `dist/` — service worker auto-generated by vite-plugin-pwa
- Electron: Build `dist/`, then Electron wraps it with native shell
- Android: Build `dist/`, then Capacitor syncs it into WebView
- Tauri: Build `dist/`, then Tauri wraps it with Rust shell

**Every platform build STARTS with the same `npm run build`.** The platform-specific steps happen AFTER.

### Phase 5: Build pipeline

```
npm run build           → dist/ (UNIVERSAL — 175 precached files, ~7MB)
                        ↓
npm run web:deploy      → dist/ → Vercel/Netlify/Cloudflare
npm run pwa:deploy      → same dist/ (SW already included)

npm run electron:dev    → vite build --mode desktop → electron . (wraps dist/)
npm run electron:build  → vite build --mode desktop → electron-builder → AppImage/deb/dmg/exe

npm run android:dev     → CAPACITOR_ENV=1 vite build → npx cap sync → Android Studio
npm run android:build   → CAPACITOR_ENV=1 vite build → npx cap sync → gradlew assembleRelease

npm run tauri:dev       → vite build → tauri dev (wraps dist/)
npm run tauri:build     → vite build → tauri build → native binary
```

### Phase 6: Delete dead weight

**Remove from repo:**
- `release/` directory (built AppImages/debs — use CI artifacts instead)
- `backend/lifeos.db` (user data — .gitignore it)
- `android/app/build/` (gradle cache — .gitignore it)
- `.autodev/` (if it still exists)
- 10+ `autodev/*` branches (git branch -D locally)

**Delete orphaned files:**
- src/lib/ai-onboarding-chat.ts (superseded by intent engine)
- src/lib/ai-local.ts (orphaned Tauri import)
- src/lib/data-seed.ts (dev tool, not needed in prod)
- src/lib/gamification/gamification-db.ts (superseded by xp-engine)
- src/lib/llm/context-builder.ts (orphaned)
- src/lib/llm-providers.ts (orphaned)
- src/lib/db.ts (confusing shortcut)

**Keep but wire up:**
- EnergyWave.tsx (new, needs Dashboard import)
- QuickLogMood.tsx (new, needs Dashboard import)
- npc-friendship.ts (future Realm feature)

### Phase 7: Update .gitignore

```
# Build artifacts
release/
android/app/build/
backend/*.db
backend/*.db-journal

# Platform-specific
.tauri/target/

# OS
.DS_Store
Thumbs.db
```

## Branch Strategy Going Forward

```
main      ← Stable releases only. Tagged versions. NEVER commit directly.
            Merged FROM develop when ready to ship.

develop   ← THE feature branch. All work lands here.
            Was: capacitor branch (renamed).

electron  ← Mirror of develop. Auto-fast-forwarded.
            Used by Oriaksum for desktop builds.

feature/* ← Short-lived branches for specific features.
            Merge into develop via PR. Delete after merge.
```

**One critical rule: develop builds as a webapp FIRST.** If a feature doesn't work on the web, it doesn't ship. Every platform is a wrapper around the webapp, not a separate path.

## Execution Order

1. Create `develop` from `capacitor` — push to origin
2. Clean .gitignore — remove build artifacts from tracking
3. Delete dead code (orphans listed above)
4. Wire up new components (EnergyWave, QuickLogMood into Dashboard)
5. Add platform dep comments to package.json
6. Test: `npm run build` → verify dist/ is clean
7. Test: `npm run electron:dev` → verify desktop works
8. Push `develop` and sync `electron` branch
9. Create v1.20.0 tag on `main` from `develop` when ready

## What This Gives Us

- **One codebase** — develop branch has everything
- **One build** — `npm run build` produces the universal artifact
- **Any platform** — wrap the same dist/ in Electron, Capacitor, or Tauri
- **Forward compatible** — new platforms just need a new adapter + shell
- **Clean git** — no more autodev branches, no more diverged electron
- **Professional CI/CD** — build webapp, then build platform shells from same artifact