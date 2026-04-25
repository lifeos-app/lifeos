/**
 * grit-score.ts — Angela Duckworth's Grit Scale for LifeOS
 *
 * Measures long-term passion (consistency in same-domain habits)
 * and perseverance (recovery rate after streak breaks).
 * Overall grit = weighted average (passion 40%, perseverance 60%).
 * Scale: 0-5 matching Duckworth's Grit Scale.
 *
 * Pure functions — no React imports.
 */

import type { Habit, HabitLog, Goal } from '../types/database';

// ── TYPES ──────────────────────────────────────────────────────

export type GritLevel = 'nascent' | 'developing' | 'strong' | 'exemplary';

export interface GritScore {
  overall: number;
  passion: number;
  perseverance: number;
  level: GritLevel;
}

// ── CONSTANTS ──────────────────────────────────────────────────

const LS_GRIT_KEY = 'lifeos_grit_score';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSION_LOOKBACK_DAYS = 90;
const PERSEVERANCE_RECOVERY_WINDOW = 3; // days

// ── HELPERS ────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function getLevel(score: number): GritLevel {
  if (score >= 4.0) return 'exemplary';
  if (score >= 3.0) return 'strong';
  if (score >= 1.5) return 'developing';
  return 'nascent';
}

function weekKeyFromDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ── PASSION CALCULATION ────────────────────────────────────────

/**
 * Passion = consistency in same-domain habits over 90 days.
 * Low variance in weekly completion rates = high passion.
 * Scale: 0-5.
 */
function calculatePassion(habits: Habit[], logs: HabitLog[]): number {
  const cutoff = daysAgoStr(PASSION_LOOKBACK_DAYS);
  const activeHabits = habits.filter(h => h.is_active && !h.is_deleted);
  if (activeHabits.length === 0) return 0;

  const recentLogs = logs.filter(l => l.date >= cutoff);
  if (recentLogs.length < 7) return 0;

  // Group habits by domain/category
  const domainHabits: Record<string, Habit[]> = {};
  for (const h of activeHabits) {
    const domain = h.category || h.goal_id || 'general';
    if (!domainHabits[domain]) domainHabits[domain] = [];
    domainHabits[domain].push(h);
  }

  // For each domain, calculate weekly completion consistency
  const domainConsistencies: number[] = [];

  for (const [, domHabits] of Object.entries(domainHabits)) {
    const habitIds = new Set(domHabits.map(h => h.id));
    const domLogs = recentLogs.filter(l => habitIds.has(l.habit_id));

    // Group logs by week
    const weekCounts: Record<string, number> = {};
    for (const log of domLogs) {
      const wk = weekKeyFromDate(log.date);
      weekCounts[wk] = (weekCounts[wk] || 0) + (log.count || 1);
    }

    const weeks = Object.values(weekCounts);
    if (weeks.length < 2) continue;

    // Calculate coefficient of variation (lower = more consistent = higher passion)
    const mean = weeks.reduce((s, v) => s + v, 0) / weeks.length;
    if (mean === 0) continue;
    const variance = weeks.reduce((s, v) => s + (v - mean) ** 2, 0) / weeks.length;
    const cv = Math.sqrt(variance) / mean;

    // Convert CV to 0-1 consistency score (CV of 0 = perfect consistency = 1.0)
    const consistency = Math.max(0, 1 - cv);
    domainConsistencies.push(consistency);
  }

  if (domainConsistencies.length === 0) return 0;

  // Average consistency across domains, scale to 0-5
  const avgConsistency = domainConsistencies.reduce((s, v) => s + v, 0) / domainConsistencies.length;

  // Factor in longevity: how many of the 90 days had at least one log
  const uniqueLogDays = new Set(recentLogs.map(l => l.date)).size;
  const coverageRatio = Math.min(uniqueLogDays / PASSION_LOOKBACK_DAYS, 1);

  return Math.min(5, avgConsistency * coverageRatio * 5);
}

// ── PERSEVERANCE CALCULATION ───────────────────────────────────

/**
 * Perseverance = recovery rate after streak breaks.
 * Resumed within 3 days of a break = +points.
 * Scale: 0-5.
 */
function calculatePerseverance(habits: Habit[], logs: HabitLog[]): number {
  const activeHabits = habits.filter(h => h.is_active && !h.is_deleted);
  if (activeHabits.length === 0) return 0;

  let totalBreaks = 0;
  let recoveries = 0;

  for (const habit of activeHabits) {
    const habitLogs = logs
      .filter(l => l.habit_id === habit.id)
      .map(l => l.date);
    const uniqueDates = [...new Set(habitLogs)].sort();

    if (uniqueDates.length < 2) continue;

    // Find gaps (streak breaks)
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1] + 'T00:00:00');
      const curr = new Date(uniqueDates[i] + 'T00:00:00');
      const gapDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));

      if (gapDays > 1) {
        totalBreaks++;
        // Recovery = resumed within PERSEVERANCE_RECOVERY_WINDOW days
        if (gapDays <= PERSEVERANCE_RECOVERY_WINDOW + 1) {
          recoveries++;
        }
      }
    }
  }

  if (totalBreaks === 0) {
    // No breaks at all — perfect perseverance if there are enough logs
    const totalLogs = logs.filter(l =>
      activeHabits.some(h => h.id === l.habit_id)
    ).length;
    return totalLogs >= 14 ? 5.0 : Math.min(5, (totalLogs / 14) * 4);
  }

  const recoveryRate = recoveries / totalBreaks;

  // Also factor in current active streaks
  const avgStreak = activeHabits.reduce((s, h) => s + (h.streak_current || 0), 0) / activeHabits.length;
  const streakBonus = Math.min(1, avgStreak / 21); // 21-day streak = full bonus

  return Math.min(5, (recoveryRate * 3.5) + (streakBonus * 1.5));
}

// ── PUBLIC API ─────────────────────────────────────────────────

/**
 * Calculate the Grit Score based on habits, logs, and goals.
 * Passion (40%) + Perseverance (60%) = Overall Grit (0-5).
 */
export function calculateGritScore(habits: Habit[], logs: HabitLog[], _goals: Goal[]): GritScore {
  const passion = calculatePassion(habits, logs);
  const perseverance = calculatePerseverance(habits, logs);
  const overall = (passion * 0.4) + (perseverance * 0.6);

  const score: GritScore = {
    overall: Math.round(overall * 100) / 100,
    passion: Math.round(passion * 100) / 100,
    perseverance: Math.round(perseverance * 100) / 100,
    level: getLevel(overall),
  };

  // Cache to localStorage with TTL
  try {
    localStorage.setItem(LS_GRIT_KEY, JSON.stringify({
      score,
      cachedAt: Date.now(),
    }));
  } catch { /* ignore */ }

  return score;
}

/**
 * Get cached grit score if still valid (24h TTL).
 * Returns null if expired or not cached.
 */
export function getCachedGritScore(): GritScore | null {
  try {
    const raw = localStorage.getItem(LS_GRIT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > TTL_MS) return null;
    return parsed.score;
  } catch {
    return null;
  }
}

/**
 * Get a human-readable insight for the grit score.
 */
export function getGritInsight(score: GritScore): string {
  if (score.overall >= 4.0) {
    return `Exemplary grit (${score.overall.toFixed(1)}/5). Your sustained passion and resilience after setbacks put you in rare company.`;
  }
  if (score.overall >= 3.0) {
    if (score.passion < score.perseverance) {
      return `Strong grit (${score.overall.toFixed(1)}/5). Your perseverance is solid, but deepening focus on fewer domains would boost your passion score.`;
    }
    return `Strong grit (${score.overall.toFixed(1)}/5). You maintain consistent habits and recover well from breaks.`;
  }
  if (score.overall >= 1.5) {
    if (score.perseverance < 2.0) {
      return `Developing grit (${score.overall.toFixed(1)}/5). When you miss a day, try to resume within 3 days -- recovery is the key to perseverance.`;
    }
    return `Developing grit (${score.overall.toFixed(1)}/5). Keep building consistency in your habits to strengthen your passion score.`;
  }
  return `Nascent grit (${score.overall.toFixed(1)}/5). Start with one habit and protect it for 21 days -- that single chain will ignite your grit.`;
}

/**
 * Get trailing 12-week grit history from habit logs.
 * Returns weekly scores for trend visualization.
 */
export function getGritHistory(logs: HabitLog[]): { date: string; score: number }[] {
  const history: { date: string; score: number }[] = [];
  const now = new Date();

  for (let w = 11; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - (w * 7));
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const weekLogs = logs.filter(l => l.date >= weekStartStr && l.date <= weekEndStr);
    const uniqueDays = new Set(weekLogs.map(l => l.date)).size;
    const uniqueHabits = new Set(weekLogs.map(l => l.habit_id)).size;

    // Simple weekly grit proxy: coverage * consistency
    const coverage = Math.min(uniqueDays / 7, 1);
    const breadth = Math.min(uniqueHabits / 3, 1); // 3+ habits = full breadth
    const weekScore = Math.min(5, (coverage * 0.6 + breadth * 0.4) * 5);

    history.push({
      date: weekEndStr,
      score: Math.round(weekScore * 100) / 100,
    });
  }

  return history;
}
