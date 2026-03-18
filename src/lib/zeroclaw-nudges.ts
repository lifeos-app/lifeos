/**
 * ZeroClaw Contextual Nudges — Proactive coaching from aggregated app state.
 *
 * Checks overdue items, habit streaks at risk, schedule gaps, and stale goals
 * to produce actionable nudges. Nudge text is optionally refined through
 * ZeroClaw chat for a conversational tone; falls back to static copy.
 */

import { useScheduleStore } from '../stores/useScheduleStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useUserStore } from '../stores/useUserStore';
import { type AgentAction } from './zeroclaw-client';
import { localDateStr } from '../utils/date';
import type { AgentInsight } from './zeroclaw-client';
import { findUnloggedHabitEvents, detectHealthTrend } from './cross-page-links';

// ── Nudge shape (matches AgentInsight for store compat) ─────────────────

export interface ContextualNudge {
  type: string;
  title: string;
  summary: string;
  details: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  generatedAt: string;
  actions?: AgentAction[];
}

// ── Main generator ──────────────────────────────────────────────────────

export async function generateContextualNudges(userId: string): Promise<ContextualNudge[]> {
  const nudges: ContextualNudge[] = [];
  const now = new Date();
  const today = localDateStr();
  const hour = now.getHours();

  // ── Guard: Skip nudges for new/unboarded users ──
  // New users shouldn't be greeted with "overdue pile-up" and "goal needs attention"
  const profile = useUserStore.getState().profile;
  if (!profile?.onboarding_complete) return nudges;

  // Grace period: suppress nudges for 3 days after account creation
  const user = useUserStore.getState().user;
  if (user?.created_at) {
    const accountAge = now.getTime() - new Date(user.created_at).getTime();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    if (accountAge < THREE_DAYS_MS) return nudges;
  }

  // ── 1. Overdue items nudge ──
  const tasks = useScheduleStore.getState().tasks;
  const overdueTasks = tasks.filter(t =>
    t.due_date && t.due_date < today && t.status !== 'done' && !t.is_deleted
  );

  if (overdueTasks.length >= 3) {
    nudges.push({
      type: 'overdue_bulk',
      title: 'Overdue pile-up',
      summary: `You have ${overdueTasks.length} overdue tasks. Want me to reschedule them based on your week?`,
      details: `Overdue: ${overdueTasks.slice(0, 3).map(t => t.title).join(', ')}${overdueTasks.length > 3 ? ` and ${overdueTasks.length - 3} more` : ''}`,
      priority: overdueTasks.length >= 6 ? 'urgent' : 'high',
      generatedAt: now.toISOString(),
      actions: [{
        type: 'navigate',
        payload: { path: '/review?mode=reschedule#overdue' },
        label: 'Reschedule with agent',
        requiresConfirm: false,
      }],
    });
  }

  // ── 2. Habit streak at risk ──
  if (hour >= 14) {
    const habits = useHabitsStore.getState().habits;
    const logs = useHabitsStore.getState().logs;
    const loggedTodayIds = new Set(
      logs.filter(l => l.date === today).map(l => l.habit_id)
    );

    const atRiskHabits = habits.filter(h =>
      h.is_active && !h.is_deleted &&
      (h.streak_current || 0) > 3 &&
      !loggedTodayIds.has(h.id)
    );

    if (atRiskHabits.length > 0) {
      const top = atRiskHabits.sort((a, b) => (b.streak_current || 0) - (a.streak_current || 0))[0];
      nudges.push({
        type: 'streak_risk',
        title: 'Streak at risk',
        summary: `Your ${top.streak_current || 0}-day "${top.title}" streak is at risk. Log it before the day ends!`,
        details: atRiskHabits.length > 1
          ? `${atRiskHabits.length} habits with active streaks not logged today`
          : `"${top.title}" has a ${top.streak_current || 0}-day streak`,
        priority: 'high',
        generatedAt: now.toISOString(),
        actions: [{
          type: 'navigate',
          payload: { path: '/habits' },
          label: 'Log now',
          requiresConfirm: false,
        }],
      });
    }
  }

  // ── 3. Schedule gap detection ──
  const events = useScheduleStore.getState().events;
  const todayEvents = events.filter(e =>
    e.start_time && e.start_time.startsWith(today) && !e.is_deleted
  ).sort((a, b) => a.start_time.localeCompare(b.start_time));

  if (todayEvents.length >= 1 && hour < 18) {
    // Find gaps > 90 minutes between events
    for (let i = 0; i < todayEvents.length - 1; i++) {
      const endCurrent = todayEvents[i].end_time
        ? new Date(todayEvents[i].end_time!)
        : new Date(new Date(todayEvents[i].start_time).getTime() + 60 * 60 * 1000);
      const startNext = new Date(todayEvents[i + 1].start_time);
      const gapMinutes = (startNext.getTime() - endCurrent.getTime()) / (1000 * 60);

      if (gapMinutes >= 90 && endCurrent.getHours() >= hour) {
        const gapTime = endCurrent.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
        nudges.push({
          type: 'schedule_gap',
          title: 'Free slot',
          summary: `You have a gap at ${gapTime} — want to slot in focused work?`,
          details: `${Math.round(gapMinutes)} minute gap between "${todayEvents[i].title}" and "${todayEvents[i + 1].title}"`,
          priority: 'low',
          generatedAt: now.toISOString(),
          actions: [{
            type: 'navigate',
            payload: { path: '/schedule' },
            label: 'Open schedule',
            requiresConfirm: false,
          }],
        });
        break; // Only one gap nudge
      }
    }
  }

  // ── 4. Stale goals ──
  const goals = useGoalsStore.getState().goals;
  const staleGoals = goals.filter(g => {
    if (g.is_deleted || g.status !== 'active') return false;
    if (!g.updated_at) return true;
    const daysSince = Math.floor(
      (now.getTime() - new Date(g.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince >= 7;
  });

  if (staleGoals.length > 0) {
    const stalest = staleGoals[0];
    nudges.push({
      type: 'stale_goal',
      title: 'Goal needs attention',
      summary: `Time to refocus on "${stalest.title}" — it hasn't had activity in over a week.`,
      details: `Goal "${stalest.title}" last updated ${stalest.updated_at || 'unknown'}`,
      priority: 'medium',
      generatedAt: now.toISOString(),
      actions: [{
        type: 'navigate',
        payload: { path: '/goals' },
        label: 'View goals',
        requiresConfirm: false,
      }],
    });
  }

  // ── 5. Goal progress lag ──
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthPct = dayOfMonth / daysInMonth;

  const activeGoals = goals.filter(g => !g.is_deleted && g.status === 'active' && (g.category === 'goal' || !g.category));
  const laggingGoals = activeGoals.filter(g => {
    const progress = g.progress || 0;
    return monthPct > 0.4 && progress < monthPct * 0.5; // Month >40% done but goals <half expected
  });

  if (laggingGoals.length > 0) {
    nudges.push({
      type: 'goal_progress_lag',
      title: 'Goals falling behind',
      summary: `We're ${Math.round(monthPct * 100)}% through the month but ${laggingGoals.length} goal${laggingGoals.length > 1 ? 's are' : ' is'} lagging. Time to push?`,
      details: `Lagging: ${laggingGoals.slice(0, 3).map(g => g.title).join(', ')}`,
      priority: 'high',
      generatedAt: now.toISOString(),
      actions: [{
        type: 'navigate',
        payload: { path: '/goals' },
        label: 'Review goals',
        requiresConfirm: false,
      }],
    });
  }

  // ── 6. Unlinked tasks piling up ──
  const allTasks = tasks.filter(t => t.status !== 'done' && !t.is_deleted);
  const unlinkedTasks = allTasks.filter(t => !t.goal_id);
  if (unlinkedTasks.length >= 5) {
    nudges.push({
      type: 'unlinked_tasks',
      title: 'Orphan tasks',
      summary: `${unlinkedTasks.length} tasks aren't linked to any goal. Want to connect them to your bigger picture?`,
      details: `Unlinked: ${unlinkedTasks.slice(0, 3).map(t => t.title).join(', ')}${unlinkedTasks.length > 3 ? ` +${unlinkedTasks.length - 3} more` : ''}`,
      priority: 'medium',
      generatedAt: now.toISOString(),
      actions: [{
        type: 'navigate',
        payload: { path: '/goals' },
        label: 'Link tasks',
        requiresConfirm: false,
      }],
    });
  }

  // ── 7. Win celebration ──
  const recentlyCompleted = goals.filter(g => {
    if (g.is_deleted || g.status !== 'completed') return false;
    if (!g.updated_at) return false;
    const hoursSince = (now.getTime() - new Date(g.updated_at).getTime()) / (1000 * 60 * 60);
    return hoursSince <= 24;
  });

  if (recentlyCompleted.length > 0) {
    nudges.push({
      type: 'win_celebration',
      title: 'Goal completed!',
      summary: `You crushed "${recentlyCompleted[0].title}"! Take a moment to celebrate your win.`,
      details: `Completed goal: ${recentlyCompleted[0].title}`,
      priority: 'low',
      generatedAt: now.toISOString(),
      actions: [{
        type: 'navigate',
        payload: { path: '/goals' },
        label: 'View achievement',
        requiresConfirm: false,
      }],
    });
  }

  // ── 8. Weekly review due ──
  const dayOfWeek = now.getDay(); // 0 = Sunday
  if (dayOfWeek === 0) {
    // Check if user has done a review this week (look for journal entry or review)
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = localDateStr(weekStart);
    const weekEvents = events.filter(e =>
      e.start_time && e.start_time >= weekStartStr &&
      e.title && e.title.toLowerCase().includes('review') && !e.is_deleted
    );

    if (weekEvents.length === 0) {
      nudges.push({
        type: 'weekly_review_due',
        title: 'Weekly review',
        summary: "It's Sunday — time for your weekly review. Reflect on wins and plan next week.",
        details: 'No weekly review detected this week',
        priority: 'medium',
        generatedAt: now.toISOString(),
        actions: [{
          type: 'navigate',
          payload: { path: '/review' },
          label: 'Start review',
          requiresConfirm: false,
        }],
      });
    }
  }

  // ── 9. Budget alert ──
  const budgetGoals = goals.filter(g =>
    !g.is_deleted && g.status === 'active' && g.budget_allocated && g.budget_allocated > 0
  );

  for (const bg of budgetGoals) {
    const progress = bg.progress || 0;
    // Calculate spent from linked tasks (simplified — uses same pattern as NodeDetail)
    const getDescendantTasks = (goalId: string): typeof tasks => {
      const directTasks = tasks.filter(t => t.goal_id === goalId);
      const childGoals = goals.filter(g => g.parent_goal_id === goalId);
      const childTasks = childGoals.flatMap(c => getDescendantTasks(c.id));
      return [...directTasks, ...childTasks];
    };
    const descTasks = getDescendantTasks(bg.id);
    const spent = descTasks
      .filter(t => t.financial_type === 'expense')
      .reduce((sum, t) => sum + (parseFloat(String(t.financial_amount)) || 0), 0);
    const budgetPct = (spent / bg.budget_allocated!) * 100;

    if (budgetPct > 80 && progress < 0.6) {
      nudges.push({
        type: 'budget_alert',
        title: 'Budget warning',
        summary: `"${bg.title}" has used ${Math.round(budgetPct)}% of budget but is only ${Math.round(progress * 100)}% complete.`,
        details: `$${spent.toFixed(0)} / $${bg.budget_allocated!.toFixed(0)} spent`,
        priority: 'high',
        generatedAt: now.toISOString(),
        actions: [{
          type: 'navigate',
          payload: { path: '/goals' },
          label: 'Review budget',
          requiresConfirm: false,
        }],
      });
      break; // Only one budget alert
    }
  }

  // ── 10. Habit-Schedule mismatch ──
  try {
    const unlogged = findUnloggedHabitEvents();
    if (unlogged.length > 0) {
      const top = unlogged[0];
      nudges.push({
        type: 'habit_schedule_mismatch',
        title: 'Habit not logged',
        summary: `Your "${top.habitTitle}" event has started but the habit isn't logged yet. Did you do it?`,
        details: `${unlogged.length} habit-linked event${unlogged.length > 1 ? 's' : ''} with unlogged habits`,
        priority: 'medium',
        generatedAt: now.toISOString(),
        actions: [{
          type: 'navigate',
          payload: { path: '/habits' },
          label: 'Log habit',
          requiresConfirm: false,
        }],
      });
    }
  } catch { /* cross-page-links unavailable */ }

  // ── 11. Health trend ──
  try {
    const trend = await detectHealthTrend();
    if (trend) {
      nudges.push({
        type: 'health_trend',
        title: trend.type.includes('decline') ? 'Health check-in' : 'Health win',
        summary: trend.message,
        details: trend.message,
        priority: trend.severity === 'high' ? 'high' : 'low',
        generatedAt: now.toISOString(),
        actions: [{
          type: 'navigate',
          payload: { path: '/health' },
          label: 'View health',
          requiresConfirm: false,
        }],
      });
    }
  } catch { /* health trend detection unavailable */ }

  // ── 12. Deadline approaching ──
  const allGoals = goals.filter(g => !g.is_deleted);
  const goalsWithDeadlines = allGoals.filter(g => {
    if (!g.target_date || g.status === 'completed') return false;
    const targetDate = new Date(g.target_date);
    const daysLeft = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= 7;
  });

  if (goalsWithDeadlines.length > 0) {
    goalsWithDeadlines.sort((a, b) => new Date(a.target_date!).getTime() - new Date(b.target_date!).getTime());
    const g = goalsWithDeadlines[0];
    const daysLeft = Math.ceil((new Date(g.target_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const progress = Math.round((g.progress || 0) * 100);
    nudges.push({
      type: 'deadline_approaching',
      title: 'Deadline approaching',
      summary: `"${g.title}" is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — ${progress}% complete.`,
      details: `Target date: ${g.target_date}. Progress: ${progress}%.`,
      priority: daysLeft <= 3 ? 'high' : 'medium',
      generatedAt: now.toISOString(),
      actions: [{ type: 'navigate', payload: { path: '/goals' }, label: 'View goals', requiresConfirm: false }],
    });
  }

  // ── 13. Goal at risk — >30% tasks overdue under an objective ──
  const objectiveGoals = allGoals.filter(g => g.category === 'objective' && g.status === 'active');
  for (const obj of objectiveGoals) {
    const descIds = new Set<string>();
    const objQueue = [obj.id];
    while (objQueue.length) {
      const pid = objQueue.pop()!;
      descIds.add(pid);
      allGoals.filter(c => c.parent_goal_id === pid).forEach(c => objQueue.push(c.id));
    }

    const objTasks = tasks.filter(t => t.goal_id && descIds.has(t.goal_id) && !t.is_deleted);
    if (objTasks.length === 0) continue;

    const overdueTCount = objTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length;
    const overdueRatio = overdueTCount / objTasks.length;

    if (overdueRatio > 0.3) {
      nudges.push({
        type: 'goal_at_risk',
        title: 'Objective at risk',
        summary: `"${obj.title}" has ${overdueTCount} overdue tasks (${Math.round(overdueRatio * 100)}%). Time to reschedule or reprioritize.`,
        details: `${overdueTCount}/${objTasks.length} tasks overdue under "${obj.title}"`,
        priority: overdueRatio > 0.5 ? 'urgent' : 'high',
        generatedAt: now.toISOString(),
        actions: [{
          type: 'navigate',
          payload: { path: '/goals' },
          label: 'Review objective',
          requiresConfirm: false,
        }],
      });
      break;
    }
  }

  // ── 14. Health metrics check-in (Energy, Water, Mood) ──
  if (hour >= 9 && hour <= 21) {
    // Check if today's health metrics exist using health store
    const { useHealthStore } = await import('../stores/useHealthStore');
    const todayMetrics = useHealthStore.getState().todayMetrics;
    
    const missing: string[] = [];
    if (!todayMetrics || todayMetrics.energy_score === null || todayMetrics.energy_score === undefined) missing.push('Energy');
    if (!todayMetrics || todayMetrics.water_glasses === null || todayMetrics.water_glasses === undefined || todayMetrics.water_glasses === 0) missing.push('Water');
    if (!todayMetrics || todayMetrics.mood_score === null || todayMetrics.mood_score === undefined) missing.push('Mood');
    
    if (missing.length > 0) {
      nudges.push({
        type: 'health_checkin',
        title: 'Health check-in',
        summary: `Time to log your ${missing.join(', ')}! Quick check-in helps track your patterns.`,
        details: `Missing health metrics for today: ${missing.join(', ')}`,
        priority: missing.length >= 3 ? 'high' : 'medium',
        generatedAt: now.toISOString(),
        actions: [{
          type: 'navigate',
          payload: { path: '/health' },
          label: 'Log now',
          requiresConfirm: false,
        }],
      });
    }
  }

  return nudges;
}
