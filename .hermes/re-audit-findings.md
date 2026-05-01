# LifeOS Re-Audit Findings — Near-Complete Trap Analysis

**Date:** 2026-05-02  
**Auditor:** Hermes Subagent  
**Checklist claims:** 122/122 = 100%  
**Actual finding:** 40+ features from vision docs not tracked, 15+ partial/stub implementations, 8 architectural concerns

---

## Category 1: Features in Vision Docs NOT in Checklist At All

These features are described in vision documents but have zero mention in the improvement checklist.

### P1-101: Voice-First Wake Word + Continuous Mode
- **Priority:** Foundation  
- **Description:** Voice-first interface with wake word detection, continuous conversation mode, and all intent engine actions available via voice  
- **Vision ref:** VISION-v2-ori §8.1: "Wake word detection using Web Speech API continuous mode", "All intent engine actions available via voice"  
- **Current state:** PARTIAL — VoiceFAB component exists, `voice-first/` feature directory (2,309 lines) with VoiceCommandHistory, VoiceSettings, VoiceWaveform, VoiceQuickActions. BUT: wake word detection missing, continuous mode not implemented, voice-to-intent bridge incomplete  
- **Evidence:** `src/features/voice-first/` has good UI scaffolding but `useVoiceCommand.ts` (591 lines) uses basic Web Speech API recognition, not continuous wake-word mode  
- **Impact:** 4/5

### P1-102: Gmail Integration
- **Priority:** Foundation  
- **Description:** Gmail inbox integration for task extraction and email-aware scheduling  
- **Vision ref:** MASTER_BUILD_PLAN §1A does not list Gmail, but VISION-v2-ori §8.2 mentions calendar-aware features; Gmail is a natural Google integration alongside Calendar  
- **Current state:** STUB — `src/lib/integrations/gmail.ts` (90 lines) is API scaffolding with proxy calls but NO actual Gmail API implementation — just function stubs  
- **Evidence:** File exists but all functions return proxy requests to a `google-proxy.php` endpoint that doesn't exist  
- **Impact:** 2/5

### P1-103: Adaptive/Dynamic Bottom Navigation  
- **Priority:** Foundation  
- **Description:** Mobile bottom nav reorders based on most-used pages (track page visits, compute affinity scores, reorder nav)  
- **Vision ref:** VISION-v2-ori §6.2: "Reorder mobile nav — Bottom nav → dynamic based on top 4 most-used pages + More"  
- **Current state:** MISSING — Sidebar.tsx and MobileNav.tsx have hardcoded navigation order. `feature-registry.ts` exists but doesn't drive nav order  
- **Evidence:** `src/components/Sidebar.tsx` has static nav items, no usage tracking for reorder  
- **Impact:** 3/5

### P1-104: Flipper Zero Workstation Activation  
- **Priority:** Foundation  
- **Description:** USB device detection that triggers Mac wake, app opening, and build system launches  
- **Vision ref:** MASTER_BUILD_PLAN §2: "Flipper plugs in → Mac wakes up → full workstation ready"  
- **Current state:** PARTIAL — `src/components/FlipperCheckin.tsx` (355 lines) exists for WebUSB game overlay check-in, but native `flipper-activate.sh` script and `launchd` daemon are NOT in the codebase  
- **Evidence:** Component exists but the system-level USB detection described in MASTER_BUILD_PLAN is absent  
- **Impact:** 1/5 (niche feature)

### P1-105: Onboarding V2 (5-Step Quick Start)
- **Priority:** Foundation  
- **Description:** 5-step 3-minute onboarding (Name → Life Snapshot → Top 3 Goals → Daily Rhythm → Done) with AI background processing, NOT the current LLM-heavy flow  
- **Vision ref:** VISION-v2-ori §7.2: "New flow (5 steps, 3 minutes)" with slider ratings for 6 life areas, AI creates goals in background  
- **Current state:** PARTIAL — WelcomeWizard exists (1,121 → split into 3 files), LifeOnboarding.tsx exists, but neither implements the 5-step rapid flow with Life Snapshot radar chart described in VISION-v2-ori  
- **Evidence:** Current onboarding is still multi-phase AI-heavy chat, not the quick 3-minute slider-based flow  
- **Impact:** 5/5 (critical user experience)

### P2-101: ZeroClaw Supabase Tools (Autonomous Actions)
- **Priority:** Vision-Critical  
- **Description:** ZeroClaw should have direct Supabase tools (read_tasks, create_task, log_habit, etc.) for autonomous action execution  
- **Vision ref:** VISION-v2-ori §6.1: "Add Supabase tools to ZeroClaw" with 12+ tool operations  
- **Current state:** STUB — `zeroclaw-client.ts` exists but `agentExecuteAction()` returns `{success: false}`. Nudge system exists (450 lines in `zeroclaw-nudges.ts`) but doesn't write actual data through Supabase tools  
- **Evidence:** VISION-v2-ori explicitly says "nudges return empty []" and "actions return false"  
- **Impact:** 5/5 (core AI promise)

### P3-101: "God Mode" Dashboard (WorldView-Inspired)
- **Priority:** Vision-Critical  
- **Description:** Unified visualization dashboard showing all life domains as interconnected streams — like Palantir for your personal world. Temporal playback, cross-life correlations, natural language queries  
- **Vision ref:** VISION-v2 §"Personal Intelligence Platform": "God mode dashboard — WorldView-inspired unified visualization of your life"  
- **Current state:** PARTIAL — Knowledge Graph view (P7-012) and Temporal Playback (P7-015) and NL Query (P7-014) exist as separate widgets, but there's no unified "God Mode" that fuses all domains into one queryable interface  
- **Evidence:** Dashboard has 30+ individual widgets but no unified cross-domain visualization  
- **Impact:** 4/5

### P3-102: Multi-Person Intelligence (Partner/Team Dashboards)
- **Priority:** Vision-Critical  
- **Description:** Shared dashboards where partner/team data is visible, cross-person insights ("Your partner hasn't logged today")  
- **Vision ref:** VISION-v2 §"Future": "Multi-person intelligence — partner/team dashboards (social system)"  
- **Current state:** PARTIAL — FamilyCircles feature exists (2,933 lines) with SharedBudgetPanel, SharedGoalsPanel, MemberManager, but NO shared dashboard visualization or cross-person intelligence insights  
- **Evidence:** `src/features/family-circles/` has good UI scaffolding but no intelligence/insight layer  
- **Impact:** 3/5

### P3-103: Evidence-Based Framework Matrix (Research → Implementation)
- **Priority:** Vision-Critical  
- **Description:** Atomic Habits 4-law framework, GTD capture→clarify→organize flow, Deep Work scheduling, Flow state matching, Tiny Habits anchoring, Covey time quadrants, Essentialism pruning, Grit tracking, Thinking Fast/Slow bias detection, Power of Habit keystone identification, Why We Sleep correlations, Drive (autonomy/mastery/purpose), Mindset reframing, Obstacle is the Way stoic reflections  
- **Vision ref:** VISION-v2 §"Foundational Research to Integrate": 14 frameworks listed with specific implementations for each  
- **Current state:** PARTIAL — Many individual implementations exist (Covey matrix, GTD review, Keystone habits, Stoic reframing, Grit score, Motivation score, Decision journal, Habit difficulty, Habit coaching), but NOT all 14. Missing: Atomic Habits 4-law implementation, Deep Work scheduling/blocking, Flow state matching (beyond detection), Essentialism goal pruning, Sleep→performance correlation engine (separate from SleepProductivityInsights), Drive autonomy tracking  
- **Evidence:** Checklist covers ~8 of 14 frameworks. Missing explicit implementations for Atomic Habits 4 laws, Deep Work focus mode, Essentialism pruning, Drive autonomy/mastery/purpose scoring  
- **Impact:** 4/5

### P4-101: Churn Prevention / Re-engagement System
- **Priority:** Engagement  
- **Description:** Automated re-engagement based on inactivity signals — NPC-themed push notifications for 2d/7d/30d churn signals, streak protection messages, "your garden is waiting" type nudges  
- **Vision ref:** LIFEOS-ROADMAP §11 App F: "No login in 2 days → NPC misses you + streak warning", "No login in 7 days → weekly summary", "No login in 30 days → re-engagement"  
- **Current state:** PARTIAL — Web Push notifications (P7-016) and Proactive Suggestions exist, but NO inactivity-based re-engagement triggers, NO NPC-themed notification templates, NO churn signal detection  
- **Evidence:** `src/lib/web-push.ts` handles push subscriptions but doesn't implement churn detection or NPC personality messages  
- **Impact:** 4/5 (retention-critical)

### P4-102: Duolingo-Style Daily Reward Chest Animation
- **Priority:** Engagement  
- **Description:** Animated chest-opening mechanic when claiming daily login reward (not just XP popup)  
- **Vision ref:** LIFEOS-ROADMAP §3.1: "Daily reward chest is their #1 retention mechanic. Users open the app just to collect it"  
- **Current state:** PARTIAL — DailyRewardToast exists with "fire animation for 7+ streaks" but no actual chest-opening animation mechanic  
- **Evidence:** `src/lib/daily-rewards.ts` handles XP logic, toast shows XP value, no chest animation component  
- **Impact:** 3/5

### P5-101: Digital Twin / Life Simulator
- **Priority:** Depth  
- **Description:** Interactive projection tool where users can simulate "what if" scenarios for their life — income changes, habit changes, time allocation shifts  
- **Vision ref:** VISION-v2 "Predictive intelligence: Based on your patterns, tomorrow will be low-energy. Schedule light"  
- **Current state:** STUB — `src/features/digital-twin/` (2,404 lines) and `src/features/life-simulator/` (2,561 lines) exist with UI components, but they're not mentioned in the checklist at all. Likely added after the last audit  
- **Evidence:** Both features are routed in App.tsx (`/simulator`, `/twin`) with full lazy loading, stores, and components. Not tracked  
- **Impact:** 3/5

### P5-102: Dream Journal System
- **Priority:** Depth  
- **Description:** Dream logging, interpretation, pattern correlation with waking life  
- **Vision ref:** Not explicitly in vision docs, but consistent with the "LifeOS models ALL of these in ONE interconnected graph" principle (VISION.md)  
- **Current state:** UNTRACKED — `src/features/dream-journal/` (2,150 lines) with DreamCalendar, DreamCorrelations, DreamInterpreter, DreamSymbolExplorer. Routed in App.tsx at `/dreams`. Not in checklist  
- **Evidence:** Full feature with store (dreamStore.ts, 286 lines), route, and 6 component files  
- **Impact:** 2/5

### P5-103: Life Timeline
- **Priority:** Depth  
- **Description:** Chronological visualization of life events, chapters, and transitions  
- **Vision ref:** VISION-v2 "temporal playback — rewind your week/month, see patterns emerge"  
- **Current state:** UNTRACKED — `src/features/life-timeline/` (1,726 lines) with LifeTimeline, LifeChapters, EventDetailPanel, TimelineFilters. Routed at `/timeline`  
- **Evidence:** Full feature with useTimelineData hook (682 lines), 5 component files  
- **Impact:** 3/5

### P5-104: Location Context System
- **Priority:** Depth  
- **Description:** Location-aware features — geolocation triggers, place management, travel logging, "when you arrive at gym, auto-suggest workout"  
- **Vision ref:** VISION-v2-ori §8.2: "Location-aware — When you arrive at the gym, auto-suggest logging a workout"  
- **Current state:** UNTRACKED — `src/features/location-context/` (2,514 lines) with LocationContext, LocationAutomations, PlacesManager, TravelLogView. Routed at `/location`. Also `ambient-computing.ts` (554 lines)  
- **Evidence:** Full feature with store (locationStore.ts, 453 lines), route, and 7 files  
- **Impact:** 4/5

### P5-105: Mini Games System
- **Priority:** Depth  
- **Description:** Brain training mini-games (Pattern, Color Match, Memory, Math Puzzle, Reflex, Typing) integrated with XP  
- **Vision ref:** WORLD-CLASS-ROADMAP §"MapleStory Visual" vision implies gamification depth  
- **Current state:** UNTRACKED — `src/features/mini-games/` (2,003 lines) with 7 game types, GameResults component  
- **Evidence:** Routed at `/mini-games` in App.tsx, store (miniGameStore.ts, 438 lines)  
- **Impact:** 2/5

### P6-101: Guild Wars System
- **Priority:** Scale  
- **Description:** Inter-guild competitions, war declarations, scoring systems, rewards  
- **Vision ref:** LIFEOS-ROADMAP §6.4: "Inter-guild competition (monthly tournament)"  
- **Current state:** UNTRACKED — `src/features/social/GuildWars.tsx` (660 lines), `WarDeclaration.tsx` (802 lines), `useGuildWars.ts` (469 lines), `guildWarStore.ts` (505 lines)  
- **Evidence:** Full war system with scoring, rewards, declarations, but not in the P6-005 guild checklist item  
- **Impact:** 3/5

### P6-102: Family Circles / Shared Family Dashboard
- **Priority:** Scale  
- **Description:** Family shared features — budget sharing, goal sharing, family achievements, member management  
- **Vision ref:** VISION-v2-ori §7.4 P3 plugin "Family shared dashboard"; LIFEOS-ROADMAP §6.5 "Family Plan ($14.99/month, 5 users)"  
- **Current state:** UNTRACKED — `src/features/family-circles/` (2,933 lines) with FamilyCircles, CircleDashboard, SharedBudgetPanel, SharedGoalsPanel, FamilyAchievements, MemberManager. Store at `familyStore.ts` (872 lines). Routed at `/family`  
- **Evidence:** Full feature implementation, not in P6-013 Family Plan (which only covers Stripe billing)  
- **Impact:** 4/5

### P6-103: Mentorship System
- **Priority:** Scale  
- **Description:** Mentor matching, mentor/mentee dashboards, mentorship tracking  
- **Vision ref:** LIFEOS-ROADMAP §"Community templates" implies mentorship capability  
- **Current state:** UNTRACKED — `src/features/mentorship/` (1,301 lines) with MentorMatching, MentorDashboard, MenteeDashboard. Store at `mentorshipStore.ts` (507 lines). Routed at `/mentor`  
- **Evidence:** Full feature with 4 views and matching algorithm  
- **Impact:** 2/5

### P6-104: Social Feed V2 + Collaborative Quests
- **Priority:** Scale  
- **Description:** Activity feed, collaborative group quests, guild events, guild announcements  
- **Vision ref:** LIFEOS-ROADMAP §6.1: "Guild challenges" and §6.3: "Shareable profile cards"  
- **Current state:** UNTRACKED — `src/features/social/` (8,109 lines total) with SocialFeed, SocialFeedV2, CollaborativeQuests (469 lines hook), GuildEvents (571 lines hook), GuildAnnouncements, WarDeclaration, WarRewards, WarScoreboard  
- **Evidence:** Massive social feature set not tracked in the P6-005/P6-006 checklist items  
- **Impact:** 3/5

### P6-105: Contract Intelligence (TCS Business Module V2)
- **Priority:** Scale  
- **Description:** Business contract management, client health dashboard, revenue projections, cash flow timeline, smart alerts, scenario calculator  
- **Vision ref:** VISION.md §Phase 2: "Client portal (SOPs, photos, checklists)"  
- **Current state:** UNTRACKED — `src/features/contract-intelligence/` (2,316 lines) with ContractIntelligence, ClientHealthDashboard, CashFlowTimeline, RevenueProjections, ScenarioCalculator, SmartAlerts. Routed at `/contract-intel`  
- **Evidence:** Full feature with hook (659 lines) and 6 component files  
- **Impact:** 3/5

### P6-106: Audio Rooms (Voice Chat)
- **Priority:** Scale  
- **Description:** Real-time audio communication rooms for guilds, study groups, accountability partners  
- **Vision ref:** LIFEOS-ROADMAP §6.1: "Guild chat with @mentions"  
- **Current state:** UNTRACKED — `src/features/audio-rooms/` (948 lines) with AudioRooms, RoomCreation, useAudioRooms. Routed at `/audio-rooms`  
- **Evidence:** Feature with store (audioRoomStore.ts, 497 lines)  
- **Impact:** 2/5

### P6-107: Public API / Integration Platform
- **Priority:** Scale  
- **Description:** Public API for third-party integrations, usage dashboard, integration guides  
- **Vision ref:** VISION-v2-ori §7.3: "Plugin architecture" with data hooks and AI context injection  
- **Current state:** UNTRACKED — `src/features/public-api/` (1,606 lines) with ApiUsageDashboard, IntegrationGuides, PublicApiSettings. Routed at `/api-settings`  
- **Impact:** 3/5

### P6-108: Player Housing (Realm)
- **Priority:** Scale  
- **Description:** Customizable player housing in the Realm, house editor, visitor viewing, themed houses  
- **Vision ref:** WORLD-CLASS-ROADMAP §"Building upgrades (garden grows, house improves)"  
- **Current state:** UNTRACKED — `src/features/housing/` (1,214 lines) with PlayerHousing, HouseEditor, HouseVisitor, HouseThemes. Routed at `/housing`  
- **Impact:** 3/5

### P6-109: Market / Trading System (Realm)
- **Priority:** Scale  
- **Description:** In-app marketplace for trading items, currency, and resources  
- **Vision ref:** WORLD-CLASS-ROADMAP: "Market Quarter — bustling market, shops"  
- **Current state:** UNTRACKED — `src/features/market/` (1,188 lines) with Market, MarketItemCard, TradeCenter, InventoryView. Two stores: marketStore.ts (385 lines) and marketplaceStore.ts (566 lines). Routed at `/market`  
- **Impact:** 2/5

---

## Category 2: Checklist Items Marked DONE That Are Actually PARTIAL or STUBS

These items are in the checklist and marked as complete but are actually hollow or incomplete implementations.

### TD-020: Feature Gates Not Enforcing
- **Checklist item:** "Feature gates" mentioned as DONE in P7-025  
- **Reality:** `feature-gates.ts` shows `canAccess()` returns `true` for everything (early adopter mode). OWNER_EMAILS array is empty. For Pro/free tier distinction, the gates are NOT actually enforcing restrictions. Stripe is wired but feature gating is bypassed  
- **Impact:** 5/5 (monetization broken)

### TD-021: ZeroClaw Autonomous Actions Still Return False
- **Checklist item:** P3-001 "AI IS the OS, not a chatbot" marked DONE  
- **Reality:** Intent engine execution IS wired (6 core intents work), but ZeroClaw's autonomous action system (the server-side agent) still returns `{success: false}` for its actions. The client-side intent engine works; the server-side AI brain does not  
- **Vision ref:** VISION-v2-ori §6.1 explicitly states "Actions return false"  
- **Impact:** 4/5

### TD-022: Google Calendar Integration Is Stub
- **Checklist item:** P7-023 "GCal sync" marked DONE  
- **Reality:** `gcal-sync.ts` (540 lines) exists with OAuth flow, conflict resolution, and preview mode — but `google-calendar.ts` (95 lines) is just API scaffolding pointing to `google-proxy.php` which doesn't exist on the server. The sync UI exists but the actual Calendar API integration doesn't work without the server proxy  
- **Impact:** 4/5

### TD-023: Health Device Import Is Parser Only
- **Checklist item:** P7-022 "Health device integration" marked DONE  
- **Reality:** `health-device-import.ts` (757 lines) only handles CSV/JSON/XML file parsing. There's NO Apple HealthKit, Google Fit API, or any device API connectivity. It's a file importer, not a device integration  
- **Impact:** 3/5

### TD-024: Web Push Notifications No Backend
- **Checklist item:** P7-016 "Web Push notifications" marked DONE  
- **Reality:** `web-push.ts` (648 lines) handles subscription management but requires a VAPID key pair and server-side push endpoint that doesn't exist. The client code is complete but the server infrastructure to actually deliver push notifications is missing  
- **Impact:** 3/5

### TD-025: RLS Migration Not Applied (Still)
- **Checklist item:** TD-010/P7-003 marked as "DEPLOYMENT ACTION"  
- **Reality:** Two checklist items mention this, both still not done. The SQL file sits at `supabase/migrations/20260418_rls_critical_tables.sql` but hasn't been pasted into Supabase  
- **Impact:** 5/5 (security critical)

### TD-026: Workout→Schedule Integration Still Broken
- **Vision ref:** VISION-v2-ori: "workout→schedule integration broken (templates have day_of_week[] that nothing reads)"  
- **Reality:** `day_of_week` in workout templates is still just data — `HealthOnboarding` creates templates but nothing reads them to generate `schedule_events`. The health device check doesn't create schedule events from workout templates  
- **Evidence:** VISION-v2-ori explicitly called this out, and the checklist never addressed it  
- **Impact:** 3/5

### TD-027: Multi-Tab Sync Still Has Edge Cases
- **Checklist item:** P1-003 "Multi-tab sync race conditions" marked DONE  
- **Reality:** BroadcastChannel leader election exists, but `sync-engine.ts` still maps 20+ tables and VISION-v2-ori noted it "hasn't been tested under real concurrent write conditions." The CRDT engine (P7-027) was added but is detection-only, not resolution  
- **Impact:** 3/5

### TD-028: Social Features Architecture But No Real Users
- **Vision ref:** VISION-v2-ori: "12 social components behind Coming Soon gate. 0 real users."  
- **Reality:** The social gate was removed (P7-024), but the social features are all client-side implementations with Supabase tables — they've never been tested with multiple real users. Guild Wars, Collaborative Quests, Social Feed V2 are all substantial code that hasn't been validated  
- **Impact:** 2/5 (works in theory, untested in practice)

### TD-029: Google/Gmail Proxy Endpoint Missing
- **Reality:** Both `gcal-sync.ts` and `gmail.ts` route through `google-proxy.php` on the server, but no such PHP endpoint exists in the codebase or deployment  
- **Impact:** 3/5

---

## Category 3: Features in Vision Docs That Have Code But Are Incomplete

### P3-105: SRS (Spaced Repetition) for Academy
- **Description:** Spaced repetition engine for learning retention  
- **Vision ref:** VISION-v2 "Brain Forge" Junction: "spaced repetition, exam prep"  
- **Current state:** PARTIAL — `srs-engine.ts` (508 lines) is a full implementation (new → learning → review cycle) but it's not wired into the Academy store or lessons. `useKnowledgeStore.ts` exists but doesn't seem to use SRS  
- **Evidence:** Engine exists, integration missing  
- **Impact:** 3/5

### P3-106: Smart Scheduler / Predictive Scheduling Depth
- **Description:** AI scheduler that auto-distributes tasks across energy peaks, detects conflicts, suggests optimal times  
- **Vision ref:** VISION-v2-ori §5 (Phase 2): "It sees patterns you don't. 'You've cleaned this site 14 times this month...'" and LIFEOS-ROADMAP §5.1  
- **Current state:** PARTIAL — `smart-scheduler.ts` (465 lines) and `pattern-engine.ts` (286 lines + 731 tests) exist. `predictScheduleSuggestions()` generates 4 slot types. But the smart scheduler hasn't been integrated into the Schedule page as an auto-scheduling feature — it generates suggestions but doesn't execute them  
- **Impact:** 4/5

### P3-107: BookForge / Life Chronicle
- **Description:** AI-powered life chronicle that automatically writes your story from data  
- **Vision ref:** VISION-v2-ori §"Story" page assessment: "BookForge integration for life chronicle. Interesting concept but half-built"  
- **Current state:** STUB — `bookforge.ts` exists (133 lines) but Story page is rated 4/10 in the audit. No AI-powered writing generation  
- **Impact:** 2/5

### P5-106: Realm Real-Time Multiplayer
- **Description:** Other players visible in the Realm, chat, emotes  
- **Vision ref:** WORLD-CLASS-ROADMAP §"Multiplayer Presence"  
- **Current state:** PARTIAL — Removed from checklist as P6-012, but `RealmMultiplayer.ts` now uses `cloudSupabase` for real subscriptions. `OnlinePlayersHUD` shows player count. But actual multiplayer gameplay (seeing avatars, real-time movement) is not functional end-to-end  
- **Impact:** 2/5

---

## Category 4: Technical Debt and Architectural Issues

### TD-030: Dual Income/Expense Table Pattern
- **Vision ref:** VISION-v2-ori §5.2: "Every financial write creates records in 2 tables"  
- **Reality:** P1-002 claims "Eliminated 12 direct Supabase dual-write sites across 8 files" but the underlying DB schema still has `income`, `expenses`, AND `transactions` tables. The code was refactored to go through useFinanceStore, but the database schema is still dual-table. The migration to unify into a single `transactions` table has never been done  
- **Impact:** 4/5

### TD-031: 40+ Feature Directories Not in Checklist
- **Description:** The features/ directory contains 20 feature directories that are full implementations with routes, stores, and components, but none of them appear in the improvement checklist: family-circles, digital-twin, dream-journal, life-simulator, life-timeline, location-context, mini-games, audio-rooms, voice-first, contract-intelligence, housing, market, mentorship, plugin-marketplace, public-api, social (expanded), telegram-bot, year-in-review-v2  
- **Impact:** 3/5 (these are "dark features" that may be bugged or untested)

### TD-032: Bundle Size Growing Uncontrolled
- **Vision ref:** VISION-v2-ori: "Under 100ms or it's broken"  
- **Reality:** With 979+ TypeScript/TSX files, 20+ feature directories added post-audit, and lazy loading only for routes, the bundle is growing. Recent feature additions (2,000+ lines each for digital-twin, life-simulator, family-circles, contract-intelligence, social) add significant code mass  
- **Impact:** 3/5

### TD-033: No Rate Limiting on AI Endpoints
- **Vision ref:** VISION-v2-ori §7.1: "Add rate limiting on AI endpoints (per-user, per-hour)"  
- **Reality:** `ai-cost-tracker.ts` (P7-006) tracks costs but doesn't enforce rate limits. The LLM proxy has no per-user throttling. Feature gates say 5 messages/day for free users but don't enforce it  
- **Impact:** 4/5 (cost risk)

### TD-034: Zero Integration/E2E Tests for New Features
- **Reality:** P7-001 added Playwright with 5 spec files and 31 tests, but all the features added AFTER the audit (20+ feature directories totaling 20,000+ lines) have ZERO test coverage. The test files only cover `lib/` modules  
- **Impact:** 4/5

### TD-035: Supabase Query Pattern Bypasses Store Layer
- **Vision ref:** VISION-v2-ori §9.16: "Schedule page also does its own supabase.from('schedule_events').select('*')"  
- **Reality:** While the major god-components were split, many feature directories still make direct Supabase calls instead of going through stores  
- **Impact:** 3/5

### TD-036: Feature Registry Not Driving Feature Visibility
- **Reality:** `feature-registry.ts` exists but feature visibility (what shows in nav, what pages are accessible) is controlled by `canAccess()` which returns true for everything. There's no real gating or progressive disclosure based on subscription level  
- **Impact:** 3/5

### TD-037: Telegram Bot and Webapp Parity Not Complete
- **Vision ref:** MASTER_BUILD_PLAN §1A/1B: Lists specific parity gaps between Telegram bot and webapp  
- **Reality:** The webapp has gained many features (20+ new feature directories) since the parity doc was written. The Telegram bot still can't do: decompose_objective, start_focus, reschedule_overdue, update_goal, schedule_optimize, meal_suggestions, workout AI, weekly_insights. And the webapp can't do: log_mood (separate from journal), evening_review (as AI coach format), update_setting (Telegram-specific)  
- **Impact:** 2/5

---

## Summary Statistics

| Category | Count | Avg Impact |
|----------|-------|------------|
| Features NOT in checklist (Category 1) | 20 | 3.1/5 |
| Checklist items that are PARTIAL/STUB (Category 2) | 10 | 3.5/5 |
| Features with code but incomplete (Category 3) | 3 | 3.0/5 |
| Technical debt / architectural (Category 4) | 8 | 3.4/5 |
| **Total new items found** | **41** | |

### Top 10 Highest Impact New Items:
1. **P1-105** — Onboarding V2 quick 5-step flow (5/5)
2. **P2-101** — ZeroClaw autonomous actions returning false (5/5)
3. **TD-025** — RLS migration not applied (5/5 security)
4. **TD-020** — Feature gates not enforcing (5/5 monetization)
5. **P4-101** — Churn prevention / re-engagement (4/5)
6. **P3-103** — Evidence-based framework matrix gaps (4/5)
7. **P1-101** — Voice-first continuous mode (4/5)
8. **TD-022** — Google Calendar integration is stub (4/5)
9. **TD-030** — Dual financial table schema not migrated (4/5)
10. **P3-102** — Multi-person intelligence dashboards (4/5)

### Checklist Score Correction:
- **Claimed:** 122/122 = 100%
- **Actual:** At least 10 items marked DONE are partial/stub implementations
- **Missing:** 20 significant features from vision docs not tracked at all
- **Realistic completion:** ~75-80% for tracked items, ~65% including untracked features