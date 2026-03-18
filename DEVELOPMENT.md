# DEVELOPMENT.md — LifeOS Development Rules
> Version: 1.0 | Created: 2026-02-12
> ⚠️ THIS FILE MUST PERSIST THROUGH COMPACTION — it governs all LifeOS development.

## The Golden Rules

### 1. Never Break Production
- **`master` branch = production.** What's deployed. What users see.
- **`develop` branch = active work.** All new features go here first.
- **Feature branches** (`feature/xyz`) branch from `develop`, merge back to `develop`.
- **Only merge `develop` → `master` at major milestones**, after testing.

### 2. Database Migrations Are Sacred
- **NEVER** edit production tables directly in Supabase dashboard.
- **ALL schema changes** go through numbered migration files.
- **Migrations are ADDITIVE ONLY:**
  - ✅ ADD columns (with defaults so existing rows don't break)
  - ✅ ADD tables
  - ✅ ADD indexes, RLS policies
  - ❌ NEVER rename columns (breaks existing queries)
  - ❌ NEVER drop columns or tables (data loss)
  - ❌ NEVER change column types (breaks existing data)
- **If you must change a column:** add new column → migrate data → deprecate old (3-step)
- Migration files: `sql/migrations/NNN_description.sql` (NNN = sequential number)
- Each migration has a matching rollback: `sql/rollbacks/NNN_description.sql`

### 3. Feature Flags
- New features ship behind flags in `src/lib/feature-flags.ts`
- Default: OFF in production, ON in development
- Flip on when feature is tested and ready
- Existing users never see half-built features

### 4. Zero Data Loss
- Every deploy must preserve all existing user data
- Test migrations against a copy of prod data before applying
- Supabase RLS (Row Level Security) stays ON — users only see their own data
- No `DELETE FROM` or `TRUNCATE` in migrations. Ever.

### 5. Deploy Process
```bash
# From lifeos-app/
# 1. Build
npm run build

# 2. Deploy to AWS (both paths!)
scp -i ~/.ssh/your-key.pem -r dist/* YOUR_USER@YOUR_SERVER_IP:/tmp/lifeos-deploy/
ssh -i ~/.ssh/your-key.pem YOUR_USER@YOUR_SERVER_IP '
  sudo cp -r /tmp/lifeos-deploy/* /your/deploy/path/
  sudo cp -r /tmp/lifeos-deploy/* /your/deploy/path/
  rm -rf /tmp/lifeos-deploy
'

# 3. Verify
curl -s -o /dev/null -w "%{http_code}" https://app.runlifeos.com
```

### 6. Git Workflow
```
master ──────────────────────── (production, tagged releases)
  │
  └── develop ───────────────── (integration branch)
        │
        ├── feature/onboarding   (feature work)
        ├── feature/ai-chat
        └── fix/schedule-bug
```

**Commit messages:** Use conventional format:
- `feat:` new feature
- `fix:` bug fix  
- `schema:` database migration
- `deploy:` deployment-related
- `docs:` documentation

**Tags:** `v0.4.0`, `v0.5.0` etc. at each major milestone on master.

## Current State (as of 2026-02-12)

### Repos
| Repo | Branch | Purpose |
|------|--------|---------|
| `lifeos-app` | master/develop | Web app (Vite + React + TS + Supabase) |
| `lifeos` | master | Mobile app (Expo + React Native + Supabase) |
| `lifeos-website` | master | Landing page (static HTML) |

### Infrastructure
- **Supabase:** project `YOUR_PROJECT_REF` (prod)
- **AWS Lightsail:** YOUR_SERVER_IP (web hosting)
- **Domains:** runlifeos.com, lifeos.com.au, app.runlifeos.com
- **Users in prod:** 4 accounts
- **Tables:** 11 active

### Dual Deploy Paths (CRITICAL)
The web app is served from TWO paths on AWS:
- `/your/deploy/path/`
- `/your/deploy/path/`
**MUST deploy to BOTH** or users hit stale code.

## Migration Log
| # | Date | Description | Applied |
|---|------|-------------|---------|
| 001 | 2026-02-10 | Initial schema (23 tables) | ✅ |
| 002 | TBD | (next migration goes here) | |

## Pre-Deploy Checklist
- [ ] All tests pass locally
- [ ] Migration tested against staging/copy
- [ ] `develop` branch is clean, no WIP commits
- [ ] Build succeeds (`npm run build`)
- [ ] Deploy to BOTH AWS paths
- [ ] Verify app loads at app.runlifeos.com
- [ ] Check existing user data still intact
- [ ] Tag release on master (`git tag v0.X.0`)
- [ ] Update this migration log

## Emergency Rollback
If a deploy breaks something:
1. `git checkout master` (last known good)
2. `npm run build && deploy`
3. If DB migration broke: run matching rollback SQL
4. Notify the team immediately
