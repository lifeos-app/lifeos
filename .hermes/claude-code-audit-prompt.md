# LifeOS Electron Branch — Full Assessment & Fix Recommendations

You are doing a comprehensive assessment of the LifeOS Electron branch and proposing prioritized fixes. The app is at v1.19.39 on the `electron` branch at `/mnt/data/tmp/lifeos/`.

## Current State

- **Branch:** electron (YOUR branch, all work stays here)
- **Version:** 1.19.39
- **Completion:** 25/66 = 37.9% on the improvement checklist
- **Source:** 629 TSX/TS files, ~148K lines
- **Platform:** Electron 41 on Jetson Orin Nano (ARM64, 7.6GB RAM, no standard GPU)
- **Recent pace:** 25 items done over 2 days — rapid but quality needs verification

## What To Do

### Phase 1: Deep Code Audit (READ everything, don't change anything yet)

Read these files in order and assess quality, bugs, and gaps:

1. **Core Electron integration** — `electron/main.js`, `electron/preload.js`, `electron/preload.cjs`, `electron.d.ts`
   - GPU crash handling (Jetson ARM specific flags)
   - OAuth flow (local callback server on port 32123)
   - setWindowOpenHandler for auth popup
   - IPC channel completeness

2. **Auth & Onboarding** — `src/stores/useUserStore.ts`, `src/components/WelcomeWizard.tsx`
   - Does OAuth actually work end-to-end on Electron?
   - Does onboarding gracefully handle LLM timeout?
   - Does initAuth handle both local and synced modes?

3. **State Stores** — ALL files in `src/stores/`
   - Check for: direct Supabase calls that bypass local-db (the dual-write bug pattern)
   - Check for: missing null safety on selectors (React #185 pattern)
   - Check for: Zustand store initialization order issues

4. **Sync Engine** — `src/lib/sync-engine.ts`
   - Race conditions in multi-tab sync (BroadcastChannel)
   - Field-level merge correctness
   - Error recovery and retry logic

5. **God Components Still Remaining** — Check file sizes:
   - `src/data/release-notes.ts` (1673 lines)
   - `src/lib/materialize.ts` (1443 lines)
   - `src/lib/gamification/achievements.ts` (1360 lines)
   - `src/realm/onboarding/OnboardingQuest.tsx` (1149 lines)
   - `src/realm/renderer/GardenRenderer.ts` (1137 lines)
   - `src/lib/sync-engine.ts` (1107 lines)
   - `src/components/NodeDetail.tsx` (985 lines)

6. **Critical Bugs** — Check for:
   - React #185 errors in console (store init during render)
   - Service worker errors in Electron (expected but harmless — verify)
   - FinancialPulse widget errors in local mode
   - Any `useStore` without null-safe selectors
   - Hardcoded URLs or keys that should not be committed

7. **Build Health** — Run `npm run typecheck` and assess error count. Run `npm run build` and check for warnings.

8. **Checklist Gaps** — Read `.hermes/improvement-checklist.md` and assess which P3-P5 items have stubs vs real implementations vs nothing. Specifically check these MISSING items that are vision-critical:
   - P3-001: AI action execution (can ZeroClaw actually CRUD data?)
   - P3-002: Persistent AI memory across sessions
   - P3-003: Proactive AI suggestions system
   - P3-006: Data seeding (is onboarding still empty-feeling?)
   - P3-007: Junction depth (10 thin traditions → real depth?)
   - TD-009: Test coverage (0.8% — what critical paths have ZERO tests?)

### Phase 2: Write the Assessment

Create a markdown file at `.hermes/electron-audit-2026-04-21.md` with these sections:

```markdown
# LifeOS Electron Branch Audit — April 21, 2026

## Executive Summary
[2-3 sentences: overall health, biggest risks, recommended immediate actions]

## Build & Runtime Health
- TypeScript errors: N
- Build warnings: N
- Runtime console errors: [list]
- App startup time: [measure if possible]
- Bundle size: [check dist/]

## Critical Bugs (must fix before any feature work)
[Priority-sorted list of actual bugs found]

## Architecture Issues
[Things that work but will break at scale or under real usage]

## Security Concerns
[Hardcoded keys, exposed secrets, RLS gaps, etc.]

## Checklist Assessment (honest scoring)
[For each P1-P5 item, rate what's ACTUALLY there vs what the checklist claims]

## Top 10 Recommended Fixes (ranked by impact)
[Number 1-10, each with: what, why, estimated effort, files to change]

## Test Coverage Plan
[Which 5-10 tests would give the most coverage lift]

## Technical Debt Scorecard
[TD-001 through TD-010, honest current status]
```

### Phase 3: Quick Fixes

After the assessment, PICK THE TOP 3 highest-impact, lowest-effort fixes and implement them. For each:
- Make the change
- Verify with `npm run typecheck`
- Commit with proper message
- Push to origin/electron

Focus on things that are broken or dangerous, NOT nice-to-haves. Examples of high-impact quick fixes:
- Null safety on store selectors that crash in local mode
- Removing direct Supabase dual-writes that were missed in P1-002
- Fixing React #185-prone patterns
- Closing security gaps (exposed keys, missing RLS)

### Rules
1. Stay on the `electron` branch — never touch main or develop
2. Read CLAUDE.md and DESIGN-RULES.md before any code changes
3. Bump version in package.json before each push
4. After each commit: `git push origin electron`
5. Don't add new dependencies without checking if alternatives exist
6. The app runs on Jetson ARM with no GPU — never assume GPU features work
7. Test coverage is 0.8% — don't worry about adding tests in this session, focus on bugs
8. The checklist claims 37.9% completion — be skeptical and verify what's actually working