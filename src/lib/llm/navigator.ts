/**
 * LifeOS LLM Navigator
 *
 * Maps natural language intents to page navigation commands.
 * The AI can call parseNavigationIntent() on any user message to
 * detect navigation requests, then executeNavigation() to act on them.
 */
import { safeScrollIntoView } from '../../utils/scroll';

// ── TYPES ──────────────────────────────────────────────────────────────────────

export type NavigationAction = 'navigate' | 'highlight' | 'scroll_to' | 'open_modal';

export interface NavigationCommand {
  action: NavigationAction;
  /** URL path (for 'navigate') or element ID (for highlight/scroll_to/open_modal) */
  target: string;
  /** Query params, tab names, section anchors, etc. */
  params?: Record<string, string>;
}

// ── NAVIGATION MAP ─────────────────────────────────────────────────────────────

/**
 * Natural language intent → navigation command.
 * Keys are lowercase patterns — matched as substrings.
 * More specific patterns go first.
 */
const NAVIGATION_MAP: Record<string, NavigationCommand> = {
  // Finance
  'show finances':        { action: 'navigate', target: '/finances' },
  'show budget':          { action: 'navigate', target: '/finances', params: { tab: 'budget' } },
  'show transactions':    { action: 'navigate', target: '/finances', params: { tab: 'transactions' } },
  'show income':          { action: 'navigate', target: '/finances', params: { tab: 'income' } },
  'show expenses':        { action: 'navigate', target: '/finances', params: { tab: 'expenses' } },
  'my finances':          { action: 'navigate', target: '/finances' },
  'my money':             { action: 'navigate', target: '/finances' },

  // Goals
  'show goals':           { action: 'navigate', target: '/goals' },
  'my goals':             { action: 'navigate', target: '/goals' },
  'show objectives':      { action: 'navigate', target: '/goals' },
  'show vision':          { action: 'navigate', target: '/goals' },

  // Schedule
  'show schedule':        { action: 'navigate', target: '/schedule' },
  'show calendar':        { action: 'navigate', target: '/schedule' },
  'my schedule':          { action: 'navigate', target: '/schedule' },
  'what\'s on today':     { action: 'navigate', target: '/schedule' },

  // Habits
  'show habits':          { action: 'navigate', target: '/habits' },
  'my habits':            { action: 'navigate', target: '/habits' },
  'show streaks':         { action: 'navigate', target: '/habits' },

  // Health
  'show health':          { action: 'navigate', target: '/health' },
  'my health':            { action: 'navigate', target: '/health' },
  'show body':            { action: 'navigate', target: '/health' },
  'show fitness':         { action: 'navigate', target: '/health' },

  // Social
  'find partners':        { action: 'navigate', target: '/social', params: { tab: 'find' } },
  'find accountability':  { action: 'navigate', target: '/social', params: { tab: 'find' } },
  'show messages':        { action: 'navigate', target: '/social', params: { tab: 'messages' } },
  'show social':          { action: 'navigate', target: '/social' },
  'my partners':          { action: 'navigate', target: '/social', params: { tab: 'partners' } },

  // Dashboard / Gamification
  'show quests':          { action: 'navigate', target: '/character', params: { tab: 'quests' } },
  'my quests':            { action: 'navigate', target: '/character', params: { tab: 'quests' } },
  'show achievements':    { action: 'navigate', target: '/', params: { section: 'achievements' } },
  'my achievements':      { action: 'navigate', target: '/', params: { section: 'achievements' } },
  'show xp':              { action: 'navigate', target: '/', params: { section: 'xp' } },
  'show level':           { action: 'navigate', target: '/', params: { section: 'xp' } },
  'show dashboard':       { action: 'navigate', target: '/' },
  'go home':              { action: 'navigate', target: '/' },

  // Settings / Plugins
  'show plugins':         { action: 'navigate', target: '/settings', params: { tab: 'plugins' } },
  'show settings':        { action: 'navigate', target: '/settings' },
  'show integrations':    { action: 'navigate', target: '/settings', params: { tab: 'plugins' } },

  // Work / TCS
  'show work':            { action: 'navigate', target: '/work' },
  'show cleaning':        { action: 'navigate', target: '/work' },
  'show jobs':            { action: 'navigate', target: '/work' },
  'show clients':         { action: 'navigate', target: '/work' },

  // Journal
  'show journal':         { action: 'navigate', target: '/reflect/journal' },
  'my journal':           { action: 'navigate', target: '/reflect/journal' },
  'write journal':        { action: 'navigate', target: '/reflect/journal' },

  // Review
  'show review':          { action: 'navigate', target: '/reflect/review' },
  'weekly review':        { action: 'navigate', target: '/reflect/review' },
  'evening review':       { action: 'navigate', target: '/reflect/review' },
};

// ── PARSER ─────────────────────────────────────────────────────────────────────

/**
 * Detect a navigation intent in a user message.
 *
 * Checks if the lowercase message contains any key from NAVIGATION_MAP.
 * Returns the first matching command, or null if none found.
 *
 * Examples:
 *   parseNavigationIntent("can you show finances?")  → { action: 'navigate', target: '/finances' }
 *   parseNavigationIntent("what's my XP level?")     → { action: 'navigate', target: '/', params: { section: 'xp' } }
 *   parseNavigationIntent("add a task for tomorrow")  → null
 */
export function parseNavigationIntent(message: string): NavigationCommand | null {
  const lower = message.toLowerCase().trim();

  // Check exact phrases first (longer = more specific = higher priority)
  const sortedKeys = Object.keys(NAVIGATION_MAP).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (lower.includes(key)) {
      return NAVIGATION_MAP[key];
    }
  }

  // Also try to detect "go to [page]" and "take me to [page]" patterns
  const gotoMatch = lower.match(/(?:go to|take me to|navigate to|open|show me)\s+(\w+)/);
  if (gotoMatch) {
    const page = gotoMatch[1];
    const pageMap: Record<string, NavigationCommand> = {
      finances:    { action: 'navigate', target: '/finances' },
      finance:     { action: 'navigate', target: '/finances' },
      goals:       { action: 'navigate', target: '/goals' },
      schedule:    { action: 'navigate', target: '/schedule' },
      calendar:    { action: 'navigate', target: '/schedule' },
      habits:      { action: 'navigate', target: '/habits' },
      health:      { action: 'navigate', target: '/health' },
      social:      { action: 'navigate', target: '/social' },
      settings:    { action: 'navigate', target: '/settings' },
      work:        { action: 'navigate', target: '/work' },
      journal:     { action: 'navigate', target: '/reflect/journal' },
      review:      { action: 'navigate', target: '/reflect/review' },
      dashboard:   { action: 'navigate', target: '/' },
      home:        { action: 'navigate', target: '/' },
      inbox:       { action: 'navigate', target: '/reflect/inbox' },
      quests:      { action: 'navigate', target: '/character', params: { tab: 'quests' } },
      achievements:{ action: 'navigate', target: '/', params: { section: 'achievements' } },
      plugins:     { action: 'navigate', target: '/settings', params: { tab: 'plugins' } },
    };
    if (pageMap[page]) return pageMap[page];
  }

  return null;
}

// ── EXECUTOR ───────────────────────────────────────────────────────────────────

/**
 * Execute a navigation command.
 *
 * For 'navigate': build URL from target + params, then dispatch via React Router
 *   → call site must pass the navigate function (from useNavigate).
 *
 * For 'highlight', 'scroll_to', 'open_modal': dispatch custom DOM events
 *   → Layout/pages listen for these to scroll or highlight elements.
 */
export function executeNavigation(
  command: NavigationCommand,
  navigateFn: (path: string) => void
): void {
  switch (command.action) {
    case 'navigate': {
      let path = command.target;
      if (command.params && Object.keys(command.params).length > 0) {
        const qs = new URLSearchParams(command.params).toString();
        path = `${path}?${qs}`;
      }
      navigateFn(path);
      break;
    }

    case 'scroll_to': {
      const el = document.getElementById(command.target);
      if (el) {
        safeScrollIntoView(el, { behavior: 'smooth', block: 'center' });
      } else {
        document.dispatchEvent(
          new CustomEvent('lifeos-scroll-to', { detail: { target: command.target } })
        );
      }
      break;
    }

    case 'highlight': {
      document.dispatchEvent(
        new CustomEvent('lifeos-highlight', {
          detail: { target: command.target, params: command.params },
        })
      );
      break;
    }

    case 'open_modal': {
      document.dispatchEvent(
        new CustomEvent('lifeos-open-modal', {
          detail: { target: command.target, params: command.params },
        })
      );
      break;
    }
  }
}

// ── UTILS ──────────────────────────────────────────────────────────────────────

/** Get a human-readable label for a navigation target */
export function getNavigationLabel(command: NavigationCommand): string {
  const pathLabels: Record<string, string> = {
    '/':           'Dashboard',
    '/finances':   'Finances',
    '/goals':      'Goals',
    '/schedule':   'Schedule',
    '/habits':     'Habits',
    '/health':     'Health',
    '/social':     'Social',
    '/settings':   'Settings',
    '/work':       'Work',
    '/journal':    'Journal',
    '/review':     'Review',
    '/inbox':      'Inbox',
  };

  const base = pathLabels[command.target] ?? command.target;
  if (command.params?.tab) return `${base} → ${command.params.tab}`;
  if (command.params?.section) return `${base} → ${command.params.section}`;
  return base;
}
