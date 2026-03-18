/**
 * Completion Analytics Engine
 * 
 * Computes task completion rates, goal velocity, streaks, and trajectory.
 * Pure computation — no LLM, works offline.
 * Results cached in localStorage with 30-min TTL.
 */

import { localDateStr } from '../utils/date';
import { logger } from '../utils/logger';

// ── TYPES ────────────────────────────────────────────────────────────────────

export interface CompletionRates {
  daily: DailyRate[];
  weeklyAverage: number;
  monthlyAverage: number;
  goalVelocity: GoalVelocityItem[];
  habitConsistency: number;
  categoryBreakdown: CategoryRate[];
  currentStreak: number;
  longestStreak: number;
  bestDay: { date: string; rate: number; count: number } | null;
  worstDay: { date: string; rate: number; count: number } | null;
}

export interface DailyRate {
  date: string;
  total: number;
  done: number;
  rate: number;
}

export interface GoalVelocityItem {
  goalId: string;
  goalTitle: string;
  goalIcon: string | null;
  tasksPerWeek: number;
  completionRate: number;
}

export interface CategoryRate {
  category: string;
  label: string;
  total: number;
  done: number;
  rate: number;
  color: string;
}

export interface GoalTrajectory {
  goalId: string;
  currentProgress: number;
  averageTasksPerWeek: number;
  remainingTasks: number;
  estimatedWeeksToComplete: number;
  estimatedCompletionDate: string | null;
  onTrack: boolean;
  targetDate: string | null;
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CATEGORY_COLORS: Record<string, string> = {
  work: '#00D4FF',
  education: '#A855F7',
  personal: '#39FF14',
  health: '#F43F5E',
  spiritual: '#FFD700',
  business: '#F97316',
  creative: '#EC4899',
  default: '#5A7A9A',
};

function getDatesInRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(localDateStr(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getCategoryFromGoal(goal: any): string {
  return goal?.domain || goal?.category || 'default';
}

// ── CACHE MANAGEMENT ─────────────────────────────────────────────────────────

function getCacheKey(userId: string, type: string): string {
  return `lifeos:completion:${userId}:${type}`;
}

function getCached<T>(userId: string, type: string): T | null {
  try {
    const key = getCacheKey(userId, type);
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function setCache<T>(userId: string, type: string, data: T): void {
  try {
    const key = getCacheKey(userId, type);
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (err) {
    logger.warn('[completion-analytics] Failed to cache:', err);
  }
}

// ── MAIN ANALYTICS ───────────────────────────────────────────────────────────

export interface AnalyticsData {
  tasks: Array<{ id: string; status: string; completed_at: string | null; due_date: string | null; goal_id: string | null; created_at: string }>;
  goals: Array<{ id: string; title: string; icon: string | null; progress: number; target_date: string | null; domain?: string; category?: string }>;
  habits?: Array<{ id: string; title: string }>;
  habitLogs?: Array<{ habit_id: string; date: string; completed: boolean }>;
}

/**
 * Get completion rates for a date range (default: last 30 days)
 */
export function getCompletionRates(
  userId: string,
  data: AnalyticsData,
  dateRange?: { start: string; end: string }
): CompletionRates {
  // Check cache first
  const cacheKey = dateRange ? `${dateRange.start}-${dateRange.end}` : 'default';
  const cached = getCached<CompletionRates>(userId, `rates:${cacheKey}`);
  if (cached) return cached;

  // Determine date range
  const endDate = dateRange?.end ? new Date(dateRange.end + 'T23:59:59') : new Date();
  const startDate = dateRange?.start
    ? new Date(dateRange.start + 'T00:00:00')
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  const dates = getDatesInRange(startDate, endDate);

  // ── Daily rates ──
  const daily: DailyRate[] = dates.map(date => {
    const tasksForDay = data.tasks.filter(t => {
      // Include tasks completed on this day OR due on this day (if not done)
      const completed = t.completed_at?.startsWith(date);
      const dueThatDay = t.due_date === date;
      return completed || (dueThatDay && t.status !== 'done');
    });

    const total = tasksForDay.length;
    const done = tasksForDay.filter(t => t.status === 'done').length;
    const rate = total > 0 ? (done / total) * 100 : 0;

    return { date, total, done, rate };
  });

  // ── Weekly average ──
  const last7Days = daily.slice(-7);
  const weeklyTasks = last7Days.reduce((sum, d) => sum + d.total, 0);
  const weeklyDone = last7Days.reduce((sum, d) => sum + d.done, 0);
  const weeklyAverage = weeklyTasks > 0 ? (weeklyDone / weeklyTasks) * 100 : 0;

  // ── Monthly average ──
  const monthlyTasks = daily.reduce((sum, d) => sum + d.total, 0);
  const monthlyDone = daily.reduce((sum, d) => sum + d.done, 0);
  const monthlyAverage = monthlyTasks > 0 ? (monthlyDone / monthlyTasks) * 100 : 0;

  // ── Goal velocity (tasks completed per goal per week) ──
  const goalVelocity: GoalVelocityItem[] = [];
  const goalMap = new Map<string, { title: string; icon: string | null; completedCount: number }>();

  data.tasks.forEach(t => {
    if (!t.goal_id || t.status !== 'done' || !t.completed_at) return;
    const completedDate = new Date(t.completed_at);
    if (completedDate < startDate || completedDate > endDate) return;

    if (!goalMap.has(t.goal_id)) {
      const goal = data.goals.find(g => g.id === t.goal_id);
      goalMap.set(t.goal_id, {
        title: goal?.title || 'Unknown Goal',
        icon: goal?.icon || null,
        completedCount: 0,
      });
    }

    const entry = goalMap.get(t.goal_id)!;
    entry.completedCount++;
  });

  const weeksInRange = Math.ceil(dates.length / 7);
  goalMap.forEach((value, goalId) => {
    const goal = data.goals.find(g => g.id === goalId);
    const totalTasks = data.tasks.filter(t => t.goal_id === goalId).length;
    const tasksPerWeek = weeksInRange > 0 ? value.completedCount / weeksInRange : 0;
    const completionRate = totalTasks > 0 ? (value.completedCount / totalTasks) * 100 : 0;

    goalVelocity.push({
      goalId,
      goalTitle: value.title,
      goalIcon: value.icon,
      tasksPerWeek,
      completionRate,
    });
  });

  // Sort by velocity (descending)
  goalVelocity.sort((a, b) => b.tasksPerWeek - a.tasksPerWeek);

  // ── Habit consistency ──
  let habitConsistency = 0;
  if (data.habits && data.habitLogs) {
    const habitDays = dates.length * data.habits.length;
    const logsInRange = data.habitLogs.filter(log =>
      dates.includes(log.date) && log.completed
    ).length;
    habitConsistency = habitDays > 0 ? (logsInRange / habitDays) * 100 : 0;
  }

  // ── Category breakdown ──
  const categoryMap = new Map<string, { total: number; done: number }>();

  data.tasks.forEach(t => {
    const createdDate = new Date(t.created_at);
    if (createdDate < startDate || createdDate > endDate) return;

    const goal = t.goal_id ? data.goals.find(g => g.id === t.goal_id) : null;
    const category = getCategoryFromGoal(goal);

    if (!categoryMap.has(category)) {
      categoryMap.set(category, { total: 0, done: 0 });
    }

    const entry = categoryMap.get(category)!;
    entry.total++;
    if (t.status === 'done') entry.done++;
  });

  const categoryBreakdown: CategoryRate[] = [];
  categoryMap.forEach((value, category) => {
    const rate = value.total > 0 ? (value.done / value.total) * 100 : 0;
    categoryBreakdown.push({
      category,
      label: category.charAt(0).toUpperCase() + category.slice(1),
      total: value.total,
      done: value.done,
      rate,
      color: CATEGORY_COLORS[category] || CATEGORY_COLORS.default,
    });
  });

  categoryBreakdown.sort((a, b) => b.total - a.total);

  // ── Streaks ──
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Work backwards from today to find current streak
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].rate >= 80) {
      currentStreak++;
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      if (i === daily.length - 1) currentStreak = 0; // today failed
      tempStreak = 0;
    }
  }

  // ── Best/worst days ──
  const daysWithTasks = daily.filter(d => d.total > 0);
  const bestDay = daysWithTasks.length > 0
    ? daysWithTasks.reduce((best, day) => day.rate > best.rate ? day : best)
    : null;
  const worstDay = daysWithTasks.length > 0
    ? daysWithTasks.reduce((worst, day) => day.rate < worst.rate ? day : worst)
    : null;

  const result: CompletionRates = {
    daily,
    weeklyAverage,
    monthlyAverage,
    goalVelocity,
    habitConsistency,
    categoryBreakdown,
    currentStreak,
    longestStreak,
    bestDay: bestDay ? { date: bestDay.date, rate: bestDay.rate, count: bestDay.done } : null,
    worstDay: worstDay ? { date: worstDay.date, rate: worstDay.rate, count: worstDay.done } : null,
  };

  // Cache result
  setCache(userId, `rates:${cacheKey}`, result);

  return result;
}

/**
 * Get goal trajectory (when will goal be completed based on current velocity)
 */
export function getGoalTrajectory(
  userId: string,
  goalId: string,
  data: AnalyticsData
): GoalTrajectory | null {
  // Check cache
  const cached = getCached<GoalTrajectory>(userId, `trajectory:${goalId}`);
  if (cached) return cached;

  const goal = data.goals.find(g => g.id === goalId);
  if (!goal) return null;

  const allTasks = data.tasks.filter(t => t.goal_id === goalId);
  const doneTasks = allTasks.filter(t => t.status === 'done');
  const remainingTasks = allTasks.length - doneTasks.length;

  // Calculate average tasks per week (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCompletions = doneTasks.filter(t =>
    t.completed_at && new Date(t.completed_at) >= thirtyDaysAgo
  );

  const averageTasksPerWeek = (recentCompletions.length / 30) * 7;

  // Estimate weeks to complete
  const estimatedWeeksToComplete = averageTasksPerWeek > 0
    ? remainingTasks / averageTasksPerWeek
    : Infinity;

  // Estimated completion date
  let estimatedCompletionDate: string | null = null;
  if (estimatedWeeksToComplete !== Infinity && estimatedWeeksToComplete < 1000) {
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + estimatedWeeksToComplete * 7);
    estimatedCompletionDate = localDateStr(estimatedDate);
  }

  // Check if on track (if target_date is set)
  let onTrack = true;
  if (goal.target_date && estimatedCompletionDate) {
    onTrack = estimatedCompletionDate <= goal.target_date;
  }

  const result: GoalTrajectory = {
    goalId,
    currentProgress: goal.progress || 0,
    averageTasksPerWeek,
    remainingTasks,
    estimatedWeeksToComplete,
    estimatedCompletionDate,
    onTrack,
    targetDate: goal.target_date,
  };

  // Cache result
  setCache(userId, `trajectory:${goalId}`, result);

  return result;
}

/**
 * Invalidate all caches for a user
 */
export function invalidateCache(userId: string): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(`lifeos:completion:${userId}:`)) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    logger.warn('[completion-analytics] Failed to invalidate cache:', err);
  }
}
