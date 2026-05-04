/**
 * essentialism.ts — Greg McKeown's Essentialism Framework for LifeOS
 *
 * "Less but better. Systematic discipline of discerning what's vital."
 *
 * Measures vital ratio, pruning score, and alignment of daily tasks with top goals.
 * Pure functions — no React imports.
 */

import type { Goal, Task, Habit } from '../types/database';

// ── TYPES ──────────────────────────────────────────────────────

export type EssentialismLevel = 'scattered' | 'discerning' | 'essentialist' | 'master';

export interface EssentialismScore {
  vitalRatio: number;
  pruningScore: number;
  alignmentScore: number;
  overall: number;
  level: EssentialismLevel;
}

// ── CONSTANTS ──────────────────────────────────────────────────

const LS_KEY = 'lifeos_essentialism_score';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── HELPERS ────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getLevel(overall: number): EssentialismLevel {
  if (overall >= 4.0) return 'master';
  if (overall >= 3.0) return 'essentialist';
  if (overall >= 1.5) return 'discerning';
  return 'scattered';
}

/**
 * Determine if a goal appears to be essential based on its properties.
 * Essential goals are: active, have a target date, have descriptions,
 * and are self-created (not AI-suggested).
 */
function isEssentialGoal(goal: Goal): boolean {
  if (goal.is_deleted) return false;
  if (goal.status === 'archived' || goal.status === 'completed' || goal.status === 'done') return false;

  const isActive = goal.status === 'active' || goal.status === 'in_progress';
  if (!isActive) return false;

  // Goals with descriptions are more intentional
  const hasDescription = !!(goal.description && goal.description.trim().length > 10);
  // Self-created goals are more essential than AI-suggested
  const isSelfDirected = goal.source !== 'onboarding_ai';

  return hasDescription || isSelfDirected;
}

/**
 * Check if a task aligns with a set of goal IDs.
 */
function taskAlignsWithGoals(task: Task, essentialGoalIds: Set<string>): boolean {
  if (task.goal_id && essentialGoalIds.has(task.goal_id)) return true;

  // Check task domain matching goal domains
  if (task.domain && essentialGoalIds.size === 0) return false;

  // Tasks without a goal and without high priority are less aligned
  if (!task.goal_id && task.priority !== 'high' && task.priority !== 'urgent') return false;

  return false;
}

/**
 * Check if a goal was intentionally de-prioritized (pruned).
 * Pruned goals are: completed but had no tasks, or archived.
 */
function isPrunedGoal(goal: Goal): boolean {
  if (goal.is_deleted) return false;
  // Archived goals = explicitly de-prioritized
  if (goal.status === 'archived' || goal.status === 'paused') return true;
  return false;
}

// ── VITAL RATIO ────────────────────────────────────────────────

/**
 * Vital Ratio: Percentage of goals that are essential.
 * Scale: 0-5 (mapped from 0-1 ratio).
 */
function calculateVitalRatio(goals: Goal[]): number {
  const activeGoals = goals.filter(g => !g.is_deleted);
  if (activeGoals.length === 0) return 0;

  const essentialGoals = activeGoals.filter(g => isEssentialGoal(g));
  const ratio = essentialGoals.length / activeGoals.length;

  // A "vital ratio" of 0.3-0.5 is ideal (3-5 essential goals out of 10)
  // Too many essential goals = no focus; too few = scattered
  // Sweet spot: 30-50% of goals are essential. Score peaks at 0.4 ratio.
  if (ratio <= 0) return 0;
  if (ratio <= 0.5) {
    // Linear ramp: 0 → 0, 0.4 → 5.0
    return clamp((ratio / 0.4) * 5, 0, 5);
  }
  if (ratio <= 0.7) {
    // Too many "essential" goals = lack of discipline
    // 0.5 → 4.0, 0.7 → 2.5
    return clamp(4.0 - (ratio - 0.5) * 7.5, 0, 5);
  }
  // > 0.7 = very scattered, calling everything essential
  return clamp(2.5 - (ratio - 0.7) * 5, 0, 5);
}

// ── PRUNING SCORE ──────────────────────────────────────────────

/**
 * Pruning Score: How well the user says "no" to non-essential goals.
 * Measured by % of goals that were de-prioritized (archived/paused).
 * Scale: 0-5.
 */
function calculatePruningScore(goals: Goal[]): number {
  const allGoals = goals.filter(g => !g.is_deleted);
  if (allGoals.length < 3) return 0; // Need enough goals to measure pruning

  const prunedGoals = allGoals.filter(g => isPrunedGoal(g));
  const totalEverCreated = allGoals.length;
  const pruneRatio = prunedGoals.length / totalEverCreated;

  // Optimal pruning: 20-40% of goals get de-prioritized (discernment)
  // 0% = never said no; > 60% = over-pruning / lack of commitment
  if (pruneRatio < 0.05) return clamp(pruneRatio * 20, 0, 2); // Too few pruned
  if (pruneRatio <= 0.4) return clamp(2 + (pruneRatio - 0.05) * 8, 0, 5); // Sweet spot
  if (pruneRatio <= 0.6) return clamp(5 - (pruneRatio - 0.4) * 10, 0, 5); // Over-pruning
  return 1; // Excessive pruning
}

// ── ALIGNMENT SCORE ────────────────────────────────────────────

/**
 * Alignment Score: % of daily tasks that align with top 3 essential goals.
 * Scale: 0-5.
 */
function calculateAlignmentScore(goals: Goal[], tasks: Task[], _habits?: Habit[]): number {
  const activeGoals = goals.filter(g => !g.is_deleted && (g.status === 'active' || g.status === 'in_progress'));
  const activeTasks = tasks.filter(t => !t.is_deleted && t.status !== 'done' && t.status !== 'completed' && t.status !== 'cancelled');

  if (activeTasks.length === 0) return 0;

  // Identify top 3 essential goals (by priority heuristic)
  // High-priority tasks linked = higher score; self-created = essential
  const essentialGoalIds = new Set<string>();

  // Sort active goals by essential criteria
  const scoredGoals = activeGoals.map(g => ({
    id: g.id,
    score: (isEssentialGoal(g) ? 2 : 0) + (g.progress ? g.progress / 100 : 0),
  }));
  scoredGoals.sort((a, b) => b.score - a.score);

  // Take top 3 (or all if fewer)
  const topGoals = scoredGoals.slice(0, 3);
  for (const sg of topGoals) {
    essentialGoalIds.add(sg.id);
  }

  // Count tasks aligned with top goals
  let alignedCount = 0;
  for (const task of activeTasks) {
    if (taskAlignsWithGoals(task, essentialGoalIds)) {
      alignedCount++;
    } else if (task.priority === 'high' || task.priority === 'urgent') {
      // High-priority tasks are assumed aligned even without goal link
      alignedCount++;
    }
  }

  const alignmentRatio = alignedCount / activeTasks.length;

  // Map ratio to 0-5 scale
  // 80-100% alignment = top score, below 30% = low
  return clamp(alignmentRatio * 5, 0, 5);
}

// ── PUBLIC API ─────────────────────────────────────────────────

/**
 * Calculate the Essentialism Score combining vital ratio, pruning, and alignment.
 * Overall = weighted average (vitalRatio 30%, pruning 30%, alignment 40%), 0-5 scale.
 */
export function calculateEssentialismScore(goals: Goal[], tasks: Task[], habits?: Habit[]): EssentialismScore {
  const vitalRatio = calculateVitalRatio(goals);
  const pruningScore = calculatePruningScore(goals);
  const alignmentScore = calculateAlignmentScore(goals, tasks, habits);

  const overall = (vitalRatio * 0.3) + (pruningScore * 0.3) + (alignmentScore * 0.4);

  const score: EssentialismScore = {
    vitalRatio: Math.round(vitalRatio * 100) / 100,
    pruningScore: Math.round(pruningScore * 100) / 100,
    alignmentScore: Math.round(alignmentScore * 100) / 100,
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
 * Get cached Essentialism score if still valid (24h TTL).
 * Returns null if expired or not cached.
 */
export function getCachedEssentialismScore(): EssentialismScore | null {
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
 * Get a human-readable insight for the Essentialism score.
 */
export function getEssentialismInsight(score: EssentialismScore): string {
  const { vitalRatio, pruningScore, alignmentScore, overall, level } = score;

  if (overall >= 4.0) {
    return `Master essentialist (${overall.toFixed(1)}/5). You have clear focus: ${vitalRatio.toFixed(1)}/5 vital ratio, ${pruningScore.toFixed(1)}/5 pruning discipline, and ${alignmentScore.toFixed(1)}/5 alignment. Keep protecting your essential few.`;
  }

  // Identify weakest dimension
  const dims = [
    { name: 'vital ratio', score: vitalRatio, tip: 'Identify the 3 goals that truly matter.archive or pause the rest. Less is more.' },
    { name: 'pruning discipline', score: pruningScore, tip: 'Practice saying no. Archive goals you have not worked on in 30 days. Every "no" frees energy for what matters.' },
    { name: 'task-goal alignment', score: alignmentScore, tip: 'Link your daily tasks to your top 3 goals. If a task does not serve a vital goal, delegate, defer, or delete it.' },
  ];

  const weakest = dims.reduce((min, d) => d.score < min.score ? d : min, dims[0]);

  if (overall >= 3.0) {
    return `Essentialist level (${overall.toFixed(1)}/5). Your ${weakest.name} at ${weakest.score.toFixed(1)}/5 is the area for growth: ${weakest.tip}`;
  }

  if (overall >= 1.5) {
    return `Discerning level (${overall.toFixed(1)}/5). You are learning to separate the vital few from the trivial many. Start with ${weakest.name}: ${weakest.tip}`;
  }

  return `Scattered (${overall.toFixed(1)}/5). You are spread too thin. ${weakest.tip} The disciplined pursuit of less is the path to making your highest contribution.`;
}