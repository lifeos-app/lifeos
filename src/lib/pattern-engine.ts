/**
 * pattern-engine.ts — Pattern Detection Engine for LifeOS
 *
 * Pure function library that analyzes user data to detect behavioral patterns:
 * - productivity_peak: Hours/days user completes most tasks
 * - energy_cycle: Morning vs afternoon vs evening productivity from habit logs
 * - habit_anchor: Most consistently done habits (anchor habits)
 * - goal_neglect: Goals with no activity in 7+ days
 * - spending_spike: Weeks where spending exceeds 1.5x average
 * - streak_risk: Habits about to break (streak + skip yesterday)
 * - optimal_schedule: Suggested time blocks from historical data
 *
 * All pure functions, no side effects, no React. Analyzes last 30 days.
 */

import type { Task, Habit, HabitLog, Goal, Bill, Transaction } from '../types/database';

// ── Types ────────────────────────────────────────────────────────

export type PatternType =
  | 'productivity_peak' | 'energy_cycle' | 'habit_anchor'
  | 'goal_neglect' | 'spending_spike' | 'streak_risk' | 'optimal_schedule';

export interface PatternInput {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  bills: Bill[];
  transactions?: Transaction[];
  journalEntries?: any[];
}

export interface DetectedPattern {
  type: PatternType;
  confidence: number;
  title: string;
  description: string;
  data: Record<string, any>;
  detectedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────

const DAYS_BACK = 30;
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
type TimeBlock = 'morning' | 'afternoon' | 'evening';

const daysAgo = (n: number): string => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };
const withinDays = (s: string | null | undefined, n: number): boolean => !!s && s >= daysAgo(n);
const hourOf = (iso: string): number => { const h = new Date(iso).getHours(); return isNaN(h) ? -1 : h; };
const dowOf = (iso: string): number => { const d = new Date(iso).getDay(); return isNaN(d) ? -1 : d; };
const blockOf = (h: number): TimeBlock => (h >= 5 && h < 12) ? 'morning' : (h < 17 ? 'afternoon' : 'evening');
const weekKey = (ds: string): string => { const d = new Date(ds); const j = new Date(d.getFullYear(),0,1); return `${d.getFullYear()}-W${Math.ceil(((d.getTime()-j.getTime())/86400000+j.getDay()+1)/7)}`; };

// ── Productivity Peak ────────────────────────────────────────────

export function detectProductivityPeaks(tasks: Task[], _habitLogs: HabitLog[]): DetectedPattern[] {
  const done = tasks.filter(t => t.status === 'done' && t.completed_at && withinDays(t.completed_at, DAYS_BACK) && !t.is_deleted);
  if (done.length < 5) return [];

  const byHour: Record<number, number> = {};
  const byDay: Record<number, number> = {};
  const byBlock: Record<TimeBlock, number> = { morning: 0, afternoon: 0, evening: 0 };

  for (const t of done) {
    const h = hourOf(t.completed_at!);
    const d = dowOf(t.completed_at!);
    if (h >= 0) { byHour[h] = (byHour[h]||0)+1; byBlock[blockOf(h)]++; }
    if (d >= 0) byDay[d] = (byDay[d]||0)+1;
  }

  const maxH = Math.max(...Object.values(byHour), 0);
  const peakHours = Object.entries(byHour).filter(([,c]) => c === maxH).map(([h]) => Number(h)).sort((a,b) => a-b);
  const maxD = Math.max(...Object.values(byDay), 0);
  const peakDays = Object.entries(byDay).filter(([,c]) => c === maxD).map(([d]) => Number(d)).sort((a,b) => a-b);
  const topBlock = (Object.entries(byBlock) as [TimeBlock,number][]).sort((a,b) => b[1]-a[1])[0];

  return [{
    type: 'productivity_peak',
    confidence: Math.min(done.length / 30, 1),
    title: 'Productivity Peak Detected',
    description: `You complete the most tasks around ${peakHours.map(h=>`${h}:00`).join(', ')} on ${peakDays.map(d=>DAY_NAMES[d]).join(', ')}. Peak time block: ${topBlock[0]}.`,
    data: { peakHours, peakDays, peakDayNames: peakDays.map(d=>DAY_NAMES[d]), hourDistribution: byHour, dayDistribution: byDay, timeBlockDistribution: byBlock, totalCompleted: done.length },
    detectedAt: new Date().toISOString(),
  }];
}

// ── Energy Cycle ─────────────────────────────────────────────────

export function detectEnergyCycles(habitLogs: HabitLog[]): DetectedPattern[] {
  const logs = habitLogs.filter(l => withinDays(l.date, DAYS_BACK));
  if (logs.length < 10) return [];

  const blockC: Record<TimeBlock, number> = { morning: 0, afternoon: 0, evening: 0 };
  const uniqueDays = new Set(logs.map(l => l.date));

  for (const l of logs) {
    const h = l.created_at ? hourOf(l.created_at) : 12;
    if (h >= 0) blockC[blockOf(h)] += l.count || 1;
  }

  const rates: Record<TimeBlock, number> = {
    morning: blockC.morning / Math.max(logs.length, 1),
    afternoon: blockC.afternoon / Math.max(logs.length, 1),
    evening: blockC.evening / Math.max(logs.length, 1),
  };

  const sorted = (Object.entries(rates) as [TimeBlock,number][]).sort((a,b) => b[1]-a[1]);
  const spread = sorted[0][1] - sorted[sorted.length-1][1];
  if (spread < 0.1) return [];

  return [{
    type: 'energy_cycle',
    confidence: Math.min(spread*2, 1) * Math.min(uniqueDays.size/14, 1),
    title: 'Energy Cycle Identified',
    description: `Strongest completion in the ${sorted[0][0]} (${Math.round(sorted[0][1]*100)}%). Lightest period: ${sorted[2][0]} (${Math.round(sorted[2][1]*100)}%).`,
    data: { rates, bestBlock: sorted[0][0], worstBlock: sorted[2][0], uniqueDays: uniqueDays.size, totalLogs: logs.length },
    detectedAt: new Date().toISOString(),
  }];
}

// ── Habit Anchor ─────────────────────────────────────────────────

export function detectHabitAnchors(habits: Habit[], habitLogs: HabitLog[]): DetectedPattern[] {
  const active = habits.filter(h => h.is_active && !h.is_deleted);
  if (active.length < 2) return [];

  const logs = habitLogs.filter(l => withinDays(l.date, DAYS_BACK));
  const stats = active.map(h => {
    const hLogs = logs.filter(l => l.habit_id === h.id);
    const days = new Set(hLogs.map(l => l.date)).size;
    return { habit: h, days, rate: days / DAYS_BACK, streak: h.streak_current || 0 };
  });

  const anchors = stats.filter(s => s.rate >= 0.6).sort((a,b) => b.rate - a.rate).slice(0, 5);
  if (anchors.length === 0) return [];

  return [{
    type: 'habit_anchor',
    confidence: Math.min(anchors[0].rate, 1),
    title: 'Habit Anchor Detected',
    description: `${anchors[0].habit.title} is your most consistent habit, done on ${Math.round(anchors[0].rate*100)}% of days. Use it as an anchor to chain new habits.`,
    data: { anchors: anchors.map(a => ({ id: a.habit.id, title: a.habit.title, completionRate: Math.round(a.rate*100), uniqueDays: a.days, streak: a.streak })) },
    detectedAt: new Date().toISOString(),
  }];
}

// ── Goal Neglect ────────────────────────────────────────────────

export function detectGoalNeglect(goals: Goal[], tasks: Task[]): DetectedPattern[] {
  const active = goals.filter(g => !g.is_deleted && !['completed','done','archived'].includes(g.status));
  if (active.length === 0) return [];

  const cutoff = daysAgo(7);
  const patterns: DetectedPattern[] = [];

  for (const goal of active) {
    const gt = tasks.filter(t => t.goal_id === goal.id && !t.is_deleted);
    const recent = gt.some(t => (t.completed_at && t.completed_at >= cutoff) || (t.updated_at && t.updated_at >= cutoff) || (t.created_at && t.created_at >= cutoff));
    if (recent) continue;

    const lastDate = gt.reduce<string|null>((best, t) => {
      const dates = [t.completed_at, t.updated_at, t.created_at].filter(Boolean).sort().reverse();
      return dates[0] && (!best || dates[0] > best) ? dates[0] : best;
    }, null);

    const daysSince = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : 999;
    if (daysSince < 7) continue;

    const label = daysSince >= 999 ? 'no recorded activity' : `${daysSince} days`;
    patterns.push({
      type: 'goal_neglect',
      confidence: Math.min(daysSince / 30, 1),
      title: `Goal Neglect: ${goal.title}`,
      description: `"${goal.title}" has had no activity for ${label}. Consider revisiting or updating its status.`,
      data: { goalId: goal.id, goalTitle: goal.title, daysSinceActivity: daysSince, lastActivity: lastDate, taskCount: gt.length, status: goal.status },
      detectedAt: new Date().toISOString(),
    });
  }

  return patterns.sort((a,b) => b.confidence - a.confidence).slice(0, 5);
}

// ── Spending Spike ──────────────────────────────────────────────

export function detectSpendingSpikes(bills: Bill[], transactions?: Transaction[]): DetectedPattern[] {
  const expenses = transactions
    ? transactions.filter(t => t.type === 'expense' && withinDays(t.date, DAYS_BACK))
    : bills.filter(b => !b.is_deleted && b.due_date && withinDays(b.due_date, DAYS_BACK)).map(b => ({ id: b.id, date: b.due_date!, amount: b.amount }));

  if (expenses.length < 3) return [];

  const ws: Record<string, number> = {};
  for (const e of expenses) { const wk = weekKey(e.date); ws[wk] = (ws[wk]||0) + e.amount; }

  const entries = Object.entries(ws);
  if (entries.length < 2) return [];

  const avg = entries.reduce((s,[,a]) => s+a, 0) / entries.length;
  const spikes = entries.filter(([,a]) => a > avg * 1.5).sort((a,b) => b[1]-a[1]);
  if (spikes.length === 0) return [];

  return spikes.slice(0, 3).map(([week, total]) => {
    const overPct = Math.round(((total/avg)-1)*100);
    return {
      type: 'spending_spike' as PatternType,
      confidence: Math.min(overPct/100, 1),
      title: `Spending Spike: ${week}`,
      description: `Spending in ${week} was $${Math.round(total)}, ${overPct}% above your weekly average of $${Math.round(avg)}.`,
      data: { week, totalSpent: total, averageWeekly: Math.round(avg), overAverageBy: Math.round(total-avg), overPct },
      detectedAt: new Date().toISOString(),
    };
  });
}

// ── Streak Risk ─────────────────────────────────────────────────

export function detectStreakRisk(habits: Habit[], habitLogs: HabitLog[]): DetectedPattern[] {
  const yesterday = daysAgo(1);
  const atRisk = habits
    .filter(h => h.is_active && !h.is_deleted && (h.streak_current||0) > 0)
    .filter(h => {
      const yLogs = habitLogs.filter(l => l.habit_id === h.id && l.date === yesterday);
      return yLogs.reduce((s,l) => s+(l.count||1), 0) < (h.target_count||1);
    });

  if (atRisk.length === 0) return [];

  return atRisk
    .sort((a,b) => (b.streak_current||0) - (a.streak_current||0))
    .slice(0, 5)
    .map(h => ({
      type: 'streak_risk' as PatternType,
      confidence: Math.min((h.streak_current||0)/14, 1),
      title: `Streak at Risk: ${h.title}`,
      description: `"${h.title}" has a ${h.streak_current}-day streak but was not completed yesterday. Complete it today to keep it alive.`,
      data: { habitId: h.id, habitTitle: h.title, currentStreak: h.streak_current, bestStreak: h.streak_best, frequency: h.frequency },
      detectedAt: new Date().toISOString(),
    }));
}

// ── Optimal Schedule ────────────────────────────────────────────

export function detectOptimalSchedule(tasks: Task[], habitLogs: HabitLog[]): DetectedPattern[] {
  const done = tasks.filter(t => t.status==='done' && t.completed_at && withinDays(t.completed_at, DAYS_BACK) && !t.is_deleted);
  const logs = habitLogs.filter(l => withinDays(l.date, DAYS_BACK));
  if (done.length < 5 && logs.length < 10) return [];

  const taskBlock: Record<TimeBlock,number> = { morning:0, afternoon:0, evening:0 };
  for (const t of done) { const h = hourOf(t.completed_at!); if (h>=0) taskBlock[blockOf(h)]++; }

  const habitBlock: Record<TimeBlock,number> = { morning:0, afternoon:0, evening:0 };
  for (const l of logs) { const h = l.created_at ? hourOf(l.created_at) : 12; if (h>=0) habitBlock[blockOf(h)]++; }

  const blocks: TimeBlock[] = ['morning','afternoon','evening'];
  const suggestions = blocks.map(block => {
    const t = taskBlock[block], h = habitBlock[block], total = t+h;
    const ratio = total > 0 ? t/total : 0.5;
    const rec = ratio > 0.6 ? 'Deep work - most tasks completed here' : ratio < 0.4 ? 'Habit routine - habit maintenance window' : 'Mixed activity - tasks and habits both work';
    return { block, recommendation: rec, score: total };
  }).sort((a,b) => b.score - a.score);

  return [{
    type: 'optimal_schedule',
    confidence: Math.min((done.length+logs.length)/60, 1),
    title: 'Optimal Schedule Suggestion',
    description: `Most productive block: ${suggestions[0].block}. ${suggestions[0].recommendation}.`,
    data: { taskByBlock: taskBlock, habitByBlock: habitBlock, suggestions },
    detectedAt: new Date().toISOString(),
  }];
}

// ── Main Entry ──────────────────────────────────────────────────

/** Run all pattern detectors, return combined results sorted by confidence. */
export function detectPatterns(input: PatternInput): DetectedPattern[] {
  return [
    ...detectProductivityPeaks(input.tasks, input.habitLogs),
    ...detectEnergyCycles(input.habitLogs),
    ...detectHabitAnchors(input.habits, input.habitLogs),
    ...detectGoalNeglect(input.goals, input.tasks),
    ...detectSpendingSpikes(input.bills, input.transactions),
    ...detectStreakRisk(input.habits, input.habitLogs),
    ...detectOptimalSchedule(input.tasks, input.habitLogs),
  ].sort((a, b) => b.confidence - a.confidence);
}