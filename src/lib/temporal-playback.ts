/**
 * temporal-playback.ts — Temporal playback engine for LifeOS
 *
 * Rewind/replay week or month of data. Reads from Zustand stores via local-db
 * to reconstruct point-in-time snapshots, detect trends, and compare deltas.
 */

import { localGetAll, localQuery, getEffectiveUserId } from './local-db';

// ─── Types ────────────────────────────────────────────────────────

export type TimeRange = 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DataSnapshot {
  date: string;                 // YYYY-MM-DD
  habitsCompletedCount: number; // habits completed that day
  habitsTotalActive: number;    // total active habits
  goalsProgressPct: number;     // average progress across active goals (0–100)
  financeIncomeTotal: number;   // sum of income for that day
  financeExpenseTotal: number;  // sum of expenses for that day
  healthAvgMood: number;        // average mood score (0–10), -1 if none
  healthAvgSleep: number;       // average sleep hours, -1 if none
  journalWordCount: number;     // total words in journal entries that day
  xpTotal: number;              // total XP as of that date
  longestStreak: number;        // best current streak across habits
}

export interface TrendResult {
  direction: 'up' | 'down' | 'stable';
  changePct: number;  // percentage change, 0 if stable
}

export interface SnapshotDelta {
  start: string;
  end: string;
  habitsCompletedCountDelta: number;
  goalsProgressDelta: number;
  financeIncomeDelta: number;
  financeExpenseDelta: number;
  healthAvgMoodDelta: number;
  healthAvgSleepDelta: number;
  journalWordCountDelta: number;
  xpTotalDelta: number;
  longestStreakDelta: number;
}

export interface TimelineDay {
  snapshot: DataSnapshot;
  trends: Record<keyof Omit<TrendKeyMap, never>, TrendResult>;
}

type TrendKeyMap = {
  habitsCompletedCount: TrendResult;
  goalsProgressPct: TrendResult;
  financeIncomeTotal: TrendResult;
  financeExpenseTotal: TrendResult;
  healthAvgMood: TrendResult;
  healthAvgSleep: TrendResult;
  journalWordCount: TrendResult;
  xpTotal: TrendResult;
  longestStreak: TrendResult;
};

export type TrendKey = keyof TrendKeyMap;

// ─── Cache ─────────────────────────────────────────────────────────

const CACHE_KEY = 'lifeos_temporal_cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache: Record<string, CacheEntry> = JSON.parse(raw);
    const entry = cache[key];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      delete cache[key];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }
    return entry.data as T;
  } catch {
    return null;
  }
}

function setCache(key: string, data: unknown): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const cache: Record<string, CacheEntry> = raw ? JSON.parse(raw) : {};
    cache[key] = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable — skip caching
  }
}

// ─── Date Helpers ──────────────────────────────────────────────────

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = parseISODate(start);
  const e = parseISODate(end);
  const cur = new Date(s);
  while (cur <= e) {
    dates.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function getStartOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function getStartOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Compute end date from range type and start date */
function rangeEnd(range: TimeRange, startDate: string): string {
  const s = parseISODate(startDate);
  const e = new Date(s);
  switch (range) {
    case 'week':
      e.setDate(e.getDate() + 6);
      break;
    case 'month':
      e.setDate(e.getDate() + 29);
      break;
    case 'quarter':
      e.setDate(e.getDate() + 89);
      break;
    case 'year':
      e.setDate(e.getDate() + 364);
      break;
    case 'custom':
      // For custom, default to +6 days (a week); caller should provide explicit end
      e.setDate(e.getDate() + 6);
      break;
  }
  return toISODate(e);
}

// ─── Data Fetching ─────────────────────────────────────────────────

interface HabitRow { id: string; habit_id?: string; date?: string; count?: number; is_active?: boolean; is_deleted?: boolean; frequency?: string; streak_current?: number; streak_best?: number; }
interface GoalRow { id: string; progress?: number; status?: string; is_deleted?: boolean; }
interface IncomeRow { id: string; date?: string; amount?: number; is_deleted?: boolean; }
interface ExpenseRow { id: string; date?: string; amount?: number; is_deleted?: boolean; }
interface HealthRow { id: string; date?: string; mood_score?: number; sleep_hours?: number; }
interface JournalRow { id: string; date?: string; content?: string; word_count?: number; is_deleted?: boolean; }
interface XPRow { user_id?: string; total_xp?: number; }
interface HabitDefRow { id: string; is_active?: boolean; is_deleted?: boolean; streak_current?: number; streak_best?: number; }

/**
 * captureSnapshot — Reconstructs the state of all domains as-of a given date.
 *
 * Reads directly from local-db (IndexedDB) to avoid stale Zustand state
 * and to support querying historical data.
 */
export async function captureSnapshot(date: string): Promise<DataSnapshot> {
  const cacheKey = `snapshot_${date}`;
  const cached = getCached<DataSnapshot>(cacheKey);
  if (cached) return cached;

  const userId = getEffectiveUserId();

  // Fetch all data in parallel
  const [
    habitLogs,
    habitDefs,
    goals,
    incomes,
    expenses,
    healthMetrics,
    journalEntries,
    xpRows,
  ] = await Promise.all([
    localGetAll<HabitRow>('habit_logs'),
    localGetAll<HabitDefRow>('habits'),
    localGetAll<GoalRow>('goals'),
    localGetAll<IncomeRow>('income'),
    localGetAll<ExpenseRow>('expenses'),
    localGetAll<HealthRow>('health_metrics'),
    localGetAll<JournalRow>('journal_entries'),
    localGetAll<XPRow>('user_xp'),
  ]);

  // ── Habits ──
  const logsForDate = habitLogs.filter(l => l.date === date);
  const habitsCompletedCount = logsForDate.filter(l => (l.count ?? 0) > 0).length;
  const activeHabits = habitDefs.filter(h => h.is_active !== false && !h.is_deleted);
  const habitsTotalActive = activeHabits.length;
  const bestStreak = activeHabits.reduce(
    (max, h) => Math.max(max, h.streak_current ?? 0),
    0,
  );

  // ── Goals ──
  const activeGoals = goals.filter(g => !g.is_deleted && g.status !== 'completed' && g.status !== 'cancelled');
  const goalsProgressPct = activeGoals.length > 0
    ? activeGoals.reduce((sum, g) => sum + (g.progress ?? 0), 0) / activeGoals.length
    : 0;

  // ── Finance ──
  const dayIncome = incomes
    .filter(i => i.date === date && !i.is_deleted)
    .reduce((s, i) => s + (i.amount ?? 0), 0);
  const dayExpense = expenses
    .filter(e => e.date === date && !e.is_deleted)
    .reduce((s, e) => s + (e.amount ?? 0), 0);

  // ── Health ──
  const dayHealth = healthMetrics.filter(h => h.date === date);
  const healthAvgMood = dayHealth.length > 0
    ? dayHealth.reduce((s, h) => s + (h.mood_score ?? 0), 0) / dayHealth.length
    : -1;
  const healthAvgSleep = dayHealth.length > 0
    ? dayHealth.reduce((s, h) => s + (h.sleep_hours ?? 0), 0) / dayHealth.length
    : -1;

  // ── Journal ──
  const dayJournals = journalEntries.filter(j => j.date === date && !j.is_deleted);
  const journalWordCount = dayJournals.reduce((s, j) => {
    const text = j.content ?? '';
    return s + (text.split(/\s+/).filter(Boolean).length);
  }, 0);

  // ── XP ──
  const userXp = xpRows.find(x => !userId || x.user_id === userId) ?? xpRows[0];
  const xpTotal = userXp?.total_xp ?? 0;

  const snapshot: DataSnapshot = {
    date,
    habitsCompletedCount,
    habitsTotalActive,
    goalsProgressPct: Math.round(goalsProgressPct * 100) / 100,
    financeIncomeTotal: Math.round(dayIncome * 100) / 100,
    financeExpenseTotal: Math.round(dayExpense * 100) / 100,
    healthAvgMood: Math.round(healthAvgMood * 10) / 10,
    healthAvgSleep: Math.round(healthAvgSleep * 10) / 10,
    journalWordCount,
    xpTotal,
    longestStreak: bestStreak,
  };

  setCache(cacheKey, snapshot);
  return snapshot;
}

// ─── Timeline Generation ───────────────────────────────────────────

/**
 * generateTimeline — Creates an array of daily DataSnapshots for a date range.
 */
export async function generateTimeline(
  range: TimeRange,
  startDate?: string,
): Promise<DataSnapshot[]> {
  const today = toISODate(new Date());
  const start = startDate
    ?? (range === 'week' ? toISODate(getStartOfWeek(new Date()))
    : range === 'month' ? toISODate(getStartOfMonth(new Date()))
    : toISODate(getStartOfWeek(new Date())));
  const end = rangeEnd(range, start);

  // Clamp end to today — no future dates
  const effectiveEnd = end > today ? today : end;

  const cacheKey = `timeline_${range}_${start}_${effectiveEnd}`;
  const cached = getCached<DataSnapshot[]>(cacheKey);
  if (cached) return cached;

  const dates = daysInRange(start, effectiveEnd);
  const snapshots = await Promise.all(dates.map(d => captureSnapshot(d)));

  setCache(cacheKey, snapshots);
  return snapshots;
}

// ─── Snapshot Comparison ────────────────────────────────────────────

/**
 * compareSnapshots — Computes the delta between two snapshots.
 */
export function compareSnapshots(start: DataSnapshot, end: DataSnapshot): SnapshotDelta {
  return {
    start: start.date,
    end: end.date,
    habitsCompletedCountDelta: end.habitsCompletedCount - start.habitsCompletedCount,
    goalsProgressDelta: Math.round((end.goalsProgressPct - start.goalsProgressPct) * 100) / 100,
    financeIncomeDelta: Math.round((end.financeIncomeTotal - start.financeIncomeTotal) * 100) / 100,
    financeExpenseDelta: Math.round((end.financeExpenseTotal - start.financeExpenseTotal) * 100) / 100,
    healthAvgMoodDelta: Math.round((end.healthAvgMood - start.healthAvgMood) * 10) / 10,
    healthAvgSleepDelta: Math.round((end.healthAvgSleep - start.healthAvgSleep) * 10) / 10,
    journalWordCountDelta: end.journalWordCount - start.journalWordCount,
    xpTotalDelta: end.xpTotal - start.xpTotal,
    longestStreakDelta: end.longestStreak - start.longestStreak,
  };
}

// ─── Trend Calculation ─────────────────────────────────────────────

function computeTrend(values: number[]): TrendResult {
  if (values.length < 2) return { direction: 'stable', changePct: 0 };

  // Compare first half average to second half average
  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (avgFirst === 0 && avgSecond === 0) return { direction: 'stable', changePct: 0 };
  if (avgFirst === 0) return { direction: 'up', changePct: 100 };

  const changePct = Math.round(((avgSecond - avgFirst) / Math.abs(avgFirst)) * 10000) / 100;

  if (Math.abs(changePct) < 5) return { direction: 'stable', changePct };
  return { direction: changePct > 0 ? 'up' : 'down', changePct };
}

/**
 * calculateTrends — Given a timeline of snapshots, returns per-domain trend direction
 * and percentage change.
 */
export function calculateTrends(
  timeline: DataSnapshot[],
): Record<TrendKey, TrendResult> {
  if (timeline.length < 2) {
    const emptyTrend: TrendResult = { direction: 'stable', changePct: 0 };
    return {
      habitsCompletedCount: emptyTrend,
      goalsProgressPct: emptyTrend,
      financeIncomeTotal: emptyTrend,
      financeExpenseTotal: emptyTrend,
      healthAvgMood: emptyTrend,
      healthAvgSleep: emptyTrend,
      journalWordCount: emptyTrend,
      xpTotal: emptyTrend,
      longestStreak: emptyTrend,
    };
  }

  return {
    habitsCompletedCount: computeTrend(timeline.map(s => s.habitsCompletedCount)),
    goalsProgressPct: computeTrend(timeline.map(s => s.goalsProgressPct)),
    financeIncomeTotal: computeTrend(timeline.map(s => s.financeIncomeTotal)),
    financeExpenseTotal: computeTrend(timeline.map(s => s.financeExpenseTotal)),
    healthAvgMood: computeTrend(timeline.map(s => s.healthAvgMood === -1 ? 0 : s.healthAvgMood)),
    healthAvgSleep: computeTrend(timeline.map(s => s.healthAvgSleep === -1 ? 0 : s.healthAvgSleep)),
    journalWordCount: computeTrend(timeline.map(s => s.journalWordCount)),
    xpTotal: computeTrend(timeline.map(s => s.xpTotal)),
    longestStreak: computeTrend(timeline.map(s => s.longestStreak)),
  };
}

// ─── Convenience: Weekly / Monthly Replay ───────────────────────────

export interface ReplayDay {
  snapshot: DataSnapshot;
  trend: TrendResult;
}

/**
 * getWeeklyReplay — 7 daily snapshots with trend arrows.
 * weekStart should be a Monday (YYYY-MM-DD).
 */
export async function getWeeklyReplay(weekStart?: string): Promise<ReplayDay[]> {
  const start = weekStart ?? toISODate(getStartOfWeek(new Date()));
  const timeline = await generateTimeline('week', start);

  // Limit to 7 days
  const week = timeline.slice(0, 7);
  const trends = calculateTrends(week);

  const trendKeys: TrendKey[] = [
    'habitsCompletedCount', 'goalsProgressPct', 'financeIncomeTotal',
    'financeExpenseTotal', 'healthAvgMood', 'healthAvgSleep',
    'journalWordCount', 'xpTotal', 'longestStreak',
  ];

  return week.map((snapshot) => {
    // For each day, compute a simplified overall trend from the weekly trends
    const overallTrend = trendKeys.reduce<TrendResult>(
      (acc, key) => {
        const t = trends[key];
        if (t.direction === 'up') return { ...acc, changePct: acc.changePct + t.changePct };
        if (t.direction === 'down') return { ...acc, changePct: acc.changePct - t.changePct };
        return acc;
      },
      { direction: 'stable' as const, changePct: 0 },
    );

    // Simplify direction
    if (overallTrend.changePct > 5) overallTrend.direction = 'up';
    else if (overallTrend.changePct < -5) overallTrend.direction = 'down';

    addTrendArrow(overallTrend); // ensure computed
    return { snapshot, trend: overallTrend };
  });
}

/**
 * getMonthlyReplay — 30 daily snapshots.
 * monthStart should be the first day of the month (YYYY-MM-DD).
 */
export async function getMonthlyReplay(monthStart?: string): Promise<ReplayDay[]> {
  const start = monthStart ?? toISODate(getStartOfMonth(new Date()));
  const timeline = await generateTimeline('month', start);

  const month = timeline.slice(0, 30);
  const trends = calculateTrends(month);

  const trendKeys: TrendKey[] = [
    'habitsCompletedCount', 'goalsProgressPct', 'financeIncomeTotal',
    'financeExpenseTotal', 'healthAvgMood', 'healthAvgSleep',
    'journalWordCount', 'xpTotal', 'longestStreak',
  ];

  return month.map((snapshot) => {
    const overallTrend = trendKeys.reduce<TrendResult>(
      (acc, key) => {
        const t = trends[key];
        if (t.direction === 'up') return { ...acc, changePct: acc.changePct + t.changePct };
        if (t.direction === 'down') return { ...acc, changePct: acc.changePct - t.changePct };
        return acc;
      },
      { direction: 'stable' as const, changePct: 0 },
    );

    if (overallTrend.changePct > 5) overallTrend.direction = 'up';
    else if (overallTrend.changePct < -5) overallTrend.direction = 'down';

    return { snapshot, trend: overallTrend };
  });
}