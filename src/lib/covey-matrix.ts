/**
 * Covey Time Quadrants — Urgent/Important Matrix
 *
 * Classifies tasks and goals into Covey's 4 quadrants:
 *   Q1: Urgent + Important (crises)
 *   Q2: Not Urgent + Important (strategic)
 *   Q3: Urgent + Not Important (interruptions)
 *   Q4: Not Urgent + Not Important (time wasters)
 *
 * Includes Essentialism pruning suggestions for Q4 items.
 * Pure functions — no React imports.
 */

import type { Task, Goal } from '../types/database';

// ── TYPES ──

export type CoveyQuadrant =
  | 'Q1_urgent_important'
  | 'Q2_not_urgent_important'
  | 'Q3_urgent_not_important'
  | 'Q4_not_urgent_not_important';

export interface CoveyMatrix {
  Q1_urgent_important: (Task | Goal)[];
  Q2_not_urgent_important: (Task | Goal)[];
  Q3_urgent_not_important: (Task | Goal)[];
  Q4_not_urgent_not_important: (Task | Goal)[];
}

// ── HELPERS ──

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function isHighPriority(priority: string | undefined | null): boolean {
  return priority === 'high' || priority === 'urgent';
}

function isMediumPriority(priority: string | undefined | null): boolean {
  return priority === 'medium';
}

function isDueSoon(dueDate: string | undefined | null): boolean {
  if (!dueDate) return false;
  const today = todayStr();
  return dueDate <= today;
}

function isDueFuture(dueDate: string | undefined | null): boolean {
  if (!dueDate) return false;
  const today = todayStr();
  return dueDate > today;
}

// ── PUBLIC API ──

/**
 * Classify a single task into a Covey quadrant.
 *
 * Q1: high/urgent priority + due today or overdue
 * Q2: high/urgent priority + due in the future (strategic work)
 * Q3: medium priority + due today (interruptions/delegatable)
 * Q4: low priority + no deadline (time wasters / prune candidates)
 */
export function classifyTask(task: Task): CoveyQuadrant {
  const priority = task.priority;
  const dueDate = task.due_date;

  // Q1: Urgent + Important — high priority, due now or overdue
  if (isHighPriority(priority) && isDueSoon(dueDate)) {
    return 'Q1_urgent_important';
  }

  // Q2: Not Urgent + Important — high priority, future deadline (strategic)
  if (isHighPriority(priority) && (isDueFuture(dueDate) || !dueDate)) {
    return 'Q2_not_urgent_important';
  }

  // Q3: Urgent + Not Important — medium priority, due today (interruptions)
  if (isMediumPriority(priority) && isDueSoon(dueDate)) {
    return 'Q3_urgent_not_important';
  }

  // Q2: Medium priority with future deadline (still somewhat important)
  if (isMediumPriority(priority) && isDueFuture(dueDate)) {
    return 'Q2_not_urgent_important';
  }

  // Q3: Medium priority, no deadline
  if (isMediumPriority(priority) && !dueDate) {
    return 'Q3_urgent_not_important';
  }

  // Q4: Low priority or no priority + no deadline
  return 'Q4_not_urgent_not_important';
}

/**
 * Classify a goal into a Covey quadrant.
 * Goals use target_date as the deadline and status as urgency signal.
 */
export function classifyGoal(goal: Goal): CoveyQuadrant {
  const isActive = goal.status === 'active' || goal.status === 'in_progress';
  const hasDeadline = !!goal.target_date;
  const isDue = hasDeadline && isDueSoon(goal.target_date);
  const isFuture = hasDeadline && isDueFuture(goal.target_date);

  // Q1: Active goal with deadline passed or today
  if (isActive && isDue) {
    return 'Q1_urgent_important';
  }

  // Q2: Active goal with future deadline or no deadline (strategic)
  if (isActive && (isFuture || !hasDeadline)) {
    return 'Q2_not_urgent_important';
  }

  // Q3: Paused goals with deadlines (may need attention)
  if (goal.status === 'paused' && hasDeadline) {
    return 'Q3_urgent_not_important';
  }

  // Q4: Archived, completed, or paused without deadline
  return 'Q4_not_urgent_not_important';
}

/**
 * Build the full Covey matrix from tasks and goals.
 */
export function getCoveyMatrix(tasks: Task[], goals: Goal[]): CoveyMatrix {
  const matrix: CoveyMatrix = {
    Q1_urgent_important: [],
    Q2_not_urgent_important: [],
    Q3_urgent_not_important: [],
    Q4_not_urgent_not_important: [],
  };

  for (const task of tasks) {
    if (task.status === 'done' || task.status === 'completed' || task.status === 'cancelled') continue;
    const q = classifyTask(task);
    matrix[q].push(task);
  }

  for (const goal of goals) {
    if (goal.status === 'completed' || goal.status === 'done') continue;
    const q = classifyGoal(goal);
    matrix[q].push(goal);
  }

  return matrix;
}

/**
 * Get Q4 items as pruning candidates (Essentialism: "less but better").
 */
export function getPruningCandidates(matrix: CoveyMatrix): (Task | Goal)[] {
  return matrix.Q4_not_urgent_not_important;
}

/**
 * Get an Essentialism-inspired insight about the current matrix state.
 */
export function getEssentialismInsight(matrix: CoveyMatrix): string {
  const q1Count = matrix.Q1_urgent_important.length;
  const q2Count = matrix.Q2_not_urgent_important.length;
  const q3Count = matrix.Q3_urgent_not_important.length;
  const q4Count = matrix.Q4_not_urgent_not_important.length;
  const total = q1Count + q2Count + q3Count + q4Count;

  if (total === 0) {
    return 'No active items to classify. Add tasks or goals to see your priority matrix.';
  }

  if (q1Count > 5) {
    return `You have ${q1Count} urgent and important items. This is crisis mode. Focus exclusively on Q1 until it drops below 3, then invest in Q2 to prevent future fires.`;
  }

  if (q1Count === 0 && q2Count > 0) {
    return `No fires burning. ${q2Count} strategic items in Q2. This is the ideal state — you are investing in what matters before it becomes urgent.`;
  }

  if (q4Count > q2Count) {
    return `You have ${q4Count} items in Q4 (not urgent, not important) vs ${q2Count} in Q2 (strategic). Consider pruning Q4 items to free energy for what truly matters.`;
  }

  if (q3Count > q2Count) {
    return `${q3Count} items are urgent but not truly important (Q3). These are interruptions stealing time from your ${q2Count} strategic priorities. Delegate or batch Q3 items.`;
  }

  return `${q1Count} urgent, ${q2Count} strategic, ${q3Count} interruptions, ${q4Count} to prune. Focus on Q1 first, then protect Q2 time blocks.`;
}
