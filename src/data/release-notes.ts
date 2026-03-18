/**
 * Release Notes — What's New in LifeOS
 * 
 * Add a new entry here when releasing a new version.
 * Only the CURRENT version is shown to users (not full history).
 * 
 * Format:
 * {
 *   version: '1.x.x',           // Semver version number
 *   date: 'Month DD, YYYY',     // Human-readable release date
 *   title: 'Release Name',      // Catchy 2-4 word title
 *   highlights: [               // Array of feature highlights
 *     { icon: '🎯', text: 'Description of the feature' },
 *     ...
 *   ]
 * }
 */

export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  highlights: Array<{ icon: string; text: string }>;
}

export const releaseNotes: ReleaseNote[] = [
  {
    version: '1.19.20',
    date: 'March 18, 2026',
    title: 'First Task Starts Today',
    highlights: [
      { icon: '✨', text: 'First planned task now appears today (was day 3)' },
      { icon: '✨', text: 'Toast shows task count and week span for clarity' },
    ],
  },
  {
    version: '1.19.19',
    date: 'March 18, 2026',
    title: 'Programmatic Task Spreading (No Duplicate Events)',
    highlights: [
      { icon: '✨', text: 'Removed schedulePreloadedTasks — no more duplicate schedule_events for tasks' },
      { icon: '✨', text: 'Tasks get due_dates spread evenly across objective timeline (target_date or 90d default)' },
      { icon: '✨', text: 'Priority-aware ordering: high/urgent tasks get earlier dates, low tasks later' },
      { icon: '✨', text: 'suggested_week auto-calculated from due_date position' },
    ],
  },
  {
    version: '1.19.18',
    date: 'March 18, 2026',
    title: 'Realistic Task Spreading for Long Plans',
    highlights: [
      { icon: '✨', text: 'LLM prompt: spread tasks across full timeline (1-2/week, not crammed into weeks 1-4)' },
      { icon: '✨', text: 'maxHoursPerDay 8→3: AI tasks cap at 3hrs/day, leaving room for life' },
      { icon: '✨', text: '180-day scheduling window for 6-month plan horizons' },
      { icon: '✨', text: '6-month event fetch for proper conflict avoidance' },
    ],
  },
  {
    version: '1.19.17',
    date: 'March 18, 2026',
    title: 'Fast Parallel Sync with Pagination',
    highlights: [
      { icon: '✨', text: 'Parallel tier-based sync: 17 tables pull simultaneously (was sequential)' },
      { icon: '✨', text: 'Paginated pulls: no more 1000-row truncation on large tables' },
      { icon: '✨', text: 'Skeleton loaders visible during initial sync instead of blank screens' },
    ],
  },
  {
    version: '1.19.16',
    date: 'March 18, 2026',
    title: 'Fix Data Loss on Logout/Login',
    highlights: [
      { icon: '✨', text: 'Initial sync gate: stores wait for Supabase pull before reading local DB' },
      { icon: '✨', text: 'Post-action sync: intent-engine syncs writes to IndexedDB immediately' },
      { icon: '✨', text: 'All stores (goals, tasks, habits, finance, health) gated on initial sync' },
      { icon: '✨', text: 'No more empty screens after re-login' },
    ],
  },
  {
    version: '1.19.15',
    date: 'March 18, 2026',
    title: 'Fix Goal Persistence Across Sessions',
    highlights: [
      { icon: '✨', text: 'Sync Supabase→local IndexedDB after intent-engine writes' },
      { icon: '✨', text: 'Goals/tasks now survive logout/login' },
      { icon: '✨', text: 'All stores invalidated after sync to force UI refresh' },
    ],
  },
  {
    version: '1.19.14',
    date: 'March 18, 2026',
    title: 'Smart Scheduler Week Spreading',
    highlights: [
      { icon: '✨', text: 'Week-aware fallback uses suggested_week instead of hardcoded +7 days' },
      { icon: '✨', text: 'Priority-based day spreading within weeks (urgent→Mon, low→Fri)' },
      { icon: '✨', text: '90-day scheduling window (up from 60)' },
      { icon: '✨', text: 'Debug logging for scheduler decisions' },
    ],
  },
  {
    version: '1.19.13',
    date: 'March 18, 2026',
    title: 'Sync Engine Fix',
    highlights: [
      { icon: '✨', text: 'Fix 400 errors: strip 8 local-only fields before Supabase push' },
      { icon: '✨', text: 'Remove schedule_events double-sync' },
    ],
  },
  {
    version: '1.19.12',
    date: 'March 18, 2026',
    title: 'Notification Navigation + Goals Overhaul',
    highlights: [
      { icon: '✨', text: 'Notification click-through: deep links to specific events, tasks, goals' },
      { icon: '✨', text: 'Goal detail: tabbed layout (Overview, Tasks, Progress, Resources)' },
      { icon: '✨', text: 'Smart scheduling: AI tasks distributed across weeks via suggested_week' },
      { icon: '✨', text: 'Goal hierarchy: visual distinction for objectives, epics, goals' },
      { icon: '✨', text: 'AI generation for epics & goals + manual task add' },
    ],
  },
  {
    version: '1.19.11',
    date: 'March 17, 2026',
    title: 'UX Polish Sprint',
    highlights: [
      { icon: '✨', text: 'Universal header: level-badge → bell → messages → character on all pages' },
      { icon: '✨', text: 'Schedule: 24h default, completed events dimmed + undraggable, pulse modal resets' },
    ],
  },
  {
    version: '1.19.10',
    date: 'March 17, 2026',
    title: 'Screenshot Audit Tools',
    highlights: [
      { icon: '✨', text: '📸 Screenshot audit script captures every page at desktop + mobile viewports' },
      { icon: '✨', text: '🔍 Visual comparison tool generates side-by-side HTML diffs' },
    ],
  },
  {
    version: '1.19.9',
    date: 'March 17, 2026',
    title: 'Interactive Healer & Scholar NPCs',
    highlights: [
      { icon: '✨', text: '💚 Healer NPC reads your health data — suggests sleep, hydration, journaling' },
      { icon: '✨', text: '📚 Scholar NPC tracks education goals — offers focus sessions' },
      { icon: '✨', text: '⚔️ Three interactive NPCs now live in the Realm (Blacksmith, Healer, Scholar)' },
    ],
  },
  {
    version: '1.19.8',
    date: 'March 17, 2026',
    title: 'Companion Progress + Onboarding Close',
    highlights: [
      { icon: '✨', text: '🥚 Companion egg progress widget in Realm — track your 7-day domain streak' },
      { icon: '✨', text: '✕ Close button on realm onboarding for easy escape on mobile' },
      { icon: '✨', text: '✨ Gold glow effect when companion is ready to hatch' },
    ],
  },
  {
    version: '1.19.7',
    date: 'March 17, 2026',
    title: 'Living Garden + Streak XP',
    highlights: [
      { icon: '✨', text: '🌱 Living Garden now renders plants from your habits — watch them grow with your streaks' },
      { icon: '✨', text: '⚡ Streak XP multipliers now work (1.5x-5x at 7/14/30/60/100/365 days)' },
      { icon: '✨', text: '🌿 Growth stage toasts celebrate your plant\'s progress' },
    ],
  },
  {
    version: '1.19.6',
    date: 'March 17, 2026',
    title: 'Onboarding Flow + Tutorial Sync',
    highlights: [
      { icon: '✨', text: '🔄 Tutorial completion now syncs bidirectionally with Supabase (single source of truth)' },
      { icon: '✨', text: '🏰 Dashboard tour auto-chains to Realm onboarding for new users' },
      { icon: '✨', text: '🔙 Realm \'Later\' button cleanly returns to Dashboard' },
    ],
  },
  {
    version: '1.19.5',
    date: 'March 17, 2026',
    title: 'Notification Render Fix',
    highlights: [
      { icon: '✨', text: '🔧 Fixed infinite re-render loop (React #185) caused by useNotifications hook' },
      { icon: '✨', text: '⚡ Notifications now derive data from stable store references instead of independent hooks' },
    ],
  },
  {
    version: '1.19.4',
    date: 'March 17, 2026',
    title: 'Fix Google Sign-In — Remove PKCE Race Condition',
    highlights: [
      { icon: '✨', text: 'Removed manual exchangeCodeForSession that raced with Supabase built-in PKCE handler' },
      { icon: '✨', text: 'OAuth callback now waits for Supabase onAuthStateChange instead of double-exchanging' },
      { icon: '✨', text: 'Fixes \'PKCE code verifier not found\' that prevented Google sign-in' },
    ],
  },
  {
    version: '1.19.3',
    date: 'March 17, 2026',
    title: 'PKCE Auth Resilience',
    highlights: [
      { icon: '✨', text: 'PKCE exchange failure now triggers clean signOut instead of leaving broken half-auth state' },
      { icon: '✨', text: 'Prevents React infinite re-render loop (error #185) when code verifier is missing' },
      { icon: '✨', text: 'User sees clean login page instead of crash on stale OAuth callbacks' },
    ],
  },
  {
    version: '1.19.2',
    date: 'March 17, 2026',
    title: 'Sage Dialogue Fix + Onboarding Auth',
    highlights: [
      { icon: '✨', text: 'Fixed Sage NPC \'arcane channels flicker\' error — removed skipAuth that caused 401 proxy rejections' },
      { icon: '✨', text: 'SetupDialogue also fixed for same auth issue' },
      { icon: '✨', text: 'Sage now properly authenticates through LLM proxy' },
    ],
  },
  {
    version: '1.19.1',
    date: 'March 17, 2026',
    title: 'Notification Centre + Sage Diagnostics',
    highlights: [
      { icon: '✨', text: 'Bell icon replaces social button in header' },
      { icon: '✨', text: 'Notification dropdown: overdue tasks, upcoming events, goal milestones, streak-at-risk habits' },
      { icon: '✨', text: 'Portal-rendered with error boundary isolation' },
      { icon: '✨', text: 'Mobile full-width, desktop right-aligned dropdown' },
    ],
  },
  {
    version: '1.19.0',
    date: 'March 17, 2026',
    title: 'Interactive Realm NPCs + Blacksmith Forge',
    highlights: [
      { icon: '✨', text: 'Feature Service Layer — GoalService, HabitService, HealthService, FinanceService, ScheduleService' },
      { icon: '✨', text: 'Blacksmith NPC opens interactive forge panel — create goals conversationally' },
      { icon: '✨', text: 'Goal creation awards 25 XP (productivity category)' },
      { icon: '✨', text: 'NPC panel portaled + error-bounded per prompt 004 architecture' },
    ],
  },
  {
    version: '1.18.8',
    date: 'March 17, 2026',
    title: 'Schedule & Event Regression Fix',
    highlights: [
      { icon: '✨', text: 'color-mix() fallbacks on all event elements' },
      { icon: '✨', text: 'Cross-midnight events now visible on both days' },
      { icon: '✨', text: 'EventDrawer complete button gradient restored' },
      { icon: '✨', text: 'Desktop multi-column schedule layers at ≥1200px' },
    ],
  },
  {
    version: '1.18.7',
    date: 'March 17, 2026',
    title: 'Sidebar Panel Portals',
    highlights: [
      { icon: '✨', text: 'Tutorial + Setup panels render via portal — fixes crash in collapsed sidebar' },
      { icon: '✨', text: 'SetupList card layout redesigned — no image/text overlap' },
      { icon: '✨', text: 'Feedback modal z-index fixed to 10005' },
    ],
  },
  {
    version: '1.18.6',
    date: 'March 17, 2026',
    title: 'Sidebar Always-Render Fix',
    highlights: [
      { icon: '✨', text: 'All sidebar labels always in DOM — CSS is sole visibility authority' },
      { icon: '✨', text: 'Eliminates JSX conditional rendering that caused mobile hamburger text disappearing' },
    ],
  },
  {
    version: '1.18.5',
    date: 'March 17, 2026',
    title: 'Modular Architecture',
    highlights: [
      { icon: '✨', text: 'Error boundaries on all 24 widgets + 6 overlays' },
      { icon: '✨', text: 'Sidebar CSS scoped to desktop — hamburger bug structurally eliminated' },
      { icon: '✨', text: 'Feature registry — single source of truth for nav' },
      { icon: '✨', text: 'AI Chat stacking isolation' },
    ],
  },
  {
    version: '1.18.4',
    date: 'March 17, 2026',
    title: 'Mobile Sidebar Force Full',
    highlights: [
      { icon: '✨', text: 'Mobile hamburger now forces full sidebar rendering — labels always visible on mobile' },
      { icon: '✨', text: 'Added forceFull prop to Sidebar, bypasses collapsed state entirely when mobile menu is open' },
    ],
  },
  {
    version: '1.18.3',
    date: 'March 17, 2026',
    title: 'Auth Resilience',
    highlights: [
      { icon: '✨', text: 'Fixed PKCE code reuse on hard refresh — URL cleaned before exchange' },
      { icon: '✨', text: 'Added 10s safety timeout on getSession to prevent infinite loading screen' },
    ],
  },
  {
    version: '1.18.2',
    date: 'March 17, 2026',
    title: 'CSS Resilience',
    highlights: [
      { icon: '✨', text: 'Added fallback values to all CSS custom properties in sidebar, mobile header, and mobile nav' },
      { icon: '✨', text: 'Prevents blank/invisible text on hard refresh before theme CSS loads' },
    ],
  },
  {
    version: '1.18.1',
    date: 'March 17, 2026',
    title: 'Mobile Hamburger Fix',
    highlights: [
      { icon: '✨', text: 'Fixed mobile sidebar showing icons-only without labels when opened via hamburger' },
      { icon: '✨', text: 'Added CSS overrides ensuring collapsed state never hides labels on mobile' },
    ],
  },
  {
    version: '1.18.0',
    date: 'March 17, 2026',
    title: 'Celestial Calendar & Tutorials',
    highlights: [
      { icon: '✨', text: 'Ethiopian calendar in Junction (Tewahedo tradition)' },
      { icon: '✨', text: 'Moon phase + season widget on Dashboard' },
      { icon: '✨', text: 'Slide tutorials for Realm and Junction first visits' },
    ],
  },
  {
    version: '1.17.0',
    date: 'March 17, 2026',
    title: 'Shell Architecture + Overlay Portals',
    highlights: [
      { icon: '✨', text: 'AI chat widget now immune to layout CSS changes (portal architecture)' },
      { icon: '✨', text: 'Mobile sidebar shows full labels when opened via hamburger' },
      { icon: '✨', text: 'Schedule page: side-by-side timeline + context panel at desktop' },
      { icon: '✨', text: 'Goals page: centered layout at desktop' },
      { icon: '✨', text: 'All overlays render outside layout DOM via tiered portal system' },
      { icon: '✨', text: 'CSS custom property contract (--sidebar-w, --header-h, --nav-h)' },
    ],
  },
  {
    version: '1.16.1',
    date: 'March 17, 2026',
    title: 'Hamburger Fix + Shell Prompt',
    highlights: [
      { icon: '✨', text: 'Fixed: FSP hamburger button no longer shows on desktop' },
      { icon: '✨', text: 'Fixed: Sidebar overlay no longer blanks screen on desktop' },
    ],
  },
  {
    version: '1.16.0',
    date: 'March 17, 2026',
    title: 'Desktop UX v2 + AI Fix',
    highlights: [
      { icon: '✨', text: 'Responsive sidebar with toggle at all widths' },
      { icon: '✨', text: 'Sidebar persists on fullscreen pages (Dashboard, Health, Finances)' },
      { icon: '✨', text: 'Dashboard widget grid at desktop (2-column layout)' },
      { icon: '✨', text: 'Bottom nav hidden when sidebar visible (≥769px)' },
      { icon: '✨', text: 'All AI features switched from expired Gemini to OpenRouter' },
      { icon: '✨', text: 'Habit cards constrained, empty states centered at desktop' },
    ],
  },
  {
    version: '1.15.0',
    date: 'March 17, 2026',
    title: 'Desktop UX Overhaul',
    highlights: [
      { icon: '✨', text: 'Persistent sidebar on desktop — always visible, full navigation' },
      { icon: '✨', text: 'Multi-column layouts for Dashboard, Health, Finances, Character, all pages' },
      { icon: '✨', text: 'Bottom nav stays on tablet, hidden on desktop' },
      { icon: '✨', text: 'Fixed: Realm invite showing for existing users' },
      { icon: '✨', text: 'Reduced dashboard flickering' },
    ],
  },
  {
    version: '1.14.11',
    date: 'March 17, 2026',
    title: 'Smooth Onboarding & Desktop',
    highlights: [
      { icon: '✨', text: '🏠 New users land on Dashboard first — no more onboarding gate' },
      { icon: '✨', text: '🏰 Realm onboarding becomes opt-in invite card on Dashboard' },
      { icon: '✨', text: '✨ Dashboard loads smoothly — no more flashing/shifting' },
      { icon: '✨', text: '🖥️ Desktop layout: multi-column grid, max-width content, proper spacing' },
      { icon: '✨', text: '🔧 Desktop header fixed (was hiding at wrong breakpoint)' },
    ],
  },
  {
    version: '1.14.10',
    date: 'March 17, 2026',
    title: 'Security Hardening',
    highlights: [
      { icon: '✨', text: '🔒 Extracted all Supabase keys and API URLs to environment variables' },
      { icon: '✨', text: '🛡️ Added CORS origin restrictions on server-side API endpoints' },
      { icon: '✨', text: '⚡ Added rate limiting to anonymous API access' },
      { icon: '✨', text: '📄 Added .env.example for self-hosting' },
    ],
  },
  {
    version: '1.14.9',
    date: 'March 15, 2026',
    title: 'Realm Interaction Restore',
    highlights: [
      { icon: '✨', text: 'Reverted broken tap-consumed logic — movement works normally again' },
      { icon: '✨', text: 'NPC check still prioritized first in tap handler' },
      { icon: '✨', text: 'All sub-agent features intact (biomes, emotes, mini-characters)' },
    ],
  },
  {
    version: '1.14.8',
    date: 'March 15, 2026',
    title: 'NPC Interaction Fix',
    highlights: [
      { icon: '✨', text: 'Fixed NPC tap detection — NPCs are now checked first with larger hit radius' },
      { icon: '✨', text: 'Tapping an NPC now stops character movement' },
      { icon: '✨', text: 'Prevented entities from blocking NPC taps' },
    ],
  },
  {
    version: '1.14.7',
    date: 'March 15, 2026',
    title: 'Celestial Companions',
    highlights: [
      { icon: '✨', text: 'Companion animals earned through multi-domain consistency — 24 species across 8 categories' },
      { icon: '✨', text: 'Moon phases, seasons, Ethiopian holidays, meteor showers with XP bonuses' },
      { icon: '✨', text: 'Bond system with 10 levels, canvas-rendered companions that follow your character' },
    ],
  },
  {
    version: '1.14.6',
    date: 'March 15, 2026',
    title: 'User Data Isolation',
    highlights: [
      { icon: '✨', text: 'All localStorage caches now scoped per user ID — no cross-account data leaks' },
      { icon: '✨', text: 'Morning brief, health AI, finance AI, profile cache, and pulse all isolated' },
    ],
  },
  {
    version: '1.14.5',
    date: 'March 15, 2026',
    title: 'Profile & Onboarding Fixes',
    highlights: [
      { icon: '✨', text: 'Morning brief uses actual user name, not character name' },
      { icon: '✨', text: 'Onboarding skip no longer requires double-skip (race condition fixed)' },
    ],
  },
  {
    version: '1.14.4',
    date: 'March 15, 2026',
    title: 'Profile & Onboarding Fixes',
    highlights: [
      { icon: '✨', text: 'Morning brief now uses actual user name, not character name' },
      { icon: '✨', text: 'Onboarding skip no longer requires double-skip (race condition fixed)' },
    ],
  },
  {
    version: '1.14.3',
    date: 'March 15, 2026',
    title: 'Morning Brief Fix',
    highlights: [
      { icon: '✨', text: 'Fixed morning brief querying wrong table for user name' },
      { icon: '✨', text: 'Brief now correctly reads from user_profiles instead of nonexistent profiles table' },
    ],
  },
  {
    version: '1.14.2',
    date: 'March 15, 2026',
    title: 'Life Pulse Popup',
    highlights: [
      { icon: '✨', text: 'Life Pulse is now a timed popup modal instead of a dashboard card' },
      { icon: '✨', text: 'Check-ins appear every 4 hours, dismissed until next window' },
    ],
  },
  {
    version: '1.14.1',
    date: 'March 15, 2026',
    title: 'Privacy Scrub',
    highlights: [
      { icon: '✨', text: 'Removed all hardcoded personal data — venue names, client details, email addresses' },
      { icon: '✨', text: 'App is now truly multi-user safe — no user sees another user\'s business data' },
    ],
  },
  {
    version: '1.14.0',
    date: 'March 15, 2026',
    title: 'Living Garden + Stability Sprint',
    highlights: [
      { icon: '✨', text: 'Living Garden v2 — 32 real botanical species with growth stages, dormancy, and Ancient shimmer' },
      { icon: '✨', text: 'Rate limits now per-user (was accidentally shared) — 100/day, 30/hr, 8/min burst' },
      { icon: '✨', text: 'Schedule, Journal, Habits pages now use stores exclusively (no more direct Supabase calls)' },
      { icon: '✨', text: 'Removed hardcoded locations and messages' },
      { icon: '✨', text: 'Performance: pathfinding cache, NPC viewport culling, Realm preview pause, memoized finance calcs' },
      { icon: '✨', text: 'RealmEventBus errors now logged instead of swallowed' },
      { icon: '✨', text: 'Centralized streak calculation — single source of truth' },
    ],
  },
  {
    version: '1.13.16',
    date: 'March 15, 2026',
    title: 'Phase 0 Critical Fixes',
    highlights: [
      { icon: '✨', text: 'Habit streaks now calculate correctly — entire gamification cascade restored' },
      { icon: '✨', text: 'Deep Think toggle removed — auto-enhancement works transparently' },
      { icon: '✨', text: 'Weekly insights user_id filtering — security hardened' },
      { icon: '✨', text: 'Live activity data persists offline — no more lost income' },
      { icon: '✨', text: 'Morning brief uses your actual name' },
      { icon: '✨', text: 'RPG class stat bonuses now apply' },
      { icon: '✨', text: 'App version displays correctly in Settings' },
    ],
  },
  {
    version: '1.13.15',
    date: 'March 14, 2026',
    title: 'NPC Characters & AI Auth Fix',
    highlights: [
      { icon: '✨', text: '🧑‍🤝‍🧑 NPCs now render as chibi characters (same art style as player)' },
      { icon: '✨', text: '🔮 11 new tradition icons — Daoism yin-yang, Islam crescent, Buddhism dharma wheel, Hindu Om' },
      { icon: '✨', text: '🔒 AI widget: auto-refreshes expired session token instead of showing error' },
      { icon: '✨', text: '🌐 Junction: dead faith path links removed, only live sites shown' },
    ],
  },
  {
    version: '1.13.14',
    date: 'March 14, 2026',
    title: 'Living Garden & Junction Fixes',
    highlights: [
      { icon: '✨', text: '🌿 Species-aware botanical garden — 8 unique plant silhouettes with bezier curves' },
      { icon: '✨', text: '🌱 5 growth stages per species with distinct visuals (seed → legendary)' },
      { icon: '✨', text: '✨ Legendary effects: cherry blossom petal fall, fern bioluminescence, cedar mist' },
      { icon: '✨', text: '🔮 Junction: removed 6 dead faith path links, fixed AI cache bug' },
      { icon: '✨', text: '⚡ Junction AI: wired up quick action buttons, cleaner UI' },
    ],
  },
  {
    version: '1.13.13',
    date: 'March 14, 2026',
    title: 'Realm Time Tracker + Doc Cleanup',
    highlights: [
      { icon: '✨', text: 'Realm HUD shows daily time spent in The Realm' },
      { icon: '✨', text: '103 docs organized into labeled subdirectories' },
    ],
  },
  {
    version: '1.13.12',
    date: 'March 14, 2026',
    title: 'Beta Stability Sprint',
    highlights: [
      { icon: '✨', text: '45+ empty catch blocks now log warnings' },
      { icon: '✨', text: '6 null safety fixes (streaks, goals, voice transcript)' },
      { icon: '✨', text: 'Health/Habit/Goal input validation with toast feedback' },
      { icon: '✨', text: 'HealthAI JSON sanitization improved' },
      { icon: '✨', text: 'Race condition guards on HealthAI + JunctionAI' },
    ],
  },
  {
    version: '1.13.11',
    date: 'March 14, 2026',
    title: 'Skip Onboarding Race Fix',
    highlights: [
      { icon: '✨', text: 'DB write completes before store update — no more double-skip' },
      { icon: '✨', text: 'Loading state on Skip button prevents confusion' },
    ],
  },
  {
    version: '1.13.10',
    date: 'March 14, 2026',
    title: 'Skip Onboarding Fix',
    highlights: [
      { icon: '✨', text: 'Later/Skip button now works instantly — store update before network' },
      { icon: '✨', text: 'Added onSkipLater callback for proper UI exit' },
      { icon: '✨', text: 'Supabase persist is now fire-and-forget (non-blocking)' },
    ],
  },
  {
    version: '1.13.9',
    date: 'March 14, 2026',
    title: 'Skip Onboarding Fix',
    highlights: [
      { icon: '✨', text: 'Fix skip button returning to onboarding instead of dashboard' },
    ],
  },
  {
    version: '1.13.8',
    date: 'March 14, 2026',
    title: 'Setup Dialogue Fix',
    highlights: [
      { icon: '✨', text: 'Fix Warrior/Sage/Merchant LLM auth - was failing on every prompt' },
      { icon: '✨', text: 'Fix skip onboarding causing sign-out instead of dashboard' },
    ],
  },
  {
    version: '1.13.7',
    date: 'March 14, 2026',
    title: 'MapleStory Visual',
    highlights: [
      { icon: '✨', text: 'Chibi character sprites replace rectangles' },
      { icon: '✨', text: 'Full character creation UI (Hair/Face/Skin/Top/Bottom/Shoes)' },
      { icon: '✨', text: 'Parallax mountain + cloud backgrounds' },
      { icon: '✨', text: 'Idle bounce animation + dark outlines' },
    ],
  },
  {
    version: '1.13.6',
    date: 'March 14, 2026',
    title: 'NPC Dialogue Split',
    highlights: [
      { icon: '✨', text: 'Setup dialogues now use split layout (stage top / dialogue bottom)' },
      { icon: '✨', text: 'Matches Realm onboarding visual style' },
      { icon: '✨', text: 'Realm dialogue active state CSS' },
    ],
  },
  {
    version: '1.13.5',
    date: 'March 14, 2026',
    title: 'Fixes Sprint',
    highlights: [
      { icon: '✨', text: '6 bug fixes from user testing' },
      { icon: '✨', text: 'Schedule empty state fixed' },
      { icon: '✨', text: 'NPC dialogue unification in progress' },
    ],
  },
  {
    version: '1.13.4',
    date: 'March 13, 2026',
    title: 'Realm UX Sprint',
    highlights: [
      { icon: '✨', text: 'World map overlay with Life City portal' },
      { icon: '✨', text: 'Realm command panel (character/quests/chat tabs)' },
      { icon: '✨', text: 'Onboarding polish (bigger Sage, visible Later button)' },
      { icon: '✨', text: 'Keyboard input fix (typing doesn\'t move character)' },
      { icon: '✨', text: 'AIChat/VoiceFAB hidden in Realm' },
    ],
  },
  {
    version: '1.13.3',
    date: 'March 13, 2026',
    title: 'Beta Sprint',
    highlights: [
      { icon: '✨', text: 'P0 bug fixes (EventDrawer, Junction, Health, Login)' },
      { icon: '✨', text: 'Tier-based level visuals (10 tiers, glow effects, rainbow transcendent)' },
      { icon: '✨', text: 'Life Pulse daily check-in widget' },
      { icon: '✨', text: 'Streak warning cards with Keep Alive' },
      { icon: '✨', text: 'XP combo counter' },
      { icon: '✨', text: 'Health input validation' },
      { icon: '✨', text: 'Touch target improvements' },
    ],
  },
  {
    version: '1.13.2',
    date: 'March 13, 2026',
    title: 'Right-Sized Sage',
    highlights: [
      { icon: '✨', text: 'Sage character scaled down for mobile — no longer fills entire stage' },
      { icon: '✨', text: 'Speech bubbles now visible above characters' },
      { icon: '✨', text: 'Dashboard tutorial will trigger after onboarding completes' },
    ],
  },
  {
    version: '1.13.1',
    date: 'March 13, 2026',
    title: 'Character Creation Live',
    highlights: [
      { icon: '✨', text: 'Choose your Industry — Health, Education, Business, Wellbeing, or Tech' },
      { icon: '✨', text: 'Full character customization — skin tone, hair, outfit color, name' },
      { icon: '✨', text: 'Character appears on stage in real-time as you customize' },
      { icon: '✨', text: 'I am [Name]! speech bubble on confirm' },
      { icon: '✨', text: 'Sage welcomes you personally after creation' },
    ],
  },
  {
    version: '1.13.0',
    date: 'March 13, 2026',
    title: 'The Awakening',
    highlights: [
      { icon: '✨', text: 'Sage NPC now appears as a live sprite on the onboarding stage' },
      { icon: '✨', text: 'Speech bubbles above characters mirror the dialogue below' },
      { icon: '✨', text: 'Character creation bug fixed — no more auto-skip to default warrior' },
      { icon: '✨', text: 'Dialogue pacing fixed — no more racing through text' },
      { icon: '✨', text: 'Later button now requires confirmation before skipping' },
      { icon: '✨', text: 'NPCs appear on stage during Health and Finance setup too' },
    ],
  },
  {
    version: '1.12.23',
    date: 'March 13, 2026',
    title: 'Chat Attachments Fixed',
    highlights: [
      { icon: '✨', text: 'Image attachments now display properly (storage bucket made public)' },
      { icon: '✨', text: 'Camera option added — tap paperclip for Camera or Gallery' },
      { icon: '✨', text: 'Broken image fallback instead of broken icon' },
    ],
  },
  {
    version: '1.12.22',
    date: 'March 13, 2026',
    title: 'Clear the Way',
    highlights: [
      { icon: '✨', text: 'AI widget and voice FAB auto-hide when typing in any input field (Social chat, search, etc.)' },
    ],
  },
  {
    version: '1.12.21',
    date: 'March 13, 2026',
    title: 'See What They See',
    highlights: [
      { icon: '✨', text: 'Removed owner bypass — owner experiences LifeOS as a regular member' },
    ],
  },
  {
    version: '1.12.20',
    date: 'March 13, 2026',
    title: 'Social Goes Live',
    highlights: [
      { icon: '✨', text: 'Social/Community page now available to all members' },
      { icon: '✨', text: 'Fixed RLS infinite recursion on group tables' },
      { icon: '✨', text: 'Friends, Guilds, Messages, Kingdom — all unlocked' },
    ],
  },
  {
    version: '1.12.19',
    date: 'March 13, 2026',
    title: 'Tutorial Skip Persists',
    highlights: [
      { icon: '✨', text: '🎓 Skipping a tutorial now permanently marks it complete — no more re-showing on refresh' },
    ],
  },
  {
    version: '1.12.18',
    date: 'March 13, 2026',
    title: 'No Popups During Onboarding',
    highlights: [
      { icon: '✨', text: '🚫 What\'s New popup and update banners suppressed during Sage onboarding' },
    ],
  },
  {
    version: '1.12.17',
    date: 'March 13, 2026',
    title: 'Hide All Overlays During Onboarding',
    highlights: [
      { icon: '✨', text: '🚫 Event drawer slider also hidden during Sage onboarding' },
    ],
  },
  {
    version: '1.12.16',
    date: 'March 13, 2026',
    title: 'Onboarding Polish',
    highlights: [
      { icon: '✨', text: '🧙 Complete Later button smaller and repositioned below progress bar' },
      { icon: '✨', text: '🚫 AI chat and voice widgets hidden during Sage onboarding' },
    ],
  },
  {
    version: '1.12.15',
    date: 'March 13, 2026',
    title: 'Sage LLM Auth Fix',
    highlights: [
      { icon: '✨', text: '🧙 Sage now properly sends skipAuth flag to server during onboarding' },
    ],
  },
  {
    version: '1.12.14',
    date: 'March 13, 2026',
    title: 'Onboarding Sage LLM Fix',
    highlights: [
      { icon: '✨', text: '🧙 Sage now uses real AI during onboarding (was falling back to templates)' },
      { icon: '✨', text: '🎴 Class selection cards properly sized on mobile' },
    ],
  },
  {
    version: '1.12.13',
    date: 'March 12, 2026',
    title: 'Immersive Setup Dialogues',
    highlights: [
      { icon: '✨', text: 'All 3 setup phases use Realm-style NPC dialogue' },
      { icon: '✨', text: 'Life Foundation phase built (The Sage)' },
      { icon: '✨', text: 'Health & Finance converted to immersive conversations' },
      { icon: '✨', text: 'No more Coming Soon on any phase' },
    ],
  },
  {
    version: '1.12.12',
    date: 'March 12, 2026',
    title: 'Custom NPC Portraits',
    highlights: [
      { icon: '✨', text: 'Custom-generated NPC artwork for Setup panels' },
      { icon: '✨', text: 'Female Merchant character' },
      { icon: '✨', text: 'No emoji design rule enforced' },
    ],
  },
  {
    version: '1.12.11',
    date: 'March 12, 2026',
    title: 'Life Setup System',
    highlights: [
      { icon: '✨', text: 'Setup Hub with NPC-themed phase cards' },
      { icon: '✨', text: 'PhaseTracker in sidebar with progress ring' },
      { icon: '✨', text: 'Dismissible on dashboard' },
    ],
  },
  {
    version: '1.12.10',
    date: 'March 12, 2026',
    title: 'Tab Navigation Fix',
    highlights: [
      { icon: '✨', text: 'Replace setSearchParams with navigate (stable identity)' },
      { icon: '✨', text: 'Fix Character/Reflect/Finances tab switching on mobile' },
    ],
  },
  {
    version: '1.12.9',
    date: 'March 12, 2026',
    title: 'Navigation & Mic Polish',
    highlights: [
      { icon: '✨', text: 'Character bottom nav fixed (flexbox overflow)' },
      { icon: '✨', text: 'Reflect uses immersive bottom tab bar' },
      { icon: '✨', text: 'Mic button visible on all screens' },
    ],
  },
  {
    version: '1.12.8',
    date: 'March 12, 2026',
    title: 'UX Polish & Backend State',
    highlights: [
      { icon: '✨', text: 'Tutorial states persist to Supabase' },
      { icon: '✨', text: 'Dynamic dashboard - no stale Welcome banner' },
      { icon: '✨', text: 'PhaseTracker hidden after onboarding' },
      { icon: '✨', text: 'Junction tab navigation fixed' },
      { icon: '✨', text: '50+ asset paths fixed' },
    ],
  },
  {
    version: '1.12.7',
    date: 'March 12, 2026',
    title: 'UX Polish Sprint',
    highlights: [
      { icon: '✨', text: 'Add empty states to Health overview' },
      { icon: '✨', text: 'Skeleton loading component (Skeleton.tsx)' },
      { icon: '✨', text: 'Error boundaries with RefreshCw retry on all routes' },
      { icon: '✨', text: 'Touch target improvements (44px minimum)' },
      { icon: '✨', text: 'Accessibility: aria-labels, role=status, alt text' },
    ],
  },
  {
    version: '1.12.6',
    date: 'March 12, 2026',
    title: 'UX Polish Sprint',
    highlights: [
      { icon: '✨', text: 'Add empty states to Health overview' },
      { icon: '✨', text: 'Skeleton loading component (Skeleton.tsx)' },
      { icon: '✨', text: 'Error boundaries with RefreshCw retry on all routes' },
      { icon: '✨', text: 'Touch target improvements (44px minimum)' },
      { icon: '✨', text: 'Accessibility: aria-labels, role=status, alt text' },
    ],
  },
  {
    version: '1.12.5',
    date: 'March 12, 2026',
    title: 'Data Isolation Fix',
    highlights: [
      { icon: '✨', text: 'Fix: user data leaking between accounts via cached contexts and IndexedDB' },
      { icon: '✨', text: 'Clear orchestrator cache, ZeroClaw context cache, and agent chat on user switch' },
      { icon: '✨', text: 'Skip migrateLocalUserToSupabase on account switch (prevents re-tagging stale records)' },
      { icon: '✨', text: 'Purge localStorage AI caches on user switch' },
    ],
  },
  {
    version: '1.12.4',
    date: 'March 12, 2026',
    title: 'Access & Tour Fix',
    highlights: [
      { icon: '✨', text: '🔓 Owner access now checks email (survives account recreation)' },
      { icon: '✨', text: '🔇 Tours wait for Supabase sync before showing (no more pestering)' },
      { icon: '✨', text: '👤 Complete Later creates default character (unlocks all Character tabs)' },
      { icon: '✨', text: '🔑 Owner account configured' },
    ],
  },
  {
    version: '1.12.3',
    date: 'March 12, 2026',
    title: 'Error Storm Fix',
    highlights: [
      { icon: '✨', text: '🔇 Eliminated asset table 404 spam (cleared stale sync retry queue)' },
      { icon: '✨', text: '🛡️ Onboarding now sets complete FIRST — never gets stuck on forging' },
      { icon: '✨', text: '🔧 Quest race condition handled (re-fetch on conflict)' },
      { icon: '✨', text: '🔇 Message unread count fails silently (no more 500 spam)' },
    ],
  },
  {
    version: '1.12.2',
    date: 'March 12, 2026',
    title: 'Onboarding Fixes',
    highlights: [
      { icon: '✨', text: '🚪 Complete Later button on onboarding (skip to app anytime)' },
      { icon: '✨', text: '🔧 Fixed 409 conflicts on user_profiles (insert→upsert)' },
      { icon: '✨', text: '🔇 Fixed asset table 404 spam (removed from sync engine)' },
    ],
  },
  {
    version: '1.12.1',
    date: 'March 12, 2026',
    title: 'Polish & UX',
    highlights: [
      { icon: '✨', text: '🦴 Skeleton loaders for 7 pages' },
      { icon: '✨', text: '📭 EmptyState variants (social, story, character, dashboard)' },
      { icon: '✨', text: '🚨 ErrorCard component for graceful error handling' },
      { icon: '✨', text: '📱 Mobile touch targets (44px minimum)' },
      { icon: '✨', text: '⚡ useEffect dependency fixes' },
      { icon: '✨', text: '🧹 Dead code cleanup (-15K lines)' },
    ],
  },
  {
    version: '1.12.0',
    date: 'March 12, 2026',
    title: 'Design System Polish',
    highlights: [
      { icon: '🎨', text: 'Goals & Schedule CSS fully migrated to design system tokens (border-radius, borders, transitions)' },
      { icon: '📭', text: 'EmptyState component adopted on Schedule, Finances, and Inbox pages' },
      { icon: '🧹', text: 'Consistent spacing, transitions, and border styles across the app' },
    ],
  },
  {
    version: '1.11.28',
    date: 'March 12, 2026',
    title: 'Onboarding Auto-Redirect + Tour CSS Fix',
    highlights: [
      { icon: '✨', text: 'New users auto-redirect to Genesis onboarding — no manual clicking' },
      { icon: '✨', text: 'Tour CSS fully overhauled with proper dark theme and subtle cancel button' },
      { icon: '✨', text: 'Test account wiped for fresh test' },
    ],
  },
  {
    version: '1.11.27',
    date: 'March 12, 2026',
    title: 'Genesis Onboarding',
    highlights: [
      { icon: '✨', text: 'Unified RPG onboarding experience with The Gardener NPC' },
      { icon: '✨', text: 'Character creation with ESBI class, role, and RPG class' },
      { icon: '✨', text: 'LLM chat or form-based life setup' },
      { icon: '✨', text: 'Post-onboarding Life Town guide' },
    ],
  },
  {
    version: '1.11.26',
    date: 'March 12, 2026',
    title: 'Tutorial System Polish',
    highlights: [
      { icon: '✨', text: 'Refined tour styling with premium dark theme' },
      { icon: '✨', text: 'Verified and updated all tour step selectors' },
      { icon: '✨', text: 'All 8 tours accessible from Settings' },
    ],
  },
  {
    version: '1.11.25',
    date: 'March 12, 2026',
    title: 'Google OAuth Fix',
    highlights: [
      { icon: '✨', text: 'Remove calendar scope from initial Google sign-in to eliminate unverified app warning' },
      { icon: '✨', text: 'Calendar access now requested only when user opts in from Settings' },
    ],
  },
  {
    version: '1.11.24',
    date: 'March 12, 2026',
    title: 'New User Experience Fix',
    highlights: [
      { icon: '✨', text: 'Suppress overdue/nudge cards for new users who haven\'t completed onboarding' },
      { icon: '✨', text: '3-day grace period before any nagging nudges appear' },
    ],
  },
  {
    version: '1.11.23',
    date: 'March 12, 2026',
    title: 'Sign Out Fix',
    highlights: [
      { icon: '✨', text: 'Sign out now returns to login screen instead of offline mode' },
      { icon: '✨', text: 'Can switch accounts properly on webapp' },
    ],
  },
  {
    version: '1.11.22',
    date: 'March 12, 2026',
    title: 'Security Fix',
    highlights: [
      { icon: '✨', text: 'Fixed 3 npm vulnerabilities (ajv, minimatch, rollup)' },
    ],
  },
  {
    version: '1.11.21',
    date: 'March 11, 2026',
    title: 'Smart goal task scheduling',
    highlights: [
      { icon: '✨', text: 'AI tasks now spread progressively across days/weeks' },
      { icon: '✨', text: 'Respects existing schedule, sleep, and free time' },
      { icon: '✨', text: 'Sequential task dependencies honored' },
    ],
  },
  {
    version: '1.11.20',
    date: 'March 11, 2026',
    title: 'Realm back navigates to previous page',
    highlights: [
      { icon: '✨', text: 'Realm back button now returns to wherever you came from (Dashboard, etc.) instead of always going to Character Overview' },
    ],
  },
  {
    version: '1.11.19',
    date: 'March 11, 2026',
    title: 'Dashboard: Fullscreen Command Center',
    highlights: [
      { icon: '✨', text: 'Dashboard now uses FullscreenPage with 5 bottom tabs: Today, Schedule, Goals, Habits, Insights' },
      { icon: '✨', text: 'Today tab: greeting, quick actions, week strip, triage, morning brief, realm preview' },
      { icon: '✨', text: 'Schedule tab: week strip, day timeline, tasks with filters' },
      { icon: '✨', text: 'Goals tab: goal progress cards + achievements' },
      { icon: '✨', text: 'Habits tab: habit tracker, completion rates, AI suggestions' },
      { icon: '✨', text: 'Insights tab: analytics, health metrics, finance summary, journal' },
    ],
  },
  {
    version: '1.11.18',
    date: 'March 11, 2026',
    title: 'Social Page: Fullscreen Immersive',
    highlights: [
      { icon: '✨', text: 'Social/Community page now fullscreen via FullscreenPage — consistent with Character, Health, Finances' },
      { icon: '✨', text: '5 bottom tabs: Friends, Discover, Guilds, Kingdom, Messages' },
      { icon: '✨', text: 'Profile button in header for quick access' },
      { icon: '✨', text: 'URL tab sync support (?tab=messages etc)' },
    ],
  },
  {
    version: '1.11.17',
    date: 'March 11, 2026',
    title: 'Fullscreen Immersive: Character + Health + Finances',
    highlights: [
      { icon: '✨', text: 'New reusable FullscreenPage component — portal, hamburger, level badge, messages, floating tabs' },
      { icon: '✨', text: 'Health page now fullscreen with 6 bottom tabs (Overview, Body, Exercise, Nutrition, Mind, Sleep)' },
      { icon: '✨', text: 'Finances page now fullscreen with 6 bottom tabs (Overview, Income, Expenses, Bills, Work, Analysis)' },
      { icon: '✨', text: 'Hamburger sidebar overlay fixed — clicking outside now closes it properly' },
      { icon: '✨', text: 'Consistent immersive experience across all three major pages' },
    ],
  },
  {
    version: '1.11.16',
    date: 'March 11, 2026',
    title: 'Fix Hamburger Menu in Fullscreen',
    highlights: [
      { icon: '✨', text: 'Sidebar was hidden by display:none !important — now overridden to display:flex when mobile-open' },
    ],
  },
  {
    version: '1.11.15',
    date: 'March 11, 2026',
    title: 'Character Header: Hamburger + Level + Messages',
    highlights: [
      { icon: '✨', text: 'Hamburger menu replaces back arrow — opens sidebar from fullscreen' },
      { icon: '✨', text: 'Level badge with XP% on right — tapping opens Player Stats modal' },
      { icon: '✨', text: 'Messages button on right — quick access to social/messages' },
      { icon: '✨', text: 'Sidebar overlay with proper z-index stacking for portal context' },
    ],
  },
  {
    version: '1.11.14',
    date: 'March 11, 2026',
    title: 'Character Fullscreen Immersive Mode',
    highlights: [
      { icon: '✨', text: 'Character Hub now renders as fullscreen immersive experience via React Portal' },
      { icon: '✨', text: 'Floating bottom tab bar with glow effects — switch between Overview, Quests, Stats, Equipment, Junction, Realm' },
      { icon: '✨', text: 'Realm tab launches its own fullscreen portal on top — exit returns to character' },
      { icon: '✨', text: 'Subtle enter animation + tab-color radial gradient background' },
      { icon: '✨', text: 'Works with all navigation paths: level-up, GamificationModal, deep links' },
    ],
  },
  {
    version: '1.11.13',
    date: 'March 11, 2026',
    title: 'Fix Equipment Infinite Loop (Root Cause)',
    highlights: [
      { icon: '✨', text: 'Set loaded=true before async in appearance store — prevents retry loop when no character exists' },
      { icon: '✨', text: 'Granular Zustand selectors in MiniCharacter, EquipmentView, EquipmentTab — stops cascading re-renders' },
      { icon: '✨', text: 'Lazy-load MiniCharacter in MobileHeader with Suspense fallback — isolates crash from rest of app' },
    ],
  },
  {
    version: '1.11.12',
    date: 'March 11, 2026',
    title: 'Revert Equipment Files to Known Good State',
    highlights: [
      { icon: '✨', text: '↩️ Reverted MobileHeader, EquipmentView, MiniCharacter, and CharacterAppearanceStore to v1.11.4 state' },
      { icon: '✨', text: '🔍 Testing whether Equipment error is pre-existing or was introduced by today\'s changes' },
    ],
  },
  {
    version: '1.11.11',
    date: 'March 11, 2026',
    title: 'Fix MobileHeader MiniCharacter Crash',
    highlights: [
      { icon: '✨', text: '🔧 MiniCharacter in header now lazy-loaded with Suspense fallback' },
      { icon: '✨', text: '🛡️ Character appearance loading sets loaded=true immediately (prevents any re-render loop)' },
      { icon: '✨', text: '⚡ EquipmentView uses isolated store selectors' },
    ],
  },
  {
    version: '1.11.10',
    date: 'March 11, 2026',
    title: 'Equipment Stability Fix',
    highlights: [
      { icon: '✨', text: '🔧 Added error handling to character appearance loading' },
      { icon: '✨', text: '⚡ Equipment view uses granular store selectors to prevent unnecessary re-renders' },
    ],
  },
  {
    version: '1.11.9',
    date: 'March 11, 2026',
    title: 'Fix Equipment Infinite Loop',
    highlights: [
      { icon: '✨', text: '🔧 Fixed infinite re-render on Equipment tab when no RPG character exists' },
      { icon: '✨', text: '🎯 loadFromSupabase now marks loaded=true even with no character (prevents retry loop)' },
    ],
  },
  {
    version: '1.11.8',
    date: 'March 11, 2026',
    title: 'Realm Portal Fix',
    highlights: [
      { icon: '✨', text: '🎮 Realm renders via React Portal to document.body — escapes all CSS stacking contexts' },
      { icon: '✨', text: '🔧 Reverted CharacterHub to original stable structure' },
      { icon: '✨', text: '📱 Fullscreen mode works correctly on mobile regardless of parent CSS' },
    ],
  },
  {
    version: '1.11.7',
    date: 'March 11, 2026',
    title: 'Fix Equipment & Realm Stability',
    highlights: [
      { icon: '✨', text: '🔧 Fixed CharacterHub early-return causing React error #185 on Equipment tab' },
      { icon: '✨', text: '🎮 Realm renders as sibling element — avoids stacking context without breaking React tree' },
    ],
  },
  {
    version: '1.11.6',
    date: 'March 11, 2026',
    title: 'Realm Fullscreen Fix',
    highlights: [
      { icon: '✨', text: '🖥️ Realm now renders truly fullscreen — no more tab bar or dark bottom half' },
      { icon: '✨', text: '📱 Fixed position:fixed being broken by parent CSS stacking context' },
    ],
  },
  {
    version: '1.11.5',
    date: 'March 11, 2026',
    title: 'Realm Rendering Fix',
    highlights: [
      { icon: '✨', text: '🌅 Fixed dark sky — realm now shows proper blue sky during daytime' },
      { icon: '✨', text: '🗺️ Expanded map from 30×25 to 40×32 tiles — no more black void' },
      { icon: '✨', text: '📱 Wider paths and tap indicator for better mobile navigation' },
      { icon: '✨', text: '📷 Camera centers properly on all screen sizes' },
    ],
  },
  {
    version: '1.11.4',
    date: 'March 11, 2026',
    title: 'Realm fullscreen immersive experience',
    highlights: [
      { icon: '✨', text: 'Fullscreen portal mode - Realm takes over entire viewport' },
      { icon: '✨', text: 'Enter/exit animations with real user data' },
      { icon: '✨', text: 'Fixed DialogueBox positioning as overlay' },
      { icon: '✨', text: 'Canvas auto-fills viewport with safe area support' },
      { icon: '✨', text: 'Hidden app navigation in fullscreen mode' },
    ],
  },
  {
    version: '1.11.3',
    date: 'March 11, 2026',
    title: 'Schedule Enhancements',
    highlights: [
      { icon: '✨', text: '📅 Tasks and habits now appear as timeline blocks' },
      { icon: '✨', text: '✅ Fixed overdue task detection (only shows truly overdue items)' },
      { icon: '✨', text: '🎯 Visual distinction for tasks, habits, and events' },
    ],
  },
  {
    version: '1.11.2',
    date: 'March 10, 2026',
    title: 'Deep Architectural Audit',
    highlights: [
      { icon: '✨', text: 'Assets store now offline-first with local DB + sync' },
      { icon: '✨', text: 'Finance store CRUD methods added' },
      { icon: '✨', text: 'Inventory sync triggers on every mutation' },
      { icon: '✨', text: 'Promise.allSettled hydration (no more cascade failures)' },
      { icon: '✨', text: 'XP dedup + onboarding double-submit guards' },
      { icon: '✨', text: 'Sync pull protects unsynced local edits' },
      { icon: '✨', text: 'Habit toggle + junction switch race guards' },
      { icon: '✨', text: 'Goal companion progress now calculates correctly' },
      { icon: '✨', text: '20 fixes across data layer, runtime, sync, UI, and Realm' },
    ],
  },
  {
    version: '1.11.1',
    date: 'March 10, 2026',
    title: 'Daily Triage & Review Fix',
    highlights: [
      { icon: '✨', text: 'Daily Triage — quick morning review of yesterday (Done/Missed/Move)' },
      { icon: '✨', text: 'Review fix — rescheduled items no longer ghost back (local DB sync)' },
      { icon: '✨', text: 'Toast stack limit — max 3 visible, no more screen flooding' },
      { icon: '✨', text: 'Journal entries appear immediately in Previous Entries after save' },
      { icon: '✨', text: 'Equipment tab error boundary for MiniCharacter' },
    ],
  },
  {
    version: '1.11.0',
    date: 'March 10, 2026',
    title: 'Character Everywhere',
    highlights: [
      { icon: '✨', text: 'MiniCharacter component — your pixel character appears in header, equipment tab, and level-up modal' },
      { icon: '✨', text: 'NPC Insight dashboard widget — daily rotating wisdom from Realm NPCs' },
      { icon: '✨', text: 'Realm Session Guard — gentle nudges from The Guide at 10/20/30 min' },
      { icon: '✨', text: 'Character appearance store with auto-sync on level up' },
      { icon: '✨', text: 'drawCharacter extracted for reuse across all surfaces' },
    ],
  },
  {
    version: '1.10.0',
    date: 'March 10, 2026',
    title: 'The Realm',
    highlights: [
      { icon: '✨', text: '⚔️ The Realm — Living RPG mini-game in Character Hub' },
      { icon: '✨', text: '🌱 Habit Garden — Plants grow with streaks, wilt when broken' },
      { icon: '✨', text: '🎵 Procedural music + SFX engine (mood-responsive, Tone.js)' },
      { icon: '✨', text: '🌧️ Dynamic weather reflecting your emotional state' },
      { icon: '✨', text: '🗡️ Equipment visible on character sprite' },
      { icon: '✨', text: '🗺️ Minimap, Quest Board, NPC dialogue from real data' },
      { icon: '✨', text: '👻 Shadows appear for overdue tasks, Goal Companions for active goals' },
      { icon: '✨', text: '📊 Dashboard Realm Preview card + celebration overlay' },
      { icon: '✨', text: '🤖 Telegram bot: 6 new commands deployed (goals, optimize, meals, workout, insights, focus)' },
      { icon: '✨', text: '🎬 Junction tradition videos (Buddhism, Hinduism, Islam, Sikhism, Tewahedo)' },
    ],
  },
  {
    version: '1.9.16',
    date: 'March 10, 2026',
    title: 'Flipper Zero & Journal Art',
    highlights: [
      { icon: '✨', text: 'Flipper Zero USB detection with RPG-style game check-in overlay' },
      { icon: '✨', text: 'Auto-generated abstract art for every journal entry via Gemini' },
      { icon: '✨', text: 'AI-powered Q&A now live in Telegram bot' },
    ],
  },
  {
    version: '1.9.15',
    date: 'March 10, 2026',
    title: 'Journal & Health Nudges',
    highlights: [
      { icon: '✨', text: 'Journal entries now save instantly (local-first sync fix)' },
      { icon: '✨', text: 'Health check-in nudges for Energy, Water & Mood tracking' },
      { icon: '✨', text: 'Quick Journal from dashboard also syncs locally' },
    ],
  },
  {
    version: '1.9.14',
    date: 'March 07, 2026',
    title: 'Timezone-aware AI time handling',
    highlights: [
      { icon: '✨', text: 'AI now knows current local time for accurate event scheduling' },
      { icon: '✨', text: 'All datetimes use Melbourne timezone offset instead of UTC' },
    ],
  },
  {
    version: '1.9.13',
    date: 'March 07, 2026',
    title: 'Owner bypass rate limit fix',
    highlights: [
      { icon: '✨', text: 'Owner accounts no longer see rate limit UI' },
      { icon: '✨', text: 'Stale counter files cleared' },
    ],
  },
  {
    version: '1.9.12',
    date: 'March 07, 2026',
    title: 'Rate limit fix',
    highlights: [
      { icon: '✨', text: 'Allow owner bypass to clear lockout' },
      { icon: '✨', text: 'Input not hard-disabled on rate limit' },
    ],
  },
  {
    version: '1.9.11',
    date: 'March 07, 2026',
    title: 'Triple Fix',
    highlights: [
      { icon: '✨', text: 'Fix chatbot 403 error' },
      { icon: '✨', text: 'Daily limit lockout UI' },
      { icon: '✨', text: 'Small screen sidebar scroll' },
    ],
  },
  {
    version: '1.9.10',
    date: 'March 07, 2026',
    title: 'AI Widget: reliable event updates + error feedback',
    highlights: [
      { icon: '✨', text: 'Events now searchable by title when LLM doesn\'t provide UUID' },
      { icon: '✨', text: 'Past/ongoing events now visible to AI (includes today from midnight)' },
      { icon: '✨', text: 'Action failures now shown directly in chat messages' },
    ],
  },
  {
    version: '1.9.9',
    date: 'March 07, 2026',
    title: 'Fix ZeroClaw action execution reliability',
    highlights: [
      { icon: '✨', text: 'Strengthen system prompt: explicit CRITICAL RULES for [ACTION:...] format on every request' },
      { icon: '✨', text: 'Rescue parser: detects LLM confirmation without action hint, constructs event from user message pattern' },
      { icon: '✨', text: 'Strips fake [Actions: ...] decoration from display text' },
      { icon: '✨', text: 'Fixes events not being created when LLM drops structured output mid-conversation' },
    ],
  },
  {
    version: '1.9.8',
    date: 'March 06, 2026',
    title: 'Fix raw JSON display in AI chat',
    highlights: [
      { icon: '✨', text: 'Fix LLM responses showing raw JSON to users when model wraps output in conversational text' },
      { icon: '✨', text: 'Robust JSON extraction from mixed content (fenced blocks, embedded JSON, plain text prefix)' },
      { icon: '✨', text: 'Fallback parser strips JSON artifacts from displayed text' },
    ],
  },
  {
    version: '1.9.7',
    date: 'March 06, 2026',
    title: 'Character & Reflect Tab Navigation',
    highlights: [
      { icon: '✨', text: 'Character hub: 6 tabs (Overview, Quests, Stats, Equipment, Assets, Junction)' },
      { icon: '✨', text: 'Reflect hub: 5 tabs (Overview, Journal, Review, Inbox, Story)' },
      { icon: '✨', text: 'URL sync via useSearchParams with slide animations' },
      { icon: '✨', text: 'Stats tab with growth recommendations from stores' },
      { icon: '✨', text: 'Quest navigation unified across dashboard and navigator' },
    ],
  },
  {
    version: '1.9.6',
    date: 'March 06, 2026',
    title: 'Performance & Sync Optimization',
    highlights: [
      { icon: '✨', text: 'Sync debounce — mutations no longer trigger full 22-table sync on every save' },
      { icon: '✨', text: 'getSession caching — reduced from 33 calls to 1 per render cycle' },
      { icon: '✨', text: 'Store-level refresh guards prevent full unmount on background syncs' },
      { icon: '✨', text: 'Gemini 2.0 Flash locked — 2.5 models removed from UI, server allowlist enforced' },
      { icon: '✨', text: 'Dashboard quick actions + layout polish' },
    ],
  },
  {
    version: '1.9.5',
    date: 'March 06, 2026',
    title: 'AI & ZeroClaw Intelligence',
    highlights: [
      { icon: '✨', text: 'Removed wasteful nudge LLM refinement (saves ~2-5K tokens/day)' },
      { icon: '✨', text: '5 new ZeroClaw actions: decompose objectives, create habits/goals, start focus, reschedule' },
      { icon: '✨', text: 'Page-aware AI context — smarter responses based on which page you\'re chatting from' },
      { icon: '✨', text: 'LLM retry logic — automatic 1-retry with 2s backoff on all AI calls' },
      { icon: '✨', text: 'Deadline proximity nudges — warns when goals are due within 7 days' },
    ],
  },
  {
    version: '1.9.4',
    date: 'March 06, 2026',
    title: 'Visual Consistency',
    highlights: [
      { icon: '✨', text: 'Unified color tokens (#F97316, #F43F5E, #EF4444)' },
      { icon: '✨', text: 'Border-radius normalized to 8px/10px/12px/20px' },
      { icon: '✨', text: '42 Orbitron + 20 Poppins → CSS variables' },
      { icon: '✨', text: '~50 emoji → Lucide SVG icons' },
      { icon: '✨', text: 'Mobile CSS overflow fixes' },
    ],
  },
  {
    version: '1.9.3',
    date: 'March 06, 2026',
    title: 'Data Integrity & Performance',
    highlights: [
      { icon: '✨', text: 'Fixed financial double-counting in charts and stats' },
      { icon: '✨', text: 'Sync storm fixed — 90% fewer network calls' },
      { icon: '✨', text: 'Session caching for faster interactions' },
      { icon: '✨', text: 'ZeroClaw system prompt fix — full personality restored' },
      { icon: '✨', text: 'Transaction and expense types aligned with database' },
    ],
  },
  {
    version: '1.9.2',
    date: 'March 06, 2026',
    title: 'UX Audit Batch 1',
    highlights: [
      { icon: '✨', text: '🔧 TaskDetail renders above sidebar (z-index fix + dedicated CSS)' },
      { icon: '✨', text: '🗑️ Cascade delete — objectives delete all children + tasks' },
      { icon: '✨', text: '🗑️ List view delete buttons — visible on hover, always on mobile' },
      { icon: '✨', text: '🎨 Emoji → Lucide icon sweep across 10 files' },
      { icon: '✨', text: '📱 Mobile bottom sheet animation + safe-area padding' },
    ],
  },
  {
    version: '1.9.1',
    date: 'March 06, 2026',
    title: 'Stable Goals',
    highlights: [
      { icon: '✨', text: '🔧 Fix Goals page refreshing — detail panels no longer close on background data updates' },
    ],
  },
  {
    version: '1.9.0',
    date: 'March 06, 2026',
    title: 'Goals Revolution',
    highlights: [
      { icon: '✨', text: '✨ AI Plan — type natural language, AI generates full goal hierarchy (Objective → Epic → Goal → Tasks)' },
      { icon: '✨', text: '📅 Smart Scheduler — auto-schedule tasks across days respecting capacity, dependencies & working hours' },
      { icon: '✨', text: '🧠 NLP Objective Decomposer — review, edit & bulk-create AI-generated plans' },
      { icon: '✨', text: '⚡ Dev feature gates — new features owner-only gated for safe rollout' },
    ],
  },
  {
    version: '1.8.5',
    date: 'March 05, 2026',
    title: 'Timeline Fix',
    highlights: [
      { icon: '✨', text: '🐛 Fixed Timeline section conditional render crash' },
    ],
  },
  {
    version: '1.8.4',
    date: 'March 05, 2026',
    title: 'Type System Cleanup',
    highlights: [
      { icon: '✨', text: '🧹 Removed dead goal code from schedule store' },
      { icon: '✨', text: '🔧 Fixed database.ts types to match actual Supabase schema' },
      { icon: '✨', text: '📦 Consolidated store types — imports from database.ts instead of local definitions' },
      { icon: '✨', text: '🎯 Aligned component types with store/database layer' },
    ],
  },
  {
    version: '1.8.3',
    date: 'March 04, 2026',
    title: 'UX Overhaul',
    highlights: [
      { icon: '✨', text: '📱 Mobile responsiveness — Goals 2-line clamp, Schedule 56px touch targets' },
      { icon: '✨', text: '🎨 235 hardcoded hex colors replaced with CSS variables' },
      { icon: '✨', text: '🧩 3 god components decomposed into 21 sub-components' },
      { icon: '✨', text: '📐 Reusable PageHeader component across Settings, Junction, Health, Journal' },
      { icon: '✨', text: '📋 Mobile nav reorganized into Life + Growth groups' },
      { icon: '✨', text: '📊 Dashboard show-more toggle, Schedule bottom sheet creation' },
      { icon: '✨', text: '💀 PageSkeleton loading states for all lazy-loaded pages' },
    ],
  },
  {
    version: '1.8.2',
    date: 'March 02, 2026',
    title: 'ZeroClaw Migration',
    highlights: [
      { icon: '⚡', text: 'AI agent now powered by ZeroClaw (Rust) — 3× less RAM' },
      { icon: '🔗', text: 'OpenAI-compatible API with streaming support' },
      { icon: '🧠', text: 'Insights now generated via ZeroClaw chat fallback' },
      { icon: '🗑️', text: 'Retired legacy Node.js agent (freed 63MB server RAM)' },
    ],
  },
  {
    version: '1.7.10',
    date: 'March 02, 2026',
    title: 'Smart Start + Free Time AI',
    highlights: [
      { icon: '✨', text: '🧠 AI-powered activity suggestions during free time' },
      { icon: '✨', text: '▶ Quick-start activities from dashboard (start/stop live timers)' },
      { icon: '✨', text: '✨ Agent suggests what to do based on goals, habits & patterns' },
    ],
  },
  {
    version: '1.7.9',
    date: 'March 02, 2026',
    title: 'AI Merge + Deep Think',
    highlights: [
      { icon: '✨', text: '🧠 Unified AI — merged Brain + Sparkle into one button' },
      { icon: '✨', text: '🔮 Deep Think toggle — routes to server agent for complex analysis' },
      { icon: '✨', text: '🗑️ Removed overlapping AgentChatFAB' },
    ],
  },
  {
    version: '1.7.8',
    date: 'March 02, 2026',
    title: 'Guided Weekly Review Wizard',
    highlights: [
      { icon: '✨', text: 'Immersive step-by-step review — one question at a time, full screen' },
      { icon: '✨', text: '8 guided steps: Overview, Habits Check, Overdue Triage, Wins, Growth, Priorities, Score, Summary' },
      { icon: '✨', text: 'Habit feedback: Good, Wrong Time, Too Hard, Skip — feeds into schedule optimization' },
      { icon: '✨', text: 'Overdue triage: mark Done, Reschedule Later, or Drop — actions applied on save' },
      { icon: '✨', text: 'Star-based week scoring with animated selection' },
      { icon: '✨', text: 'Smart step skipping — habits and overdue steps hidden when empty' },
    ],
  },
  {
    version: '1.7.7',
    date: 'March 02, 2026',
    title: 'Review UX + Collapsible Dashboard',
    highlights: [
      { icon: '✨', text: 'Weekly Review defaults to last week — current week shows Week in Progress' },
      { icon: '✨', text: 'Review form blocked for current week — redirects to last week' },
      { icon: '✨', text: 'Dashboard overdue card is now collapsible — compact by default on mobile' },
      { icon: '✨', text: 'Overdue Fix button navigates to /review?mode=reschedule' },
      { icon: '✨', text: 'AI Reschedule available on all weeks not just current' },
    ],
  },
  {
    version: '1.7.6',
    date: 'March 02, 2026',
    title: 'Travel Map + AI Goals + Task Scheduling',
    highlights: [
      { icon: '✨', text: 'Live Google Maps in Mission Control for travel events' },
      { icon: '✨', text: 'Vehicle equipment card with fuel/odometer/ATO deductions' },
      { icon: '✨', text: 'AI Goal Coach always visible — AI Goal Creation button when no goals' },
      { icon: '✨', text: 'Refine Goals with AI button for existing goals' },
      { icon: '✨', text: 'Task scheduler — tasks with due dates auto-populate the schedule' },
      { icon: '✨', text: 'Habits auto-schedule as daily events' },
    ],
  },
  {
    version: '1.7.5',
    date: 'March 02, 2026',
    title: 'Event Expiry Nudge + Vehicle System',
    highlights: [
      { icon: '✨', text: 'Still going? prompt when events expire — Done or Extend 30m' },
      { icon: '✨', text: 'Vehicle equipment table with fuel tracking and ATO deductions' },
      { icon: '✨', text: 'Progressive location permissions — privacy-first, feature-triggered' },
      { icon: '✨', text: 'Auto-complete expired events after 5 min with XP award' },
    ],
  },
  {
    version: '1.7.4',
    date: 'March 02, 2026',
    title: 'Timezone + Reactivity Fix',
    highlights: [
      { icon: '✨', text: 'Fix UTC timezone bug in event queries — local dates now used' },
      { icon: '✨', text: 'Event slider ticks every 10s instead of 60s' },
      { icon: '✨', text: 'Live events fetched via parallel is_live query' },
      { icon: '✨', text: 'Graceful end_time:null handling for live events' },
    ],
  },
  {
    version: '1.7.3',
    date: 'March 02, 2026',
    title: 'Event Slider Fix',
    highlights: [
      { icon: '✨', text: '🕐 Fixed timezone bug — events now created on correct day' },
      { icon: '✨', text: '📡 Realtime sync — event slider updates instantly from any source' },
      { icon: '✨', text: '🔴 Live events (no end time) now correctly appear in event slider' },
    ],
  },
  {
    version: '1.7.2',
    date: 'February 28, 2026',
    title: 'Rituals & Scheduler AI',
    highlights: [
      { icon: '✨', text: '🔄 Rituals moved to Habits page' },
      { icon: '✨', text: '🧠 Scheduler AI now aware of rituals' },
    ],
  },
  {
    version: '1.7.1',
    date: 'February 28, 2026',
    title: 'Rituals & Smart Event Details',
    highlights: [
      { icon: '✨', text: '🔄 Rituals System — define sleep, meals, workouts as recurring patterns that auto-populate your schedule' },
      { icon: '✨', text: '💪 Workout Details — exercise checklist, rest timer, progress tracking in event slider' },
      { icon: '✨', text: '🍽️ Meal Details — macros, calories, ingredient list with one-tap meal logging' },
      { icon: '✨', text: '😴 Sleep Details — quality rating, bedtime targets, scheduled vs actual comparison' },
      { icon: '✨', text: '🧘 Meditation Details — breathing guide, session timer, weekly counter' },
      { icon: '✨', text: '📖 Study Details — Pomodoro timer, auto-saving notes, focus mode' },
      { icon: '✨', text: '⚡ Smart Event Slider — overlay morphs based on event type with contextual controls' },
    ],
  },
  {
    version: '1.7.0',
    date: 'February 28, 2026',
    title: 'Health & Finance Intelligence Upgrade',
    highlights: [
      { icon: '✨', text: '🧠 Unified AI Brain — chat widget now orchestrates all 8 AI engines with balance tracking' },
      { icon: '✨', text: '💪 Exercise UX — AI Workout Generator at top, scheduler integration with time picker' },
      { icon: '✨', text: '🍽️ Nutrition UX — quick meal suggestions, actual macros, meals-to-schedule with weekly planning' },
      { icon: '✨', text: '😴 Sleep Scheduler — sleep score, bedtime/wake schedule synced to calendar, scheduled vs actual' },
      { icon: '✨', text: '💰 Finance Score — financial health score, overdue bill alerts, projected monthly income' },
      { icon: '✨', text: '🧘 Mindfulness Streak — consecutive day tracking with 14-day dot timeline' },
      { icon: '✨', text: '😄 Emoji Mood Scale — visual emoji inputs for mood and energy logging' },
      { icon: '✨', text: '📸 Progress Photos — before/after body comparison from camera' },
      { icon: '✨', text: '⬆️ UX Polish — scroll-to-top, sticky labels, smooth tab transitions, mobile optimization' },
    ],
  },
  {
    version: '1.6.0',
    date: 'February 27, 2026',
    title: 'AI Intelligence Suite',
    highlights: [
      { icon: '✨', text: '🧠 AI Goal Coach — detects neglected/stalled goals with actionable nudges' },
      { icon: '✨', text: '📊 AI Weekly Insights — time allocation, habit streaks, trends & financial summary' },
      { icon: '✨', text: '🍽️ AI Meal Suggestions — personalized meals based on your nutrition gaps' },
      { icon: '✨', text: '💪 AI Workout Generator — smart workouts that avoid overtraining' },
      { icon: '✨', text: '📅 AI Schedule Optimizer — reschedule suggestions with drag-and-drop' },
      { icon: '✨', text: '☀️ Morning Brief — daily dashboard briefing with weather & priorities' },
    ],
  },
  {
    version: '1.5.0',
    date: 'February 27, 2026',
    title: 'Early Adopter Pro',
    highlights: [
      { icon: '✨', text: '🎉 All users get Pro features free — Early Adopter mode enabled' },
      { icon: '✨', text: '🤖 AI messages for everyone (15/day Pro, 5/day Free — no paywall)' },
      { icon: '✨', text: '👑 Pro badge in sidebar — \'Early Adopter\' with celebration popup' },
      { icon: '✨', text: '⚙️ Settings subscription tab shows Early Adopter card instead of Stripe' },
      { icon: '✨', text: '🔍 Full SEO overhaul — JSON-LD schemas, sitemaps, keyword-rich meta across all pages' },
    ],
  },
  {
    version: '1.4.3',
    date: 'February 26, 2026',
    title: 'Update Flow & Finance Polish',
    highlights: [
      { icon: '🔔', text: 'Update detection now works reliably — "What\'s New" shows after every deploy' },
      { icon: '📱', text: 'Finance stats strip — compact 2×2 grid on mobile, no more vertical stacking' },
      { icon: '✨', text: 'Tighter mobile density — less whitespace, more data visible on small screens' },
      { icon: '📌', text: 'Sticky tab bar won\'t jump — hardware-accelerated positioning' },
      { icon: '🎨', text: 'Consistent glass card styling across all Finance tabs' },
    ],
  },
  {
    version: '1.4.2',
    date: 'February 25, 2026',
    title: 'Finance UX v2',
    highlights: [
      { icon: '✨', text: '💰 Tab bar now matches Health page — even grid, icons, labels, sticky header' },
      { icon: '✨', text: '📊 Compact donut chart (150px) — more room for data, less wasted space' },
      { icon: '✨', text: '🏗️ Restored missing base CSS for overview hero, stats, and tab grid' },
      { icon: '✨', text: '📐 Desktop 2-column overview grid with full-width insights + cashflow' },
      { icon: '✨', text: '📱 Tighter mobile tab spacing with proper breakpoints' },
    ],
  },
  {
    version: '1.4.1',
    date: 'February 25, 2026',
    title: 'Finance UX Polish',
    highlights: [
      { icon: '✨', text: '💰 Compact stat strip — Income, Expense, Net & Bills in a tight horizontal row' },
      { icon: '✨', text: '🎨 Fixed the oval line artifact on desktop glass cards' },
      { icon: '✨', text: '📊 Financial Insights now display as compact horizontal chips' },
      { icon: '✨', text: '📋 Form modals are solid and centered — no more transparent staggering' },
      { icon: '✨', text: '📱 Tighter mobile density across all finance tabs' },
    ],
  },
  {
    version: '1.4.0',
    date: 'February 25, 2026',
    title: 'Unified Schedule',
    highlights: [
      { icon: '📅', text: 'Three schedule layers — Primary, Operations & Sacred — all in one timeline' },
      { icon: '🎨', text: '25 event types with fixed colours and layer filtering' },
      { icon: '🎓', text: 'Tutorials progress ring — see your completion at a glance in the sidebar' },
      { icon: '🤖', text: 'Smarter Telegram bot — understands all event types across all layers' },
      { icon: '🔧', text: 'Bug fixes — mood logging, habit tracking, and activity logging all fixed' },
    ],
  },
  {
    version: '1.3.4',
    date: 'February 23, 2026',
    title: 'Character & Reflect',
    highlights: [
      { icon: '⚔️', text: 'Character Hub — Equipment + Junction grouped together with XP stats' },
      { icon: '📓', text: 'Reflect Hub — Journal + Review + Inbox in one place' },
      { icon: '🔔', text: 'Update detection — you\'ll always know when new features drop' },
      { icon: '📱', text: 'Streamlined navigation — 12 items → 9 for cleaner experience' },
      { icon: '🆕', text: 'What\'s New — see what changed after every update' },
    ],
  },
  // Add new releases above this comment (newest first)
];
