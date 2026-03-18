import type { GoalNode, GoalTask } from './types';

// ── Constants ──

export const ICONS = ['🎯', '📖', '💪', '💰', '🧠', '🚀', '⚡', '🔥', '🎨', '🌍', '💼', '❤️'];

export const COLORS = ['#00D4FF', '#A855F7', '#39FF14', '#F97316', '#EC4899', '#FACC15', '#06B6D4', '#F43F5E'];

export const PRIORITY_COLORS: Record<string, string> = {
  critical: '#F43F5E',
  high: '#F97316',
  medium: '#00D4FF',
  low: '#5A7A9A',
};

export const LEVEL_COLORS: Record<string, string> = {
  objective: '#00D4FF',
  epic: '#A855F7',
  goal: '#39FF14',
  task: '#F59E0B',
};

export const STATUS_CYCLE = ['active', 'in_progress', 'done'] as const;

export const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  active: { icon: '○', color: 'var(--text-muted)' },
  in_progress: { icon: '◐', color: '#F59E0B' },
  done: { icon: '●', color: '#39FF14' },
};

// ── Helper Functions ──

/**
 * Get countdown string for target date
 * @example "3d left", "2w left", "5d overdue"
 */
export function getCountdown(targetDate: string | null): string | null {
  if (!targetDate) return null;
  const target = new Date(targetDate + 'T00:00:00');
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return '1d left';
  if (days <= 7) return `${days}d left`;
  if (days <= 30) return `${Math.ceil(days / 7)}w left`;
  return `${Math.ceil(days / 30)}mo left`;
}

/**
 * Calculate progress for a goal node (recursive for goals with children)
 * @param node - The goal node to calculate progress for
 * @param allGoals - All goals (to find children)
 * @param allTasks - All tasks (to calculate leaf progress)
 * @returns Progress percentage (0-100)
 */
export function calcProgress(node: GoalNode, allGoals: GoalNode[], allTasks: GoalTask[]): number {
  const children = allGoals.filter(g => g.parent_goal_id === node.id);
  if (children.length > 0) {
    // Parent goal: average of children's progress
    const childProgress = children.map(c => calcProgress(c, allGoals, allTasks));
    return childProgress.reduce((a, b) => a + b, 0) / childProgress.length;
  }
  // Leaf goal: calculate from tasks
  const tasks = allTasks.filter(t => t.goal_id === node.id);
  if (tasks.length === 0) return node.progress || 0;
  const done = tasks.filter(t => t.status === 'done').length;
  return Math.round((done / tasks.length) * 100);
}

/**
 * Build goal hierarchy tree (top-level goals with nested children)
 * @param goals - All goals (flat list)
 * @param parentId - Parent goal ID (null for root)
 * @returns Nested goal tree
 */
export function buildGoalTree(goals: GoalNode[], parentId: string | null = null): GoalNode[] {
  return goals
    .filter(g => g.parent_goal_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(goal => ({
      ...goal,
      children: buildGoalTree(goals, goal.id) as unknown as undefined,
    }));
}

/**
 * Calculate task completion velocity: tasks completed per week over last 4 weeks.
 */
export function calculateVelocity(tasks: GoalTask[]): number {
  const now = Date.now();
  const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000;
  const completedRecently = tasks.filter(t =>
    t.status === 'done' && t.completed_at && new Date(t.completed_at).getTime() >= fourWeeksAgo
  );
  return completedRecently.length / 4;
}

/**
 * Project estimated completion date based on current velocity.
 * @returns ISO date string or null if velocity is 0
 */
export function projectCompletionDate(velocity: number, remainingTasks: number): string | null {
  if (velocity <= 0 || remainingTasks <= 0) return null;
  const weeksNeeded = remainingTasks / velocity;
  const msNeeded = weeksNeeded * 7 * 24 * 60 * 60 * 1000;
  const projected = new Date(Date.now() + msNeeded);
  return projected.toISOString().split('T')[0];
}

/**
 * Get goal type/level (objective, epic, goal, or task)
 * Based on hierarchy depth
 */
export function getGoalLevel(goal: GoalNode, allGoals: GoalNode[]): 'objective' | 'epic' | 'goal' | 'task' {
  if (goal.type) return goal.type as 'objective' | 'epic' | 'goal' | 'task';
  
  // Calculate depth in hierarchy
  let depth = 0;
  let current = goal;
  while (current.parent_goal_id) {
    depth++;
    const parent = allGoals.find(g => g.id === current.parent_goal_id);
    if (!parent) break;
    current = parent;
  }
  
  if (depth === 0) return 'objective';
  if (depth === 1) return 'epic';
  if (depth === 2) return 'goal';
  return 'task';
}
