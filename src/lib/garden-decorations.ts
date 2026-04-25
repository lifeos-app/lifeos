/**
 * Garden Decorations -- achievement-unlocked garden items
 *
 * 12 decoration types, each tied to a specific achievement milestone.
 * Scans user achievements to determine which decorations are unlocked.
 * Stores placed decorations in localStorage.
 */

import type { UserAchievement } from './gamification/achievements';
import { ACHIEVEMENTS } from './gamification/achievements';

export interface GardenDecoration {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Achievement condition that unlocks this decoration */
  unlockCondition: string;
  /** Target value for the achievement condition */
  unlockTarget: number;
  /** Friendly unlock hint */
  unlockHint: string;
}

export const GARDEN_DECORATIONS: GardenDecoration[] = [
  {
    id: 'fountain',
    name: 'Crystal Fountain',
    icon: '\u26F2',
    description: 'A shimmering fountain that boosts garden vitality',
    unlockCondition: 'total_actions_gte',
    unlockTarget: 100,
    unlockHint: 'Complete 100 actions',
  },
  {
    id: 'statue',
    name: 'Hero Statue',
    icon: '\uD83D\uDDFF',
    description: 'A monument to your dedication',
    unlockCondition: 'tasks_completed_gte',
    unlockTarget: 100,
    unlockHint: 'Complete 100 tasks',
  },
  {
    id: 'lantern',
    name: 'Spirit Lantern',
    icon: '\uD83C\uDFEE',
    description: 'Illuminates the garden with warm light',
    unlockCondition: 'habits_created_gte',
    unlockTarget: 5,
    unlockHint: 'Create 5 habits',
  },
  {
    id: 'bench',
    name: 'Meditation Bench',
    icon: '\uD83E\uDE91',
    description: 'A peaceful resting place for reflection',
    unlockCondition: 'journal_entries_gte',
    unlockTarget: 10,
    unlockHint: 'Write 10 journal entries',
  },
  {
    id: 'archway',
    name: 'Victory Archway',
    icon: '\uD83C\uDF09',
    description: 'An arch commemorating completed goals',
    unlockCondition: 'goals_completed_gte',
    unlockTarget: 3,
    unlockHint: 'Complete 3 goals',
  },
  {
    id: 'windmill',
    name: 'Golden Windmill',
    icon: '\uD83C\uDF3E',
    description: 'Harnesses the wind of productivity',
    unlockCondition: 'tasks_completed_gte',
    unlockTarget: 500,
    unlockHint: 'Complete 500 tasks',
  },
  {
    id: 'greenhouse',
    name: 'Glass Greenhouse',
    icon: '\uD83C\uDF3F',
    description: 'Shelters rare habit plants',
    unlockCondition: 'perfect_habit_week',
    unlockTarget: 1,
    unlockHint: 'Achieve a perfect habit week',
  },
  {
    id: 'treehouse',
    name: 'Ancient Treehouse',
    icon: '\uD83C\uDFE1',
    description: 'A cozy retreat among the canopy',
    unlockCondition: 'total_actions_gte',
    unlockTarget: 1000,
    unlockHint: 'Complete 1000 actions',
  },
  {
    id: 'bridge',
    name: 'Rainbow Bridge',
    icon: '\uD83C\uDF08',
    description: 'Connects different garden zones',
    unlockCondition: 'streak_gte',
    unlockTarget: 7,
    unlockHint: 'Maintain a 7-day streak',
  },
  {
    id: 'sundial',
    name: 'Celestial Sundial',
    icon: '\u2600\uFE0F',
    description: 'Tracks the passage of productive hours',
    unlockCondition: 'health_logged_days',
    unlockTarget: 14,
    unlockHint: 'Log health metrics for 14 days',
  },
  {
    id: 'well',
    name: 'Wishing Well',
    icon: '\uD83E\uDEA3',
    description: 'Toss in a coin and make a wish',
    unlockCondition: 'savings_milestone',
    unlockTarget: 1000,
    unlockHint: 'Save $1000 in tracked finances',
  },
  {
    id: 'torii_gate',
    name: 'Torii Gate',
    icon: '\u26E9\uFE0F',
    description: 'A sacred gate marking spiritual growth',
    unlockCondition: 'streak_gte',
    unlockTarget: 30,
    unlockHint: 'Maintain a 30-day streak',
  },
];

const STORAGE_KEY = 'lifeos_garden_decorations';

/**
 * Check if a decoration's unlock condition is met by the user's achievements.
 */
function isDecorationUnlocked(
  decoration: GardenDecoration,
  userAchievements: UserAchievement[],
): boolean {
  // Find achievements matching this decoration's condition
  const matchingAchievements = ACHIEVEMENTS.filter(
    a => a.condition === decoration.unlockCondition &&
      (a.target || 0) >= decoration.unlockTarget,
  );

  // Check if any matching achievement has been unlocked
  for (const ach of matchingAchievements) {
    const userAch = userAchievements.find(ua => ua.achievement_id === ach.id);
    if (userAch && userAch.unlocked_at) return true;
  }

  // Also check progress-based: if any achievement with this condition has progress >= target
  for (const ach of ACHIEVEMENTS.filter(a => a.condition === decoration.unlockCondition)) {
    const userAch = userAchievements.find(ua => ua.achievement_id === ach.id);
    if (userAch && userAch.progress >= decoration.unlockTarget) return true;
  }

  return false;
}

/**
 * Get all decorations that the user has unlocked via achievements.
 */
export function getUnlockedDecorations(
  userAchievements: UserAchievement[],
): GardenDecoration[] {
  return GARDEN_DECORATIONS.filter(d => isDecorationUnlocked(d, userAchievements));
}

/**
 * Get progress toward the next locked decorations.
 */
export function getNextDecorationProgress(
  userAchievements: UserAchievement[],
): { decoration: GardenDecoration; progress: number; needed: number }[] {
  const locked = GARDEN_DECORATIONS.filter(d => !isDecorationUnlocked(d, userAchievements));

  return locked.map(decoration => {
    // Find the best progress toward this condition
    const matching = ACHIEVEMENTS.filter(a => a.condition === decoration.unlockCondition);
    let bestProgress = 0;

    for (const ach of matching) {
      const userAch = userAchievements.find(ua => ua.achievement_id === ach.id);
      if (userAch) {
        bestProgress = Math.max(bestProgress, userAch.progress);
      }
    }

    return {
      decoration,
      progress: Math.min(bestProgress, decoration.unlockTarget),
      needed: decoration.unlockTarget,
    };
  }).sort((a, b) => (b.progress / b.needed) - (a.progress / a.needed));
}

/**
 * Get placed decorations from localStorage.
 */
export function getPlacedDecorations(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/**
 * Place a decoration in the garden.
 */
export function placeDecoration(decorationId: string): void {
  const placed = getPlacedDecorations();
  if (!placed.includes(decorationId)) {
    placed.push(decorationId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(placed));
  }
}

/**
 * Remove a decoration from the garden.
 */
export function removeDecoration(decorationId: string): void {
  const placed = getPlacedDecorations().filter(id => id !== decorationId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(placed));
}
