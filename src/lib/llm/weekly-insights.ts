/**
 * LifeOS Weekly Insights Generator
 *
 * Gathers a full week's worth of data across all LifeOS domains,
 * computes stats locally, then calls the LLM for an AI narrative.
 *
 * Pattern follows morning-brief.ts and reschedule.ts
 */

import { supabase } from '../supabase';
import { callLLMSimple } from '../llm-proxy';
import { localDateStr } from '../../utils/date';
import { logger } from '../../utils/logger';

// ── TYPES ──────────────────────────────────────────────────────────────────────

export interface WeeklyInsightsData {
  weekKey: string;                // e.g. "2026-06-08" (week start)
  weekLabel: string;              // e.g. "Jun 8 - Jun 14, 2026"

  // Task stats
  taskCompletion: {
    completed: number;
    total: number;
    rate: number;                 // 0-100
    trend: 'up' | 'down' | 'same' | 'new';  // vs previous week
    prevRate: number;
  };

  // Most productive day
  productiveDay: {
    day: string;                  // e.g. "Wednesday"
    tasksCompleted: number;
  };

  // Habit streaks
  habitStreaks: {
    strong: { title: string; icon: string | null; streak: number }[];
    slipping: { title: string; icon: string | null; daysLogged: number; totalDays: number }[];
    overallRate: number;          // 0-100
  };

  // Goal progress
  goalProgress: {
    goals: { title: string; progress: number; icon: string | null }[];
    avgProgress: number;
  };

  // Time allocation
  timeAllocation: {
    categories: { label: string; hours: number; color: string }[];
    totalHours: number;
  };

  // Financial summary
  financeSummary: {
    income: number;
    expenses: number;
    net: number;
  };

  // AI narrative (Pro only)
  aiNarrative: string | null;

  generatedAt: string;
}

// ── HELPERS ────────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EVENT_TYPE_COLORS: Record<string, string> = {
  work: '#00D4FF',
  personal: '#A855F7',
  health: '#F43F5E',
  social: '#F97316',
  learning: '#8B5CF6',
  cleaning: '#39FF14',
  security: '#F97316',
  spiritual: '#FFD700',
  default: '#5A7A9A',
};

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (cur <= endDate) {
    dates.push(localDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ── MAIN GENERATOR ─────────────────────────────────────────────────────────────

/**
 * Generate weekly insights for a given week range.
 * Computes all stats locally, optionally calls LLM for narrative.
 */
export async function generateWeeklyInsights(
  userId: string,
  weekStart: string,   // YYYY-MM-DD (Sunday)
  weekEnd: string,     // YYYY-MM-DD (Saturday)
  options: { includeAINarrative?: boolean } = {},
): Promise<WeeklyInsightsData> {
  const { includeAINarrative = false } = options;

  // Previous week range for trend comparison
  const prevStart = new Date(weekStart + 'T00:00:00');
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(weekStart + 'T00:00:00');
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStartStr = localDateStr(prevStart);
  const prevEndStr = localDateStr(prevEnd);

  // ── Parallel data fetching ──
  const [
    tasksRes,
    prevTasksRes,
    habitsRes,
    habitLogsRes,
    goalsRes,
    eventsRes,
    incomeRes,
    expensesRes,
  ] = await Promise.all([
    // This week's tasks
    supabase.from('tasks').select('id, title, status, due_date, completed_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('due_date', weekStart).lte('due_date', weekEnd),

    // Previous week's tasks (for trend)
    supabase.from('tasks').select('id, status')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('due_date', prevStartStr).lte('due_date', prevEndStr),

    // Active habits
    supabase.from('habits').select('id, title, icon, frequency, streak_current')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('is_active', true),

    // Habit logs for this week
    supabase.from('habit_logs').select('habit_id, date')
      .eq('user_id', userId)
      .gte('date', weekStart).lte('date', weekEnd),

    // Active goals
    supabase.from('goals').select('id, title, progress, status, icon')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .is('parent_goal_id', null)
      .lt('progress', 1),

    // Schedule events this week
    supabase.from('schedule_events')
      .select('id, title, start_time, end_time, event_type')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('start_time', weekStart + 'T00:00:00')
      .lte('start_time', weekEnd + 'T23:59:59'),

    // Income this week
    supabase.from('income').select('amount, date')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('date', weekStart).lte('date', weekEnd),

    // Expenses this week
    supabase.from('expenses').select('amount, date')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('date', weekStart).lte('date', weekEnd),
  ]);

  const tasks = tasksRes.data || [];
  const prevTasks = prevTasksRes.data || [];
  const habits = (habitsRes.data || []) as { id: string; title: string; icon: string | null; frequency: string; streak_current: number }[];
  const habitLogs = (habitLogsRes.data || []) as { habit_id: string; date: string }[];
  const goals = (goalsRes.data || []) as { id: string; title: string; progress: number; status: string; icon: string | null }[];
  const events = (eventsRes.data || []) as { id: string; title: string; start_time: string; end_time: string | null; event_type: string | null }[];
  const incomes = (incomeRes.data || []) as { amount: number; date: string }[];
  const expenses = (expensesRes.data || []) as { amount: number; date: string }[];

  // ── Task completion ──
  const completed = tasks.filter(t => t.status === 'done').length;
  const total = tasks.length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const prevCompleted = prevTasks.filter(t => t.status === 'done').length;
  const prevTotal = prevTasks.length;
  const prevRate = prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0;

  let trend: 'up' | 'down' | 'same' | 'new' = 'new';
  if (prevTotal > 0) {
    if (rate > prevRate) trend = 'up';
    else if (rate < prevRate) trend = 'down';
    else trend = 'same';
  }

  // ── Most productive day ──
  const dayTaskCounts: Record<string, number> = {};
  for (const task of tasks) {
    if (task.status === 'done' && task.completed_at) {
      const dayOfWeek = new Date(task.completed_at).getDay();
      const dayName = DAY_NAMES[dayOfWeek];
      dayTaskCounts[dayName] = (dayTaskCounts[dayName] || 0) + 1;
    }
  }
  // Also count events completed on each day
  for (const ev of events) {
    const dayOfWeek = new Date(ev.start_time).getDay();
    const dayName = DAY_NAMES[dayOfWeek];
    dayTaskCounts[dayName] = (dayTaskCounts[dayName] || 0) + 1;
  }

  const topDay = Object.entries(dayTaskCounts).sort((a, b) => b[1] - a[1])[0];
  const productiveDay = topDay
    ? { day: topDay[0], tasksCompleted: topDay[1] }
    : { day: 'N/A', tasksCompleted: 0 };

  // ── Habit streaks ──
  const weekDates = getDatesInRange(weekStart, weekEnd);
  const habitLogMap = new Map<string, Set<string>>();
  for (const log of habitLogs) {
    if (!habitLogMap.has(log.habit_id)) habitLogMap.set(log.habit_id, new Set());
    habitLogMap.get(log.habit_id)!.add(log.date);
  }

  const strong: WeeklyInsightsData['habitStreaks']['strong'] = [];
  const slipping: WeeklyInsightsData['habitStreaks']['slipping'] = [];
  let totalHabitLogs = 0;
  const totalPossible = habits.length * 7;

  for (const habit of habits) {
    const logged = habitLogMap.get(habit.id);
    const daysLogged = logged ? logged.size : 0;
    totalHabitLogs += daysLogged;

    if (daysLogged >= 5 || (habit.streak_current || 0) >= 7) {
      strong.push({ title: habit.title, icon: habit.icon, streak: habit.streak_current || 0 });
    } else if (daysLogged <= 2 && habits.length > 0) {
      slipping.push({ title: habit.title, icon: habit.icon, daysLogged, totalDays: 7 });
    }
  }

  const overallHabitRate = totalPossible > 0 ? Math.round((totalHabitLogs / totalPossible) * 100) : 0;

  // ── Goal progress ──
  const goalProgress = goals.slice(0, 5).map(g => ({
    title: g.title,
    progress: Math.round((g.progress || 0) * 100),
    icon: g.icon,
  }));
  const avgGoalProgress = goals.length > 0
    ? Math.round(goals.reduce((s, g) => s + (g.progress || 0), 0) / goals.length * 100)
    : 0;

  // ── Time allocation ──
  const categoryHours: Record<string, number> = {};
  for (const ev of events) {
    const cat = ev.event_type || 'other';
    const start = new Date(ev.start_time);
    const end = ev.end_time ? new Date(ev.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    categoryHours[cat] = (categoryHours[cat] || 0) + hours;
  }

  const timeCategories = Object.entries(categoryHours)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, hours]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      hours: Math.round(hours * 10) / 10,
      color: EVENT_TYPE_COLORS[label.toLowerCase()] || EVENT_TYPE_COLORS.default,
    }));

  const totalHours = Object.values(categoryHours).reduce((s, h) => s + h, 0);

  // ── Financial summary ──
  const totalIncome = incomes.reduce((s, i) => s + (parseFloat(String(i.amount)) || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(String(e.amount)) || 0), 0);

  // ── Week label ──
  const startDate = new Date(weekStart + 'T00:00:00');
  const endDate = new Date(weekEnd + 'T00:00:00');
  const weekLabel = `${startDate.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // ── AI Narrative (Pro feature) ──
  let aiNarrative: string | null = null;
  if (includeAINarrative) {
    aiNarrative = await generateAINarrative({
      weekLabel,
      taskRate: rate,
      taskTrend: trend,
      prevRate,
      completed,
      total,
      productiveDay: productiveDay.day,
      strongHabits: strong.map(h => h.title),
      slippingHabits: slipping.map(h => h.title),
      habitRate: overallHabitRate,
      avgGoalProgress,
      income: totalIncome,
      expenses: totalExpenses,
      topTimeCategory: timeCategories[0]?.label || 'None',
    });
  }

  return {
    weekKey: weekStart,
    weekLabel,
    taskCompletion: { completed, total, rate, trend, prevRate },
    productiveDay,
    habitStreaks: { strong, slipping, overallRate: overallHabitRate },
    goalProgress: { goals: goalProgress, avgProgress: avgGoalProgress },
    timeAllocation: { categories: timeCategories, totalHours: Math.round(totalHours * 10) / 10 },
    financeSummary: { income: totalIncome, expenses: totalExpenses, net: totalIncome - totalExpenses },
    aiNarrative,
    generatedAt: new Date().toISOString(),
  };
}

// ── AI NARRATIVE GENERATOR ─────────────────────────────────────────────────────

async function generateAINarrative(ctx: {
  weekLabel: string;
  taskRate: number;
  taskTrend: string;
  prevRate: number;
  completed: number;
  total: number;
  productiveDay: string;
  strongHabits: string[];
  slippingHabits: string[];
  habitRate: number;
  avgGoalProgress: number;
  income: number;
  expenses: number;
  topTimeCategory: string;
}): Promise<string> {
  const prompt = `You are LifeOS, a personal productivity AI. Generate a 3-4 sentence weekly insight summary.
Be conversational, warm, and actionable. Use data to be specific. Don't use emojis. Don't start with "This week".

Week: ${ctx.weekLabel}
Task completion: ${ctx.completed}/${ctx.total} (${ctx.taskRate}%)${ctx.taskTrend !== 'new' ? ` — ${ctx.taskTrend} from last week's ${ctx.prevRate}%` : ''}
Most productive day: ${ctx.productiveDay}
Habit consistency: ${ctx.habitRate}%
Strong habits: ${ctx.strongHabits.length > 0 ? ctx.strongHabits.join(', ') : 'None stood out'}
Slipping habits: ${ctx.slippingHabits.length > 0 ? ctx.slippingHabits.join(', ') : 'All on track'}
Goal progress: ${ctx.avgGoalProgress}% average
Income: $${ctx.income.toFixed(0)} | Expenses: $${ctx.expenses.toFixed(0)}
Most time spent on: ${ctx.topTimeCategory}

Write exactly 3-4 sentences. First sentence: overall vibe of the week. Second: highlight something strong. Third: identify one improvement area. Fourth (optional): one specific actionable tip for next week.`;

  try {
    const content = await callLLMSimple(prompt, { timeoutMs: 20000 });
    return content.trim();
  } catch (err) {
    logger.error('[weekly-insights] AI narrative failed:', err);
    return 'Unable to generate AI summary. Check your stats above for a quick overview of how your week went.';
  }
}

// ── CACHE HELPERS ──────────────────────────────────────────────────────────────

const CACHE_PREFIX = 'lifeos_weekly_insights_';

export function getCachedInsights(weekKey: string): WeeklyInsightsData | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + weekKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function cacheInsights(data: WeeklyInsightsData): void {
  try {
    localStorage.setItem(CACHE_PREFIX + data.weekKey, JSON.stringify(data));
    // Clean up old caches (keep last 8 weeks)
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    if (keys.length > 8) {
      keys.sort();
      for (let i = 0; i < keys.length - 8; i++) {
        localStorage.removeItem(keys[i]);
      }
    }
  } catch {
    // localStorage full — ignore
  }
}
