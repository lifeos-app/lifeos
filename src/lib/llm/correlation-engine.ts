/**
 * LifeOS Cross-Domain Correlation Engine
 *
 * Detects how habits, schedule, finances, health, and goals
 * correlate using simple day-by-day Pearson correlations
 * over the last 30 days. No ML -- just binary correlations
 * on daily metric pairs.
 */

import type {
  Habit, HabitLog, Task, ScheduleEvent, Goal,
  Transaction, Bill, HealthMetric,
} from '../../types/database';
import { SEVEN_PRINCIPLES } from '../hermetic-integration';

// ── TYPES ────────────────────────────────────────────────────────────────────

export interface Correlation {
  id: string;
  type: 'positive' | 'negative' | 'neutral';
  domains: [string, string];
  strength: number; // -1 to 1
  description: string;
  data: Record<string, unknown>;
  detectedAt: string;
  /** Index into SEVEN_PRINCIPLES — proves Correspondence (as above so below) */
  hermeticPrinciple?: number;
  /** True when the correlation is negative, reflecting Polarity */
  polarityDetected?: boolean;
}

export interface CorrelationInput {
  habits: Habit[];
  habitLogs: HabitLog[];
  tasks: Task[];
  events: ScheduleEvent[];
  goals: Goal[];
  transactions: Transaction[];
  bills: Bill[];
  healthMetrics: HealthMetric[];
}

const MIN_DAYS = 5;
const MIN_STRENGTH = 0.25;
const LOOKBACK = 30;

// ── HELPERS ──────────────────────────────────────────────────────────────────

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function lastNDays(n = LOOKBACK): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(dateStr(d));
  }
  return days;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n < MIN_DAYS) return 0;
  const mA = a.reduce((s, v) => s + v, 0) / n;
  const mB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, dA = 0, dB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - mA, db = b[i] - mB;
    num += da * db; dA += da * da; dB += db * db;
  }
  const den = Math.sqrt(dA) * Math.sqrt(dB);
  return den === 0 ? 0 : num / den;
}

function safePearson(a: number[], b: number[]): number {
  const pairs: [number, number][] = [];
  for (let i = 0; i < a.length; i++) {
    if (!isNaN(a[i]) && !isNaN(b[i])) pairs.push([a[i], b[i]]);
  }
  if (pairs.length < MIN_DAYS) return 0;
  return pearson(pairs.map(p => p[0]), pairs.map(p => p[1]));
}

function corrType(r: number): 'positive' | 'negative' | 'neutral' {
  if (r > 0.15) return 'positive';
  if (r < -0.15) return 'negative';
  return 'neutral';
}

function gid(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeCorr(domains: [string, string], r: number, desc: string, data?: Record<string, unknown>): Correlation {
  const type = corrType(r);
  return {
    id: gid(), type, domains, strength: r, description: desc, data: data ?? {}, detectedAt: new Date().toISOString(),
    hermeticPrinciple: 1, // CORRESPONDENCE — "As above, so below"
    ...(type === 'negative' ? { polarityDetected: true } : {}),
  };
}

// ── HABITS ↔ SCHEDULE ─────────────────────────────────────────────────────

/** Does habit completion predict task productivity? */
export function correlateHabitsWithSchedule(
  habits: Habit[], habitLogs: HabitLog[], tasks: Task[], events: ScheduleEvent[],
): Correlation[] {
  const results: Correlation[] = [];
  const active = habits.filter(h => h.is_active && !h.is_deleted);
  if (!active.length || !tasks.length) return results;

  const days = lastNDays();
  const logsByDate = new Map<string, Set<string>>();
  for (const log of habitLogs) {
    if (!logsByDate.has(log.date)) logsByDate.set(log.date, new Set());
    logsByDate.get(log.date)!.add(log.habit_id);
  }
  const taskDoneByDay = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === 'done' && t.completed_at) {
      const d = t.completed_at.slice(0, 10);
      taskDoneByDay.set(d, (taskDoneByDay.get(d) || 0) + 1);
    }
  }
  const eventsByDay = new Map<string, number>();
  for (const e of events) {
    if (!e.start_time || e.is_deleted) continue;
    const d = e.start_time.slice(0, 10);
    eventsByDay.set(d, (eventsByDay.get(d) || 0) + 1);
  }

  const habitRate: number[] = [];
  const taskDone: number[] = [];
  const eventDensity: number[] = [];

  for (const day of days) {
    const completed = active.filter(h => logsByDate.get(day)?.has(h.id)).length;
    habitRate.push(active.length > 0 ? completed / active.length : 0);
    taskDone.push(taskDoneByDay.get(day) || 0);
    eventDensity.push(eventsByDay.get(day) || 0);
  }

  const r1 = pearson(habitRate, taskDone);
  if (Math.abs(r1) >= MIN_STRENGTH) {
    const highDays = days.filter((_, i) => habitRate[i] > 0.5);
    const lowDays = days.filter((_, i) => habitRate[i] <= 0.5);
    const avgH = highDays.length ? highDays.reduce((s, d) => s + (taskDoneByDay.get(d) || 0), 0) / highDays.length : 0;
    const avgL = lowDays.length ? lowDays.reduce((s, d) => s + (taskDoneByDay.get(d) || 0), 0) / lowDays.length : 0;
    const pct = avgL > 0 ? Math.round(((avgH - avgL) / avgL) * 100) : 0;
    results.push(makeCorr(['habits', 'schedule'], r1,
      pct > 0
        ? `Days with higher habit completion have ${pct}% more tasks completed (r=${r1.toFixed(2)})`
        : `Days with higher habit completion have ${Math.abs(pct)}% fewer tasks completed (r=${r1.toFixed(2)})`,
      { r: r1, avgH, avgL, pct }));
  }

  const r2 = pearson(eventDensity, habitRate);
  if (Math.abs(r2) >= MIN_STRENGTH) {
    results.push(makeCorr(['habits', 'schedule'], r2,
      r2 < 0
        ? `Busier days (more events) correlate with ${Math.round(Math.abs(r2) * 100)}% lower habit completion (r=${r2.toFixed(2)})`
        : `Busier days correlate with higher habit completion (r=${r2.toFixed(2)})`,
      { r: r2 }));
  }

  return results;
}

// ── GOALS ↔ FINANCES ───────────────────────────────────────────────────────

/** Does financial activity predict goal progress? */
export function correlateGoalsWithFinances(
  goals: Goal[], bills: Bill[], transactions: Transaction[],
): Correlation[] {
  const results: Correlation[] = [];
  const activeGoals = goals.filter(g => !g.is_deleted && g.status !== 'completed' && g.status !== 'done');
  if (!activeGoals.length && !transactions.length) return results;

  const days = lastNDays();
  const txByDay = new Map<string, { count: number; net: number }>();
  for (const tx of transactions) {
    const e = txByDay.get(tx.date) || { count: 0, net: 0 };
    e.count++; e.net += tx.type === 'income' ? tx.amount : -tx.amount;
    txByDay.set(tx.date, e);
  }
  const goalUpdByDay = new Map<string, number>();
  for (const g of activeGoals) {
    if (!g.updated_at) continue;
    const d = g.updated_at.slice(0, 10);
    goalUpdByDay.set(d, (goalUpdByDay.get(d) || 0) + 1);
  }

  const txCnt: number[] = []; const netFlow: number[] = []; const goalUpd: number[] = [];
  for (const day of days) {
    const td = txByDay.get(day) || { count: 0, net: 0 };
    txCnt.push(td.count); netFlow.push(td.net); goalUpd.push(goalUpdByDay.get(day) || 0);
  }

  const r1 = pearson(txCnt, goalUpd);
  if (Math.abs(r1) >= MIN_STRENGTH) {
    results.push(makeCorr(['goals', 'finances'], r1,
      r1 > 0
        ? `Days with more financial transactions have more goal updates (r=${r1.toFixed(2)})`
        : `Days with more financial transactions have fewer goal updates (r=${r1.toFixed(2)})`,
      { r: r1 }));
  }

  const r2 = pearson(netFlow, goalUpd);
  if (Math.abs(r2) >= MIN_STRENGTH) {
    results.push(makeCorr(['goals', 'finances'], r2,
      r2 > 0
        ? `Positive cash flow days correlate with more goal progress (r=${r2.toFixed(2)})`
        : `Negative cash flow days correlate with more goal progress (r=${r2.toFixed(2)})`,
      { r: r2 }));
  }

  const unpaid = bills.filter(b => !b.is_deleted && b.status !== 'paid');
  if (unpaid.length > 0) {
    const avg = unpaid.reduce((s, b) => s + b.amount, 0) / unpaid.length;
    if (avg > 0) {
      results.push(makeCorr(['goals', 'finances'], -0.3,
        `${unpaid.length} unpaid bills (avg $${avg.toFixed(0)}) may be limiting financial goal progress`,
        { unpaidBillCount: unpaid.length, avgBillAmount: avg }));
    }
  }

  return results;
}

// ── HEALTH ↔ PRODUCTIVITY ──────────────────────────────────────────────────

/** Does sleep/energy/mood predict task output? */
export function correlateHealthWithProductivity(
  healthMetrics: HealthMetric[], tasks: Task[], habitLogs: HabitLog[],
): Correlation[] {
  const results: Correlation[] = [];
  const days = lastNDays();
  const healthByDay = new Map<string, HealthMetric>();
  for (const hm of healthMetrics) healthByDay.set(hm.date, hm);

  const taskDoneByDay = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === 'done' && t.completed_at) {
      const d = t.completed_at.slice(0, 10);
      taskDoneByDay.set(d, (taskDoneByDay.get(d) || 0) + 1);
    }
  }
  const habitLogByDay = new Map<string, number>();
  const habitN = new Set(habitLogs.map(l => l.habit_id)).size || 1;
  for (const log of habitLogs) habitLogByDay.set(log.date, (habitLogByDay.get(log.date) || 0) + 1);

  const sleepHrs: number[] = []; const energy: number[] = []; const mood: number[] = [];
  const taskDone: number[] = []; const habitRate: number[] = [];

  for (const day of days) {
    const hm = healthByDay.get(day);
    sleepHrs.push(hm?.sleep_hours ?? NaN);
    energy.push(hm?.energy_score ?? NaN);
    mood.push(hm?.mood_score ?? NaN);
    taskDone.push(taskDoneByDay.get(day) || 0);
    habitRate.push((habitLogByDay.get(day) || 0) / habitN);
  }

  // Sleep → task completion
  const rSleep = safePearson(sleepHrs, taskDone);
  if (Math.abs(rSleep) >= MIN_STRENGTH) {
    const hi = days.filter((_, i) => !isNaN(sleepHrs[i]) && sleepHrs[i] >= 7);
    const lo = days.filter((_, i) => !isNaN(sleepHrs[i]) && sleepHrs[i] < 7);
    const avgH = hi.length ? hi.reduce((s, d) => s + (taskDoneByDay.get(d) || 0), 0) / hi.length : 0;
    const avgL = lo.length ? lo.reduce((s, d) => s + (taskDoneByDay.get(d) || 0), 0) / lo.length : 0;
    const mult = avgL > 0 ? avgH / avgL : 0;
    results.push(makeCorr(['health', 'schedule'], rSleep,
      mult > 1
        ? `Days with 7+ hours sleep have ${mult.toFixed(1)}x task completion rate (r=${rSleep.toFixed(2)})`
        : `Sleep hours and task completion correlate at r=${rSleep.toFixed(2)}`,
      { r: rSleep, avgHighSleep: avgH, avgLowSleep: avgL, mult }));
  }

  // Energy → habit completion
  const rEn = safePearson(energy, habitRate);
  if (Math.abs(rEn) >= MIN_STRENGTH) {
    results.push(makeCorr(['health', 'habits'], rEn,
      rEn > 0
        ? `Higher energy days correlate with better habit completion (r=${rEn.toFixed(2)})`
        : `Higher energy days correlate with lower habit completion (r=${rEn.toFixed(2)})`,
      { r: rEn }));
  }

  // Mood → productivity
  const prod = taskDone.map((t, i) => t + habitRate[i] * 3);
  const rMo = safePearson(mood, prod);
  if (Math.abs(rMo) >= MIN_STRENGTH) {
    results.push(makeCorr(['health', 'schedule'], rMo,
      `Mood and productivity correlate at r=${rMo.toFixed(2)}`, { r: rMo }));
  }

  return results;
}

// ── SCHEDULE ↔ ENERGY ──────────────────────────────────────────────────────

/** Does schedule density predict habit/energy outcomes? */
export function correlateScheduleWithEnergy(
  events: ScheduleEvent[], habitLogs: HabitLog[],
): Correlation[] {
  const results: Correlation[] = [];
  const days = lastNDays();

  const evCntByDay = new Map<string, number>();
  const mtgCntByDay = new Map<string, number>();
  for (const e of events) {
    if (!e.start_time || e.is_deleted) continue;
    const d = e.start_time.slice(0, 10);
    evCntByDay.set(d, (evCntByDay.get(d) || 0) + 1);
    if (e.event_type === 'meeting') mtgCntByDay.set(d, (mtgCntByDay.get(d) || 0) + 1);
  }
  const habDoneByDay = new Map<string, number>();
  for (const l of habitLogs) habDoneByDay.set(l.date, (habDoneByDay.get(l.date) || 0) + 1);

  const evD: number[] = []; const mtgD: number[] = []; const habD: number[] = [];
  for (const day of days) {
    evD.push(evCntByDay.get(day) || 0);
    mtgD.push(mtgCntByDay.get(day) || 0);
    habD.push(habDoneByDay.get(day) || 0);
  }

  const r1 = pearson(evD, habD);
  if (Math.abs(r1) >= MIN_STRENGTH) {
    const busy = days.filter((_, i) => evD[i] > 0);
    const empty = days.filter((_, i) => evD[i] === 0);
    const avgB = busy.length ? busy.reduce((s, d) => s + (habDoneByDay.get(d) || 0), 0) / busy.length : 0;
    const avgE = empty.length ? empty.reduce((s, d) => s + (habDoneByDay.get(d) || 0), 0) / empty.length : 0;
    const pct = avgE > 0 ? Math.round(((avgB - avgE) / avgE) * 100) : 0;
    results.push(makeCorr(['schedule', 'habits'], r1,
      r1 < 0
        ? `Days with events have ${Math.abs(pct)}% lower habit completion (r=${r1.toFixed(2)})`
        : `Event-packed days correlate with higher habit completion (r=${r1.toFixed(2)})`,
      { r: r1, avgB, avgE, pct }));
  }

  const r2 = pearson(mtgD, habD);
  if (Math.abs(r2) >= MIN_STRENGTH) {
    results.push(makeCorr(['schedule', 'habits'], r2,
      r2 < 0
        ? `Meeting-heavy days correlate with ${Math.round(Math.abs(r2) * 100)}% lower habit completion (r=${r2.toFixed(2)})`
        : `Meeting-heavy days correlate with higher habit completion (r=${r2.toFixed(2)})`,
      { r: r2 }));
  }

  return results;
}

// ── MAIN DETECTOR ───────────────────────────────────────────────────────────

/** Run all cross-domain detectors, return sorted by absolute strength */
export function detectCorrelations(input: CorrelationInput): Correlation[] {
  return [
    ...correlateHabitsWithSchedule(input.habits, input.habitLogs, input.tasks, input.events),
    ...correlateGoalsWithFinances(input.goals, input.bills, input.transactions),
    ...correlateHealthWithProductivity(input.healthMetrics, input.tasks, input.habitLogs),
    ...correlateScheduleWithEnergy(input.events, input.habitLogs),
  ]
    .filter(c => c.type !== 'neutral')
    .sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength));
}

/** Format top correlations as compact string for LLM injection */
export function formatCorrelationsForLLM(correlations: Correlation[], limit = 5): string {
  const top = correlations.slice(0, limit);
  if (!top.length) return 'No significant cross-domain correlations detected in the last 30 days.';
  return top.map((c, i) => {
    const arrow = c.type === 'positive' ? '(+)' : '(-)';
    return `${i + 1}. [${c.domains[0]}<->${c.domains[1]}] ${arrow} ${c.description}`;
  }).join('\n');
}