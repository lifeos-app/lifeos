# Phase 3 Self-Healing Audit — LifeOS Improvement Checklist

**Date:** 2026-04-27
**Checklist Status Before Audit:** 87/89 = 97.8% (TD-010 remaining)
**Audit Finding:** 87/89 is a "near-complete trap". 27 NEW items discovered.
**Revised Status:** 87/116 = 75.0%

---

## Methodology

1. Read ALL 7 vision documents + LIVING-REALM-SPEC.md + DESIGN-RULES.md
2. Extracted EVERY stated feature/capability/requirement as discrete items
3. Cross-referenced against existing checklist (89 items) and actual codebase
4. Verified 5 known architectural issues against actual code
5. Scored each NEW item: DONE / PARTIAL / STUB / MISSING

---

## NEW ITEMS DISCOVERED (Not in Checklist)

### Priority 1: BROKEN (Architecture defects creating silent failures)

| ID | Description | Status | Evidence | Priority | Source |
|----|-------------|--------|----------|----------|--------|
| TD-011 | electron/main.js God Object — 526 lines, 13 IPC handlers | PARTIAL | 526 lines, 13 ipcMain.handle calls confirmed. No decomposition. | 1 | VISION-v2-ori.md §9 "Technical Debt — Fix NOW" |
| TD-012 | data-access.ts uses runtime env detection instead of build-time aliases | PARTIAL | 270 lines. Lines 23-78: 7 runtime checks (__IS_ELECTRON__, __IS_TAURI__, globalThis.Capacitor, window.electronAPI, __TAURI_INTERNALS__, import.meta.env). Some build-time defines exist but runtime fallbacks dominate. | 1 | VISION-v2-ori.md §1 "Current State Audit" + architectural review |
| TD-013 | No store init ordering — 16 Zustand stores hydrate in random order | PARTIAL | App.tsx lines 288-311: Promise.allSettled with 8 stores but no ordering. 16 total stores (8 not in the hydration block). No store-init-order config. | 1 | Known architectural issue #3 |
| TD-014 | No CRDT/event-sourcing sync layer between Supabase and SQLite | MISSING | sync-engine.ts is 1118 lines, has push/pull/retry but NO CRDT, NO vector clocks, NO conflict resolution metadata, NO event sourcing. grep for "CRDT|conflict|merge.*strateg|vector.*clock" returned zero results. | 1 | Known architectural issue #4 |
| TD-015 | God component: OnboardingQuest.tsx — 1149 lines | STUB | 1149 lines confirmed at src/realm/onboarding/OnboardingQuest.tsx | 1 | VISION-v2-ori.md §5.3 "Split God Components" |
| TD-016 | God component: WelcomeWizard.tsx — 1121 lines | STUB | 1121 lines confirmed at src/components/WelcomeWizard.tsx | 1 | Known architectural issue #5 |
| TD-017 | God component: NodeDetail.tsx — 985 lines | STUB | 985 lines confirmed at src/components/NodeDetail.tsx | 1 | Known architectural issue #5 |
| TD-018 | God component: AIChat.tsx — 981 lines | STUB | 981 lines confirmed at src/components/AIChat.tsx | 1 | Known architectural issue #5 |
| TD-019 | God component: Academy.tsx — 957 lines | STUB | 957 lines confirmed at src/pages/Academy.tsx | 1 | Known architectural issue #5 |

### Priority 2: FOUNDATION (Missing infrastructure blocking vision)

| ID | Description | Status | Evidence | Priority | Source |
|----|-------------|--------|----------|----------|--------|
| P7-001 | E2E test framework — zero Playwright/Cypress coverage | MISSING | No .spec. or .e2e. files found outside node_modules. Only unit tests (11 files via vitest). No Playwright/Cypress config. | 2 | LIFEOS-ROADMAP.md §2.1 "E2E tests for critical flows (login, create task, toggle habit) — Must-have" |
| P7-002 | Error monitoring — no Sentry or equivalent | MISSING | grep for "Sentry|sentry" in src/ returned zero results. VISION-v2-ori.md Day 30: "Set up error monitoring (consider Sentry free tier)" | 2 | VISION-v2-ori.md §10 Day 30 |
| P7-003 | RLS not applied — critical SQL migration pending deployment | STUB | supabase/migrations/20260418_rls_critical_tables.sql exists (185 lines) but not applied. Already tracked as TD-010 but scored here for severity. | 2 | VISION-v2-ori.md §9 "Verify RLS policies on ALL 82 tables" |
| P7-004 | journal_entries.tags stored as comma-separated string, not JSONB array | PARTIAL | No evidence of JSONB migration for tags. VISION-v2-ori.md §4 schema rec #4: "Convert journal_entries.tags from comma-string to JSONB array" | 2 | VISION-v2-ori.md §4 "Schema Recommendations #4" |
| P7-005 | No audit_log table for multi-user data changes | MISSING | grep for "audit_log" returned zero results in src/ and supabase/. | 2 | VISION-v2-ori.md §4 "Tables Missing for Multi-User: audit_log" |
| P7-006 | No ai_usage tracking — token costs unmonitored | MISSING | grep for "ai_usage|tokens_in|tokens_out" returned zero results in src/ (only proactive-suggestions.ts has rate limiting of suggestions, not AI token tracking). | 2 | VISION-v2-ori.md §4 "Add ai_usage table (user_id, date, model, tokens_in, tokens_out, cost_cents)" |
| P7-007 | 142 CSS files with no design system consolidation | STUB | 142 CSS files in src/. VISION-v2-ori.md §9 #13: "90+ CSS files. No design system beyond design-system.css. Consolidate. Use CSS custom properties consistently." Still true. | 2 | VISION-v2-ori.md §9 Tech Debt #13 |

### Priority 3: VISION-CRITICAL (Stated product differentiators not implemented)

| ID | Description | Status | Evidence | Priority | Source |
|----|-------------|--------|----------|----------|--------|
| P7-008 | Voice-first interface — no TTS (text-to-speech) response | STUB | VoiceFAB.tsx (218 lines) exists for speech-to-text. useSpeechRecognition.ts exists. But NO TTS output: grep for "tts|elevenlabs|text-to-speech|SpeechSynthesis" returned zero. Vision: "Hey LifeOS, how am I doing? → Spoken response via ElevenLabs TTS" | 3 | VISION-v2-ori.md §8.1 "Voice-First Interface"; VISION.md §Phase 2 "Voice input (speech-to-text → AI → action)" |
| P7-009 | Ambient computing — no geolocation-triggered suggestions | STUB | useLocation.ts exists (privacy-first hook) but no ambient triggers. No "arrive at gym → suggest logging workout" logic. No weather API integration for scheduling. | 3 | VISION-v2-ori.md §8.2 "Ambient Computing" |
| P7-010 | Flow state detection and optimization | STUB | pattern-engine.ts has "energy_cycle" detector. hermetic-principle-insight.ts mentions "rhythm_swing". But no real flow state detection (challenge-skill matching, focus state inference). MANIFESTO.md Layer 2: "Focus: Deep work blocks, flow states, attention management — Current coverage: partial" | 3 | MANIFESTO.md §II Layer 2 "Gap: No ultradian rhythm detection"; VISION-v2.md Phase 2 "Flow state detection and optimization" |
| P7-011 | Plugin system — architecture only, no actual plugins | STUB | plugin-registry.ts (159 lines) exists with registerPlugin/getPlugin. No actual plugins registered. PluginActivityWidget.tsx exists. VISION-v2-ori.md §7.3 lists 5 Phase 3 plugins (Fitness/Reading/Meditation/Finance/Calendar). None built. | 3 | VISION-v2-ori.md §7.3 "Plugin System — Current: lib/plugins/plugin-registry.ts and types exist. No actual plugins." |
| P7-012 | Knowledge graph architecture — no code exists | MISSING | grep for "knowledge.*graph" returned zero results. No graph data structures, no node/edge types. This is v3+ per MANIFESTO.md. | 3 | MANIFESTO.md §V "The Knowledge Graph" |
| P7-013 | Multi-LLM federation — only Gemini via proxy | PARTIAL | LLM proxy routes to Gemini. Academy uses callLLMProxy. ZeroClaw is Gemini. No Anthropic, no Codex, no local Ollama integration for main AI. (Holy Sage uses Ollama separately.) | 3 | MANIFESTO.md §V "LLM Integration Strategy — Not one LLM — a federation of models" |
| P7-014 | Natural language queries across all data ("Show me every time I slept <6hrs") | MISSING | No natural language query engine. Intent engine handles commands but not analytical queries. | 3 | VISION-v2.md Phase 2 "Natural language queries"; MANIFESTO.md Phase 4 |
| P7-015 | Temporal playback — rewind your week/month, see patterns emerge | MISSING | No temporal playback code. Pattern-engine detects patterns but has no time-travel/rewind UI. | 3 | VISION-v2.md Phase 2 "Temporal playback — rewind your week/month" |

### Priority 4: ENGAGEMENT (Retention gaps from vision docs)

| ID | Description | Status | Evidence | Priority | Source |
|----|-------------|--------|----------|----------|--------|
| P7-016 | Web Push notifications — not implemented | MISSING | grep for "pushManager|PushManager|web.*push" returned zero. No push notification system at all. | 4 | VISION-v2-ori.md §8.2 "Web Push notifications for proactive nudges" |
| P7-017 | Referral system for viral growth | MISSING | LIFEOS-ROADMAP.md §6.3 "Referral system (invite friends → both get bonus XP) — Must-have". Only passing references in tcs-growth-seed.ts. No user-facing referral code. | 4 | LIFEOS-ROADMAP.md §6.3; P6-007 notes "Referral system deferred (needs backend)" |
| P7-018 | Habit home screen widget (iOS/Android) | MISSING | No widget code. LIFEOS-ROADMAP.md §3.4 "Habit widget (iOS/Android home screen) — Nice-to-have, Requires native wrapper or PWA widget API" | 4 | LIFEOS-ROADMAP.md §3.4 |
| P7-019 | Realm screenshot sharing ("Look at my garden!") | MISSING | No screenshot/canvas export from Realm. ShareCard exists for profile but not Realm canvas. | 4 | LIFEOS-ROADMAP.md §3.5 "Realm screenshot sharing — Nice-to-have" |

### Priority 5: DEPTH (World awareness and completeness)

| ID | Description | Status | Evidence | Priority | Source |
|----|-------------|--------|----------|----------|--------|
| P7-020 | World/Geopolitical awareness — Layer 6 from Manifesto | MISSING | MANIFESTO.md §II Layer 6: "Current coverage: Almost nothing. Junction touches cultural/religious calendar. Gap: This is the biggest gap. No awareness of the world the user lives in." No tax engine, legal awareness, or local knowledge. | 5 | MANIFESTO.md §II Layer 6 |
| P7-021 | Sleep → productivity correlation engine (server-side, 60+ days data) | PARTIAL | pattern-engine.ts has energy_cycle detector. correlation-engine.ts exists. But no dedicated sleep-productivity correlation that requires 60+ days (VISION-v2-ori.md). Current correlation is cross-domain Pearson, not sleep-specific temporal lag analysis. | 5 | VISION-v2.md Phase 1 "Sleep ↔ performance correlation engine"; VISION-v2-ori.md §8.3 "Requires 60+ days of data" |
| P7-022 | Health device integration (Apple Health / Google Fit) | MISSING | No Apple Health Kit, Google Fit, or wearable code anywhere. | 5 | LIFEOS-ROADMAP.md §3.4 "Apple Watch / Wear OS companion — Future"; MANIFESTO.md Phase 6 |
| P7-023 | Google Calendar bidirectional sync | STUB | google-calendar.ts (95 lines) exists as API scaffolding but calls /api/google-proxy.php which may not be deployed. No evidence of working bidirectional sync. | 5 | MASTER_BUILD_PLAN.md §1C; VISION.md Phase 2 "Google Calendar integration" (already in checklist as done per v1.13.6) |

### Priority 6: SCALE (Multi-user, social, compliance)

| ID | Description | Status | Evidence | Priority | Source |
|----|-------------|--------|----------|----------|--------|
| P7-024 | Social features still behind "Coming Soon" gate | PARTIAL | SocialPage.tsx lines 295-296: `isComingSoon('social', userId)` renders ComingSoon wrapper. VISION-v2-ori.md §9 #12: "12 social components behind a Coming Soon gate. 0 real users." | 6 | VISION-v2-ori.md §9 Tech Debt #12 |
| P7-025 | Server-side subscription enforcement | STUB | feature-gates.ts canAccess() line 97 returns true in early-adopter mode. stripe-client.ts is 367 lines but VITE_STRIPE_ENABLED must be set. No server-side enforcement currently. | 6 | VISION-v2-ori.md §9 #18 "canAccess() returns true for everything" |
| P7-026 | notification_preferences table — not in schema | MISSING | No notification_preferences table code. VISION-v2-ori.md §4 rec #5: "Add notification_preferences table" | 6 | VISION-v2-ori.md §4 "Schema Recommendations #5" |
| P7-027 | sync_conflicts table for offline conflict tracking | MISSING | No sync_conflicts table code. VISION-v2-ori.md §4 rec #6: "Add sync_conflicts table for offline conflict tracking" | 6 | VISION-v2-ori.md §4 "Schema Recommendations #6" |

---

## SUMMARY

### By Priority
- Priority 1 (BROKEN): 9 items — TD-011 through TD-019 (all God objects + architectural defects)
- Priority 2 (FOUNDATION): 7 items — E2E tests, error monitoring, RLS, schema gaps, CSS cleanup
- Priority 3 (VISION-CRITICAL): 8 items — Voice/TTS, ambient computing, plugins, knowledge graph, multi-LLM
- Priority 4 (ENGAGEMENT): 4 items — Web Push, referrals, habit widget, realm sharing
- Priority 5 (DEPTH): 4 items — World awareness, sleep correlation, health devices, GCal sync
- Priority 6 (SCALE): 4 items — Social gate, server enforcement, notification prefs, sync conflicts

### By Status
- MISSING: 12 items (no code exists)
- STUB: 10 items (architecture/scaffolding only, non-functional)
- PARTIAL: 8 items (some implementation, significant gaps)

### Revised Checklist Score
- Previous: 87/89 = 97.8%
- New items: 27
- Revised total: 116 items
- Revised score: 87/116 = 75.0%

### Top 5 Most Critical (Do First)
1. **TD-014** — No CRDT/event-sourcing sync layer (data loss risk in multi-device)
2. **TD-011** — electron/main.js God Object (526 lines, 13 IPC handlers)
3. **TD-013** — No store init ordering (random hydration = flaky state)
4. **P7-001** — Zero E2E tests (deployments are prayers)
5. **P7-003** — RLS not applied (security vulnerability for multi-user)

---

## ITEMS VERIFIED AS ALREADY DONE (Not Duplicated)

These vision features were already tracked and completed in the checklist:
- [x] Onboarding flow fix (P1-001)
- [x] Financial data model unification (P1-002) 
- [x] Schedule/Goals god component split (P2-001, P2-002)
- [x] Intent Engine decomposition (P2-003)
- [x] Cross-domain data fusion / correlation engine (P3-004)
- [x] Pattern Engine (P3-005)
- [x] Pre-populated intelligence / data seeding (P3-006)
- [x] Junction as game library + AI recommender (P3-007, P3-008)
- [x] Daily rewards, challenges, smart notifications (P4-001 through P4-006)
- [x] Living Garden species-aware (P5-001)
- [x] Companion system (P5-002)
- [x] Celestial layer (P5-003)
- [x] All Realm zones (P5-006)
- [x] NPC friendship (P5-007)
- [x] Predictive scheduling (P6-004)
- [x] Habit Coaching AI (P6-001)
- [x] Financial intelligence (P6-002)
- [x] Health correlations (P6-003)
- [x] Guild system, partners, leaderboards, Stripe (P6-005 through P6-009)
- [x] All Academy 2.0 items (A2-001 through A2-007)
- [x] Evening Review, Streak Shield, Character Permeation (P3-009, P4-007, P4-008)
- [x] All depth features from April 25 audit (P5-010 through P5-021, P6-011 through P6-015)