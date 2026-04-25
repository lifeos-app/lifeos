/**
 * GTD-Enhanced Weekly Review — Getting Things Done methodology
 *
 * 5 phases: Capture -> Clarify -> Organize -> Reflect -> Engage
 * Generates a structured review from tasks, habits, goals, and journal entries.
 * Pure functions — no React imports.
 */

import type { Task, Goal, Habit } from '../types/database';

// ── TYPES ──

export interface GTDAction {
  id: string;
  label: string;
  type: 'capture' | 'clarify' | 'organize' | 'reflect' | 'engage';
  itemId?: string;
  completed: boolean;
}

export interface GTDReviewPhase {
  phase: string;
  title: string;
  description: string;
  questions: string[];
  actions: GTDAction[];
}

export interface GTDReview {
  completedAt: string;
  phases: GTDReviewPhase[];
  weekScore: number;
  nextWeekFocus: string;
}

// ── HELPERS ──

function genActionId(): string {
  return 'gtd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function getWeekAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ── PHASE GENERATORS ──

function generateCapturePhase(tasks: Task[], _habits: Habit[], journalEntries: { content?: string; tags?: string }[]): GTDReviewPhase {
  const actions: GTDAction[] = [];

  // Tasks with no due date = uncaptured / needs processing
  const undatedTasks = tasks.filter(t =>
    !t.due_date && t.status !== 'done' && t.status !== 'cancelled'
  );
  for (const t of undatedTasks.slice(0, 5)) {
    actions.push({
      id: genActionId(),
      label: `Set a due date for "${t.title}"`,
      type: 'capture',
      itemId: t.id,
      completed: false,
    });
  }

  // Scan journal for potential habit/task keywords
  const actionKeywords = ['should', 'need to', 'want to', 'must', 'have to', 'going to', 'plan to'];
  for (const entry of journalEntries.slice(0, 10)) {
    const content = (entry.content || '').toLowerCase();
    for (const kw of actionKeywords) {
      if (content.includes(kw)) {
        actions.push({
          id: genActionId(),
          label: 'Review journal entry for uncaptured tasks or ideas',
          type: 'capture',
          completed: false,
        });
        break;
      }
    }
    if (actions.length >= 8) break;
  }

  return {
    phase: 'capture',
    title: 'Capture',
    description: 'Collect everything that has your attention. Get it out of your head and into your system.',
    questions: [
      'What commitments did you make this week that are not in your task list?',
      'Are there any ideas, projects, or someday-maybes floating in your head?',
      'Did anything come up in conversations that needs follow-up?',
    ],
    actions: actions.slice(0, 8),
  };
}

function generateClarifyPhase(tasks: Task[], goals: Goal[]): GTDReviewPhase {
  const actions: GTDAction[] = [];

  // Ambiguous tasks: no priority or no context
  const ambiguousTasks = tasks.filter(t =>
    t.status !== 'done' && t.status !== 'cancelled' && (!t.priority || !t.goal_id)
  );
  for (const t of ambiguousTasks.slice(0, 5)) {
    if (!t.priority) {
      actions.push({
        id: genActionId(),
        label: `Set priority for "${t.title}"`,
        type: 'clarify',
        itemId: t.id,
        completed: false,
      });
    }
    if (!t.goal_id) {
      actions.push({
        id: genActionId(),
        label: `Link "${t.title}" to a goal or mark as standalone`,
        type: 'clarify',
        itemId: t.id,
        completed: false,
      });
    }
  }

  // Stalled goals: active but no recent updates
  const weekAgo = getWeekAgoStr();
  const stalledGoals = goals.filter(g =>
    (g.status === 'active' || g.status === 'in_progress') &&
    (g.updated_at || g.created_at) < weekAgo
  );
  for (const g of stalledGoals.slice(0, 3)) {
    actions.push({
      id: genActionId(),
      label: `Review stalled goal: "${g.title}" — still relevant?`,
      type: 'clarify',
      itemId: g.id,
      completed: false,
    });
  }

  return {
    phase: 'clarify',
    title: 'Clarify',
    description: 'Process each item. What is it? Is it actionable? What is the next action?',
    questions: [
      'For each task without a priority, ask: does this need to happen this week?',
      'Are any goals no longer relevant? Should they be archived?',
      'Which tasks can be delegated or eliminated entirely?',
    ],
    actions: actions.slice(0, 8),
  };
}

function generateOrganizePhase(tasks: Task[], goals: Goal[]): GTDReviewPhase {
  const actions: GTDAction[] = [];

  // Tasks without categories/domains
  const uncategorized = tasks.filter(t =>
    t.status !== 'done' && t.status !== 'cancelled' && !t.domain && !t.goal_id
  );
  if (uncategorized.length > 0) {
    actions.push({
      id: genActionId(),
      label: `${uncategorized.length} task${uncategorized.length > 1 ? 's' : ''} without a category or linked goal`,
      type: 'organize',
      completed: false,
    });
  }

  // Goals without sub-goals or tasks
  const lonelyGoals = goals.filter(g => {
    const isActive = g.status === 'active' || g.status === 'in_progress';
    const hasChildren = goals.some(c => c.parent_goal_id === g.id);
    const hasTasks = tasks.some(t => t.goal_id === g.id);
    return isActive && !hasChildren && !hasTasks;
  });
  for (const g of lonelyGoals.slice(0, 3)) {
    actions.push({
      id: genActionId(),
      label: `Break down "${g.title}" into actionable tasks or milestones`,
      type: 'organize',
      itemId: g.id,
      completed: false,
    });
  }

  return {
    phase: 'organize',
    title: 'Organize',
    description: 'Put everything in the right place. Assign contexts, projects, and priorities.',
    questions: [
      'Are all your active goals broken down into next actions?',
      'Is your calendar accurate for the coming week?',
      'Are waiting-for items tracked with clear follow-up dates?',
    ],
    actions: actions.slice(0, 8),
  };
}

function generateReflectPhase(tasks: Task[], habits: Habit[], goals: Goal[]): GTDReviewPhase {
  const actions: GTDAction[] = [];
  const weekAgo = getWeekAgoStr();
  const today = todayStr();

  // Completed tasks this week
  const completedThisWeek = tasks.filter(t =>
    (t.status === 'done' || t.status === 'completed') &&
    t.completed_at && t.completed_at >= weekAgo
  );

  // Streaks
  const activeStreaks = habits.filter(h => h.streak_current > 0);
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak_current), 0);

  if (completedThisWeek.length > 0) {
    actions.push({
      id: genActionId(),
      label: `Celebrate: ${completedThisWeek.length} task${completedThisWeek.length > 1 ? 's' : ''} completed this week`,
      type: 'reflect',
      completed: false,
    });
  }

  if (activeStreaks.length > 0) {
    actions.push({
      id: genActionId(),
      label: `${activeStreaks.length} active streak${activeStreaks.length > 1 ? 's' : ''} (best: ${bestStreak} days)`,
      type: 'reflect',
      completed: false,
    });
  }

  // Goals that progressed
  const progressedGoals = goals.filter(g =>
    g.updated_at && g.updated_at >= weekAgo &&
    (g.status === 'active' || g.status === 'in_progress')
  );
  if (progressedGoals.length > 0) {
    actions.push({
      id: genActionId(),
      label: `${progressedGoals.length} goal${progressedGoals.length > 1 ? 's' : ''} progressed this week`,
      type: 'reflect',
      completed: false,
    });
  }

  // Overdue tasks
  const overdue = tasks.filter(t =>
    t.due_date && t.due_date < today && t.status !== 'done' && t.status !== 'cancelled'
  );
  if (overdue.length > 0) {
    actions.push({
      id: genActionId(),
      label: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} need attention`,
      type: 'reflect',
      completed: false,
    });
  }

  return {
    phase: 'reflect',
    title: 'Reflect',
    description: 'Step back and look at the bigger picture. What worked? What did not?',
    questions: [
      'What was your biggest win this week?',
      'What could you have done differently?',
      'Which habits are you maintaining well? Which need reinforcement?',
      'Are your goals still aligned with your values?',
    ],
    actions,
  };
}

function generateEngagePhase(tasks: Task[], goals: Goal[]): GTDReviewPhase {
  const actions: GTDAction[] = [];
  const today = todayStr();

  // Top 3 priorities for next week — high priority tasks due soonest
  const upcoming = tasks
    .filter(t => t.status !== 'done' && t.status !== 'cancelled')
    .sort((a, b) => {
      const pOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const pa = pOrder[a.priority || 'medium'] ?? 2;
      const pb = pOrder[b.priority || 'medium'] ?? 2;
      if (pa !== pb) return pa - pb;
      return (a.due_date || '9999').localeCompare(b.due_date || '9999');
    })
    .slice(0, 3);

  for (const t of upcoming) {
    actions.push({
      id: genActionId(),
      label: `Priority: "${t.title}"${t.due_date ? ` (due ${t.due_date})` : ''}`,
      type: 'engage',
      itemId: t.id,
      completed: false,
    });
  }

  // Recommended focus area — domain with most active but stalled goals
  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'in_progress');
  const domainCounts: Record<string, number> = {};
  for (const g of activeGoals) {
    const domain = g.domain || g.category || 'general';
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  }
  const topDomain = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0];
  if (topDomain) {
    actions.push({
      id: genActionId(),
      label: `Focus area: ${topDomain[0]} (${topDomain[1]} active goal${topDomain[1] > 1 ? 's' : ''})`,
      type: 'engage',
      completed: false,
    });
  }

  return {
    phase: 'engage',
    title: 'Engage',
    description: 'Choose your battles for next week. What 3 things will move the needle most?',
    questions: [
      'What are the 3 most important outcomes for next week?',
      'What can you say no to this week to protect focus time?',
      'Which goal deserves the most attention right now?',
    ],
    actions,
  };
}

// ── PUBLIC API ──

/**
 * Generate a complete GTD weekly review from user data.
 */
export function generateGTDReview(
  tasks: Task[],
  habits: Habit[],
  goals: Goal[],
  journalEntries: { content?: string; tags?: string }[],
): GTDReview {
  const today = todayStr();
  const weekAgo = getWeekAgoStr();

  const phases: GTDReviewPhase[] = [
    generateCapturePhase(tasks, habits, journalEntries),
    generateClarifyPhase(tasks, goals),
    generateOrganizePhase(tasks, goals),
    generateReflectPhase(tasks, habits, goals),
    generateEngagePhase(tasks, goals),
  ];

  // Calculate week score (0-10)
  const completedThisWeek = tasks.filter(t =>
    (t.status === 'done' || t.status === 'completed') &&
    t.completed_at && t.completed_at >= weekAgo
  ).length;
  const activeStreaks = habits.filter(h => h.streak_current > 0).length;
  const overdue = tasks.filter(t =>
    t.due_date && t.due_date < today && t.status !== 'done' && t.status !== 'cancelled'
  ).length;

  const rawScore = Math.min(completedThisWeek * 0.5 + activeStreaks * 0.8 - overdue * 0.3, 10);
  const weekScore = Math.max(0, Math.round(rawScore * 10) / 10);

  // Determine next week focus
  const engagePhase = phases[4];
  const focusAction = engagePhase.actions.find(a => a.label.startsWith('Focus area:'));
  const nextWeekFocus = focusAction
    ? focusAction.label.replace('Focus area: ', '')
    : 'Complete your top 3 priorities';

  return {
    completedAt: new Date().toISOString(),
    phases,
    weekScore,
    nextWeekFocus,
  };
}

// ── LOCAL STORAGE ──

const LS_KEY = 'lifeos_gtd_reviews';

/**
 * Save a completed GTD review to localStorage.
 */
export function saveGTDReview(review: GTDReview): void {
  try {
    const existing = getGTDReviews();
    existing.push(review);
    // Keep last 52 reviews (1 year of weekly reviews)
    const trimmed = existing.slice(-52);
    localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

/**
 * Get all saved GTD reviews from localStorage.
 */
export function getGTDReviews(): GTDReview[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Get the most recent GTD review, or null if none.
 */
export function getLastGTDReview(): GTDReview | null {
  const reviews = getGTDReviews();
  return reviews.length > 0 ? reviews[reviews.length - 1] : null;
}
