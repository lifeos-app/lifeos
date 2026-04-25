/**
 * habit-difficulty.ts — Habit Difficulty Scaling for LifeOS
 *
 * Tracks habit mastery through 4 tiers (beginner -> mastery)
 * based on consecutive completion streaks. Suggests when a user
 * is ready to increase difficulty and provides XP multipliers.
 *
 * Pure functions — no React imports.
 */

import type { Habit, HabitLog } from '../types/database';

// ── TYPES ──────────────────────────────────────────────────────

export type DifficultyTier = 'beginner' | 'intermediate' | 'advanced' | 'mastery';

export interface HabitDifficultyAnalysis {
  habitId: string;
  currentTier: DifficultyTier;
  daysAtTier: number;
  readyToProgress: boolean;
  suggestion: string;
}

// ── CONSTANTS ──────────────────────────────────────────────────

export const DIFFICULTY_COLORS: Record<DifficultyTier, string> = {
  beginner: '#00D4FF',     // accent blue
  intermediate: '#39FF14', // green
  advanced: '#D4AF37',     // gold
  mastery: '#A855F7',      // purple
};

const TIER_THRESHOLDS: Record<DifficultyTier, number> = {
  beginner: 0,
  intermediate: 7,
  advanced: 21,
  mastery: 60,
};

const READY_TO_PROGRESS_DAYS = 21;

// ── HELPERS ────────────────────────────────────────────────────

function getCurrentStreak(habitId: string, logs: HabitLog[]): number {
  const habitLogs = logs.filter(l => l.habit_id === habitId);
  if (habitLogs.length === 0) return 0;

  const dates = [...new Set(habitLogs.map(l => l.date))].sort().reverse();
  const today = new Date();
  let streak = 0;

  for (let i = 0; i <= dates.length; i++) {
    const check = new Date(today);
    check.setDate(check.getDate() - i);
    const checkStr = check.toISOString().split('T')[0];

    if (dates.includes(checkStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}

function getTierForStreak(streak: number): DifficultyTier {
  if (streak >= TIER_THRESHOLDS.mastery) return 'mastery';
  if (streak >= TIER_THRESHOLDS.advanced) return 'advanced';
  if (streak >= TIER_THRESHOLDS.intermediate) return 'intermediate';
  return 'beginner';
}

function getDaysAtTier(streak: number, tier: DifficultyTier): number {
  return Math.max(0, streak - TIER_THRESHOLDS[tier]);
}

function generateSuggestion(habit: Habit, tier: DifficultyTier, daysAtTier: number, readyToProgress: boolean): string {
  const name = habit.title;

  if (!readyToProgress) {
    const daysNeeded = READY_TO_PROGRESS_DAYS - daysAtTier;
    return `${daysNeeded} more days at ${tier} level before ${name} is ready to level up.`;
  }

  switch (tier) {
    case 'beginner':
      return `You've built a solid base with ${name}. Ready to increase frequency or duration?`;
    case 'intermediate':
      if (habit.duration_minutes) {
        const newDuration = Math.round(habit.duration_minutes * 1.5);
        return `You've mastered ${habit.duration_minutes} min ${name}. Ready for ${newDuration} min?`;
      }
      if (habit.frequency === 'weekly') {
        return `${name} is solid weekly. Ready to try it 3x per week?`;
      }
      return `You've mastered the basics of ${name}. Ready to raise the bar?`;
    case 'advanced':
      return `${name} is deeply ingrained. Consider adding a challenge variation or teaching it to others.`;
    case 'mastery':
      return `${name} is part of who you are. You're in the mastery zone -- maintain and mentor.`;
  }
}

// ── PUBLIC API ─────────────────────────────────────────────────

/**
 * Analyze a single habit's difficulty tier and progression readiness.
 */
export function analyzeHabitDifficulty(habit: Habit, logs: HabitLog[]): HabitDifficultyAnalysis {
  const streak = getCurrentStreak(habit.id, logs);
  const currentTier = getTierForStreak(streak);
  const daysAtTier = getDaysAtTier(streak, currentTier);
  const readyToProgress = daysAtTier >= READY_TO_PROGRESS_DAYS && currentTier !== 'mastery';
  const suggestion = generateSuggestion(habit, currentTier, daysAtTier, readyToProgress);

  return {
    habitId: habit.id,
    currentTier,
    daysAtTier,
    readyToProgress,
    suggestion,
  };
}

/**
 * Analyze all habits for difficulty scaling.
 */
export function getAllDifficultyAnalyses(habits: Habit[], logs: HabitLog[]): HabitDifficultyAnalysis[] {
  const activeHabits = habits.filter(h => h.is_active && !h.is_deleted);
  return activeHabits.map(h => analyzeHabitDifficulty(h, logs));
}

/**
 * Get XP multiplier for a difficulty tier.
 * Higher tiers earn more XP per completion.
 */
export function getDifficultyXPMultiplier(tier: DifficultyTier): number {
  switch (tier) {
    case 'beginner': return 1.0;
    case 'intermediate': return 1.1;
    case 'advanced': return 1.25;
    case 'mastery': return 1.5;
  }
}
