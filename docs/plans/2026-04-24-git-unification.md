# LifeOS Git Unification Plan — Electron + Webapp = One Forward Path

## Current State (Problem)

```
origin/main ............... ancient, 109 commits behind
origin/electron ........... v1.19.50, stale since P6-001
main (local) .............. 293 unpushed autodev merges (noise)
electron (local) .......... v1.19.50, same as origin/electron
capacitor (current) ....... v1.19.70, 37 commits ahead of electron, ALL real work
```

Working directory has 3 uncommitted Electron DB changes.

## Goal

**One codebase, two build targets:**
- `npm run build` → webapp (Vite static, deploy anywhere)
- `npm run electron` → desktop app (SQLite, local-first)
- Same `src/` code, same components, same wisdom-map.json
- Electron-specific code lives in `electron/` only
- Feature flags or `import.meta.env` gates any Electron-only features

## Step-by-Step

### 1. Commit the uncommitted Electron DB changes
```bash
cd /mnt/data/tmp/lifeos
git add electron/database.js electron/schema.sql src/lib/capacitor-db.ts
git commit -m "feat: Electron DB migration — is_deleted + sync_status columns for local-first sync"
```

### 2. Merge capacitor into electron (bring electron up to date)
```bash
git checkout electron
git merge capacitor --no-edit
# Resolve any conflicts (unlikely — capacitor is 37 commits purely ahead)
```

This gives electron branch ALL the Hermetic + Multifaith + P6 features.

### 3. Make capacitor the new main
The `main` branch is polluted with 293 autodev merge commits. Rather than clean it:
```bash
# Force-push capacitor as the new origin/main (after backing up)
git push origin capacitor:main --force-with-lease
# Or: create a clean squashed version
```

**Alternative (safer):** Keep capacitor as the daily-driver branch, push it to origin:
```bash
git push origin capacitor
# So origin/capacitor exists as a backup
```

### 4. Establish the forward rule
From this point forward:
- `capacitor` is THE development branch (rename to `develop` later?)
- All new work merges into capacitor
- `electron` tracks capacitor — periodic merges, NOT a separate path
- `main` = stable releases, tagged versions
- Webapp and Electron both build from `capacitor`

### 5. Fix the build targets
```
package.json scripts:
  "dev"          → vite dev (webapp)
  "dev:electron" → electron . (desktop)
  "build"        → vite build (webapp static)
  "build:electron" → electron-builder (desktop binary)
```

Both targets consume the SAME src/ directory. Electron-specific code is:
- `electron/` directory (main process, DB, IPC)
- `src/lib/capacitor-db.ts` (SQLite adapter, gated by platform)
- Feature detection: `window.electronAPI` or `import.meta.env.VITE_PLATFORM`

### 6. Push and verify
```bash
git push origin capacitor
git push origin electron
# Verify both branches are in sync:
git log --oneline capacitor..electron  # should be empty
git log --oneline electron..capacitor  # should be empty
```

### 7. Deploy webapp
```bash
npm run build  # outputs to dist/
# Deploy dist/ to Vercel/Netlify/Cloudflare
```

### 8. Deploy Electron
```bash
npm run build:electron  # outputs to release/
# Distribute .AppImage / .dmg / .exe
```

## Architecture That Makes This Work

```
src/
  lib/
    wisdom-map.json .......... identical in both builds
    multifaith-wisdom.ts ..... identical
    hermetic-integration.ts .. identical
    pattern-engine.ts ........ identical
    capacitor-db.ts .......... Electron adapter (gated by platform)
    supabase.ts .............. Webapp adapter (gated by platform)
  components/ ................ identical
  pages/ ..................... identical
  stores/ .................... identical (local-first, either DB backend)

electron/
  main.js .................... Electron main process
  database.js ................ SQLite adapter
  schema.sql ................. Local DB schema
  preload.js ................. IPC bridge

vite.config.ts ............... Web build
electron-builder.json ........ Desktop build
```

The key insight: **local-first architecture already makes this work.**
All stores use the same interface. The only difference is WHICH database
adapter loads — SQLite via Electron IPC, or Supabase via HTTP.
The wisdom-map, Hermetic engines, and multifaith rotation
are 100% platform-agnostic.

## Immediate Next Steps

1. Commit 3 uncommitted files
2. Merge capacitor into electron
3. Push both branches
4. Verify Electron builds from the merged state
5. Deploy webapp to Vercel

This should take one session.