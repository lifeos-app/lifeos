/**
 * Sleep-Productivity Correlation Engine — P7-021
 *
 * Analyzes the relationship between sleep quality/duration and productivity
 * metrics over 60+ days of data. Extends beyond simple Pearson correlation
 * to track longitudinal patterns, optimal sleep ranges, recovery times,
 * and consistency bonuses.
 *
 * All data sourced from stores/local-db. No direct Supabase calls.
 */

import { localGetAll, localQuery } from './local-db';
import type { HealthMetric, Task, HabitLog } from '../types/database';

// ── Types ────────────────────────────────────────────────────────

export interface SleepRecord {
  date: string;
  sleepHours: number;
  sleepQuality: number; // 1-5
  bedTime: string | null; // HH:mm or ISO string
  wakeTime: string | null;
}

export interface ProductivityRecord {
  date: string;
  tasksCompleted: number;
  focusHours: number;      // derived from task/event durations
  xpEarned: number;
  moodScore: number;        // from health metrics (1-5)
  habitCompletionRate: number; // 0-1
}

export interface SleepBucketResult {
  range: string;    // e.g. "5-6h"
  min: number;
  max: number;
  avgProductivity: number;
  count: number;
}

export interface DayOfWeekPattern {
  day: string;
  dayIndex: number;
  optimalSleep: number;
  avgProductivity: number;
  count: number;
}

export interface RecoveryPattern {
  afterPoorSleep: number;    // threshold used for "poor" sleep
  productivityDrop: number;  // average % drop in productivity
  recoveryDays: number;     // average days to recover
}

export interface SleepProductivityReport {
  overallCorrelation: number;
  sleepOptimalRange: { min: number; max: number } | null;
  productivityBySleepBucket: SleepBucketResult[];
  dayOfWeekPatterns: DayOfWeekPattern[];
  recoveryPatterns: RecoveryPattern;
  consistencyBonus: number;   // 0-1, how much consistent sleep schedule helps
  recommendations: string[];
  dataPoints: number;
  daysAnalyzed: number;
  insufficientData: boolean;
}

interface CacheEntry {
  report: SleepProductivityReport;
  timestamp: number;
}

const CACHE_KEY = 'lifeos_sleep_productivity';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Utility Functions ────────────────────────────────────────────

/**
 * Pearson correlation coefficient between two arrays.
 * Returns NaN if either array has < 2 data points.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;

  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  return denom === 0 ? 0 : sumXY / denom;
}

/**
 * Group productivity data by sleep hour buckets.
 */
export function bucketAnalysis(
  sleepData: SleepRecord[],
  productivityData: ProductivityRecord[]
): SleepBucketResult[] {
  // Build date-based lookup for productivity
  const prodMap = new Map<string, ProductivityRecord>();
  for (const p of productivityData) {
    prodMap.set(p.date, p);
  }

  // Define bucket boundaries
  const buckets = [
    { min: 0, max: 5, range: '<5h' },
    { min: 5, max: 6, range: '5-6h' },
    { min: 6, max: 7, range: '6-7h' },
    { min: 7, max: 8, range: '7-8h' },
    { min: 8, max: 9, range: '8-9h' },
    { min: 9, max: 24, range: '9+h' },
  ];

  const results: SleepBucketResult[] = buckets.map(b => ({
    range: b.range,
    min: b.min,
    max: b.max,
    avgProductivity: 0,
    count: 0,
  }));

  const bucketSums = buckets.map(() => ({ total: 0, count: 0 }));

  for (const s of sleepData) {
    const p = prodMap.get(s.date);
    if (!p) continue;

    const prod = computeProductivityScore(p);

    // Find matching bucket
    for (let i = 0; i < buckets.length; i++) {
      if (s.sleepHours >= buckets[i].min && s.sleepHours < buckets[i].max) {
        bucketSums[i].total += prod;
        bucketSums[i].count++;
        break;
      }
    }
  }

  for (let i = 0; i < buckets.length; i++) {
    results[i].count = bucketSums[i].count;
    results[i].avgProductivity = bucketSums[i].count > 0
      ? bucketSums[i].total / bucketSums[i].count
      : 0;
  }

  return results;
}

/**
 * Lag correlation: how does N-days-ago sleep affect today's productivity?
 * Returns Pearson r for shifted lag.
 */
export function lagCorrelation(
  sleepData: SleepRecord[],
  productivityData: ProductivityRecord[],
  lagDays: number
): number {
  const pMap = new Map<string, ProductivityRecord>();
  for (const p of productivityData) {
    pMap.set(p.date, p);
  }

  const sleepMap = new Map<string, number>();
  for (const s of sleepData) {
    sleepMap.set(s.date, s.sleepHours);
  }

  const x: number[] = [];
  const y: number[] = [];

  for (const p of productivityData) {
    // Find the sleep data from `lagDays` before this date
    const pDate = new Date(p.date);
    pDate.setDate(pDate.getDate() - lagDays);
    const lagDate = pDate.toISOString().split('T')[0];

    const lagSleep = sleepMap.get(lagDate);
    if (lagSleep !== undefined) {
      x.push(lagSleep);
      y.push(computeProductivityScore(p));
    }
  }

  return pearsonCorrelation(x, y);
}

/**
 * Rolling average with a given window size.
 */
export function rollingAverage(data: number[], window: number): number[] {
  if (window <= 0 || data.length === 0) return [...data];
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    result.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return result;
}

/**
 * Detect the optimal sleep range (hours) for peak productivity.
 * Finds the bucket range with highest average productivity.
 */
export function detectOptimalSleepRange(
  sleepData: SleepRecord[],
  productivityData: ProductivityRecord[]
): { min: number; max: number; peakProductivity: number } | null {
  const buckets = bucketAnalysis(sleepData, productivityData);
  const populated = buckets.filter(b => b.count >= 2);
  if (populated.length === 0) return null;

  populated.sort((a, b) => b.avgProductivity - a.avgProductivity);
  const best = populated[0];

  return {
    min: best.min,
    max: best.max,
    peakProductivity: best.avgProductivity,
  };
}

/**
 * Detect how many days it takes to recover from poor sleep.
 * "Poor" = sleep hours below threshold (default: 6).
 */
export function detectRecoveryTime(
  sleepData: SleepRecord[],
  productivityData: ProductivityRecord[],
  poorThreshold: number = 6
): RecoveryPattern {
  const sleepMap = new Map<string, number>();
  for (const s of sleepData) {
    sleepMap.set(s.date, s.sleepHours);
  }

  const prodMap = new Map<string, number>();
  for (const p of productivityData) {
    prodMap.set(p.date, computeProductivityScore(p));
  }

  // Collect all dates in order
  const allDates = Array.from(new Set([...sleepMap.keys(), ...prodMap.keys()])).sort();

  const baselineProdArr: number[] = [];
  for (const [date, score] of prodMap) {
    const sleep = sleepMap.get(date);
    if (sleep !== undefined && sleep >= poorThreshold) {
      baselineProdArr.push(score);
    }
  }
  const baselineProd = baselineProdArr.length > 0
    ? baselineProdArr.reduce((s, v) => s + v, 0) / baselineProdArr.length
    : 0;

  // Find "poor sleep" days and measure subsequent recovery
  const recoveryDays: number[] = [];
  const productivityDrops: number[] = [];

  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    const sleep = sleepMap.get(date);
    if (sleep === undefined || sleep >= poorThreshold) continue;

    // This is a poor sleep day. Check how long until productivity recovers.
    const dayAfter = new Date(date);
    dayAfter.setDate(dayAfter.getDate() + 1);

    // Productivity drop on the poor sleep day itself (next-day effect)
    // Productivity of the day AFTER poor sleep
    const prodAfter = prodMap.get(dayAfter.toISOString().split('T')[0]);
    if (prodAfter !== undefined && baselineProd > 0) {
      const drop = Math.max(0, baselineProd - prodAfter) / baselineProd;
      productivityDrops.push(drop);
    }

    // Find recovery: first day after when productivity >= baseline * 0.9
    let recovered = false;
    for (let d = 1; d <= 7; d++) {
      const checkDate = new Date(date);
      checkDate.setDate(checkDate.getDate() + d);
      const checkStr = checkDate.toISOString().split('T')[0];
      const checkSleep = sleepMap.get(checkStr);
      const checkProd = prodMap.get(checkStr);

      if (checkProd !== undefined && checkProd >= baselineProd * 0.9) {
        // Also require that the recovery day had decent sleep
        if (checkSleep === undefined || checkSleep >= poorThreshold) {
          recoveryDays.push(d);
          recovered = true;
          break;
        }
      }
    }
    if (!recovered) {
      recoveryDays.push(7); // didn't recover within a week
    }
  }

  return {
    afterPoorSleep: poorThreshold,
    productivityDrop: productivityDrops.length > 0
      ? productivityDrops.reduce((s, v) => s + v, 0) / productivityDrops.length
      : 0,
    recoveryDays: recoveryDays.length > 0
      ? recoveryDays.reduce((s, v) => s + v, 0) / recoveryDays.length
      : 0,
  };
}

// ── Helper: Compute a composite productivity score from a record ──

function computeProductivityScore(p: ProductivityRecord): number {
  // Weight: tasks 30%, habit rate 25%, mood 20%, focus 15%, xp 10%
  const taskScore = Math.min(p.tasksCompleted / 5, 1);  // normalize: 5 tasks = 1
  const habitScore = p.habitCompletionRate;
  const moodScore = p.moodScore / 5;
  const focusScore = Math.min(p.focusHours / 4, 1);       // normalize: 4 focus hours = 1
  const xpScore = Math.min(p.xpEarned / 200, 1);         // normalize: 200 XP = 1

  return taskScore * 0.3 + habitScore * 0.25 + moodScore * 0.2 + focusScore * 0.15 + xpScore * 0.1;
}

// ── Consistency Bonus ─────────────────────────────────────────

/**
 * Calculate how much a consistent sleep schedule correlates with higher productivity.
 * Returns 0-1 where 1 = perfect consistency = always better productivity.
 */
function calculateConsistencyBonus(
  sleepData: SleepRecord[],
  productivityData: ProductivityRecord[]
): number {
  if (sleepData.length < 7) return 0;

  // Compute standard deviation of sleep hours
  const sleepHours = sleepData.map(s => s.sleepHours);
  const mean = sleepHours.reduce((s, v) => s + v, 0) / sleepHours.length;
  const variance = sleepHours.reduce((s, v) => s + (v - mean) ** 2, 0) / sleepHours.length;
  const stdDev = Math.sqrt(variance);

  // Low std dev = consistent. Normalize so stdDev < 0.5h → high consistency, >2h → low
  // Invert: consistency = max(0, 1 - stdDev / 2)
  const consistency = Math.max(0, Math.min(1, 1 - stdDev / 2));

  // Now check: is consistency positively correlated with productivity?
  // Group nights into "consistent" (within 0.5h of mean) vs "inconsistent"
  const prodMap = new Map<string, number>();
  for (const p of productivityData) {
    prodMap.set(p.date, computeProductivityScore(p));
  }

  let consistentProd = 0;
  let consistentCount = 0;
  let inconsistentProd = 0;
  let inconsistentCount = 0;

  for (const s of sleepData) {
    const prod = prodMap.get(s.date);
    if (prod === undefined) continue;
    if (Math.abs(s.sleepHours - mean) <= 0.5) {
      consistentProd += prod;
      consistentCount++;
    } else {
      inconsistentProd += prod;
      inconsistentCount++;
    }
  }

  const avgConsistent = consistentCount > 0 ? consistentProd / consistentCount : 0;
  const avgInconsistent = inconsistentCount > 0 ? inconsistentProd / inconsistentCount : 0;

  // Bonus = consistency metric * direction bonus (1 if consistent sleep → higher prod)
  const directionBonus = avgConsistent >= avgInconsistent ? 1 : 0.5;
  return consistency * directionBonus;
}

// ── Recommendation Generator ────────────────────────────────────

function generateRecommendations(
  report: SleepProductivityReport,
  sleepData: SleepRecord[]
): string[] {
  const recs: string[] = [];

  if (report.sleepOptimalRange) {
    const { min, max } = report.sleepOptimalRange;
    recs.push(`Your peak productivity is at ${min}-${max} hours of sleep. Aim for this range.`);
  }

  if (report.overallCorrelation > 0.3) {
    recs.push('Your sleep has a meaningful impact on productivity. Prioritize consistent sleep.');
  } else if (report.overallCorrelation < -0.1) {
    recs.push('Oversleeping may be hurting your productivity. Try waking at a consistent time.');
  }

  if (report.recoveryPatterns.productivityDrop > 0.2) {
    recs.push(`After a poor night of sleep, your productivity drops by ${Math.round(report.recoveryPatterns.productivityDrop * 100)}%. Plan lighter tasks the day after.`);
  }

  if (report.recoveryPatterns.recoveryDays > 1) {
    recs.push(`It takes you ~${Math.round(report.recoveryPatterns.recoveryDays)} days to recover from poor sleep. Protect your sleep schedule.`);
  }

  if (report.consistencyBonus > 0.5) {
    recs.push('You benefit significantly from a consistent sleep schedule. Keep your bedtime and wake time steady.');
  } else if (report.consistencyBonus > 0.2) {
    recs.push('Consistent sleep timing helps you. Try to go to bed within a 30-minute window each night.');
  }

  // Find best and worst sleep days
  const dayPatterns = report.dayOfWeekPatterns.filter(d => d.count >= 2);
  if (dayPatterns.length >= 2) {
    const worst = [...dayPatterns].sort((a, b) => a.optimalSleep - b.optimalSleep)[0];
    const best = [...dayPatterns].sort((a, b) => b.optimalSleep - a.optimalSleep)[0];
    if (worst.optimalSleep < 6.5) {
      recs.push(`${worst.day} nights average only ${worst.optimalSleep.toFixed(1)}h of sleep. Consider an earlier bedtime.`);
    }
  }

  // Check for sleep debt pattern
  const avgSleep = sleepData.length > 0
    ? sleepData.reduce((s, r) => s + r.sleepHours, 0) / sleepData.length
    : 0;
  if (avgSleep < 7) {
    recs.push(`Your average sleep is ${avgSleep.toFixed(1)}h. Most adults need 7-9 hours for peak performance.`);
  }

  // Check sleep quality vs duration
  const avgQuality = sleepData.length > 0
    ? sleepData.reduce((s, r) => s + r.sleepQuality, 0) / sleepData.length
    : 0;
  if (avgQuality < 3 && avgSleep >= 7) {
    recs.push('You are getting enough sleep hours but quality is low. Consider sleep hygiene improvements.');
  }

  if (recs.length === 0) {
    recs.push('Keep tracking your sleep and productivity to unlock personalized insights.');
  }

  return recs;
}

// ── Main Analysis Function ─────────────────────────────────────

/**
 * Analyze sleep-productivity correlation over the specified number of days.
 * Reads data from local DB (health_metrics, tasks, habit_logs, xp_events).
 * Returns a cached report if available and < 6 hours old.
 */
export async function analyzeSleepProductivity(days: number = 60): Promise<SleepProductivityReport> {
  // Check cache
  const cached = getCachedReport();
  if (cached && !cached.insufficientData) return cached;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  // ── Load data from local DB ──
  const [healthMetrics, tasks, habitLogs] = await Promise.all([
    localGetAll<HealthMetric>('health_metrics'),
    localGetAll<Task>('tasks'),
    localGetAll<HabitLog>('habit_logs'),
  ]);

  // ── Build Sleep Records ──
  const sleepData: SleepRecord[] = healthMetrics
    .filter(m => m.date >= cutoffStr && m.sleep_hours != null && m.sleep_hours > 0)
    .map(m => {
      // Extract bedTime/wakeTime from notes or metadata if available
      // For now, derive from sleep_hours and a reasonable assumption
      return {
        date: m.date,
        sleepHours: m.sleep_hours!,
        sleepQuality: m.sleep_quality ?? 3, // default to average
        bedTime: null,
        wakeTime: null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Build Productivity Records ──
  // Group tasks by completion date
  const tasksByDate = new Map<string, { completed: number; totalXp: number }>();
  for (const t of tasks) {
    if (!t.completed_at || t.is_deleted) continue;
    const dateStr = t.completed_at.split('T')[0];
    if (dateStr < cutoffStr) continue;
    const entry = tasksByDate.get(dateStr) || { completed: 0, totalXp: 0 };
    entry.completed++;
    // XP estimation: rough XP per task based on priority
    const xpMap: Record<string, number> = { low: 10, medium: 25, high: 50, urgent: 100 };
    entry.totalXp += xpMap[t.priority || 'medium'] || 25;
    tasksByDate.set(dateStr, entry);
  }

  // Group habit logs by date for completion rate
  const totalActiveHabits = new Set(habitLogs.filter(l => l.date >= cutoffStr).map(l => l.habit_id)).size;
  const habitsByDate = new Map<string, { completed: Set<string>; total: Set<string> }>();
  for (const l of habitLogs) {
    if (l.date < cutoffStr) continue;
    const entry = habitsByDate.get(l.date) || { completed: new Set<string>(), total: new Set<string>() };
    entry.completed.add(l.habit_id);
    entry.total.add(l.habit_id);
    habitsByDate.set(l.date, entry);
  }

  // Health metrics map for mood
  const healthByDate = new Map<string, HealthMetric>();
  for (const m of healthMetrics) {
    healthByDate.set(m.date, m);
  }

  // Build productivity records for each date where sleep data exists
  // (and also dates without sleep, for broader coverage)
  const allDates = new Set<string>();
  for (const s of sleepData) allDates.add(s.date);
  for (const [date] of tasksByDate) allDates.add(date);

  const productivityData: ProductivityRecord[] = [];
  for (const date of allDates) {
    const taskInfo = tasksByDate.get(date);
    const habitInfo = habitsByDate.get(date);
    const health = healthByDate.get(date);

    const habitCompletionRate = habitInfo
      ? habitInfo.completed.size / Math.max(totalActiveHabits, 1)
      : 0;

    const focusHours = health?.energy_score
      ? (health.energy_score / 5) * 8 // estimate: energy_score/5 * 8h potential
      : (taskInfo ? Math.min(taskInfo.completed * 0.5, 8) : 0);  // fallback: 0.5h per task

    productivityData.push({
      date,
      tasksCompleted: taskInfo?.completed ?? 0,
      focusHours: focusHours,
      xpEarned: taskInfo?.totalXp ?? 0,
      moodScore: health?.mood_score ?? 3,
      habitCompletionRate,
    });
  }

  productivityData.sort((a, b) => a.date.localeCompare(b.date));

  // ── Minimum Data Check ──
  const pairedDates = sleepData.filter(s =>
    productivityData.some(p => p.date === s.date)
  );

  if (pairedDates.length < 7) {
    const report: SleepProductivityReport = {
      overallCorrelation: 0,
      sleepOptimalRange: null,
      productivityBySleepBucket: [],
      dayOfWeekPatterns: [],
      recoveryPatterns: { afterPoorSleep: 6, productivityDrop: 0, recoveryDays: 0 },
      consistencyBonus: 0,
      recommendations: ['Need at least 7 days of sleep tracking data to analyze patterns.'],
      dataPoints: pairedDates.length,
      daysAnalyzed: days,
      insufficientData: true,
    };
    return report;
  }

  // ── Compute Overall Correlation ──
  // Align sleep and productivity arrays by date
  const prodMap = new Map<string, number>();
  for (const p of productivityData) {
    prodMap.set(p.date, computeProductivityScore(p));
  }

  const sleepX: number[] = [];
  const prodY: number[] = [];
  for (const s of sleepData) {
    const prod = prodMap.get(s.date);
    if (prod !== undefined) {
      sleepX.push(s.sleepHours);
      prodY.push(prod);
    }
  }

  const overallCorrelation = pearsonCorrelation(sleepX, prodY);

  // ── Bucket Analysis ──
  const productivityBySleepBucket = bucketAnalysis(sleepData, productivityData);

  // ── Optimal Sleep Range ──
  const optimalRange = detectOptimalSleepRange(sleepData, productivityData);

  // ── Day of Week Patterns ──
  const dayPatterns: DayOfWeekPattern[] = [];
  const dayData: Record<number, { sleep: number[]; prod: number[] }> = {};
  for (let d = 0; d < 7; d++) {
    dayData[d] = { sleep: [], prod: [] };
  }
  for (const s of sleepData) {
    const dayOfWeek = new Date(s.date + 'T00:00:00').getDay();
    const prod = prodMap.get(s.date);
    dayData[dayOfWeek].sleep.push(s.sleepHours);
    if (prod !== undefined) dayData[dayOfWeek].prod.push(prod);
  }
  for (let d = 0; d < 7; d++) {
    const data = dayData[d];
    if (data.sleep.length >= 1) {
      dayPatterns.push({
        day: DAY_NAMES[d],
        dayIndex: d,
        optimalSleep: data.sleep.reduce((s, v) => s + v, 0) / data.sleep.length,
        avgProductivity: data.prod.length > 0
          ? data.prod.reduce((s, v) => s + v, 0) / data.prod.length
          : 0,
        count: data.sleep.length,
      });
    }
  }

  // ── Recovery Patterns ──
  const recoveryPatterns = detectRecoveryTime(sleepData, productivityData);

  // ── Consistency Bonus ──
  const consistencyBonus = calculateConsistencyBonus(sleepData, productivityData);

  // ── Build Report ──
  const report: SleepProductivityReport = {
    overallCorrelation: isNaN(overallCorrelation) ? 0 : overallCorrelation,
    sleepOptimalRange: optimalRange ? { min: optimalRange.min, max: optimalRange.max } : null,
    productivityBySleepBucket,
    dayOfWeekPatterns: dayPatterns,
    recoveryPatterns,
    consistencyBonus,
    recommendations: [], // filled below
    dataPoints: pairedDates.length,
    daysAnalyzed: days,
    insufficientData: false,
  };

  report.recommendations = generateRecommendations(report, sleepData);

  // Cache the report
  setCachedReport(report);

  return report;
}

// ── Cache Helpers ──────────────────────────────────────────────

function getCachedReport(): SleepProductivityReport | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.report;
  } catch {
    return null;
  }
}

function setCachedReport(report: SleepProductivityReport): void {
  try {
    const entry: CacheEntry = { report, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage may be full or unavailable
  }
}

/**
 * Invalidate the sleep-productivity correlation cache.
 * Call this when new health/habit/task data is persisted.
 */
export function invalidateSleepProductivityCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}