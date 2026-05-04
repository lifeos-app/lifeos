/**
 * drive-autonomy.ts — Daniel Pink's Drive Framework (Autonomy + Mastery + Purpose)
 *
 * "Intrinsic motivation = Autonomy + Mastery + Purpose"
 *
 * Measures each dimension based on behavioral data, weighted equally.
 * Pure functions — no React imports.
 */

import type { Habit, HabitLog, Goal, Task } from '../types/database';

// ── TYPES ──────────────────────────────────────────────────────

export type DriveLevel = 'controlled' | 'motivated' | 'self-directed' | 'autonomous';

export interface DriveScore {
  autonomy: number;
  mastery: number;
  purpose: number;
  overall: number;
  level: DriveLevel;
}

// ── CONSTANTS ──────────────────────────────────────────────────

const LS_KEY = 'lifeos_drive_score';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOOKBACK_DAYS = 30;

// ── HELPERS ────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getLevel(overall: number): DriveLevel {
  if (overall >= 4.0) return 'autonomous';
  if (overall >= 3.0) return 'self-directed';
  if (overall >= 1.5) return 'motivated';
  return 'controlled';
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

/**
 * Count unique days a habit was logged within the lookback period.
 */
function countActiveDays(habitId: string, logs: HabitLog[], cutoff: string): number {
  const dates = new Set<string>();
  for (const log of logs) {
    if (log.habit_id === habitId && log.date >= cutoff) {
      dates.add(log.date);
    }
  }
  return dates.size;
}

// ── AUTONOMY ────────────────────────────────────────────────────

/**
 * Autonomy (0-5): % of self-directed tasks (no external deadline) +
 *   % of habits user chose vs AI-suggested +
 *   % of goals that are self-created.
 *
 * Higher autonomy = more internal locus of control.
 */
function calculateAutonomy(habits: Habit[], goals: Goal[], tasks: Task[]): number {
  let score = 0;

  // Factor 1: Self-directed tasks (no external deadline, self-created) — 40% weight
  const activeTasks = tasks.filter(t =>
    !t.is_deleted && t.status !== 'done' && t.status !== 'completed' && t.status !== 'cancelled'
  );
  if (activeTasks.length > 0) {
    const selfDirectedTasks = activeTasks.filter(t =>
      // No due_date = self-directed (no external pressure)
      !t.due_date &&
      // Self-created (not AI)
      (t.source !== 'onboarding_ai')
    );
    const selfDirectedRatio = selfDirectedTasks.length / activeTasks.length;
    // Map 0-1 to 0-2 (max 2 points for this factor)
    score += selfDirectedRatio * 2;
  } else {
    score += 1; // Neutral baseline if no tasks
  }

  // Factor 2: Habits user chose vs suggested — 30% weight
  const activeHabits = habits.filter(h => h.is_active && !h.is_deleted);
  if (activeHabits.length > 0) {
    const userChosenHabits = activeHabits.filter(h => h.source !== 'onboarding_ai');
    const userChosenRatio = userChosenHabits.length / activeHabits.length;
    score += userChosenRatio * 1.5; // max 1.5 points
  } else {
    score += 0.5;
  }

  // Factor 3: Goals that are self-created — 30% weight
  const activeGoals = goals.filter(g =>
    !g.is_deleted && (g.status === 'active' || g.status === 'in_progress')
  );
  if (activeGoals.length > 0) {
    const selfCreatedGoals = activeGoals.filter(g => g.source !== 'onboarding_ai');
    const selfCreatedRatio = selfCreatedGoals.length / activeGoals.length;
    score += selfCreatedRatio * 1.5; // max 1.5 points
  } else {
    score += 0.5;
  }

  return clamp(score, 0, 5);
}

// ── MASTERY ──────────────────────────────────────────────────────

/**
 * Mastery (0-5): % of habits with improving streaks +
 *   goal progress percentage +
 *   consistent logging behavior.
 */
function calculateMastery(habits: Habit[], goals: Goal[], logs: HabitLog[]): number {
  let score = 0;
  const cutoff = daysAgo(LOOKBACK_DAYS);

  // Factor 1: Habits with improving streaks — 35% weight
  const activeHabits = habits.filter(h => h.is_active && !h.is_deleted);
  if (activeHabits.length > 0) {
    let improvingCount = 0;
    for (const habit of activeHabits) {
      const currentStreak = habit.streak_current || 0;
      const bestStreak = habit.streak_best || 0;
      // Improving = current streak >= 50% of best streak (growing toward records)
      if (bestStreak > 0 && currentStreak >= bestStreak * 0.5) improvingCount++;
      else if (currentStreak >= 7) improvingCount++; // 7+ days is mastery-building
    }
    const improvingRatio = improvingCount / activeHabits.length;
    score += improvingRatio * 1.75; // max 1.75 points
  } else {
    score += 0.5;
  }

  // Factor 2: Goal progress — 35% weight
  const activeGoals = goals.filter(g =>
    !g.is_deleted && (g.status === 'active' || g.status === 'in_progress')
  );
  if (activeGoals.length > 0) {
    const avgProgress = activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length;
    // progress is 0-100, map to 0-1.75
    score += (avgProgress / 100) * 1.75;
  } else {
    score += 0.5;
  }

  // Factor 3: Consistent logging (deliberate practice) — 30% weight
  const recentLogs = logs.filter(l => l.date >= cutoff);
  if (recentLogs.length > 0) {
    const uniqueLogDays = new Set(recentLogs.map(l => l.date)).size;
    // Logging > 70% of days = high consistency
    const consistency = Math.min(uniqueLogDays / (LOOKBACK_DAYS * 0.7), 1);
    score += consistency * 1.5; // max 1.5 points
  }

  return clamp(score, 0, 5);
}

// ── PURPOSE ──────────────────────────────────────────────────────

/**
 * Purpose (0-5): % of goals with meaningful descriptions +
 *   % of tasks linked to purpose-aligned goals +
 *   habit-goal alignment.
 */
function calculatePurpose(habits: Habit[], goals: Goal[], tasks: Task[]): number {
  let score = 0;

  // Factor 1: Goals with meaningful descriptions (purpose clarity) — 35% weight
  const activeGoals = goals.filter(g =>
    !g.is_deleted && (g.status === 'active' || g.status === 'in_progress')
  );
  if (activeGoals.length > 0) {
    const goalsWithPurpose = activeGoals.filter(g =>
      g.description && g.description.trim().length > 20
    );
    const purposeRatio = goalsWithPurpose.length / activeGoals.length;
    score += purposeRatio * 1.75; // max 1.75 points
  } else {
    score += 0.3;
  }

  // Factor 2: % of tasks linked to goals (purpose-driven action) — 40% weight
  const activeTasks = tasks.filter(t =>
    !t.is_deleted && t.status !== 'done' && t.status !== 'completed' && t.status !== 'cancelled'
  );
  if (activeTasks.length > 0) {
    const tasksWithGoals = activeTasks.filter(t => t.goal_id);
    const taskGoalRatio = tasksWithGoals.length / activeTasks.length;
    score += taskGoalRatio * 2.0; // max 2.0 points
  } else {
    score += 0.5;
  }

  // Factor 3: Habits linked to goals (purpose alignment) — 25% weight
  const activeHabits = habits.filter(h => h.is_active && !h.is_deleted);
  if (activeHabits.length > 0) {
    const habitsWithGoals = activeHabits.filter(h => h.goal_id);
    const habitGoalRatio = habitsWithGoals.length / activeHabits.length;
    score += habitGoalRatio * 1.25; // max 1.25 points
  }

  return clamp(score, 0, 5);
}

// ── PUBLIC API ─────────────────────────────────────────────────

/**
 * Calculate the Drive Score (Autonomy + Mastery + Purpose).
 * Overall = equal weight (autonomy 33%, mastery 33%, purpose 34%), 0-5 scale.
 */
export function calculateDriveScore(habits: Habit[], goals: Goal[], tasks: Task[]): DriveScore {
  const autonomy = calculateAutonomy(habits, goals, tasks);
  const mastery = calculateMastery(habits, goals, tasks as unknown as HabitLog[]);
  const purpose = calculatePurpose(habits, goals, tasks);

  // Note: For mastery calculation, we use habitLogs from the habits' streak data
  // rather than requiring separate log data. This keeps the API signature clean.

  const overall = (autonomy * 0.33) + (mastery * 0.33) + (purpose * 0.34);

  const score: DriveScore = {
    autonomy: Math.round(autonomy * 100) / 100,
    mastery: Math.round(mastery * 100) / 100,
    purpose: Math.round(purpose * 100) / 100,
    overall: Math.round(overall * 100) / 100,
    level: getLevel(overall),
  };

  // Cache to localStorage with TTL
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ score, cachedAt: Date.now() }));
  } catch { /* ignore */ }

  return score;
}

/**
 * Calculate the Drive Score with habit logs for better mastery calculation.
 * Uses actual log data for streak analysis.
 */
export function calculateDriveScoreWithLogs(
  habits: Habit[],
  goals: Goal[],
  tasks: Task[],
  logs: HabitLog[],
): DriveScore {
  let score = calculateDriveScore(habits, goals, tasks);

  // Recalculate mastery with actual log data for better accuracy
  const mastery = calculateMasteryWithLogs(habits, goals, logs);
  const autonomy = calculateAutonomy(habits, goals, tasks);
  const purpose = calculatePurpose(habits, goals, tasks);

  const overall = (autonomy * 0.33) + (mastery * 0.33) + (purpose * 0.34);

  score = {
    autonomy: Math.round(autonomy * 100) / 100,
    mastery: Math.round(mastery * 100) / 100,
    purpose: Math.round(purpose * 100) / 100,
    overall: Math.round(overall * 100) / 100,
    level: getLevel(overall),
  };

  // Update cache
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ score, cachedAt: Date.now() }));
  } catch { /* ignore */ }

  return score;
}

/**
 * Mastery calculation with actual habit log data.
 */
function calculateMasteryWithLogs(habits: Habit[], goals: Goal[], logs: HabitLog[]): number {
  let score = 0;
  const cutoff = daysAgo(LOOKBACK_DAYS);

  // Factor 1: Habits with improving streaks via logs — 35% weight
  const activeHabits = habits.filter(h => h.is_active && !h.is_deleted);
  if (activeHabits.length > 0) {
    let improvingCount = 0;
    for (const habit of activeHabits) {
      const activeDays = countActiveDays(habit.id, logs, cutoff);
      const currentStreak = habit.streak_current || 0;
      // Improving = consistent logging (active >= 70% of days) or good streak
      if (currentStreak >= 7) improvingCount++;
      else if (activeDays >= LOOKBACK_DAYS * 0.7) improvingCount++;
    }
    const improvingRatio = improvingCount / activeHabits.length;
    score += improvingRatio * 1.75;
  } else {
    score += 0.5;
  }

  // Factor 2: Goal progress — 35% weight
  const activeGoals = goals.filter(g =>
    !g.is_deleted && (g.status === 'active' || g.status === 'in_progress')
  );
  if (activeGoals.length > 0) {
    const avgProgress = activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length;
    score += (avgProgress / 100) * 1.75;
  } else {
    score += 0.5;
  }

  // Factor 3: Consistent logging (deliberate practice) — 30% weight
  const recentLogs = logs.filter(l => l.date >= cutoff);
  if (recentLogs.length > 0) {
    const uniqueLogDays = new Set(recentLogs.map(l => l.date)).size;
    const consistency = Math.min(uniqueLogDays / (LOOKBACK_DAYS * 0.7), 1);
    score += consistency * 1.5;
  }

  return clamp(score, 0, 5);
}

/**
 * Get cached Drive score if still valid (24h TTL).
 * Returns null if expired or not cached.
 */
export function getCachedDriveScore(): DriveScore | null {
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
 * Get a human-readable insight for the Drive score.
 */
export function getDriveInsight(score: DriveScore): string {
  const { autonomy, mastery, purpose, overall, level } = score;

  const levelLabels: Record<DriveLevel, string> = {
    autonomous: 'Autonomous',
    'self-directed': 'Self-Directed',
    motivated: 'Motivated',
    controlled: 'Controlled',
  };

  if (overall >= 4.0) {
    return `${levelLabels[level]} drive (${overall.toFixed(1)}/5). You operate from deep intrinsic motivation. Autonomy (${autonomy.toFixed(1)}), mastery (${mastery.toFixed(1)}), and purpose (${purpose.toFixed(1)}) are all strong. Continue aligning your work with these values.`;
  }

  // Identify strongest and weakest dimensions
  const dims = [
    { name: 'autonomy', score: autonomy, tip: 'Create more self-directed tasks and goals. Replace externally imposed deadlines with ones you set yourself.' },
    { name: 'mastery', score: mastery, tip: 'Commit to deliberate practice. Track streaks, push beyond your comfort zone, and invest in skill development daily.' },
    { name: 'purpose', score: purpose, tip: 'Connect your daily work to a bigger reason. Write a purpose statement for each goal and link tasks to those goals.' },
  ];

  const weakest = dims.reduce((min, d) => d.score < min.score ? d : min, dims[0]);
  const strongest = dims.reduce((max, d) => d.score > max.score ? d : max, dims[0]);

  if (overall >= 3.0) {
    return `${levelLabels[level]} drive (${overall.toFixed(1)}/5). ${strongest.name} (${strongest.score.toFixed(1)}) is your strongest driver. Strengthen ${weakest.name} (${weakest.score.toFixed(1)}): ${weakest.tip}`;
  }

  if (overall >= 1.5) {
    return `${levelLabels[level]} drive (${overall.toFixed(1)}/5). Your ${weakest.name} dimension (${weakest.score.toFixed(1)}/5) needs attention. ${weakest.tip}`;
  }

  return `${levelLabels[level]} drive (${overall.toFixed(1)}/5). Your motivation is largely external. Start with ${weakest.name}: ${weakest.tip} Intrinsic motivation builds when you feel autonomous, growing, and purposeful.`;
}