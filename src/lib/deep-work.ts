/**
 * deep-work.ts — Cal Newport's Deep Work Framework for LifeOS
 *
 * "Focused work produces exponentially more value. Schedule deep blocks, eliminate shallow"
 *
 * Calculates deep work score from task patterns and schedule blocks.
 * Pure functions — no React imports.
 */

import type { Task, ScheduleEvent } from '../types/database';

// ── TYPES ──────────────────────────────────────────────────────

export interface DeepWorkScore {
  hoursThisWeek: number;
  deepRatio: number;
  focusRating: number;
  shallowRatio: number;
  schedulingScore: number;
}

// ── CONSTANTS ──────────────────────────────────────────────────

const LS_KEY = 'lifeos_deep_work_score';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const DEEP_TAGS = ['deep', 'focus', 'deep-work', 'deepwork', 'concentrated', 'writing', 'coding', 'research', 'design', 'strategy'];
const SHALLOW_TAGS = ['email', 'meeting', 'call', 'slack', 'communication', 'admin', 'quick', 'social', 'notification', 'reply'];
const DEEP_EVENT_TYPES: string[] = ['block', 'custom'];
const SHALLOW_EVENT_TYPES: string[] = ['meeting', 'social'];
const MIN_DEEP_BLOCK_MINUTES = 90; // Cal Newport: deep work requires 90+ min uninterrupted

// ── HELPERS ────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function isDeepTask(task: Task): boolean {
  // Tasks with deep-related tags
  if (task.tags && task.tags.some(t => DEEP_TAGS.includes(t.toLowerCase()))) return true;

  // Tasks with longer estimated duration and high priority (strategic work)
  if (task.priority === 'high' || task.priority === 'urgent') {
    if (task.estimated_duration && task.estimated_duration >= 60) return true;
  }

  // Tasks linked to goals (goal work is often deep)
  if (task.goal_id && !SHALLOW_TAGS.some(st => task.tags?.some(t => t.toLowerCase() === st))) return true;

  return false;
}

function isShallowTask(task: Task): boolean {
  if (task.tags && task.tags.some(t => SHALLOW_TAGS.includes(t.toLowerCase()))) return true;
  if (task.estimated_duration && task.estimated_duration < 15) return true;
  if (!task.goal_id && task.priority === 'low') return true;
  return false;
}

function isDeepEvent(event: ScheduleEvent): boolean {
  // Schedule blocks > 90 min uninterrupted
  if (event.event_type && DEEP_EVENT_TYPES.includes(event.event_type)) {
    const duration = getEventDurationMinutes(event);
    if (duration >= MIN_DEEP_BLOCK_MINUTES) return true;
  }

  // Events with deep tags in the title
  const lowerTitle = event.title.toLowerCase();
  if (DEEP_TAGS.some(t => lowerTitle.includes(t))) return true;

  return false;
}

function isShallowEvent(event: ScheduleEvent): boolean {
  if (event.event_type && SHALLOW_EVENT_TYPES.includes(event.event_type)) return true;
  const lowerTitle = event.title.toLowerCase();
  if (SHALLOW_TAGS.some(t => lowerTitle.includes(t))) return true;
  return false;
}

function getEventDurationMinutes(event: ScheduleEvent): number {
  try {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
  } catch {
    return 0;
  }
}

/**
 * Count scheduling conflicts for an event (overlapping events).
 * Fewer conflicts = better protected deep block.
 */
function countConflicts(event: ScheduleEvent, allEvents: ScheduleEvent[]): number {
  let conflicts = 0;
  const eStart = new Date(event.start_time).getTime();
  const eEnd = new Date(event.end_time).getTime();

  for (const other of allEvents) {
    if (other.id === event.id || other.is_deleted) continue;
    const oStart = new Date(other.start_time).getTime();
    const oEnd = new Date(other.end_time).getTime();

    // Overlap check
    if (oStart < eEnd && oEnd > eStart) {
      conflicts++;
    }
  }

  return conflicts;
}

// ── DEEP WORK CALCULATION ──────────────────────────────────────

/**
 * Calculate deep work hours from schedule blocks.
 * Deep work = blocks > 90 min uninterrupted with no conflicts.
 */
function calculateDeepHours(scheduleBlocks: ScheduleEvent[]): number {
  let totalDeepMinutes = 0;

  for (const event of scheduleBlocks) {
    if (event.is_deleted) continue;
    if (!isDeepEvent(event)) continue;

    const duration = getEventDurationMinutes(event);
    if (duration >= MIN_DEEP_BLOCK_MINUTES) {
      const conflicts = countConflicts(event, scheduleBlocks);
      // Deep work is diluted by conflicts: effective deep = duration * (1 - conflicts * 0.25)
      const effectiveFactor = Math.max(0, 1 - conflicts * 0.25);
      totalDeepMinutes += duration * effectiveFactor;
    }
  }

  return totalDeepMinutes / 60; // convert to hours
}

/**
 * Calculate total work hours from schedule blocks and task completion.
 */
function calculateTotalWorkHours(scheduleBlocks: ScheduleEvent[], tasks: Task[]): number {
  let totalMinutes = 0;

  for (const event of scheduleBlocks) {
    if (event.is_deleted) continue;
    if (event.event_type === 'sleep' || event.event_type === 'meal') continue;
    totalMinutes += getEventDurationMinutes(event);
  }

  // Also account for completed tasks with duration that aren't in schedule
  const unscheduledCompletedTasks = tasks.filter(t =>
    t.status === 'done' && !t.is_deleted && !scheduleBlocks.some(e => e.task_id === t.id)
  );
  for (const task of unscheduledCompletedTasks) {
    totalMinutes += task.actual_duration || task.estimated_duration || 30;
  }

  // Cap at reasonable weekly maximum
  return Math.min(totalMinutes / 60, 80);
}

/**
 * Calculate deep work from task completion patterns.
 * Returns estimated deep hours from tasks.
 */
function calculateDeepHoursFromTasks(tasks: Task[]): number {
  const completed = tasks.filter(t => t.status === 'done' && !t.is_deleted);
  let deepMinutes = 0;

  for (const task of completed) {
    if (isDeepTask(task)) {
      deepMinutes += task.actual_duration || task.estimated_duration || 30;
    }
  }

  return deepMinutes / 60;
}

/**
 * Calculate scheduling score: how well deep blocks are protected.
 * 0-5 scale. Deep blocks with no conflicts = high score.
 */
function calculateSchedulingScore(scheduleBlocks: ScheduleEvent[]): number {
  const deepBlocks = scheduleBlocks.filter(e => !e.is_deleted && isDeepEvent(e));
  if (deepBlocks.length === 0) return 0;

  let totalProtectedScore = 0;
  for (const block of deepBlocks) {
    const conflicts = countConflicts(block, scheduleBlocks);
    const protectionScore = Math.max(0, 5 - conflicts * 1.5);
    totalProtectedScore += protectionScore;
  }

  return clamp(totalProtectedScore / deepBlocks.length, 0, 5);
}

// ── PUBLIC API ─────────────────────────────────────────────────

/**
 * Calculate Deep Work Score based on tasks and schedule blocks.
 * Focus rating on 0-5 scale.
 */
export function calculateDeepWorkScore(tasks: Task[], scheduleBlocks: ScheduleEvent[]): DeepWorkScore {
  const scheduleDeepHours = calculateDeepHours(scheduleBlocks);
  const taskDeepHours = calculateDeepHoursFromTasks(tasks);
  const hoursThisWeek = Math.round((scheduleDeepHours + taskDeepHours) * 100) / 100;

  const totalWorkHours = calculateTotalWorkHours(scheduleBlocks, tasks);
  const deepRatio = totalWorkHours > 0
    ? Math.round((hoursThisWeek / totalWorkHours) * 100) / 100
    : 0;

  const shallowHours = totalWorkHours - hoursThisWeek;
  const shallowRatio = totalWorkHours > 0
    ? Math.round((shallowHours / totalWorkHours) * 100) / 100
    : 0;

  // Focus rating based on deep work percentage (0-5 scale)
  // Cal Newport: 4+ hours/day of deep work = near-maximum
  // Per week that's 20+ hours; 10h/week = decent; <5h = low
  const hoursPerDay = hoursThisWeek / 7;
  let focusRating: number;
  if (hoursPerDay >= 4) focusRating = 5.0;
  else if (hoursPerDay >= 3) focusRating = 4.0;
  else if (hoursPerDay >= 2) focusRating = 3.0;
  else if (hoursPerDay >= 1) focusRating = 2.0;
  else if (hoursPerDay >= 0.5) focusRating = 1.0;
  else focusRating = 0;

  const schedulingScore = calculateSchedulingScore(scheduleBlocks);

  const score: DeepWorkScore = {
    hoursThisWeek,
    deepRatio,
    focusRating,
    shallowRatio,
    schedulingScore: Math.round(schedulingScore * 100) / 100,
  };

  // Cache to localStorage with TTL
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ score, cachedAt: Date.now() }));
  } catch { /* ignore */ }

  return score;
}

/**
 * Get cached Deep Work score if still valid (24h TTL).
 * Returns null if expired or not cached.
 */
export function getCachedDeepWorkScore(): DeepWorkScore | null {
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
 * Get a human-readable insight for the Deep Work score.
 */
export function getDeepWorkInsight(score: DeepWorkScore): string {
  const { hoursThisWeek, deepRatio, focusRating, shallowRatio, schedulingScore } = score;

  if (hoursThisWeek === 0) {
    return 'No deep work detected this week. Schedule 90+ minute focus blocks with no interruptions to start building your deep practice.';
  }

  const hoursPerDay = hoursThisWeek / 7;

  if (focusRating >= 4.0) {
    return `Excellent deep work: ${hoursThisWeek.toFixed(1)} hours this week (${hoursPerDay.toFixed(1)}h/day). Your shallow ratio is ${(shallowRatio * 100).toFixed(0)}%. Continue protecting these blocks fiercely.`;
  }

  if (focusRating >= 3.0) {
    if (schedulingScore < 2.5) {
      return `Good deep work at ${hoursThisWeek.toFixed(1)} hours, but scheduling protection is weak (${schedulingScore.toFixed(1)}/5). Your deep blocks have conflicts. Treat deep work as immovable appointments.`;
    }
    return `Solid deep work: ${hoursThisWeek.toFixed(1)} hours this week (${hoursPerDay.toFixed(1)}h/day). To reach peak performance, aim for 4 hours of deep work per day.`;
  }

  if (shallowRatio > 0.7) {
    return `Shallow work dominates at ${(shallowRatio * 100).toFixed(0)}% of your total. Only ${hoursThisWeek.toFixed(1)} hours of deep work this week. Batch emails, decline non-essential meetings, and protect morning hours for deep focus.`;
  }

  return `${hoursThisWeek.toFixed(1)} hours of deep work this week (focus rating: ${focusRating.toFixed(1)}/5). Schedule longer uninterrupted blocks and eliminate distractions during those periods.`;
}