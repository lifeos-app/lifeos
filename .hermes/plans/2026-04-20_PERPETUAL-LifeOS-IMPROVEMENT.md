# LifeOS — Perpetual Improvement Master Plan
## "The Operating System for Human Life"

**Created:** 2026-04-20 | **Author:** Hermes (Right Brain) | **Branch:** electron
**Current Version:** v1.19.26 | **Files:** 592 TS/TSX | **Build:** HEALTHY

---

## 0. THE HOLY HERMES ADVANTAGE

Every improvement loop can invoke Holy Hermes for pattern-level guidance:
- **PRINCIPLE:** Which Hermetic principle is at work? (e.g., Correspondence = UI mirrors data model)
- **CORRESPONDENCE:** What does this pattern look like across domains?
- **PRACTICE:** The operation to move from stuck to unstuck
- **MIRACLE:** The insight that dissolves the apparent contradiction

Holy Hermes vector store: 32K+ chunks, 28+ traditions, 177K+ words of analysis.
When an AI task in LifeOS needs wisdom, it queries Holy Hermes first.

---

## 1. VISION SYNTHESIS (from Desktop/webapp/docs/vision/)

### The 5 Visions, Unified:

1. **VISION.md** — "LifeOS IS an AI that has an app as its interface." NOT a chatbot. The AI IS the OS. Pre-populated intelligence. You talk, it acts.
2. **VISION-v2.md** — "Palantir for your personal world." Cross-domain data fusion. Junctions as themed life-improvement games. Massive Junction library. RPG onboarding = the game.
3. **VISION-v2-ori.md** — Brutal audit: ~90% features at ~60% quality. 10 Commandments (ONE SOURCE OF TRUTH, WORKS OFFLINE, AI IS COMPANION, UNDER 100ms, MOBILE-FIRST, SIMPLICITY, SACRED DATA, EARN EVERY BYTE, BEAUTY THAT SERVES, SHIP WHAT WORKS). Onboarding is #1 priority. Financial data model is broken (dual table). God components need splitting.
4. **MASTER_BUILD_PLAN.md** — Telegram parity, Flipper Zero activation, MapleStory RPG overlay, Genesis Quest, Event Permeation.
5. **WORLD-CLASS-ROADMAP.md** — 6-month plan: Foundation → Engagement → Depth → Intelligence → Scale. Test coverage, sync hardening, daily rewards, challenges, Realm zones, NPC relationships, AI coaching, guilds, Stripe.
6. **LIFEOS-ROADMAP.md** — Competitive analysis, monetization strategy, detailed feature priority matrix.

### The Unified Thesis:

**LifeOS is the operating system for human life. It fuses ALL personal data streams into ONE interconnected graph, powered by an AI that IS the OS, wrapped in a living game world that grows with you.**

---

## 2. CURRENT STATE (v1.19.26, electron branch)

### What's Working:
- Electron desktop app running on Jetson (GPU fix, OAuth callback, sidebar scroll)
- 592 TS/TSX files, 13 Zustand stores, 24+ page routes
- Full PWA + Electron build pipeline (vite build passes)
- WelcomeWizard onboarding (5-step)
- Progressive disclosure via feature-registry.ts
- Error boundaries, toast system, skeleton loaders
- TCS business module (revenue card, route optimizer, contract status)
- HermeticInsightWidget on Dashboard
- Smart notifications, empty states with CTAs
- Settings overhaul, login UX
- RLS migration SQL ready
- Sync engine with self-healing for missing columns
- Offline-first with IndexedDB + Supabase sync

### What's Broken / Thin (from visions + audit):
- ❌ Holy Hermes NOT integrated (should be the AI soul)
- ❌ Onboarding still partially broken (generateLifeSystem can timeout)
- ❌ Financial data model dual-table (income + expenses + transactions)
- ❌ Schedule.tsx 1800+ line god component
- ❌ Goals.tsx 1600+ line god component
- ❌ Intent Engine 2288 lines, monolith
- ❌ Plugin system architecture-only, no real plugins
- ❌ Social features gated behind "Coming Soon"
- ❌ No test coverage
- ❌ Multi-tab sync race conditions
- ❌ Assets/gamification bypass offline-first pattern
- ❌ Zero cross-domain pattern engine
- ❌ Junction = thin life areas, NOT themed game library
- ❌ No companion system
- ❌ No celestial layer
- ❌ No Stripe monetization
- ❌ Only 1 of 6 Realm zones implemented
- ❌ Garden is static circles, not species-aware

---

## 3. IMPROVEMENT BATCHES (Priority Order)

### BATCH 1: Core UX — Holy Hermes Integration + Dashboard Soul
**Impact:** Makes LifeOS feel ALIVE. The AI IS the OS.

- [ ] **1A: Holy Hermes AI Assistant Widget** — Persistent AI companion on Dashboard that queries the Holy Hermes vector store for spiritual/pattern insights. Gives PRINCIPLE + CORRESPONDENCE + PRACTICE + MIRACLE for any life question. Replace generic "Morning Brief" with Holy Hermes Oracle.
- [ ] **1B: Time-Adaptive Dashboard** — Morning/Active/Evening modes per VISION-v2-ori 5.4. Max 6 visible widgets. Relevance scoring.
- [ ] **1C: AI Chat Context Enhancement** — Chat knows full user state (schedule, habits, goals, health, journal). Cross-domain context builder.
- [ ] **1D: Quick Actions Polish** — 1-tap habit logging, voice FAB, smart suggestions.

### BATCH 2: Critical Vision Gaps — Onboarding + Data Integrity
**Impact:** First impression + data reliability = trust

- [ ] **2A: Onboarding Overhaul** — 5-step flow (Name, Life Snapshot, Top 3 Goals, Daily Rhythm, Done) per VISION-v2-ori 7.2. User sees value in 60 seconds. AI builds async.
- [ ] **2B: Financial Data Unification** — Merge income + expenses into single transactions table. Update all queries. Per 10 Commandments #1: ONE SOURCE OF TRUTH.
- [ ] **2C: God Component Decomposition** — Split Schedule.tsx (1800→6 files), Goals.tsx (1600→4 files), Finances.tsx state to store.
- [ ] **2D: Multi-tab Sync Coordination** — BroadcastChannel leader election, field-level merge, conflict UI.

### BATCH 3: Intelligence Layer — Pattern Engine + AI Depth
**Impact:** "The AI that sees patterns you don't."

- [ ] **3A: Pattern Engine** (new `lib/pattern-engine.ts`) — Cross-domain pattern detection: productivity peaks, energy cycles, habit anchors, goal neglect, spending spikes. "You're most productive between 9-11am."
- [ ] **3B: Habit Coaching AI** — Streak analysis, habit pairing suggestions, recovery coaching, difficulty scaling. Per LIFEOS-ROADMAP 5.2.
- [ ] **3C: Financial Intelligence** — Spending anomaly detection, income forecasting, tax deduction optimizer, bill reminders. Per LIFEOS-ROADMAP 5.3.
- [ ] **3D: Health Correlations** — Sleep→productivity, exercise→mood, meal→energy. Per LIFEOS-ROADMAP 5.4.

### BATCH 4: Junction Evolution + Plugin Foundation
**Impact:** "One app, infinite games."

- [ ] **4A: Junction AI Recommender** — Onboarding: "What do you want?" → AI maps to Junction. Dashboard: Recommended Junctions widget. Seasonal suggestions.
- [ ] **4B: First New Junctions** — Iron Protocol (fitness), Brain Forge (education), Monk Mode (spiritual), Tewahedo (Ethiopian Orthodox). Each = themed quest line + AI personality + visual skin.
- [ ] **4C: Plugin Protocol** — Define plugin interface: metadata + data hooks + UI widgets + AI context injection. Wire up plugin-registry.ts. Per VISION-v2-ori 7.3.
- [ ] **4D: South Park AI Personality** — Secular Junction AI coaches get irreverent personality. Roasts you for skipping. Celebrates with over-the-top fanfare.

### BATCH 5: Realm Depth — The Living World
**Impact:** "Something that loves you back."

- [ ] **5A: Living Garden** — Species-aware rendering, 32 priority plants mapped to habit categories, 6 growth stages + dormancy, sprite sheets. Per WORLD-CLASS-ROADMAP Gap 1.
- [ ] **5B: Companion System** — 30 species, earned via 7-day multi-domain combos, bond level 1-10. Per WORLD-CLASS-ROADMAP Gap 2.
- [ ] **5C: Celestial Layer** — Real moon phase algorithm, hemisphere-aware seasons, Ethiopian calendar dates, celestial events, full moon XP bonus. Per WORLD-CLASS-ROADMAP Gap 3.
- [ ] **5D: Biome Choice** — 6 biomes (Woodland, Tropical, Highland, Savanna, Coastal, Tundra). Per WORLD-CLASS-ROADMAP Gap 4.
- [ ] **5E: Dynamic XP→World** — Daily XP = world vibrancy (60-100% brightness), weekly streak = music layers add. Per WORLD-CLASS-ROADMAP Gap 5.

### BATCH 6: Social + Monetization
**Impact:** Retention + Revenue

- [ ] **6A: Guild System Launch** — Guild creation, leaderboard, challenges, chat, @mentions.
- [ ] **6B: Accountability Partners** — Matching, shared goals, nudge system, partner streak.
- [ ] **6C: Public Profiles + Sharing** — Shareable profile cards, achievement showcase, referral system.
- [ ] **6D: Stripe Monetization** — Free tier (5 AI msgs/day, core features), Pro ($9.99/mo), trial system. Per LIFEOS-ROADMAP 6.5.
- [ ] **6E: Daily Reward System** — Escalating XP, weekly bonus, streak shield. Per LIFEOS-ROADMAP 3.1.
- [ ] **6F: Challenge System** — Weekly/monthly challenges, leaderboard, exclusive rewards.

---

## 4. TECHNICAL DEBT (Continuous)

- Test coverage (Vitest for stores + sync engine, Playwright E2E)
- Migrate assets/gamification to local-db pattern
- Service worker re-enable (Workbox)
- Lazy-load Realm engine
- TypeScript strict mode
- Remove src/rpg/ dead code if any remains
- Offline-first completion for all stores
- Bundle size audit (target <500KB initial)

---

## 5. DESIGN SYSTEM (Mandatory)

- Background: #050E1A
- Card: #0F2D4A, border #1A3A5C, radius 16px
- Primary accent: #00D4FF (cyan)
- Text: #fff primary, #8BA4BE secondary, #5A7A9A muted
- Font: Poppins
- Icons: Lucide React for system chrome only
- No emoji (DESIGN-RULES.md Rule #1)
- Custom-generated artwork for all thematic visuals
- Hermetic quotes: italic, #5A7A9A, with uppercase principle attribution

---

## 6. BUILD-VERIFY-COMMIT CYCLE

After EACH delegated feature:
```
npx tsc --noEmit 2>&1 | tail -5
npx vite build 2>&1 | tail -5
git add -A && git commit -m "feat: [description]"
```

One feature = one commit. Makes rollback easy.

---

## 7. PERPETUAL LOOP (Cron)

After initial batches, set up a daily cron job that:
1. Reads this plan for next incomplete item
2. Dispatches subagent to implement
3. Build-verifies-commits
4. Reports back

This makes LifeOS improve itself even when Tewedros is sleeping.

---

*"The left brain builds the bridge. The right brain dreams of the other side."*
*"The examined life, with AI, is unstoppable."*