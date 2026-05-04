/**
 * atomic-habits.ts — James Clear's 4 Laws of Behavior Change for LifeOS
 *
 * "1% daily improvement compounds. 4 laws: make it obvious, attractive, easy, satisfying"
 *
 * Scores each of the 4 laws (0-5) and computes an overall Atomic Habits profile.
 * Pure functions — no React imports.
 */

import type { Habit, HabitLog } from '../types/database';
import { analyzeHabitDifficulty, getDifficultyXPMultiplier } from './habit-difficulty';

// ── TYPES ──────────────────────────────────────────────────────

export type AtomicHabitsLevel = 'novice' | 'practitioner' | 'expert' | 'master';

export interface AtomicHabitsProfile {
  obviousScore: number;
  attractiveScore: number;
  easyScore: number;
  satisfyingScore: number;
  overall: number;
  level: AtomicHabitsLevel;
}

// ── CONSTANTS ──────────────────────────────────────────────────

const LS_KEY = 'lifeos_atomic_habits_profile';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── HELPERS ────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getLevel(overall: number): AtomicHabitsLevel {
  if (overall >= 4.0) return 'master';
  if (overall >= 3.0) return 'expert';
  if (overall >= 1.5) return 'practitioner';
  return 'novice';
}

function isCueSpecific(habit: Habit): boolean {
  // A habit with a specific time_of_day or a description containing
  // cue-like language ("after", "when", "at") is considered cue-specific.
  if (habit.time_of_day && habit.time_of_day.trim().length > 0) return true;
  if (habit.description) {
    const lower = habit.description.toLowerCase();
    if (lower.includes('after ') || lower.includes('before ') || lower.includes('when ') || lower.includes('at ')) {
      return true;
    }
  }
  return false;
}

function hasTemptationBundling(habit: Habit): boolean {
  // Habits paired with enjoyable activities — check description for bundling language
  if (!habit.description) return false;
  const lower = habit.description.toLowerCase();
  const bundleKeywords = ['while', 'during', 'with', 'pair', 'bundle', 'combine', 'alongside', 'after'];
  return bundleKeywords.some(kw => lower.includes(kw));
}

// ── LAW 1: OBVIOUS (Make It Obvious) ──────────────────────────

/**
 * Law 1 — Obvious: Score based on habit cue specificity.
 * Habits with specific times/locations get higher scores.
 * Scale: 0-5.
 */
function calculateObviousScore(habits: Habit[]): number {
  const active = habits.filter(h => h.is_active && !h.is_deleted);
  if (active.length === 0) return 0;

  let totalScore = 0;
  for (const habit of active) {
    let habitScore = 0;

    // Has a time_of_day set (specific cue)
    if (habit.time_of_day && habit.time_of_day.trim().length > 0) {
      habitScore += 2.5;
    }

    // Has cue-specific language in description
    if (isCueSpecific(habit)) {
      habitScore += 1.5;
    }

    // Has a category (implementation intention context)
    if (habit.category && habit.category.trim().length > 0) {
      habitScore += 0.5;
    }

    // Daily habits have more obvious triggers
    if (habit.frequency === 'daily') {
      habitScore += 0.5;
    }

    totalScore += clamp(habitScore, 0, 5);
  }

  return clamp(totalScore / active.length, 0, 5);
}

// ── LAW 2: ATTRACTIVE (Make It Attractive) ─────────────────────

/**
 * Law 2 — Attractive: Score based on temptation bundling and social context.
 * Habits paired with enjoyable activities score higher.
 * Scale: 0-5.
 */
function calculateAttractiveScore(habits: Habit[], logs: HabitLog[]): number {
  const active = habits.filter(h => h.is_active && !h.is_deleted);
  if (active.length === 0) return 0;

  let totalScore = 0;
  for (const habit of active) {
    let habitScore = 0;

    // Temptation bundling in description
    if (hasTemptationBundling(habit)) {
      habitScore += 2.0;
    }

    // Completion rate (enjoyable habits get done more)
    const habitLogs = logs.filter(l => l.habit_id === habit.id);
    if (habitLogs.length > 0) {
      const uniqueDays = new Set(habitLogs.map(l => l.date)).size;
      // Estimate: compare unique log days to expected days based on frequency
      const createdDate = habit.created_at ? new Date(habit.created_at) : new Date();
      const daysSinceCreation = Math.max(1, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
      const expectedDays = habit.frequency === 'daily' ? daysSinceCreation : daysSinceCreation / 7;
      const completionRate = Math.min(uniqueDays / Math.max(expectedDays, 1), 1);
      habitScore += completionRate * 2.0;
    }

    // Has color/icon (visual appeal = attractiveness)
    if (habit.icon) habitScore += 0.25;
    if (habit.color) habitScore += 0.25;

    // Linked to a goal (purpose-driven attractiveness)
    if (habit.goal_id) habitScore += 0.5;

    totalScore += clamp(habitScore, 0, 5);
  }

  return clamp(totalScore / active.length, 0, 5);
}

// ── LAW 3: EASY (Make It Easy) ─────────────────────────────────

/**
 * Law 3 — Easy: Score based on habit difficulty and friction reduction.
 * Lower difficulty + shorter duration = easier.
 * Scale: 0-5.
 */
function calculateEasyScore(habits: Habit[], logs: HabitLog[]): number {
  const active = habits.filter(h => h.is_active && !h.is_deleted);
  if (active.length === 0) return 0;

  let totalScore = 0;
  for (const habit of active) {
    let habitScore = 0;

    // Difficulty tier from habit-difficulty engine
    const analysis = analyzeHabitDifficulty(habit, logs);
    const tierMultiplier = getDifficultyXPMultiplier(analysis.currentTier);
    // Higher tier = harder, so we invert: easy = low tier
    // beginner = 5 easy points, mastery = 1 easy point (mastery means it's NOT easy, it's mastered)
    const easyFromDifficulty = 6 - tierMultiplier; // beginner(1.0) → 5, mastery(1.5) → 4.5
    // But actually for Atomic Habits, "easy" means reducing friction.
    // A beginner-tier habit is already easy (friction is low).
    // An advanced/mastery habit has had friction progressively added.
    // So we score easy as: beginner habits are easy (5), mastery habits had easy become hard.
    const easyMap: Record<string, number> = { beginner: 5, intermediate: 4, advanced: 2.5, mastery: 3 };
    habitScore += easyMap[analysis.currentTier] || 2.5;

    // Short duration = easier (2-minute rule from the book)
    if (habit.duration_minutes != null) {
      if (habit.duration_minutes <= 2) habitScore += 1.0;
      else if (habit.duration_minutes <= 5) habitScore += 0.75;
      else if (habit.duration_minutes <= 15) habitScore += 0.5;
      else if (habit.duration_minutes <= 30) habitScore += 0.25;
      // > 30 min gets no bonus (harder to start)
    } else {
      // No duration set — unknown friction, neutral
      habitScore += 0.25;
    }

    // Daily frequency = easier habit loop (lower activation energy)
    if (habit.frequency === 'daily') habitScore += 0.25;

    totalScore += clamp(habitScore, 0, 5);
  }

  return clamp(totalScore / active.length, 0, 5);
}

// ── LAW 4: SATISFYING (Make It Satisfying) ─────────────────────

/**
 * Law 4 — Satisfying: Score based on immediate reward.
 * Habits with streak tracking + completion logs = satisfying.
 * Scale: 0-5.
 */
function calculateSatisfyingScore(habits: Habit[], logs: HabitLog[]): number {
  const active = habits.filter(h => h.is_active && !h.is_deleted);
  if (active.length === 0) return 0;

  let totalScore = 0;
  for (const habit of active) {
    let habitScore = 0;

    // Streak tracking provides immediate satisfaction
    const currentStreak = habit.streak_current || 0;
    if (currentStreak >= 21) habitScore += 2.0;
    else if (currentStreak >= 7) habitScore += 1.5;
    else if (currentStreak >= 3) habitScore += 1.0;
    else if (currentStreak >= 1) habitScore += 0.5;

    // Best streak shows history of satisfaction
    const bestStreak = habit.streak_best || 0;
    if (bestStreak >= 30) habitScore += 1.0;
    else if (bestStreak >= 14) habitScore += 0.75;
    else if (bestStreak >= 7) habitScore += 0.5;
    else if (bestStreak >= 3) habitScore += 0.25;

    // Recent logs with notes (satisfaction reinforcement)
    const habitLogsWithNotes = logs.filter(
      l => l.habit_id === habit.id && l.notes && l.notes.trim().length > 0
    );
    if (habitLogsWithNotes.length > 0) {
      const notesRatio = Math.min(habitLogsWithNotes.length / 14, 1); // up to 14 days
      habitScore += notesRatio * 0.5;
    }

    // Habit has visual feedback (icon/color)
    if (habit.icon) habitScore += 0.25;
    if (habit.color) habitScore += 0.25;

    // Daily frequency = more frequent satisfaction
    if (habit.frequency === 'daily') habitScore += 0.5;

    totalScore += clamp(habitScore, 0, 5);
  }

  return clamp(totalScore / active.length, 0, 5);
}

// ── PUBLIC API ─────────────────────────────────────────────────

/**
 * Calculate the Atomic Habits Profile based on the 4 Laws.
 * Each law scored 0-5. Overall = average of 4 laws.
 */
export function calculateAtomicHabitsProfile(habits: Habit[], logs: HabitLog[]): AtomicHabitsProfile {
  const obviousScore = calculateObviousScore(habits);
  const attractiveScore = calculateAttractiveScore(habits, logs);
  const easyScore = calculateEasyScore(habits, logs);
  const satisfyingScore = calculateSatisfyingScore(habits, logs);

  const overall = (obviousScore + attractiveScore + easyScore + satisfyingScore) / 4;

  const profile: AtomicHabitsProfile = {
    obviousScore: Math.round(obviousScore * 100) / 100,
    attractiveScore: Math.round(attractiveScore * 100) / 100,
    easyScore: Math.round(easyScore * 100) / 100,
    satisfyingScore: Math.round(satisfyingScore * 100) / 100,
    overall: Math.round(overall * 100) / 100,
    level: getLevel(overall),
  };

  // Cache to localStorage with TTL
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ profile, cachedAt: Date.now() }));
  } catch { /* ignore */ }

  return profile;
}

/**
 * Get cached Atomic Habits profile if still valid (24h TTL).
 * Returns null if expired or not cached.
 */
export function getCachedAtomicHabitsProfile(): AtomicHabitsProfile | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > TTL_MS) return null;
    return parsed.profile;
  } catch {
    return null;
  }
}

/**
 * Get a human-readable insight for the Atomic Habits profile.
 */
export function getAtomicHabitsInsight(profile: AtomicHabitsProfile): string {
  const { obviousScore, attractiveScore, easyScore, satisfyingScore, overall, level } = profile;

  if (overall >= 4.0) {
    return `Mastery level (${overall.toFixed(1)}/5). Your habit design is exceptional across all 4 laws. Keep refining edge cases and mentoring others in habit architecture.`;
  }

  // Identify the weakest law
  const laws = [
    { name: 'Obvious', score: obviousScore, tip: 'Add specific times and locations to every habit. Implementation intentions ("I will [habit] at [time] in [place]") double success rates.' },
    { name: 'Attractive', score: attractiveScore, tip: 'Try temptation bundling: pair a habit you need to do with one you want to do. Example: only listen to your favorite podcast while exercising.' },
    { name: 'Easy', score: easyScore, tip: 'Reduce friction. Start with the 2-minute rule: scale down any habit to a version that takes 2 minutes or less. Make the good habit the path of least resistance.' },
    { name: 'Satisfying', score: satisfyingScore, tip: 'Add immediate reinforcement. Track your streaks visually, celebrate small wins, and never miss twice. Satisfaction seals the habit loop.' },
  ];

  const weakest = laws.reduce((min, l) => l.score < min.score ? l : min, laws[0]);
  const strongest = laws.reduce((max, l) => l.score > max.score ? l : max, laws[0]);

  if (overall >= 3.0) {
    return `Expert level (${overall.toFixed(1)}/5). Your strongest law is ${strongest.name} (${strongest.score.toFixed(1)}). Focus on ${weakest.name} (${weakest.score.toFixed(1)}): ${weakest.tip}`;
  }

  if (overall >= 1.5) {
    return `Practitioner level (${overall.toFixed(1)}/5). ${weakest.name} is your weakest law at ${weakest.score.toFixed(1)}/5. ${weakest.tip}`;
  }

  return `Novice level (${overall.toFixed(1)}/5). Start with ${weakest.name} — your weakest of the 4 laws at ${weakest.score.toFixed(1)}/5. ${weakest.tip}`;
}