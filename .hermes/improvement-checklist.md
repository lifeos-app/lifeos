# LifeOS Perpetual Improvement Checklist

## Meta
- **Project:** LifeOS — The Operating System for Human Life
- **Repo:** /mnt/data/tmp/lifeos/
- **Branch:** electron
- **Baseline Version:** 1.19.27
- **Current Version:** 1.19.58
- **Baseline Date:** 2026-04-20
- **Last Audit:** 2026-04-23
- **Completion:** 51/68 = 75.0%

## Vision Documents (Source of Truth)
1. `/home/tewedros/Desktop/webapp/docs/vision/VISION.md` — "LifeOS IS an AI that has an app as its interface"
2. `/home/tewedros/Desktop/webapp/docs/vision/VISION-v2.md` — "Palantir for your personal world"
3. `/home/tewedros/Desktop/webapp/docs/vision/VISION-v2-ori.md` — Brutal audit, 10 Commandments, Phase 1-3 plan
4. `/home/tewedros/Desktop/webapp/docs/vision/WORLD-CLASS-ROADMAP.md` — 6-month plan, Realm gaps
5. `/home/tewedros/Desktop/webapp/docs/vision/LIFEOS-ROADMAP.md` — Competitive analysis, monetization
6. `/home/tewedros/Desktop/webapp/docs/vision/MASTER_BUILD_PLAN.md` — Telegram parity, RPG overlay

## Supporting Docs
- `/home/tewedros/Desktop/webapp/CLAUDE.md` — Coding rules, git workflow
- `/home/tewedros/Desktop/webapp/DESIGN-RULES.md` — No emoji, fullscreen overlay rules
- `/home/tewedros/Desktop/webapp/docs/specs/LIVING-REALM-SPEC.md` — Detailed Realm spec

---

## Priority 1: BROKEN (Fix before anything else)

- [x] [P1-001] Onboarding flow is fragile — ✅ DONE — Commit: fd523c3 — Date: 2026-04-20 — 15s LLM timeout, smart template fallback (8 domains with personalized goals), progress screen, no more generic goals
- [x] [P1-006] OAuth sign-in opens 3 spurious windows — ✅ DONE — Commit: 7356342 — Date: 2026-04-20 — setWindowOpenHandler on main window + auth popup, consolidated event listeners, fixed timeout/closed race conditions
- [x] [P1-002] Financial data model is dual-table — ✅ DONE — Commit: 9fc7913 — Date: 2026-04-21 — All income/expense writes now go through useFinanceStore.addIncome/addExpense(), which creates both tables via localInsert. Eliminated 12 direct Supabase dual-write sites across 8 files.
- [x] [P1-003] Multi-tab sync race conditions — ✅ DONE — Commit: (prior session) — Date: 2026-04-21 — BroadcastChannel leader election + field-level merge in localBulkUpsert + leader-only sync + lifeos-refresh event on invalidation.
- [x] [P1-004] Assets/gamification bypass offline-first — ✅ DONE — Commit: (prior session) — Date: 2026-04-21 — Migrated useAssetsStore and gamification queries to local-db pattern.
- [x] [P1-005] Sleep tracking as easy as journaling — SleepQuickLog dashboard widget with one-tap bedtime/wake logging — DONE 2026-04-20 — Morning/active/evening/night mode priorities. Widget ID: sleep-quick-log.

## Priority 2: FOUNDATION (Architecture blocking progress)

- [x] [P2-001] Schedule.tsx god component — ✅ DONE — Commit: 8145fbc — Date: 2026-04-20 — 2051→229 lines. Split into ScheduleDayView + ScheduleTimeline + ScheduleBoardView + useScheduleDragHandlers + useScheduleEffects + useScheduleTimelineData
- [x] [P2-002] Goals.tsx god component — ✅ DONE — Commit: 566ec24 — Date: 2026-04-20 — 1827→300 lines. Split into GoalsForm, GoalsFilterBar, useGoalsEffects, useGoalsActions
- [x] [P2-003] Intent Engine monolith — ✅ DONE — Commit: 0402d50 — Date: 2026-04-20 — 2324→25 lines re-export + 12 focused modules in src/lib/intent/
- [x] [P2-004] Error handling inconsistent — ✅ DONE — Commit: b1b1dab — Date: 2026-04-20 — Created src/lib/error-handler.ts: classifyError, handleError, handleErrorWithRetry, useErrorHandler hook (6 categories)
- [x] [P2-005] Loading states incomplete — ✅ DONE — Commit: 8a02d66 — Date: 2026-04-20 — Shimmer component + all 16 skeletons wrapped + CharacterHub/Finances use proper skeletons
- [x] [P2-006] Test coverage thin — ✅ DONE — Commit: b208d73 — Date: 2026-04-22 — 5→8 test files, 41→150 tests. Added pattern-engine.test.ts (29 tests), error-handler.test.ts (34 tests), xp-engine.test.ts (46 tests). All pure function tests with proper mocking.

## Priority 3: VISION-CRITICAL (Features that ARE the product)

- [x] [P3-001] AI IS the OS, not a chatbot — ✅ DONE — Date: 2026-04-21 — executeIntent() now wires 6 core intents to real store operations: habit_log→useHabitsStore, health_log/mood→localDB+useHealthStore, journal→useJournalStore, income→useFinanceStore, expense→useFinanceStore, event→useScheduleStore. Returns {success, message}. AIChat shows green toasts on action execution. Intent engine is ALIVE.
- [x] [P3-002] AI remembers permanently — ✅ DONE — Date: 2026-04-21 — ai-memory.ts persistence layer + ai_conversations SQLite table + ChatHeader conversation history dropdown + debounced auto-save + title generation from first message
- [x] [P3-003] AI anticipates proactively — ✅ DONE — Date: 2026-04-21 — proactive-suggestions.ts with 5 generators (schedule_reminder, habit_nudge, health_warning, goal_progress, streak_at_risk). ProactiveSuggestions widget on Dashboard with action buttons wired to intent engine. Rate limited to 3/session, 4h cooldown on dismiss.
- [x] [P3-004] Cross-domain data fusion — ✅ DONE — Commit: 939ea64 — Date: 2026-04-20 — correlation-engine.ts with Pearson correlation across 5 domains, integrated into AI context builder
- [x] [P3-005] Pattern Engine — ✅ DONE — Commit: 501d35a — Date: 2026-04-20 — Created src/lib/pattern-engine.ts (286 lines): 7 detectors (productivity_peak, energy_cycle, habit_anchor, goal_neglect, spending_spike, streak_risk, optimal_schedule)
- [x] [P3-006] Pre-populated intelligence — ✅ DONE — Commit: b208d73 — Date: 2026-04-22 — data-seed.ts (575 lines): seedInitialData() creates 6 habits, 3 goals, schedule scaffolding, 3 expense categories based on onboarding answers. Idempotent via localStorage marker. Offline-first via localInsert.
- [x] [P3-007] Junction as game library — 🔨 DONE — Commit: b208d73 — Date: 2026-04-22 — Expanded from 10 thin traditions to 18 rich Junctions (added 8 secular: The Game, Iron Protocol, The Grind, Clean Slate, Brain Forge, Gut Check, Monk Mode, Stack Overflow). 6 new tradition categories. JUNCTION_QUEST_TIERS with 24 tiers and ~78 quests. Updated TraditionSelector and SwitchJunctionModal to use CATEGORY_TABS.
- [x] [P3-008] Junction AI Recommender — ✅ DONE — Commit: 5336af5 — Date: 2026-04-22 — junction-recommender.ts scores 18 Junctions against user profile (focus, occupation, preferences, habits). HermesRecommendsPanel on Junction page shows top 3 with reasoning and Why This? tooltip.

## Priority 4: ENGAGEMENT (Retention and daily use)

- [x] [P4-001] Daily reward system — ✅ DONE — Date: 2026-04-21 — daily-rewards.ts with escalating XP tiers (10→20→30→50→80→120→200), streak calculation, DailyRewardToast component with fire animation for 7+ streaks, auto-dismiss, claim once/day, wired to xp-engine
- [x] [P4-002] Challenge system — ✅ DONE — Date: 2026-04-21 — challenges.ts with weekly pool (4 challenges: journal/habit/mood/expense), monthly mega-challenge (30 check-ins=1000XP), progress tracking, Claim button wired to xp-engine, ChallengeCard component on Dashboard
- [x] [P4-003] Smart notifications — ✅ DONE — v1.19.51 — Adaptive cooldown system: 4h→24h→48h based on dismiss count. acceptSuggestion() signals positive reception. CooldownEntry tracks {at, count}. Migrates old format automatically.
- [x] [P4-004] Quick actions everywhere — ✅ DONE — v1.19.51 — Added Log Mood (inline 1-tap emoji row, no sheet), Log Water (+1 glass counter with current count shown), Focus Block (creates 25-min task + starts live timer in 1 tap). All 3 fire with zero navigation.
- [x] [P4-005] Progress visualization — ✅ DONE — v1.19.51 — DashboardHeatmap.tsx: GitHub-style 26-week activity grid. Tasks done + habit logs + journal entries combined. Colour scale #1A4A2E→#39FF14. Fixed-position tooltip. Legend. Shown in Dashboard secondary column.
- [x] [P4-006] Time-adaptive Dashboard — ✅ DONE — Commit: 6587fcd — Date: 2026-04-20 — Morning/active/evening/night modes with widget prioritization, mode badge, accent colors, dashboard-modes.ts + useDashboardMode.ts

## Priority 5: DEPTH (Richness and completeness)

- [x] [P5-001] Living Garden species-aware — ✅ v1.19.59 — All 10 habit categories have distinct Canvas renderers: Lotus (wellness), Oak (fitness), Olive (learning), MoneyTree (finance), Cedar (spiritual), Bamboo (productivity), CherryBlossom (creative), Sunflower (social), NeemTree (health), Fern (other). 32 species in flora data, 6 growth stages + dormancy, sprite sheet fallback, Ancient golden aura.
- [x] [P5-002] Companion system — ✅ v1.19.59 — 24 species across 8 categories, 4 body types (canine/feline/bird/large), CompanionRenderer (371 lines), useFauna hook, checkCompanionEligibility (7-day 3+ domain streak), bond system 10 levels, NPC friendship (npc-friendship.ts 403 lines), Supabase tables with RLS, species palettes for Canvas rendering.
- [x] [P5-003] Celestial layer — ✅ DONE — Commit: 2b4c1aa — Date: 2026-04-23 — Real moon phase (Julian Day Number), hemisphere-aware seasons, Ethiopian calendar date overlay (toEthiopian()), full moon XP +10% gold indicator, upcoming 3 events with urgency colouring, illumination progress bar. DashboardCelestial.tsx rewritten.
- [x] [P5-004] Biome choice — v1.19.60 — Already complete. 6 biomes (Woodland, Tropical, Highland, Savanna, Coastal, Tundra) with full BiomePalette, BiomePicker UI (2x3 grid, golden selection border), localStorage persistence, live tile rendering override, RealmEngine.setTileBiome() integration.
- [x] [P5-005] Dynamic XP→World — v1.19.60 — XP→vibrancy, mood→weather, streak→music layers (3+ days: rhythm, 7+: melody boost, 14+: full vibrancy). All wired through RealmEngine.
- [ ] [P5-006] All Realm zones — ❌ MISSING — LIFEOS-ROADMAP 4.1: "5 more zones: Ironworks District, Wisdom Summit, Healer's Sanctuary, Market Quarter, Social Square." Only Life Town. — Impact: 2/5
- [x] [P5-007] NPC friendship system — ✅ DONE — Commit: a73b60d — Date: 2026-04-23 — npc-friendship.ts: 10 friendship tiers (Stranger→Eternal Bond), exponential XP, daily interaction +1 XP, unlocks at 3/6/10, 6 NPC definitions, gift system, quest system, friendship greeting modifier, serialization to npc_bonds in user preferences.
- [ ] [P5-008] MapleStory chibi sprites — ❌ MISSING — WORLD-CLASS-ROADMAP: "Characters are colored rectangles (embarrassment). Need chibi sprites." — Impact: 2/5
- [ ] [P5-009] RPG Genesis Quest onboarding — ❌ MISSING — MASTER_BUILD_PLAN Phase 4 + WORLD-CLASS-ROADMAP: "Character creation → Genesis Garden tutorial → First Quest → Portal to Life Town." — Impact: 2/5

## Priority 6: SCALE (Multi-user, social, revenue)

- [x] [P6-001] Habit Coaching AI — ✅ DONE — Commit: ed212c4 — Date: 2026-04-22 — habit-coaching.ts generates 4 insight types (streak_at_risk, recovery, pairing, optimal_time). Merged into ProactiveSuggestions pipeline on Dashboard.y scaling." — Impact: 3/5 — File needed: src/lib/habit-coaching.ts
- [x] [P6-002] Financial intelligence — ✅ DONE — v1.19.51 — financial-intelligence.ts wired into DashboardFinancialPulse. Top insight shown inline, expand to see up to 4. Anomalies, income forecast, savings opportunities, trend alerts all rendered with severity-coloured InsightRow components.
- [x] [P6-003] Health correlations — ✅ DONE — v1.19.51 — correlateHealthWithProductivity() results now surface in DashboardHealth widget below the vitals grid. "Pattern detected" section with colour-coded correlation strings (green=positive, orange=negative). Min strength 0.35, max 2 shown.
- [ ] [P6-004] Predictive scheduling — ❌ MISSING — LIFEOS-ROADMAP 5.1: "Pattern learning. Auto-schedule suggestions. Energy-aware scheduling." — Impact: 3/5
- [ ] [P6-005] Guild system — 📦 STUB — Social code exists but gated. LIFEOS-ROADMAP 6.1: "Guild creation, leaderboard, challenges, chat." — Impact: 2/5
- [ ] [P6-006] Accountability partners — 📦 STUB — Partner matching exists. LIFEOS-ROADMAP 6.2: "Shared goals, partner nudge, partner streak." — Impact: 2/5
- [ ] [P6-007] Public profiles + sharing — ❌ MISSING — LIFEOS-ROADMAP 6.3: "Shareable profile cards. Achievement showcase. Referral system." — Impact: 2/5
- [ ] [P6-008] Leaderboards — ❌ MISSING — LIFEOS-ROADMAP 6.4: "Global XP leaderboard (weekly reset). Domain ladders." — Impact: 2/5
- [ ] [P6-009] Stripe monetization — 📦 STUB — useSubscription.ts has stubs. feature-gates.ts has Stripe refs. No actual integration. LIFEOS-ROADMAP 6.5: "Free tier + Pro ($9.99/mo) + trial system." — Impact: 2/5
- [ ] [P6-010] Telegram parity — 🔨 PARTIAL — MASTER_BUILD_PLAN Phase 1: "Both interfaces can do everything the other can." Missing: log_income, log_expense, log_mood in webapp; decompose_objective, start_focus in Telegram. — Impact: 2/5

## Technical Debt

- [x] [TD-001] Schedule.tsx: 2051→229 lines — ✅ DONE — Split into 6 files. Commit: 8145fbc
- [x] [TD-002] Goals.tsx: 1827→300 lines — ✅ DONE — Split into 4 files. Commit: 566ec24
- [x] [TD-003] Intent Engine: 2324→25 lines — ✅ DONE — Decomposed into 12 modules. Commit: 0402d50
- [x] [TD-004] Health.tsx orchestration vs Health-tabs subcomponents — ✅ DONE — Verified: 125 lines, clean split, no direct Supabase calls, all tabs in health-tabs/ directory, hooks architecture already proper
- [x] [TD-005] Finances.tsx: 657→302 lines — ✅ DONE — Date: 2026-04-21 — Extracted useFinanceActions (181 lines), useFinanceComputed (268 lines), FinanceSummary (74 lines), FinanceTabActions (33 lines). All direct Supabase calls moved to useFinanceStore methods. Zero direct Supabase imports in Finances.tsx.
- [ ] [TD-006] Service worker — disabled in Electron (expected). Should work for PWA.
- [x] [TD-007] Offline-first completion — ✅ v1.19.59 — All write-heavy stores now route through local-db. No direct supabase.from() in stores. useLiveActivityStore, useAgentStore, useFinanceStore, useGoalsStore, useHabitsStore, useHealthStore, useScheduleStore, useJournalStore, useInventoryStore all use local-first pattern. Engines import supabase from data-access (correct architecture).
- [ ] [TD-008] TypeScript strict mode — not enabled
- [ ] [TD-009] Test coverage — 5 test files for 592 source files (0.8%)
- [ ] [TD-010] RLS migration SQL ready but not applied — supabase/migrations/20260418_rls_critical_tables.sql needs manual paste

## Completed ✅

- [x] [C-001] Holy Hermes Oracle widget — ✅ DONE — Commit: c264898 — Date: 2026-04-20 — Replaced HermeticInsightWidget with AI spiritual assistant (passive + active chat modes)
- [x] [C-002] WelcomeWizard onboarding flow — ✅ DONE — Commit: 1d64288 — 5-step wizard for new users
- [x] [C-003] Progressive disclosure — ✅ DONE — Commit: ca50a99 — Hide advanced features for new users via revealAfterDays
- [x] [C-004] Empty states with CTAs — ✅ DONE — Commit: 07ebd29 — Hermetic quotes, action buttons
- [x] [C-005] Error boundaries — ✅ DONE — Commit: 528463b — App-level, chunk recovery, async toast, crash persistence
- [x] [C-006] Login UX overhaul — ✅ DONE — Commit: 8084c52 — Signup tab, password reset, social login, friendly errors
- [x] [C-007] Habits UX polish — ✅ DONE — Commit: 7d1db34 — Completion animation, streak flames, categories, swipe
- [x] [C-008] Goals UX polish — ✅ DONE — Commit: b6796c4 — Progress rings, state badges, quick add, suggestions
- [x] [C-009] Settings overhaul — ✅ DONE — Commit: d00996f — Profile completion, preferences, danger zone, light theme
- [x] [C-010] TCS business module — ✅ DONE — Commit: 054033e — Revenue card, route optimizer, contract status, health score
- [x] [C-011] Dashboard personalization — ✅ DONE — Commit: 9e78366 — Time-aware greeting, streaks, financial pulse
- [x] [C-012] PWA support — ✅ DONE — Commit: 14ab56f — Installable, offline mode, service worker
- [x] [C-013] Performance optimization — ✅ DONE — Commit: 7c26926 — Lazy loading, bundle splitting (620KB→147KB)
- [x] [C-014] Accessibility (WCAG 2.1 AA) — ✅ DONE — Commit: 8881831 — Skip link, focus indicators, ARIA
- [x] [C-015] Smart notifications — 🔨 DONE (basic) — Commit: 6ed8e5c — Priority-based, compact toasts, bell icon
- [x] [C-016] Mobile responsive — ✅ DONE — Commit: eb0f4fd — Safe areas, touch targets, breakpoints
- [x] [C-017] Electron GPU crash fix — ✅ DONE — Commit: a0b1a54 — SwiftShader, VAAPI disable, crash recovery
- [x] [C-018] Electron OAuth fix — ✅ DONE — Commit: 8e05411 — Local callback server replaces deep links
- [x] [C-019] Sidebar scroll fix — ✅ DONE — Commit: a0b1a54 — overflow-y: auto, flex-shrink pinned footer
- [x] [C-020] Notification spam fix — ✅ DONE — Commits for AgentNudgeBar, GamificationOverlay, AchievementToast
- [x] [C-021] KmLogger travel_km fix — ✅ DONE — Commit: 60deaee
- [x] [C-022] Holy Sage Oracle page — ✅ DONE — Date: 2026-04-21 — Full oracle chat interface wired to Ollama (gemma4:e2b), Holy Hermes system prompt, streaming SSE, localStorage persistence, hermetic 4-part auto-highlight (Principle/Correspondence/Practice/Miracle), reconnect button, auto-resize input, Ctrl+/ focus shortcut, markdown export, purple/gold glass aesthetic
- [x] [C-023] Holy Sage Dashboard widget — ✅ DONE — Date: 2026-04-21 — SageWidget.tsx with one-liner input → navigates to /sage?q=, time-adaptive priorities (night=10, morning=8, evening=7, active=1)
- [x] [C-024] Electron blank screen fix — ✅ DONE — Date: 2026-04-21 — Two root causes: (1) npm run build creates /assets/ absolute paths that break in file:// protocol → must use build:desktop for ./assets/ relative paths, (2) TMPDIR=/mnt/data/tmp/scratch causes Chromium shared memory creation failure → forced to /tmp in main.js
- [x] [P3-002] AI persistent memory — ✅ DONE — Date: 2026-04-21 — ai-memory.ts persistence layer + ai_conversations SQLite table + ChatHeader conversation history dropdown + debounced auto-save + title generation from first message

## Audit Log
- 2026-04-20: Initial deep audit. 65 features assessed. 12 DONE, 53 remaining. Score: 18.5%. Holy Hermes Oracle committed as first execution.
- 2026-04-20: Batch 2 execution. 3 items DONE: P2-001 Schedule split, P3-005 Pattern Engine, P2-004 Error Handler. Score: 15/65 = 23.1%. Version: 1.19.30.
- 2026-04-20: Batch 3 execution. 3 items DONE: P2-002 Goals split, P4-006 Time-adaptive Dashboard, P1-001 Onboarding fix. Score: 18/65 = 27.7%. Version: 1.19.33.
- 2026-04-20: Batch 4 execution. 3 items DONE: P2-003 Intent Engine split, P3-004 Cross-domain fusion, P2-005 Skeleton shimmer. Score: 21/65 = 32.3%. Version: 1.19.36.
- 2026-04-20: P1-005 SleepQuickLog integrated into Dashboard with time-adaptive mode priorities. Score: 22/66 = 33.3%. Version: 1.19.37.
- 2026-04-21: Hermes improvement cycle. 4 items DONE: C-022 Holy Sage page, C-023 Sage Dashboard widget, C-024 Electron blank screen fix (TMPDIR+build:desktop), P3-002 AI persistent memory. Score: 28/68 = 41.2%. Version: 1.19.40.
- 2026-04-21: Hermes cycle 2. 3 items DONE: P3-001 Intent engine action execution (6 real CRUD handlers), P4-001 Daily reward system (escalating XP tiers + streaks + toast), TD-005 Finances refactor (657→302 lines, zero direct Supabase). Score: 31/68 = 45.6%. Version: 1.19.41.
- 2026-04-21: Hermes cycle 3. 4 items DONE: P3-003 Proactive suggestions (5 generators + Dashboard widget), P4-002 Challenge system (weekly/monthly, 200-1000XP), TD-004 Health.tsx verified clean (125 lines), TD-005 Finances refactor confirmed. Score: 34/68 = 50.0%. Version: 1.19.42.
- 2026-04-22: Hermes cron cycle. 3 items DONE: P2-006 Test coverage (5→8 test files, 41→150 tests — pattern-engine/error-handler/xp-engine), P3-006 Pre-populated intelligence (data-seed.ts, 575 lines, onboarding-aware seeding), P3-007 Junction game library (10→18 traditions, 8 secular Junctions with quest tiers, 6 new categories). Also committed accumulated work from prior sessions. Score: 37/68 = 54.4%. Version: 1.19.43.
- 2026-04-22: Hermes local-first fix cycle. T1-A + T1-B DONE: useLiveActivityStore + useAgentStore now route all writes through local-db (offline-first). Added unified_events, event_completions, ai_insights to IDB STORES (v8), sync-engine SYNC_TABLES, and STATIC_COLUMNS. Score: 39/68 = 57.4%. Version: 1.19.48.
- 2026-04-22: Full branch audit + feature accessibility fix. ROOT CAUSE: LOCAL_USER in electron-api.ts used `new Date().toISOString()` as created_at → accountDays=0 → all progressive-disclosure features (Academy/Character/Replicator/Lessons) were hidden every session. Fixed: hardcoded '2020-01-01' so local users always see all features. Also lowered revealAfterDays thresholds (5→2, 7→3). TCS plugin gate confirmed working — auto-enables for tewedross12@gmail.com/teddyscleaning emails. All 14 routes confirmed present in App.tsx. Clean build + relaunch. Score: 46/68 = 67.6%. Version: 1.19.52.