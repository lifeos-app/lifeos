/**
 * keystone-habits.ts — Keystone Habit Detection for LifeOS
 *
 * Identifies habits whose completion correlates with improvement
 * across OTHER domains (tasks completed, health logged, other
 * habits done). Uses Pearson correlation from the correlation engine.
 *
 * Pure functions — no React imports.
 */

import type { Habit, HabitLog, Task, HealthMetric } from '../types/database';

// ── TYPES ──────────────────────────────────────────────────────

export interface KeystoneResult {
  habitId: string;
  habitName: string;
  score: number;
  affectedDomains: string[];
  cascadeEffect: string;
}

// ── CONSTANTS ──────────────────────────────────────────────────

const MIN_DATA_POINTS = 14;
const MIN_CORRELATION = 0.25;
const LOOKBACK_DAYS = 30;

// ── HELPERS ────────────────────────────────────────────────────

function lastNDays(n: number = LOOKBACK_DAYS): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n < MIN_DATA_POINTS) return 0;

  const mA = a.reduce((s, v) => s + v, 0) / n;
  const mB = b.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let dA = 0;
  let dB = 0;

  for (let i = 0; i < n; i++) {
    const da = a[i] - mA;
    const db = b[i] - mB;
    num += da * db;
    dA += da * da;
    dB += db * db;
  }

  const den = Math.sqrt(dA) * Math.sqrt(dB);
  return den === 0 ? 0 : num / den;
}

// ── PUBLIC API ─────────────────────────────────────────────────

/**
 * Detect keystone habits by correlating each habit's completion
 * with task productivity, health logging, and other habit completions.
 *
 * Returns top 3 habits sorted by keystone score (sum of abs correlations).
 */
export function detectKeystoneHabits(
  habits: Habit[],
  logs: HabitLog[],
  tasks: Task[],
  healthMetrics: HealthMetric[],
): KeystoneResult[] {
  const activeHabits = habits.filter(h => h.is_active && !h.is_deleted);
  if (activeHabits.length < 2) return [];

  const days = lastNDays();

  // Pre-compute daily metrics
  const taskDoneByDay = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === 'done' && t.completed_at && !t.is_deleted) {
      const d = t.completed_at.split('T')[0];
      taskDoneByDay.set(d, (taskDoneByDay.get(d) || 0) + 1);
    }
  }

  const healthByDay = new Map<string, number>();
  for (const hm of healthMetrics) {
    healthByDay.set(hm.date, 1);
  }

  const logsByHabitByDay = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!logsByHabitByDay.has(log.habit_id)) {
      logsByHabitByDay.set(log.habit_id, new Set());
    }
    logsByHabitByDay.get(log.habit_id)!.add(log.date);
  }

  // Total other habits done per day (excluding the target habit)
  function otherHabitsDonePerDay(excludeId: string): number[] {
    return days.map(day => {
      let count = 0;
      for (const h of activeHabits) {
        if (h.id === excludeId) continue;
        if (logsByHabitByDay.get(h.id)?.has(day)) count++;
      }
      return count;
    });
  }

  const taskSeries = days.map(d => taskDoneByDay.get(d) || 0);
  const healthSeries = days.map(d => healthByDay.get(d) || 0);

  const results: KeystoneResult[] = [];

  for (const habit of activeHabits) {
    const habitDays = logsByHabitByDay.get(habit.id) || new Set();
    const habitSeries = days.map(d => habitDays.has(d) ? 1 : 0);

    // Check minimum data points
    const dataPoints = habitSeries.filter(v => v > 0).length;
    if (dataPoints < MIN_DATA_POINTS) continue;

    const correlations: { domain: string; r: number }[] = [];

    // Correlation with tasks completed
    const rTasks = pearson(habitSeries, taskSeries);
    if (Math.abs(rTasks) >= MIN_CORRELATION) {
      correlations.push({ domain: 'Tasks', r: rTasks });
    }

    // Correlation with health metrics logged
    const rHealth = pearson(habitSeries, healthSeries);
    if (Math.abs(rHealth) >= MIN_CORRELATION) {
      correlations.push({ domain: 'Health', r: rHealth });
    }

    // Correlation with other habits completed
    const otherHabits = otherHabitsDonePerDay(habit.id);
    const rHabits = pearson(habitSeries, otherHabits);
    if (Math.abs(rHabits) >= MIN_CORRELATION) {
      correlations.push({ domain: 'Other Habits', r: rHabits });
    }

    if (correlations.length === 0) continue;

    const keystoneScore = correlations.reduce((s, c) => s + Math.abs(c.r), 0);
    const affectedDomains = correlations.map(c => c.domain);

    // Build cascade effect description
    const effects: string[] = [];
    for (const c of correlations) {
      if (c.domain === 'Tasks' && c.r > 0) {
        const pct = Math.round(c.r * 100);
        effects.push(`${pct}% more tasks completed`);
      } else if (c.domain === 'Other Habits' && c.r > 0) {
        const mult = (1 + c.r).toFixed(1);
        effects.push(`${mult}x more habits logged`);
      } else if (c.domain === 'Health' && c.r > 0) {
        effects.push('more health tracking');
      }
    }

    const cascadeEffect = effects.length > 0
      ? `When you do ${habit.title}, you also see ${effects.join(' and ')}`
      : `${habit.title} correlates with activity across ${affectedDomains.join(', ')}`;

    results.push({
      habitId: habit.id,
      habitName: habit.title,
      score: Math.round(keystoneScore * 100) / 100,
      affectedDomains,
      cascadeEffect,
    });
  }

  // Sort descending by score, return top 3
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/**
 * Get a human-readable insight for a keystone result.
 */
export function getKeystoneInsight(result: KeystoneResult): string {
  const domains = result.affectedDomains.join(' and ').toLowerCase();
  return `${result.habitName} is your keystone habit: ${result.cascadeEffect}. It positively influences ${domains}.`;
}
