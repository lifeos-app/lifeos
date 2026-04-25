/**
 * Seasonal Events -- 4 seasons with quests, XP bonuses, and realm modifiers
 *
 * Southern hemisphere (Brisbane): Spring=Sep-Nov, Summer=Dec-Feb, Autumn=Mar-May, Winter=Jun-Aug
 * Each season has 3 quests tied to habits/goals/journal data.
 * Progress persisted in localStorage.
 */

export interface Season {
  id: string;
  name: string;
  icon: string;
  theme: string;
  months: number[]; // 0-indexed months (southern hemisphere)
  color: string;
  xpMultiplier: number;
}

export interface SeasonalQuest {
  id: string;
  seasonId: string;
  title: string;
  description: string;
  icon: string;
  targetCount: number;
  /** Which data source to check: habits | goals | tasks | journal */
  dataSource: 'habits' | 'goals' | 'tasks' | 'journal';
  xpReward: number;
}

export interface SeasonalQuestProgress {
  questId: string;
  seasonId: string;
  progress: number; // 0-100
  claimed: boolean;
  seasonYear: string; // e.g. "spring_2026"
}

// ── SEASONS (Southern Hemisphere — Brisbane) ──

export const SEASONS: Season[] = [
  {
    id: 'spring',
    name: 'Spring Renewal',
    icon: '\uD83C\uDF38',
    theme: 'New beginnings and growth',
    months: [8, 9, 10], // Sep, Oct, Nov
    color: '#39FF14',
    xpMultiplier: 1.1,
  },
  {
    id: 'summer',
    name: 'Summer Blaze',
    icon: '\u2600\uFE0F',
    theme: 'Energy, action, and intensity',
    months: [11, 0, 1], // Dec, Jan, Feb
    color: '#F97316',
    xpMultiplier: 1.15,
  },
  {
    id: 'autumn',
    name: 'Autumn Harvest',
    icon: '\uD83C\uDF42',
    theme: 'Reaping what you have sown',
    months: [2, 3, 4], // Mar, Apr, May
    color: '#D4AF37',
    xpMultiplier: 1.1,
  },
  {
    id: 'winter',
    name: 'Winter Reflection',
    icon: '\u2744\uFE0F',
    theme: 'Inner work and deep focus',
    months: [5, 6, 7], // Jun, Jul, Aug
    color: '#00D4FF',
    xpMultiplier: 1.05,
  },
];

// ── SEASONAL QUESTS ──

export const SEASONAL_QUESTS: SeasonalQuest[] = [
  // Spring
  {
    id: 'spring_plant',
    seasonId: 'spring',
    title: 'Plant 7 New Habits',
    description: 'Create 7 new habits during Spring to plant seeds for the year',
    icon: '\uD83C\uDF31',
    targetCount: 7,
    dataSource: 'habits',
    xpReward: 200,
  },
  {
    id: 'spring_goals',
    seasonId: 'spring',
    title: 'Set 3 Fresh Goals',
    description: 'Define 3 new goals for the season ahead',
    icon: '\uD83C\uDFAF',
    targetCount: 3,
    dataSource: 'goals',
    xpReward: 150,
  },
  {
    id: 'spring_journal',
    seasonId: 'spring',
    title: 'Spring Awakening Journal',
    description: 'Write 10 journal entries reflecting on your spring growth',
    icon: '\uD83D\uDCD7',
    targetCount: 10,
    dataSource: 'journal',
    xpReward: 175,
  },

  // Summer
  {
    id: 'summer_tasks',
    seasonId: 'summer',
    title: 'Summer Sprint',
    description: 'Complete 30 tasks in the summer heat',
    icon: '\u26A1',
    targetCount: 30,
    dataSource: 'tasks',
    xpReward: 250,
  },
  {
    id: 'summer_habits',
    seasonId: 'summer',
    title: 'Consistency Under Fire',
    description: 'Log habits for 21 consecutive days',
    icon: '\uD83D\uDD25',
    targetCount: 21,
    dataSource: 'habits',
    xpReward: 300,
  },
  {
    id: 'summer_goals',
    seasonId: 'summer',
    title: 'Midyear Push',
    description: 'Complete 2 goals before summer ends',
    icon: '\uD83C\uDFC6',
    targetCount: 2,
    dataSource: 'goals',
    xpReward: 250,
  },

  // Autumn
  {
    id: 'autumn_harvest',
    seasonId: 'autumn',
    title: 'Harvest Your Tasks',
    description: 'Complete 50 tasks to reap the autumn harvest',
    icon: '\uD83C\uDF3E',
    targetCount: 50,
    dataSource: 'tasks',
    xpReward: 300,
  },
  {
    id: 'autumn_reflect',
    seasonId: 'autumn',
    title: 'Gratitude Journal',
    description: 'Write 15 journal entries of gratitude and reflection',
    icon: '\uD83C\uDF41',
    targetCount: 15,
    dataSource: 'journal',
    xpReward: 200,
  },
  {
    id: 'autumn_goals',
    seasonId: 'autumn',
    title: 'Year-End Goal Review',
    description: 'Complete 3 goals before winter arrives',
    icon: '\uD83C\uDFAF',
    targetCount: 3,
    dataSource: 'goals',
    xpReward: 250,
  },

  // Winter
  {
    id: 'winter_journal',
    seasonId: 'winter',
    title: 'Deep Reflection',
    description: 'Write 30 consecutive journal entries during the cold months',
    icon: '\u2744\uFE0F',
    targetCount: 30,
    dataSource: 'journal',
    xpReward: 400,
  },
  {
    id: 'winter_habits',
    seasonId: 'winter',
    title: 'Iron Discipline',
    description: 'Maintain all habits for 14 straight days in winter',
    icon: '\uD83E\uDDCA',
    targetCount: 14,
    dataSource: 'habits',
    xpReward: 250,
  },
  {
    id: 'winter_tasks',
    seasonId: 'winter',
    title: 'Quiet Productivity',
    description: 'Complete 20 tasks while the world sleeps',
    icon: '\uD83C\uDF19',
    targetCount: 20,
    dataSource: 'tasks',
    xpReward: 200,
  },
];

const STORAGE_KEY = 'lifeos_seasonal_quests';

// ── CORE FUNCTIONS ──

/**
 * Get the current season (southern hemisphere).
 */
export function getCurrentSeason(): Season {
  const month = new Date().getMonth();
  return SEASONS.find(s => s.months.includes(month)) || SEASONS[0];
}

/**
 * Get the season key for the current period (e.g. "autumn_2026").
 */
export function getSeasonKey(): string {
  const season = getCurrentSeason();
  const year = new Date().getFullYear();
  return `${season.id}_${year}`;
}

/**
 * Get quests for the current season.
 */
export function getSeasonalQuests(): SeasonalQuest[] {
  const season = getCurrentSeason();
  return SEASONAL_QUESTS.filter(q => q.seasonId === season.id);
}

/**
 * Get the seasonal XP multiplier. Returns 1.25 if it is the user's birth season.
 * Otherwise returns the season's base multiplier.
 */
export function getSeasonalXPMultiplier(birthMonth?: number): number {
  const season = getCurrentSeason();
  if (birthMonth !== undefined && season.months.includes(birthMonth)) {
    return 1.25;
  }
  return season.xpMultiplier;
}

/**
 * Check quest progress based on data counts.
 */
export function checkSeasonalQuestProgress(
  quest: SeasonalQuest,
  currentCount: number,
): number {
  if (quest.targetCount <= 0) return 100;
  return Math.min(Math.round((currentCount / quest.targetCount) * 100), 100);
}

/**
 * Load quest progress from localStorage.
 */
export function loadQuestProgress(): SeasonalQuestProgress[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SeasonalQuestProgress[];
  } catch {
    return [];
  }
}

/**
 * Save quest progress to localStorage.
 */
export function saveQuestProgress(progress: SeasonalQuestProgress[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch { /* ignore */ }
}

/**
 * Update or create progress for a quest.
 */
export function updateQuestProgress(
  questId: string,
  progressPct: number,
): SeasonalQuestProgress {
  const all = loadQuestProgress();
  const seasonKey = getSeasonKey();
  const quest = SEASONAL_QUESTS.find(q => q.id === questId);
  const seasonId = quest?.seasonId || getCurrentSeason().id;

  const existing = all.find(p => p.questId === questId && p.seasonYear === seasonKey);
  if (existing) {
    existing.progress = Math.max(existing.progress, progressPct);
    saveQuestProgress(all);
    return existing;
  }

  const newProgress: SeasonalQuestProgress = {
    questId,
    seasonId,
    progress: progressPct,
    claimed: false,
    seasonYear: seasonKey,
  };
  all.push(newProgress);
  saveQuestProgress(all);
  return newProgress;
}

/**
 * Mark a quest as claimed.
 */
export function claimQuest(questId: string): boolean {
  const all = loadQuestProgress();
  const seasonKey = getSeasonKey();
  const entry = all.find(p => p.questId === questId && p.seasonYear === seasonKey);
  if (!entry || entry.progress < 100 || entry.claimed) return false;

  entry.claimed = true;
  saveQuestProgress(all);
  return true;
}
