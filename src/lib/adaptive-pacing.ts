/**
 * adaptive-pacing.ts — Adaptive Pacing for Academy 2.0
 *
 * Evaluates weekly lesson completion rates and recommends pacing adjustments.
 * Pure functions — no side effects.
 */

// ── Types (inline to avoid cross-worktree dependency) ──

interface LearningGoal {
  id: string;
  userId: string;
  topic: string;
  domain: string;
  weeklyTargetLessons: number;
  lessonsCompletedThisWeek: number;
  lessonsScheduledThisWeek: number;
  lastPacingEvalDate: string | null;
  pacingStatus: string;
  [key: string]: unknown;
}

export interface PacingEvaluation {
  weekStart: string;
  scheduled: number;
  completed: number;
  completionRate: number;
  recommendation: 'increase' | 'decrease' | 'maintain';
  message: string;
  newWeeklyTarget: number;
}

// ── Helpers ──

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Public API ──

/**
 * Evaluate pacing for a learning goal.
 * Returns null if a pacing eval was done within the last 6 days.
 */
export function evaluatePacing(goal: LearningGoal): PacingEvaluation | null {
  const today = new Date().toISOString().split('T')[0];

  // Skip if last eval was within 6 days
  if (goal.lastPacingEvalDate) {
    const daysSince = daysBetween(goal.lastPacingEvalDate, today);
    if (daysSince < 7) return null;
  }

  const weekStart = getWeekStart();
  const scheduled = Math.max(goal.lessonsScheduledThisWeek, 1);
  const completed = goal.lessonsCompletedThisWeek;
  const completionRate = completed / scheduled;
  const currentTarget = goal.weeklyTargetLessons;

  let recommendation: 'increase' | 'decrease' | 'maintain';
  let message: string;
  let newWeeklyTarget: number;

  if (completionRate >= 0.8) {
    recommendation = 'increase';
    newWeeklyTarget = Math.min(currentTarget + 1, 7);
    message = "You're crushing it! Ready for more?";
  } else if (completionRate <= 0.5) {
    recommendation = 'decrease';
    newWeeklyTarget = Math.max(currentTarget - 1, 1);
    message = "Life happens. Let's ease the pace a little.";
  } else {
    recommendation = 'maintain';
    newWeeklyTarget = currentTarget;
    message = "You're on track. Keep going!";
  }

  return {
    weekStart,
    scheduled,
    completed,
    completionRate,
    recommendation,
    message,
    newWeeklyTarget,
  };
}

/**
 * Apply a pacing change to a learning goal. Returns partial update fields.
 */
export function applyPacingChange(
  goal: LearningGoal,
  newWeeklyTarget: number,
): Partial<LearningGoal> {
  const today = new Date().toISOString().split('T')[0];
  return {
    weeklyTargetLessons: newWeeklyTarget,
    lastPacingEvalDate: today,
    pacingStatus: newWeeklyTarget > goal.weeklyTargetLessons
      ? 'accelerating'
      : newWeeklyTarget < goal.weeklyTargetLessons
        ? 'decelerating'
        : 'steady',
  };
}
