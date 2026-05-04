/**
 * sleep-performance.ts — Sleep-to-Performance Engine for LifeOS
 *
 * "Sleep is the foundation of every cognitive function. 7-9 hours non-negotiable."
 *
 * Calculates sleep performance score from health metrics, correlates sleep
 * with next-day task completion, habit streaks, and mood.
 * Pure functions — no React imports.
 */

import type { HealthMetric, Task, HabitLog } from '../types/database';

// ── TYPES ──────────────────────────────────────────────────────

export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface SleepPerformanceScore {
  avgSleepHours: number;
  optimalRange: { min: number; max: number };
  deficit: number;
  performanceImpact: number;
  trendDirection: TrendDirection;
}

// ── CONSTANTS ──────────────────────────────────────────────────

const LS_KEY = 'lifeos_sleep_performance';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const OPTIMAL_MIN = 7;
const OPTIMAL_MAX = 9;
const LOOKBACK_DAYS = 14;
const RECENT_DAYS = 7;

// ── HELPERS ────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

/**
 * Calculate performance impact based on average sleep hours.
 * 7-9h = 5.0, 6-7h = 3.5, 5-6h = 2.0, <5h = 1.0, >9h = 4.0
 */
function sleepHoursToPerformanceImpact(avgHours: number): number {
  if (avgHours >= OPTIMAL_MIN && avgHours <= OPTIMAL_MAX) return 5.0;
  if (avgHours >= 6 && avgHours < OPTIMAL_MIN) return 3.5;
  if (avgHours >= 5 && avgHours < 6) return 2.0;
  if (avgHours < 5) return 1.0;
  // > 9 hours (oversleeping)
  if (avgHours > OPTIMAL_MAX && avgHours <= 10) return 4.0;
  return 3.0; // > 10h
}

/**
 * Compute trend direction by comparing recent 7 days vs previous 7 days.
 */
function computeTrendDirection(recentAvg: number, previousAvg: number): TrendDirection {
  const diff = recentAvg - previousAvg;
  if (diff > 0.3) return 'improving';
  if (diff < -0.3) return 'declining';
  return 'stable';
}

/**
 * Correlate sleep hours with next-day task completion rate.
 * Returns a Pearson r value.
 */
function correlateSleepWithTasks(
  sleepByDate: Map<string, number>,
  tasks: Task[],
): number {
  // Build task completion count by date
  const tasksByDate = new Map<string, number>();
  for (const task of tasks) {
    if (task.completed_at && task.status === 'done' && !task.is_deleted) {
      const date = task.completed_at.split('T')[0];
      tasksByDate.set(date, (tasksByDate.get(date) || 0) + 1);
    }
  }

  // Pair: sleep on day N, task completion on day N+1
  const sleepX: number[] = [];
  const taskY: number[] = [];

  for (const [date, sleepH] of sleepByDate) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    if (tasksByDate.has(nextDayStr)) {
      sleepX.push(sleepH);
      taskY.push(tasksByDate.get(nextDayStr)!);
    }
  }

  if (sleepX.length < 3) return 0;

  // Pearson correlation
  const n = sleepX.length;
  const meanX = sleepX.reduce((s, v) => s + v, 0) / n;
  const meanY = taskY.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = sleepX[i] - meanX;
    const dy = taskY[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : clamp(num / den, -1, 1);
}

/**
 * Correlate sleep hours with next-day mood score.
 */
function correlateSleepWithMood(
  sleepByDate: Map<string, number>,
  healthMetrics: HealthMetric[],
): number {
  const moodByDate = new Map<string, number>();
  for (const hm of healthMetrics) {
    if (hm.mood_score != null) {
      moodByDate.set(hm.date, hm.mood_score);
    }
  }

  const sleepX: number[] = [];
  const moodY: number[] = [];

  for (const [date, sleepH] of sleepByDate) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    if (moodByDate.has(nextDayStr)) {
      sleepX.push(sleepH);
      moodY.push(moodByDate.get(nextDayStr)!);
    }
  }

  if (sleepX.length < 3) return 0;

  // Pearson correlation
  const n = sleepX.length;
  const meanX = sleepX.reduce((s, v) => s + v, 0) / n;
  const meanY = moodY.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = sleepX[i] - meanX;
    const dy = moodY[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : clamp(num / den, -1, 1);
}

/**
 * Correlate sleep hours with next-day habit completion.
 */
function correlateSleepWithHabits(
  sleepByDate: Map<string, number>,
  habitLogs: HabitLog[],
): number {
  // Build habit completion count by date
  const habitsByDate = new Map<string, number>();
  for (const log of habitLogs) {
    habitsByDate.set(log.date, (habitsByDate.get(log.date) || 0) + (log.count || 1));
  }

  const sleepX: number[] = [];
  const habitsY: number[] = [];

  for (const [date, sleepH] of sleepByDate) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    if (habitsByDate.has(nextDayStr)) {
      sleepX.push(sleepH);
      habitsY.push(habitsByDate.get(nextDayStr)!);
    }
  }

  if (sleepX.length < 3) return 0;

  // Pearson correlation
  const n = sleepX.length;
  const meanX = sleepX.reduce((s, v) => s + v, 0) / n;
  const meanY = habitsY.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = sleepX[i] - meanX;
    const dy = habitsY[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : clamp(num / den, -1, 1);
}

// ── PUBLIC API ─────────────────────────────────────────────────

/**
 * Calculate the Sleep Performance Score based on health metrics, tasks, and habit logs.
 * Averages last 14 days of sleep data, compares to optimal range,
 * and correlates with next-day performance.
 */
export function calculateSleepPerformanceScore(
  healthMetrics: HealthMetric[],
  tasks: Task[],
  habitLogs: HabitLog[],
): SleepPerformanceScore {
  const cutoffStr = daysAgo(LOOKBACK_DAYS);

  // Filter to recent metrics with sleep data
  const recentMetrics = healthMetrics.filter(
    m => m.date >= cutoffStr && m.sleep_hours != null && m.sleep_hours > 0
  );

  // Build sleep-by-date map
  const sleepByDate = new Map<string, number>();
  for (const m of recentMetrics) {
    sleepByDate.set(m.date, m.sleep_hours!);
  }

  // Average sleep over lookback period
  const avgSleepHours = recentMetrics.length > 0
    ? recentMetrics.reduce((s, m) => s + m.sleep_hours!, 0) / recentMetrics.length
    : 0;

  // Sleep deficit from optimal minimum
  const deficit = Math.max(0, OPTIMAL_MIN - avgSleepHours);

  // Performance impact (0-5 scale)
  const performanceImpact = sleepHoursToPerformanceImpact(avgSleepHours);

  // Trend: compare recent 7 days vs previous 7 days
  const recentCutoff = daysAgo(RECENT_DAYS);
  const midCutoff = daysAgo(LOOKBACK_DAYS);

  const recentMetrics7 = recentMetrics.filter(m => m.date >= recentCutoff);
  const previousMetrics7 = recentMetrics.filter(m => m.date >= midCutoff && m.date < recentCutoff);

  const recentAvg = recentMetrics7.length > 0
    ? recentMetrics7.reduce((s, m) => s + m.sleep_hours!, 0) / recentMetrics7.length
    : 0;
  const previousAvg = previousMetrics7.length > 0
    ? previousMetrics7.reduce((s, m) => s + m.sleep_hours!, 0) / previousMetrics7.length
    : 0;

  const trendDirection = computeTrendDirection(recentAvg, previousAvg);

  // Adjust performance impact based on correlations (bonus/penalty)
  const taskCorrelation = correlateSleepWithTasks(sleepByDate, tasks);
  const moodCorrelation = correlateSleepWithMood(sleepByDate, healthMetrics);
  const habitCorrelation = correlateSleepWithHabits(sleepByDate, habitLogs);

  // If sleep positively correlates with performance, boost impact; if negative, reduce
  const correlationBonus = (taskCorrelation + moodCorrelation + habitCorrelation) / 3;
  const adjustedImpact = clamp(performanceImpact + correlationBonus, 0, 5);

  const score: SleepPerformanceScore = {
    avgSleepHours: Math.round(avgSleepHours * 100) / 100,
    optimalRange: { min: OPTIMAL_MIN, max: OPTIMAL_MAX },
    deficit: Math.round(deficit * 100) / 100,
    performanceImpact: Math.round(adjustedImpact * 100) / 100,
    trendDirection,
  };

  // Cache to localStorage with TTL
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ score, cachedAt: Date.now() }));
  } catch { /* ignore */ }

  return score;
}

/**
 * Get cached Sleep Performance score if still valid (24h TTL).
 * Returns null if expired or not cached.
 */
export function getCachedSleepPerformanceScore(): SleepPerformanceScore | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > TTL_MS) return null;
    return parsed.score;
  } catch {
    return null;
  }
}

/**
 * Get a human-readable insight for the Sleep Performance score.
 */
export function getSleepPerformanceInsight(score: SleepPerformanceScore): string {
  const { avgSleepHours, deficit, performanceImpact, trendDirection } = score;

  if (avgSleepHours === 0) {
    return 'No sleep data available. Start tracking your sleep hours to unlock performance insights. Aim for 7-9 hours each night.';
  }

  const trendText = trendDirection === 'improving'
    ? 'Your sleep trend is improving over the past week.'
    : trendDirection === 'declining'
      ? 'Your sleep has been declining recently. Protect your bedtime routine.'
      : 'Your sleep has been stable recently.';

  if (deficit <= 0 && avgSleepHours <= OPTIMAL_MAX) {
    return `Excellent. You are averaging ${avgSleepHours.toFixed(1)} hours of sleep, which is in the optimal 7-9 hour range. ${trendText} Performance impact: ${performanceImpact.toFixed(1)}/5.`;
  }

  if (deficit > 0 && deficit <= 1) {
    return `You are averaging ${avgSleepHours.toFixed(1)} hours of sleep, just under the optimal 7-hour minimum. A deficit of ${deficit.toFixed(1)} hours affects cognitive performance. Try going to bed 30 minutes earlier. ${trendText}`;
  }

  if (deficit > 1 && deficit <= 2) {
    return `Sleep deficit of ${deficit.toFixed(1)} hours. Averaging ${avgSleepHours.toFixed(1)}h instead of the recommended 7-9h. This significantly impairs focus, decision-making, and habit formation. Prioritize sleep as a non-negotiable. ${trendText}`;
  }

  if (deficit > 2) {
    return `Critical sleep deficit: averaging only ${avgSleepHours.toFixed(1)} hours. This is severely undermining your performance (${performanceImpact.toFixed(1)}/5). Every aspect of cognitive function declines below 6 hours. Make sleep your top priority this week.`;
  }

  // Over 9 hours
  if (avgSleepHours > OPTIMAL_MAX) {
    return `You are averaging ${avgSleepHours.toFixed(1)} hours of sleep, above the optimal 9-hour ceiling. Oversleeping can reduce alertness. Aim for 7-9 hours and maintain a consistent wake time. ${trendText}`;
  }

  return `Averaging ${avgSleepHours.toFixed(1)} hours of sleep. ${trendText} Performance impact: ${performanceImpact.toFixed(1)}/5.`;
}