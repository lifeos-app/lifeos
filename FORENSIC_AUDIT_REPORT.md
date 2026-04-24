# LifeOS Forensic Audit Report

**Date:** 2026-04-24  
**Auditor:** Hermes Agent  
**Repository:** /mnt/data/tmp/lifeos  
**HEAD:** capacitor branch (13a5888)

---

## 1. BRANCH INVENTORY

### Local Branches
| Branch | Last Commit | Description |
|--------|-------------|-------------|
| **capacitor** (HEAD) | `13a5888` docs: git unification plan | Most recent, 37 commits ahead of electron. Contains ALL capacitor, Electron DB migration, Hermetic, Multifaith, P6 social/monetization features. v1.19.70 |
| **electron** | `3daf69e` feat: Electron DB migration | Same as origin/electron. Contains Electron DB changes (is_deleted + sync_status). v1.19.50-era |
| **main** | `51f4697` Merge branch autodev/w2 | Local-only branch with 293 autodev merge commits. Stale, essentially noise from automated merges. No meaningful unique code. |
| autodev/w1-20260411-183945 | `414262f` Merge branch | Autodev worker branch |
| autodev/w1-20260411-190845 | `b3e3b10` Merge branch | Autodev worker branch |
| autodev/w1-20260412-091345 | `55f655e` Merge branch | Autodev worker branch |
| autodev/w1-20260412-095545 | `0cb83cd` Merge branch | Autodev worker branch |
| autodev/w1-20260413-100545 | `72b38c3` Merge branch | Autodev worker branch |
| autodev/w1-20260413-102945 | `052f5c8` [w1] feat | Latest w1 autodev |
| autodev/w2-20260411-183945 | `323bcdb` | Autodev worker branch |
| autodev/w2-20260411-191445 | `3de803d` | Autodev worker branch |
| autodev/w2-20260412-090155 | `0904076` | Autodev worker branch |
| autodev/w2-20260412-093745 | `9eeeac0` | Autodev worker branch |
| autodev/w2-20260412-094945 | `58feed4` | Autodev worker branch |
| autodev/w2-20260413-102945 | `547d8a6` [w2] feat | Latest w2 autodev |
| autodev/w99-test | `cd4655e` [w99] style | Test branch |

### Remote Branches
| Branch | Last Commit | Description |
|--------|-------------|-------------|
| **origin/main** | `3009bf6` fix: electron-builder afterPack + package metadata | "Ancient" branch (109+ commits behind capacitor). Contains Electron desktop mode, Flask backend, Tauri fixes, Piano Academy integration, Digital Replicator. v1.19.20 |
| **origin/electron** | `3daf69e` feat: Electron DB migration | Points to same commit as local `electron`. Has is_deleted + sync_status columns |
| **origin/capacitor** | `13a5888` docs: git unification plan | Same as local capacitor HEAD |

### Key Finding
**capacitor and origin/electron are nearly identical** — only 1 file differs (docs/plans/2026-04-24-git-unification.md, added in capacitor). The electron DB migration commit (3daf69e) was already merged into capacitor. The unification plan document confirms this was intentional.

---

## 2. BUILD TARGETS

### Build Systems Present

| Target | Build Command | Output | Status |
|--------|--------------|--------|--------|
| **Vite Webapp** | `npm run dev` / `npm run build` | Static SPA in `dist/` | PRIMARY — default build |
| **Electron Desktop** | `npm run electron:dev` / `npm run electron:build` | AppImage/deb/dmg/nsis | WORKING — has release artifacts |
| **Capacitor Android** | `CAPACITOR_ENV=1 npm run build && npx cap sync && cd android && ./gradlew assembleDebug` | APK in android/app/build/outputs/ | WORKING — debug APK exists |
| **Tauri Desktop** | `npm run tauri dev` / `npm run tauri build` | Native binary via Rust | PRESENT but older — last worked on Mar 29 |
| **PWA** | `npm run build` (via vite-plugin-pwa) | Service worker + manifest | ACTIVE — sw.js, manifest.webmanifest |
| **Flask API** | `python backend/app.py` | localhost:8080 REST API | PRESENT — 74K lines, fallback for Tauri dev |

### package.json Scripts
```
dev              → vite (web dev server)
build            → vite build (web SPA)
build:desktop    → vite build --mode desktop
electron:dev     → ELECTRON_ENV=1 vite build --mode desktop && electron .
electron:build   → ELECTRON_ENV=1 vite build --mode desktop && electron-builder
electron:build:linux   → (+ --linux)
electron:build:win     → (+ --win)
electron:build:mac     → (+ --mac)
electron:build:arm64   → (+ --linux --arm64)
tauri            → tauri CLI
test             → vitest run
test:watch       → vitest
typecheck        → tsc -b
lint             → eslint .
postinstall      → electron-builder install-app-deps
```

### Vite Build Modes
- Default mode: webapp (no `__IS_*__` flags set)
- Desktop mode: `--mode desktop`, sets `__IS_ELECTRON__` via `ELECTRON_ENV=1`
- Capacitor mode: `CAPACITOR_ENV=1` sets `__IS_CAPACITOR__`
- Tauri mode: `TAURI_ENV_PLATFORM` sets `__IS_TAURI__`

### CI/CD
- `.github/workflows/build-android.yml` — Builds Android APK on push to `capacitor` branch

---

## 3. PLATFORM-SPECIFIC CODE

### electron/ Directory (6 files)
| File | Lines | Purpose |
|------|-------|---------|
| `main.js` | 526 | Electron main process: BrowserWindow, IPC handlers, OAuth popup, protocol registration (lifeos-media://) |
| `database.js` | 1039 | Native SQLite via better-sqlite3. Full CRUD, filter parsing, file operations. Mirrors Tauri lib.rs and Flask app.py. 37 ALLOWED_TABLES, soft-delete support, sync_meta. |
| `preload.cjs` | 58 | Context bridge exposing `window.electronAPI`: dbQuery, dbRpc, readFile, readMedia, listDirectory, getAcademyOverview, addXp, getLifeContext, getSteamStatus, getAppInfo, openAuthPopup |
| `schema.sql` | 738 | SQLite schema — 37 tables, indexes, triggers, full-text search. Electron/Tauri/Flask all use the same schema. |
| `rebuild.js` | 83 | electron-builder afterPack hook — rebuilds better-sqlite3 native .node binary for target arch |
| `steam.js` | 118 | Steamworks integration (x86_64 only). Graceful ARM64/Jetson fallback. DLC check, achievements, user info. |

### android/ Directory
- Full Capacitor Android project generated by `npx cap add android`
- Source: `android/app/src/main/java/app/lifeos/teddybot/MainActivity.java` (5 lines, just extends Capacitor BridgeActivity)
- Build: Gradle 8.x, AGP, SDK 34+
- Native libs: `libsqlcipher.so` (arm64-v8a, armeabi-v7a, x86, x86_64)
- Splash screens: landscape + portrait, hdpi through xxxhdpi
- APK: `android/app/build/outputs/apk/debug/app-debug.apk` (exists)

### src-tauri/ Directory (Tauri)
- **tauri.conf.json**: Window 1280x800, "LifeOS — Command Center", withGlobalTauri: true
- **Cargo.toml**: rusqlite (bundled SQLite), reqwest, tokio, chrono, rand, serde
- **src/lib.rs**: Rust backend — rusqlite Connection, AppState, LifeOsError types, db_query command
- **src/main.rs**: Standard Tauri entry
- **capabilities/default.json**: core:default, window:default, webview:default permissions
- **Build artifacts**: Cargo.lock, target/ directory present — Tauri was recently compiled

### capacitor.config.ts
```typescript
appId: 'app.lifeos.teddybot'
appName: 'LifeOS'
webDir: 'dist'
plugins.CapacitorSQLite:
  androidIsEncryption: false
  electronIsEncryption: false
  // + iOS/macOS/Windows paths defined
```

### Platform-Gating Patterns in src/
**13 platform-aware files** (out of 672 total .ts/.tsx files = 1.9%):

| Pattern | Files Using It | Purpose |
|---------|---------------|---------|
| `window.electronAPI` | App.tsx, Login.tsx, useUserStore.ts, electron-api.ts, ai-memory.ts, capacitor-api.ts, academy-data.ts, data-access.ts, electron.d.ts | Detect Electron runtime or use Electron IPC |
| `__IS_ELECTRON__` | App.tsx, data-access.ts, electron-api.ts, supabase.ts | Build-time Electron flag (Vite define) |
| `__IS_TAURI__` | App.tsx, data-access.ts, tauri-api.ts, supabase.ts | Build-time Tauri flag |
| `__IS_CAPACITOR__` | App.tsx, data-access.ts, capacitor-api.ts | Build-time Capacitor flag |
| `globalThis.Capacitor` | data-access.ts, capacitor-api.ts | Runtime Capacitor detection |
| `__TAURI_INTERNALS__` / `__TAURI__` | App.tsx, tauri-api.ts, data-access.ts | Runtime Tauri detection |
| `@capacitor-community/sqlite` | capacitor-db.ts, capacitor-api.ts | Capacitor SQLite plugin |
| `@tauri-apps/api` | tauri-api.ts, academy-data.ts, ai-local.ts | Tauri IPC invoke() |
| `import.meta.env` | 19 files | Feature flags, API URLs, mode detection |

**App.tsx router selection:**
- Desktop (Electron/Tauri/Capacitor) → `HashRouter`
- Web → `BrowserRouter`

---

## 4. SHARED CODE

### File Count
| Category | Count | % of Total |
|----------|-------|------------|
| **Total src/ files** (.ts/.tsx, not tests) | 659 | 100% |
| **Platform-agnostic** (no platform checks) | 646 | **98.1%** |
| **Platform-aware** (has platform checks) | 13 | 1.9% |
| **Platform-ONLY** (only works on one platform) | 6 | 0.9% |

### Platform-ONLY files (cannot work on other platforms):
1. `src/lib/capacitor-db.ts` — Requires @capacitor-community/sqlite (Android/iOS only)
2. `src/lib/capacitor-api.ts` — Capacitor-specific Supabase adapter
3. `src/lib/electron-api.ts` — Requires window.electronAPI (Electron only)
4. `src/electron.d.ts` — Type declarations for Electron window bridge
5. `src/lib/tauri-api.ts` — Tauri-specific (has HTTP fallback, so partially cross-platform)
6. `src/lib/db.ts` — Just re-exports from tauri-api (Tauri-specific shortcut)

### Shared Core (~98%)
All components, pages, stores, hooks, engines, and UI code are platform-agnostic. They import from `src/lib/data-access.ts` which auto-routes to the correct backend. The adapter pattern means the same component code works identically on web, Electron, Tauri, and Android.

---

## 5. ADAPTER PATTERN

### Architecture: Unified Data Access Layer
```
src/lib/data-access.ts  ← Central router (auto-detects environment)
  ├── src/lib/supabase.ts      → Supabase Cloud (web default)
  ├── src/lib/local-api.ts     → Flask HTTP API (localhost:8080/api)  
  ├── src/lib/tauri-api.ts     → Tauri invoke() → Rust → rusqlite
  ├── src/lib/electron-api.ts  → window.electronAPI → IPC → better-sqlite3
  └── src/lib/capacitor-api.ts → @capacitor-community/sqlite → on-device SQLite
```

### Detection Priority (in `getEnvironment()`):
1. `__IS_CAPACITOR__` (build-time) → capacitor
2. `globalThis.Capacitor.isNativePlatform()` (runtime) → capacitor
3. `__IS_ELECTRON__` (build-time) → electron
4. `window.electronAPI` (runtime) → electron
5. `__IS_TAURI__` (build-time) → tauri
6. `__TAURI_INTERNALS__` / `__TAURI__` (runtime) → tauri
7. `VITE_USE_LOCAL_API=true` → local-api
8. `VITE_API_BASE_URL` set → local-api
9. Default → supabase

### Adapter Interface
All 5 adapters expose the same Supabase-compatible chainable interface:
```typescript
db.from('table').select('*').eq('id', 1).single()
db.from('table').insert({...}).select()
db.from('table').update({...}).eq('id', 1)
db.from('table').delete().eq('id', 1)
db.from('table').upsert({...}, { onConflict: 'id' })
db.rpc('function_name', params)
db.auth.getUser() / getSession() / signIn / signOut
```

### DB Backend Details
| Backend | SQLite Engine | Location | Auth Mode |
|---------|--------------|----------|-----------|
| Supabase | PostgreSQL (cloud) | Remote | Full OAuth + email |
| Flask API | Python sqlite3 | backend/lifeos.db | Local JWT |
| Tauri | rusqlite (bundled) | ~/.lifeos/data.db | Single-user local |
| Electron | better-sqlite3 | ~/.lifeos/data.db (Linux) / userData (Win/Mac) | Single-user local + Google OAuth popup |
| Capacitor | @capacitor-community/sqlite + sqlcipher | On-device app data | Single-user local |

### Offline Support
- Web: IndexedDB via `src/lib/local-db.ts` (mirrors all Supabase tables)
- Electron/Tauri/Android: Native SQLite (always available)
- Sync engine: `src/lib/sync-engine.ts` handles reconnection + push on reconnect

---

## 6. UNIQUE FEATURES PER BRANCH

### capacitor branch ONLY (not in main):
**145 new files** including entire feature subsystems:
- **Hermetic Integration**: hermetic-integration.ts, hermetic-principle-insight.ts, hermetic-polarity.ts, hermetic-gender-balance.ts, HermeticPrincipleBar, HermeticPrincipleOverlay, DailyHermeticAffirmation, HolyHermesOracle
- **Multifaith Wisdom Layer**: multifaith-wisdom.ts, wisdom-map.json, prayer-times, junction-recommender, usePrayerTimes, useSacredSchedule
- **Social Features**: LeaderboardTab, ShareCard, GuildsTab, social/ groups+messaging+partner-goals+profiles
- **Stripe Monetization**: stripe-client.ts, feature-gates.ts, feature-registry.ts, useSubscription
- **Proactive Suggestions**: proactive-suggestions.ts, ProactiveSuggestions component
- **Dashboard Enhancements**: DashboardDailyProgress, DashboardFinancialPulse, DashboardHeatmap, DashboardScheduleInsights, DashboardStreakMomentum, DashboardWeeklyInsight, EnergyWave, SageWidget, ChallengeCard, DailyRewardToast
- **Schedule Upgrades**: ScheduleBoardView, ScheduleDayView, ScheduleTimeline, useScheduleDragHandlers
- **TCS Business Suite**: 12+ components (BusinessHealthScore, ContractStatusCards, DailyCheckin, InvoiceTracker, JobCompleteButton, KMLogger, MonthlyRevenueCard, QuickInvoiceButton, RouteOptimizerIndicator, TCSDrivingWidget, TCSGrowthOverview, TCSTodayCard, VehicleLogbook)
- **Intent Engine**: Full AI intent system (action-executor, context-loader, goal-plan-executor, grocery-actions, health-actions, shorthand-parser, system-prompt)
- **Pattern Engine**: pattern-engine.ts, correlation-engine.ts
- **Error Recovery**: AppErrorBoundary, AsyncErrorToast, ChunkLoadErrorBoundary, CrashRecoveryBanner
- **Realm Onboarding**: TutorialQuest
- **Capacitor Adapters**: capacitor-api.ts, capacitor-db.ts
- **Android Build**: Full android/ project, build-android.sh, CI workflow
- **Test Coverage**: 5 test files + extended coverage (316 tests)
- **Unification Plan**: docs/plans/2026-04-24-git-unification.md

### main branch ONLY (not in capacitor):
**33 new files** — mostly test files and Command Center:
- **Command Center**: CommandCenter.tsx, ClaudeSessions.tsx, FederationStatus.tsx, ServiceCard.tsx, SystemMetrics.tsx, ServiceEmbed.tsx, CommandCenterSkeleton
- **Extra Tests**: useAcademyStore, useAgentStore, useAssetsStore, useCharacterAppearanceStore, useCommandCenterStore, useFinanceStore, useHealthStore, useInventoryStore, useJournalStore, useLessonsStore, useLiveActivityStore, useUserStore tests
- **GoalCard component**: GoalCard.tsx
- **Adapters**: paperclip.ts, tribewizard.ts (systems adapters)
- **Misc**: cache-constants.ts, database.test.ts, quest-engine-v2.test.ts

### origin/electron: 
Identical to capacitor minus the unification plan document. No unique features.

### origin/main:
- **Flask Backend**: backend/app.py (74K lines, fully featured REST API)
- **Older Electron setup**: Uses `preload.js` (not `.cjs`), no `rebuild.js`, simpler electron-builder config
- **NO Capacitor deps**: No @capacitor packages in package.json
- **Steam integration**: steamworks.js present (x86_64 only)
- **Tauri**: Full src-tauri setup with Rust SQLite backend
- **PWA**: public/sw.js, manifest files
- **Piano Academy**: Integrated via IPC
- **Digital Replicator**: Parts inventory manager
- **v1.19.20** — significantly behind capacitor's v1.19.70

---

## 7. DEPENDENCY AUDIT

### Platform-Specific Dependencies

| Dependency | Platform | In capacitor | In origin/main | Notes |
|-----------|----------|-------------|----------------|-------|
| `@capacitor-community/sqlite` | Android/iOS ONLY | YES | NO | Capacitor SQLite plugin, uses sqlcipher |
| `@capacitor/android` | Android ONLY | YES | NO | Android native runtime |
| `@capacitor/cli` | Android/iOS build | YES | NO | Build tool |
| `@capacitor/core` | Android/iOS runtime | YES | NO | Core Capacitor runtime |
| `better-sqlite3` | Electron ONLY | YES | YES | Native Node.js SQLite binding |
| `electron` | Electron ONLY | YES | YES | Desktop runtime (v41.1.0) |
| `electron-builder` | Electron build | YES | YES | Packaging |
| `@electron/rebuild` | Electron build | YES | YES | Native module rebuild |
| `steamworks.js` | Electron x86_64 | YES | YES | Steam SDK (NOT ARM64 compatible) |
| `@tauri-apps/api` | Tauri runtime | YES | YES | Tauri IPC |
| `@tauri-apps/plugin-shell` | Tauri plugin | YES | YES | Shell access |
| `@tauri-apps/cli` | Tauri build (devDep) | YES | YES | Build tool |
| `@supabase/supabase-js` | Web/cloud | YES | YES | Primary web DB backend |
| `vite-plugin-pwa` | Web PWA | YES | NO (missing from origin/main) | Service worker generation |
| `sharp` | Image processing | YES | NO | Asset optimization |

### Dependency Concerns
- **ALL platform deps are in the SAME package.json**: Electron, Capacitor, and Tauri deps coexist. This means `npm install` on any platform pulls ALL deps regardless of target.
- `steamworks.js` will fail on ARM64 — has graceful fallback
- `better-sqlite3` requires native compilation — `postinstall` runs `electron-builder install-app-deps`
- Capacitor deps only needed when `CAPACITOR_ENV=1` — but always installed

---

## 8. ENTRY POINTS

### Ways to Start LifeOS

| # | Entry Point | Platform | How |
|---|------------|----------|-----|
| 1 | `src/main.tsx` → React root | Web | `npm run dev` (Vite on :5173) |
| 2 | `index.html` → loads main.tsx | Web (built) | `npm run build && npm run preview` |
| 3 | `electron/main.js` | Electron | `npm run electron:dev` |
| 4 | `src-tauri/src/main.rs` | Tauri | `npm run tauri dev` |
| 5 | `android/.../MainActivity.java` | Android | `npx cap sync && ./gradlew assembleDebug` |
| 6 | `backend/app.py` | Flask API | `python backend/run.py` (standalone server) |
| 7 | **PWA Service Worker** | Web (installed) | Browser installs from manifest.webmanifest |

### Renderer Entry (shared by all platforms):
- `index.html` → `<div id="root">` → `src/main.tsx` → `App.tsx`
- App.tsx detects platform at runtime and selects HashRouter (desktop) or BrowserRouter (web)
- `src/main.tsx` initializes: error handlers, local DB, sync engine, service worker, deferred fonts, route prefetching

### Electron Entry Flow:
```
electron/main.js
  → creates BrowserWindow
  → loads dist/index.html
  → preload.cjs injects window.electronAPI
  → React detects electronAPI → routes data-access to electron-api.ts
  → electron-api.ts → IPC → electron/database.js → better-sqlite3
```

### Capacitor Entry Flow:
```
Android Activity → WebView loads dist/index.html
  → Capacitor runtime injects globalThis.Capacitor
  → React detects Capacitor → data-access routes to capacitor-api.ts
  → capacitor-api.ts → capacitor-db.ts → @capacitor-community/sqlite
```

### Tauri Entry Flow:
```
src-tauri/src/main.rs → creates Tauri window → loads dist/index.html
  → __TAURI__ injected → data-access routes to tauri-api.ts
  → tauri-api.ts → invoke() → src-tauri/src/lib.rs → rusqlite
```

---

## 9. DEAD CODE / ORPHAN FILES

### Truly Orphaned Files (not imported anywhere)
**TypeScript/TSX (13 files):**
1. `src/lib/ai-onboarding-chat.ts` — Old AI chat onboarding, likely superseded by intent engine
2. `src/lib/ai-local.ts` — Uses `@tauri-apps/api` imports but not imported
3. `src/lib/data-seed.ts` — DB seeding utility, not imported
4. `src/lib/gamification/gamification-db.ts` — Old gamification DB, replaced by gamification/xp-engine
5. `src/lib/npc-friendship.ts` — NPC friendship system, not wired up
6. `src/lib/llm/context-builder.ts` — LLM context builder, not imported
7. `src/lib/llm-providers.ts` — LLM provider config, not imported
8. `src/lib/stripe-client.ts` — Stripe client, not directly imported (feature-gates.ts is used instead)
9. `src/realm/bridge/RealmPersistence.ts` — Realm persistence, not wired
10. `src/realm/bridge/useRealmEvents.ts` — Realm events hook, not wired
11. `src/hooks/useDebounce.ts` — Utility hook, no consumers
12. `src/hooks/useData.ts` — Old data hook, replaced by store pattern
13. `src/hooks/useNetworkStatus.ts` — Network status, no consumers

**Orphaned TSX Components (13 files):**
1. `src/realm/onboarding/OnboardingCanvas.tsx`
2. `src/components/SwipeActions.tsx`
3. `src/components/PhaseForm.tsx`
4. `src/components/PullToRefresh.tsx`
5. `src/components/setup/SetupCanvas.tsx`
6. `src/components/plugins/PluginSettings.tsx`
7. `src/components/ui/LazyImage.tsx`
8. `src/components/dashboard/EnergyWave.tsx`
9. `src/components/dashboard/quick-actions/QuickLogMood.tsx`
10. `src/components/HermeticInsightWidget.tsx`
11. `src/components/ChatWidget.tsx`
12. `src/components/PhaseChat.tsx`
13. `src/components/llm/ActionConfirmCard.tsx`

### Legacy/Abandoned Files
- `src/lib/db.ts` — Just re-exports tauri-api. Superseded by data-access.ts
- `electron/preload.js` (on origin/main) — Replaced by `preload.cjs` (on capacitor)
- `backend/app.py` — 74K lines Flask backend, still referenced by local-api.ts as HTTP fallback. Not dead but Tauri/Electron bypass it.
- `backend/lifeos.db` — 408KB SQLite database in repo (should be .gitignored)
- `release/` directory — Contains built AppImage and .deb files (v1.19.20), should not be in repo
- `.autodev/` — Removed in capacitor branch but may exist on older branches
- Multiple `autodev/*` branches — 10+ autodev worker branches, noise from automated development

### Shell Scripts (may be dead)
- `adb-pendo.sh` — ADB commands for a "Pendo" device (Android hotspot setup)
- `setup-pendo-hotspot.sh` — Same
- `electron-launch.sh` — Alternative Electron launch script
- `start-jetson.sh` / `start-jetson-electron.sh` — NVIDIA Jetson deployment scripts
- `start-local.sh` — Local Flask API start
- `build-android.sh` — Manual Android build script (superseded by CI workflow)

---

## 10. SUMMARY TABLE

Features present on each branch (Y = present, P = partial, N = absent, - = not applicable)

| Feature / System | capacitor | electron | main (local) | origin/main |
|-----------------|-----------|----------|-------------|-------------|
| **Vite Webapp Build** | Y | Y | Y | Y |
| **Electron Desktop** | Y | Y | Y | Y |
| **Capacitor Android** | Y | Y | N | N |
| **Tauri Desktop** | Y | Y | Y | Y |
| **PWA Support** | Y | Y | Y | P |
| **Flask Backend** | Y | Y | Y | Y |
| **Supabase Cloud** | Y | Y | Y | Y |
| **Unified Data Access** | Y | Y | P | P |
| **Capacitor SQLite Adapter** | Y | N | N | N |
| **Electron SQLite Adapter** | Y | Y | P | P |
| **Tauri Rusqlite Adapter** | Y | Y | Y | Y |
| **Hermetic Integration** | Y | Y | N | N |
| **Multifaith Wisdom Layer** | Y | Y | N | N |
| **Social: Leaderboards** | Y | Y | N | N |
| **Social: Guilds** | Y | Y | N | N |
| **Social: Share Cards** | Y | Y | N | N |
| **Stripe Monetization** | Y | Y | N | N |
| **Feature Gating** | Y | Y | N | N |
| **TCS Business Suite** | Y | Y | N | N |
| **Intent Engine (AI)** | Y | Y | N | N |
| **Pattern Engine** | Y | Y | N | N |
| **Proactive Suggestions** | Y | Y | N | N |
| **Steam Integration** | Y | Y | Y | Y |
| **RPG/Character System** | Y | Y | Y | Y |
| **Living Garden** | Y | Y | Y | Y |
| **Music Engine** | Y | Y | Y | Y |
| **Realm (RPG World)** | Y | Y | Y | Y |
| **Command Center** | N | N | Y | Y |
| **Offline Sync (IndexedDB)** | Y | Y | Y | P |
| **Test Suite (316 tests)** | Y | Y | Y | P |
| **CI/CD (Android APK)** | Y | Y | N | N |
| **Git Unification Plan** | Y | N | N | N |
| **Command Center** | N | N | Y | P |
| **Digital Replicator** | Y | Y | Y | Y |
| **Piano Academy** | Y | Y | Y | Y |
| **Telegram Parity** | Y | Y | N | N |
| **Predictive Scheduling** | Y | Y | N | N |
| **Quest Onboarding** | Y | Y | N | N |

---

## Key Findings & Recommendations

### Architecture
1. **98% shared code** — The adapter pattern is working well. All business logic is platform-agnostic.
2. **capacitor ≈ electron** — They're essentially the same branch now (1 file diff). The unification plan is already executed.
3. **origin/main is stale** — 109+ commits behind, missing massive feature additions. Should be reset to capacitor content.
4. **main (local) is noise** — 293 autodev merge commits with no unique value. Should be abandoned.

### Problems
1. **Monolithic package.json** — All platform deps (Electron, Capacitor, Tauri, Steam) in one file. `npm install` on Android dev pulls Electron; `npm install` on web pulls better-sqlite3. Should consider workspace separation.
2. **Build artifacts in repo** — `release/` has AppImages and .deb files. `backend/lifeos.db` is a 408KB SQLite database. `android/app/build/` has full gradle build cache. Should be gitignored.
3. **13 orphan files** — Dead code consuming maintenance burden.
4. **10+ autodev branches** — Automated worker branches cluttering branch list.
5. **db.ts shortcut** — `src/lib/db.ts` just re-exports tauri-api. Confusing alongside data-access.ts.
6. **Flask backend (74K lines)** — Massive file, likely unmaintained in favor of Electron/Tauri native backends.