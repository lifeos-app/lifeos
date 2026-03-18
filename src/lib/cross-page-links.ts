/**
 * Cross-Page Links — Connects data across LifeOS modules.
 *
 * habit↔event matching, goal↔finance utils, health trend detection.
 * Used by nudges, schedule badges, and habit page annotations.
 */

import { useScheduleStore } from '../stores/useScheduleStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useHealthStore } from '../stores/useHealthStore';
import { localDateStr } from '../utils/date';
import { localGetAll } from './local-db';

// ── Habit ↔ Event Matching ──────────────────────────────────────

/**
 * Finds schedule events today whose title matches a habit title (fuzzy).
 * Returns map of habitId → matching event(s).
 */
export function findHabitEventMatches(): Map<string, { eventTitle: string; eventTime: string }[]> {
  const today = localDateStr();
  const habits = useHabitsStore.getState().habits.filter(h => h.is_active && !h.is_deleted);
  const events = useScheduleStore.getState().events.filter(e =>
    e.start_time?.startsWith(today) && !e.is_deleted
  );

  const matches = new Map<string, { eventTitle: string; eventTime: string }[]>();

  for (const habit of habits) {
    const ht = habit.title.toLowerCase();
    const matched = events.filter(e => {
      const et = e.title.toLowerCase();
      // Exact match or keyword overlap
      return et.includes(ht) || ht.includes(et) ||
        // Common keyword matching (e.g., habit "Gym" matches event "Gym Session")
        ht.split(/\s+/).some(w => w.length > 3 && et.includes(w));
    });

    if (matched.length > 0) {
      matches.set(habit.id, matched.map(e => ({
        eventTitle: e.title,
        eventTime: e.start_time,
      })));
    }
  }

  return matches;
}

/**
 * Checks if a habit has a linked event today but hasn't been logged.
 */
export function findUnloggedHabitEvents(): { habitId: string; habitTitle: string; eventTime: string }[] {
  const today = localDateStr();
  const logs = useHabitsStore.getState().logs.filter(l => l.date === today);
  const loggedIds = new Set(logs.map(l => l.habit_id));
  const matches = findHabitEventMatches();

  const unlogged: { habitId: string; habitTitle: string; eventTime: string }[] = [];
  const habits = useHabitsStore.getState().habits;

  for (const [habitId, events] of matches) {
    if (!loggedIds.has(habitId)) {
      const habit = habits.find(h => h.id === habitId);
      if (habit) {
        // Only flag if the event has started
        const started = events.find(e => new Date(e.eventTime).getTime() <= Date.now());
        if (started) {
          unlogged.push({ habitId, habitTitle: habit.title, eventTime: started.eventTime });
        }
      }
    }
  }

  return unlogged;
}

// ── Goal ↔ Finance Utils ────────────────────────────────────────

/**
 * Finds goals with budget > 80% spent but < 60% progress.
 * Extends the existing budget_alert nudge pattern.
 */
export function findBudgetAtRiskGoals(): { goalTitle: string; budgetPct: number; progress: number }[] {
  const goals = useGoalsStore.getState().goals;
  const tasks = useScheduleStore.getState().tasks;

  const results: { goalTitle: string; budgetPct: number; progress: number }[] = [];

  const activeGoals = goals.filter(g => !g.is_deleted && g.status === 'active' && g.budget_allocated && g.budget_allocated > 0);

  for (const goal of activeGoals) {
    const progress = goal.progress || 0;
    // Calculate spent from linked tasks (same pattern as nudges)
    const getDescendantTasks = (goalId: string): typeof tasks => {
      const directTasks = tasks.filter(t => t.goal_id === goalId);
      const childGoals = goals.filter(g => g.parent_goal_id === goalId);
      const childTasks = childGoals.flatMap(c => getDescendantTasks(c.id));
      return [...directTasks, ...childTasks];
    };
    const descTasks = getDescendantTasks(goal.id);
    const spent = descTasks
      .filter(t => t.financial_type === 'expense')
      .reduce((sum, t) => sum + (parseFloat(String(t.financial_amount)) || 0), 0);
    const budgetPct = (spent / goal.budget_allocated!) * 100;

    if (budgetPct > 80 && progress < 0.6) {
      results.push({ goalTitle: goal.title, budgetPct, progress });
    }
  }

  return results;
}

// ── Health Trend Detection ──────────────────────────────────────

/**
 * Detects significant mood/sleep changes over the last 7 days.
 * Returns a trend description or null if no significant change.
 */
export async function detectHealthTrend(): Promise<{
  type: 'mood_decline' | 'mood_improve' | 'sleep_decline' | 'sleep_improve';
  message: string;
  severity: 'low' | 'medium' | 'high';
} | null> {
  try {
    const allMetrics = await localGetAll<{
      date: string; mood_score?: number; sleep_hours?: number; is_deleted?: boolean;
    }>('health_metrics');

    const now = new Date();
    const weekAgo = localDateStr(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const twoWeeksAgo = localDateStr(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));

    const thisWeek = allMetrics.filter(m => !m.is_deleted && m.date >= weekAgo);
    const lastWeek = allMetrics.filter(m => !m.is_deleted && m.date >= twoWeeksAgo && m.date < weekAgo);

    if (thisWeek.length < 3 || lastWeek.length < 3) return null;

    // Mood trend
    const thisWeekMood = thisWeek.filter(m => m.mood_score).map(m => m.mood_score!);
    const lastWeekMood = lastWeek.filter(m => m.mood_score).map(m => m.mood_score!);

    if (thisWeekMood.length >= 3 && lastWeekMood.length >= 3) {
      const avgThis = thisWeekMood.reduce((a, b) => a + b, 0) / thisWeekMood.length;
      const avgLast = lastWeekMood.reduce((a, b) => a + b, 0) / lastWeekMood.length;
      const diff = avgThis - avgLast;

      if (diff <= -2) {
        return { type: 'mood_decline', message: `Your mood has dropped significantly (avg ${avgThis.toFixed(1)} vs ${avgLast.toFixed(1)} last week).`, severity: 'high' };
      }
      if (diff >= 2) {
        return { type: 'mood_improve', message: `Your mood is up! (avg ${avgThis.toFixed(1)} vs ${avgLast.toFixed(1)} last week).`, severity: 'low' };
      }
    }

    // Sleep trend
    const thisWeekSleep = thisWeek.filter(m => m.sleep_hours).map(m => m.sleep_hours!);
    const lastWeekSleep = lastWeek.filter(m => m.sleep_hours).map(m => m.sleep_hours!);

    if (thisWeekSleep.length >= 3 && lastWeekSleep.length >= 3) {
      const avgThis = thisWeekSleep.reduce((a, b) => a + b, 0) / thisWeekSleep.length;
      const avgLast = lastWeekSleep.reduce((a, b) => a + b, 0) / lastWeekSleep.length;
      const diff = avgThis - avgLast;

      if (diff <= -1) {
        return { type: 'sleep_decline', message: `Your sleep has declined (avg ${avgThis.toFixed(1)}h vs ${avgLast.toFixed(1)}h last week).`, severity: 'medium' };
      }
      if (diff >= 1) {
        return { type: 'sleep_improve', message: `Your sleep is improving! (avg ${avgThis.toFixed(1)}h vs ${avgLast.toFixed(1)}h last week).`, severity: 'low' };
      }
    }

    return null;
  } catch {
    return null;
  }
}
