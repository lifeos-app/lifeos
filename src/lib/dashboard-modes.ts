/**
 * Dashboard Modes — Time-adaptive widget priorities
 *
 * VISION-v2-ori section 5.4:
 *   Morning (6am-12pm): Focus on preparation
 *   Active  (12pm-9pm): Focus on doing
 *   Evening (9pm-midnight): Focus on reflection
 *   Night   (midnight-6am): Minimal
 *
 * Max 6 visible widgets per mode; rest are collapsed.
 */

import { getDailyPrinciple, DOMAIN_PRINCIPLE, SEVEN_PRINCIPLES } from './hermetic-integration';

export type DashboardMode = 'morning' | 'active' | 'evening' | 'night';

export interface ModeWidgetConfig {
  id: string;
  priority: number;   // 1-10, higher = shown first
  collapsed: boolean;  // true = hidden behind "show more"
}

// ── Widget IDs (must match existing dashboard component ids) ──

const W = {
  // Full-row / header widgets
  greeting:         'greeting',
  quickActions:     'quick-actions',
  tcsToday:         'tcs-today',
  tcsCheckin:       'tcs-checkin',
  tcsDriving:       'tcs-driving',
  streakWarnings:   'streak-warnings',
  freeTime:         'free-time',
  weekStrip:        'week-strip',
  phaseTracker:     'phase-tracker',

  // Primary column
  triage:           'triage',
  overdue:          'overdue',
  morningBrief:     'morning-brief',
  stats:            'stats',
  schedule:         'schedule',
  tasks:            'tasks',
  habits:           'habits',

  // Secondary column
  dailyProgress:    'daily-progress',
  streakMomentum:   'streak-momentum',
  financialPulse:   'financial-pulse',
  weeklyInsight:    'weekly-insight',
  realmInvite:      'realm-invite',
  realmPreview:     'realm-preview',
  npcInsight:       'npc-insight',
  celestial:        'celestial',
  proactiveSuggest: 'proactive-suggest',
  ambientSuggest:   'ambient-suggest',
  holyHermes:       'holy-hermes',
  sageOracle:        'sage-oracle',
  lifePulse:        'life-pulse',
  scheduleInsights: 'schedule-insights',
  sleepQuickLog:    'sleep-quick-log',
  completionRates:  'completion-rates',
  suggestions:      'suggestions',
  journal:          'journal',
  health:           'health',
  finances:         'finances',
  goals:            'goals',
  achievements:     'achievements',
  agentNudge:       'agent-nudge',
  dailyReward:      'daily-reward',
  eveningReview:    'evening-review',
} as const;

type WidgetId = typeof W[keyof typeof W];

// ── Mode configurations ──

const MORNING_WIDGETS: ModeWidgetConfig[] = [
  // Morning (6am-12pm): Focus on preparation
  { id: W.dailyReward,    priority: 10, collapsed: false },  // Daily login reward (morning prime)
  { id: W.schedule,        priority: 10, collapsed: false },  // Calendar preview
  { id: W.sleepQuickLog,   priority: 9,  collapsed: false },  // Sleep quick log (morning wake-up)
  { id: W.sageOracle,      priority: 8,  collapsed: false },  // Sage Oracle — spiritual morning
  { id: W.ambientSuggest,  priority: 6,  collapsed: false },  // Ambient suggestions (morning=priority 6)
  { id: W.proactiveSuggest, priority: 7,  collapsed: false },  // Proactive AI suggestions
  { id: W.triage,          priority: 7,  collapsed: false },  // Priority tasks
  { id: W.morningBrief,    priority: 6,  collapsed: false },  // Morning journal prompt
  { id: W.scheduleInsights, priority: 6,  collapsed: false },  // Schedule suggestions
  { id: W.habits,          priority: 5,  collapsed: false },  // Habit check-in
  { id: W.streakMomentum,  priority: 4,  collapsed: true },
  { id: W.holyHermes,      priority: 3,  collapsed: true },
  { id: W.quickActions,    priority: 2,  collapsed: true },
  { id: W.stats,           priority: 1,  collapsed: true },
  { id: W.eveningReview,   priority: 0,  collapsed: true },  // Hidden in morning
];

const ACTIVE_WIDGETS: ModeWidgetConfig[] = [
  // Active (12pm-9pm): Focus on doing — sage oracle collapsed (low priority)
  { id: W.triage,          priority: 10, collapsed: false },  // Active task
  { id: W.dailyReward,    priority: 5,  collapsed: false },  // Daily login reward (lower mid-day)
  { id: W.financialPulse,  priority: 9,  collapsed: false },  // Financial pulse
  { id: W.scheduleInsights, priority: 8,  collapsed: false },  // Schedule suggestions
  { id: W.quickActions,    priority: 8,  collapsed: false },  // Quick actions
  { id: W.ambientSuggest,  priority: 8,  collapsed: false },  // Ambient suggestions (active=priority 8)
  { id: W.proactiveSuggest, priority: 7,  collapsed: false },  // Proactive AI suggestions
  { id: W.tasks,           priority: 7,  collapsed: false },  // Live timeline
  { id: W.habits,          priority: 6,  collapsed: false },  // Habit progress
  { id: W.dailyProgress,   priority: 5,  collapsed: false },  // Goal progress
  { id: W.sleepQuickLog,   priority: 4,  collapsed: true },  // Sleep summary (collapsed)
  { id: W.morningBrief,    priority: 3,  collapsed: true },
  { id: W.streakMomentum,  priority: 2,  collapsed: true },
  { id: W.sageOracle,      priority: 1,  collapsed: true },  // Lower priority during active hours
  { id: W.eveningReview,   priority: 0,  collapsed: true },  // Hidden during active
];

const EVENING_WIDGETS: ModeWidgetConfig[] = [
  // Evening (9pm-midnight): Focus on reflection
  { id: W.eveningReview,    priority: 8,  collapsed: false },  // Evening review — prime time
  { id: W.dailyProgress,   priority: 10, collapsed: false },  // Daily review
  { id: W.dailyReward,    priority: 8,  collapsed: false },  // Daily login reward (evening catch-up)
  { id: W.sleepQuickLog,   priority: 9,  collapsed: false },  // Bedtime tracking
  { id: W.journal,         priority: 8,  collapsed: false },  // Journal entry
  { id: W.sageOracle,      priority: 7,  collapsed: false },  // Sage Oracle — evening wisdom
  { id: W.proactiveSuggest, priority: 7,  collapsed: false },  // Proactive AI suggestions
  { id: W.ambientSuggest,  priority: 3,  collapsed: false },  // Ambient suggestions (evening=priority 3)
  { id: W.goals,           priority: 6,  collapsed: false },  // Goal progress
  { id: W.streakMomentum,  priority: 5,  collapsed: false },  // Streaks
  { id: W.scheduleInsights, priority: 4,  collapsed: true },  // Schedule suggestions (collapsed evening)
  { id: W.schedule,        priority: 4,  collapsed: true },
  { id: W.holyHermes,      priority: 3,  collapsed: true },
  { id: W.financialPulse,  priority: 2,  collapsed: true },
  { id: W.triage,          priority: 1,  collapsed: true },
];

const NIGHT_WIDGETS: ModeWidgetConfig[] = [
  // Night (midnight-6am): Minimal — spiritual/soulful time
  { id: W.sageOracle,      priority: 10, collapsed: false },  // Sage Oracle — prime spiritual time
  { id: W.eveningReview,   priority: 9,  collapsed: false },  // Evening review — night reflection
  { id: W.sleepQuickLog,   priority: 9,  collapsed: false },  // Bedtime tracking
  { id: W.journal,         priority: 8,  collapsed: false },  // Quick log
  { id: W.dailyReward,    priority: 8,  collapsed: false },  // Daily login reward (night owl catch)
  { id: W.dailyProgress,   priority: 7,  collapsed: false },  // Today's score
  { id: W.proactiveSuggest, priority: 7,  collapsed: false },  // Proactive AI suggestions
  { id: W.ambientSuggest,  priority: 1,  collapsed: true },  // Ambient suggestions (night=priority 1)
  { id: W.celestial,       priority: 6,  collapsed: false },  // Sleep reminder (ambient)
  { id: W.triage,          priority: 3,  collapsed: true },
  { id: W.scheduleInsights, priority: 3,  collapsed: true },  // Schedule suggestions (collapsed night)
  { id: W.habits,          priority: 2,  collapsed: true },
  { id: W.holyHermes,      priority: 1,  collapsed: true },
];

const MODE_CONFIGS: Record<DashboardMode, ModeWidgetConfig[]> = {
  morning: MORNING_WIDGETS,
  active:  ACTIVE_WIDGETS,
  evening: EVENING_WIDGETS,
  night:   NIGHT_WIDGETS,
};

// ── Public API ──

const MAX_VISIBLE = 6;

/**
 * Hermetic Principle Priority Boost
 * 
 * Today's governing principle subtly elevates the widget whose domain
 * matches. Not a replacement for the day-rotation — an enhancement.
 * The principle becomes active in the architecture, not just the UI.
 */
export function getHermeticBoost(widgetId: string): number {
  const principle = getDailyPrinciple();
  
  // Map each principle to the widget it governs
  const PRINCIPLE_WIDGET_BOOST: Record<string, string[]> = {
    mentalism:    [W.sageOracle, W.holyHermes, W.journal],
    correspondence: [W.celestial, W.weeklyInsight, W.lifePulse],
    vibration:   [W.streakMomentum, W.habits, W.health],
    polarity:    [W.health, W.financialPulse, W.proactiveSuggest],
    rhythm:      [W.schedule, W.scheduleInsights, W.sleepQuickLog],
    'cause-and-effect': [W.financialPulse, W.dailyProgress, W.achievements],
    gender:      [W.goals, W.realmInvite, W.realmPreview],
  };
  
  // Normalize principle name for lookup
  const key = principle.name.toLowerCase().replace(/\s+/g, '-');
  const governedWidgets = PRINCIPLE_WIDGET_BOOST[key];
  if (governedWidgets?.includes(widgetId)) return 2;
  return 0;
}

/**
 * Determine current dashboard mode based on local time.
 */
export function getDashboardMode(): DashboardMode {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 21) return 'active';
  if (h >= 21) return 'evening';
  return 'night';  // midnight–6am
}

/**
 * Get widget priorities for the given mode.
 * Returns sorted by priority (descending), with max 6 visible.
 */
export function getWidgetConfig(mode: DashboardMode, maxVisible = MAX_VISIBLE): ModeWidgetConfig[] {
  const configs = MODE_CONFIGS[mode] ?? [];
  const sorted = [...configs]
    .map(w => ({ ...w, priority: w.priority + getHermeticBoost(w.id) }))
    .sort((a, b) => b.priority - a.priority);
  return sorted.map((w, i) => ({
    ...w,
    collapsed: i >= maxVisible ? true : w.collapsed,
  }));
}

/**
 * Mode-aware greeting text.
 */
export function getModeGreeting(mode: DashboardMode, userName: string): string {
  const name = userName || 'there';
  switch (mode) {
    case 'morning':  return `Good morning, ${name}`;
    case 'active':   return `Let's go, ${name}`;
    case 'evening':  return `Good evening, ${name}`;
    case 'night':    return `Still up, ${name}?`;
  }
}

/**
 * Accent color for each mode (CSS color string).
 */
export function getModeAccent(mode: DashboardMode): string {
  switch (mode) {
    case 'morning':  return '#00BCD4';  // cyan
    case 'active':   return '#F59E0B';  // gold
    case 'evening':  return '#8B5CF6';  // purple
    case 'night':    return '#1E3A5F';  // deep blue
  }
}

/**
 * Human-readable label for a mode.
 */
export function getModeLabel(mode: DashboardMode): string {
  switch (mode) {
    case 'morning':  return 'Morning';
    case 'active':   return 'Active';
    case 'evening':  return 'Evening';
    case 'night':    return 'Night';
  }
}

/**
 * Check if a widget is visible (not collapsed) in the given mode config.
 */
export function isWidgetVisible(widgetId: string, config: ModeWidgetConfig[]): boolean {
  const entry = config.find(w => w.id === widgetId);
  return entry ? !entry.collapsed : true;  // default visible if not in config
}