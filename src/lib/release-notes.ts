/**
 * LifeOS Release Notes
 * Version history and changelog
 */

export interface ReleaseNote {
  version: string;
  date: string;
  notes: string[];
  breaking?: boolean;
}

export const releaseNotes: ReleaseNote[] = [
  {
    version: '1.10.0',
    date: '2026-07-08',
    notes: [
      '⚔️ The Realm — Living RPG mini-game in Character Hub',
      '🌱 Habit Garden — Plants grow with streaks, wilt when broken',
      '🎵 Procedural music + SFX engine (mood-responsive)',
      '🌧️ Dynamic weather reflecting your emotional state',
      '🗡️ Equipment visible on character sprite',
      '🗺️ Minimap, Quest Board, NPC dialogue from real data',
      '👻 Shadows appear for overdue tasks, Goal Companions for active goals',
      '📊 Dashboard Realm Preview card + celebration overlay',
      '🤖 Telegram bot: 6 new AI commands (goals, optimize, meals, workout, insights, focus)',
      '🎬 Junction tradition videos (Buddhism, Hinduism, Islam, Sikhism, Tewahedo)',
    ],
  },
  {
    version: '1.9.16',
    date: '2026-07-08',
    notes: [
      'XP awards wired into Journal, Health, Habits, Goals, Finances',
      'Gamification event bus connecting all actions to The Realm',
      'Full app optimization audit (AI, performance, data integrity)',
      'Bug fixes for journal submission, intent engine timeouts',
    ],
  },
  {
    version: '1.8.4',
    date: '2026-03-04',
    notes: [
      'Node Detail redesigned as bottom sheet (mobile) / modal (desktop)',
      'Finance, health, and habit cross-references in goal details',
      'ZeroClaw context-aware assistance for any goal or task',
      'Swipe-to-dismiss gesture support on mobile',
      'Improved collapsible accordion sections',
      'Budget & finance tracking for goals',
      'Linked habits display with streak and completion rate',
      'Health metrics integration for health-related goals',
    ],
  },
  {
    version: '1.8.3',
    date: '2026-03-03',
    notes: [
      'Previous version (baseline)',
    ],
  },
];

export function getCurrentVersion(): string {
  return releaseNotes[0].version;
}

export function getReleaseNotes(version: string): ReleaseNote | undefined {
  return releaseNotes.find(r => r.version === version);
}

export function getLatestReleaseNotes(): ReleaseNote {
  return releaseNotes[0];
}
