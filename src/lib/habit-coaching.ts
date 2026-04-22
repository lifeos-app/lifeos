/**
 * habit-coaching.ts — Habit Coaching AI for LifeOS
 *
 * Analyzes streak data, detects at-risk habits, and generates
 * personalised coaching messages. Surfaces in ProactiveSuggestions
 * and as a Dashboard widget.
 *
 * Coaching types:
 *   streak_at_risk  — Habit streak about to break (<2h window)
 *   recovery        — Habit just recovered after a miss
 *   pairing         — Suggest habit stacking (pair with existing strong habit)
 *   optimal_time    — Suggest better time based on completion patterns
 */

import type { Habit, HabitLog } from '../types/database';
import { calculateStreak } from '../stores/useHabitsStore';

// ─── Types ──────────────────────────────────────────

export type CoachingType = 'streak_at_risk' | 'recovery' | 'pairing' | 'optimal_time';

export interface CoachingInsight {
  id: string;
  type: CoachingType;
  habitId: string;
  habitTitle: string;
  priority: number;       // 1 (urgent) – 4 (info)
  message: string;        // Human-readable coaching message
  action?: {
    label: string;        // e.g. "Log Now", "Set Reminder"
    intent: string;       // Intent action type
    data: Record<string, unknown>;
  };
  timestamp: string;
}

export interface CoachingInput {
  habits: Habit[];
  habitLogs: HabitLog[];
  userId: string;
  now?: Date;             // Injection point for tests
}

// ─── Constants ──────────────────────────────────────

const STREAK_RISK_THRESHOLD_DAYS = 1;  // Streak at risk if not logged today
const RECOVERY_WINDOW_DAYS = 2;         // Habit recovered if logged within 2 days of a miss
const MIN_LOGS_FOR_COACHING = 3;        // Need at least 3 logs to generate coaching
const MAX_INSIGHTS = 5;                  // Don't overwhelm the user

const HOUR_LABELS: Record<string, string> = {
  morning:   'morning (6–10am)',
  afternoon: 'afternoon (12–4pm)',
  evening:   'evening (6–10pm)',
  night:     'night (10pm–1am)',
};

const COACHING_TEMPLATES = {
  streak_at_risk: [
    (h: string, s: number) => `🔥 ${h} is on a ${s}-day streak! Don't let it break — log it now.`,
    (h: string, s: number) => `Your ${s}-day ${h} streak is at risk. One quick log keeps it alive.`,
    (h: string, s: number) => `${s} days strong on ${h}. You haven't logged today yet.`,
  ],
  recovery: [
    (h: string) => `Welcome back! You resumed ${h} after a miss — resilience builds the streak.`,
    (h: string) => `You bounced back on ${h}. That's what matters more than perfection.`,
    (h: string) => `${h} is back on track. Every comeback makes the habit stronger.`,
  ],
  pairing: [
    (h: string, anchor: string) => `Stack ${h} right after ${anchor} — the "already doing" cue makes it stick.`,
    (h: string, anchor: string) => `Pro tip: do ${h} immediately after ${anchor}. Habit stacking works.`,
  ],
  optimal_time: [
    (h: string, time: string) => `${h} logs are most consistent ${time}. That's your optimal window.`,
    (h: string, time: string) => `You tend to complete ${h} ${time}. Set a cue for that time.`,
  ],
};

const coachId = () => `hc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const todayStr = (d: Date) => d.toISOString().split('T')[0];

// ─── Core Analysis Functions ────────────────────────

/**
 * Detect habits at risk of breaking their streak.
 * A habit is at risk if: it has a streak >= 2 and hasn't been logged today.
 */
function detectStreaksAtRisk(input: CoachingInput): CoachingInsight[] {
  const today = todayStr(input.now || new Date());
  const insights: CoachingInsight[] = [];

  for (const habit of input.habits) {
    if (!habit.is_active && habit.is_active !== undefined) continue;

    const { current } = calculateStreak(habit.id, input.habitLogs);
    if (current < 2) continue; // Only coach on meaningful streaks

    // Check if logged today
    const loggedToday = input.habitLogs.some(
      l => l.habit_id === habit.id && l.date === today && l.completed
    );

    if (!loggedToday) {
      const templates = COACHING_TEMPLATES.streak_at_risk;
      const message = templates[Math.floor(Math.random() * templates.length)](habit.title, current);

      insights.push({
        id: coachId(),
        type: 'streak_at_risk',
        habitId: habit.id,
        habitTitle: habit.title,
        priority: current >= 7 ? 1 : current >= 3 ? 2 : 3,
        message,
        action: {
          label: 'Log Now',
          intent: 'habit_log',
          data: { habitId: habit.id, habitTitle: habit.title },
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return insights;
}

/**
 * Detect habits that just recovered after a miss.
 * A habit has recovered if: it was missed 1-2 days ago, but logged today.
 */
function detectRecoveries(input: CoachingInput): CoachingInsight[] {
  const now = input.now || new Date();
  const today = todayStr(now);
  const insights: CoachingInsight[] = [];

  for (const habit of input.habits) {
    if (!habit.is_active && habit.is_active !== undefined) continue;

    const habitLogs = input.habitLogs
      .filter(l => l.habit_id === habit.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (habitLogs.length < MIN_LOGS_FOR_COACHING) continue;

    // Check: logged today, and there was a gap 1-2 days before today
    const loggedToday = habitLogs.some(l => l.date === today && l.completed);
    if (!loggedToday) continue;

    // Find yesterday and the day before
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = localDateStr(yesterday);

    const dayBefore = new Date(now);
    dayBefore.setDate(dayBefore.getDate() - 2);
    const dayBeforeStr = localDateStr(dayBefore);

    const loggedYesterday = habitLogs.some(l => l.date === yesterdayStr && l.completed);
    const loggedDayBefore = habitLogs.some(l => l.date === dayBeforeStr && l.completed);

    // Recovery: logged today but there was a gap in the last 1-2 days
    if (!loggedYesterday || !loggedDayBefore) {
      const templates = COACHING_TEMPLATES.recovery;
      const message = templates[Math.floor(Math.random() * templates.length)](habit.title);

      insights.push({
        id: coachId(),
        type: 'recovery',
        habitId: habit.id,
        habitTitle: habit.title,
        priority: 3,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return insights;
}

/**
 * Suggest habit stacking — pair a struggling habit with a consistent anchor habit.
 */
function detectPairingSuggestions(input: CoachingInput): CoachingInsight[] {
  const insights: CoachingInsight[] = [];

  // Find "anchor" habits (high streak, very consistent)
  const anchors: Habit[] = [];
  const struggling: Habit[] = [];

  for (const habit of input.habits) {
    if (!habit.is_active && habit.is_active !== undefined) continue;

    const { current, best } = calculateStreak(habit.id, input.habitLogs);
    if (best >= 7 && current >= 3) {
      anchors.push(habit);
    } else if (current <= 1) {
      struggling.push(habit);
    }
  }

  if (anchors.length === 0 || struggling.length === 0) return insights;

  // Suggest pairing each struggling habit with the best anchor
  const bestAnchor = anchors.sort((a, b) => {
    const sa = calculateStreak(a.id, input.habitLogs).current;
    const sb = calculateStreak(b.id, input.habitLogs).current;
    return sb - sa;
  })[0];

  const templates = COACHING_TEMPLATES.pairing;

  for (const habit of struggling.slice(0, 2)) { // Max 2 pairing suggestions
    const message = templates[Math.floor(Math.random() * templates.length)](
      habit.title,
      bestAnchor.title
    );

    insights.push({
      id: coachId(),
      type: 'pairing',
      habitId: habit.id,
      habitTitle: habit.title,
      priority: 3,
      message,
      action: {
        label: 'Set Reminder',
        intent: 'habit_reminder',
        data: { habitId: habit.id, anchorHabitId: bestAnchor.id },
      },
      timestamp: new Date().toISOString(),
    });
  }

  return insights;
}

/**
 * Analyze completion time patterns and suggest optimal time for habits.
 */
function detectOptimalTimes(input: CoachingInput): CoachingInsight[] {
  const insights: CoachingInsight[] = [];

  for (const habit of input.habits) {
    if (!habit.is_active && habit.is_active !== undefined) continue;

    const habitLogs = input.habitLogs.filter(l => l.habit_id === habit.id && l.completed);
    if (habitLogs.length < MIN_LOGS_FOR_COACHING) continue;

    // Determine time distribution from logs that have timestamps
    const hourBuckets: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };

    for (const log of habitLogs) {
      // Use created_at timestamp if available, or infer from habit's time_of_day
      const ts = log.created_at || log.date;
      const hour = new Date(ts).getHours();

      if (hour >= 6 && hour < 12) hourBuckets.morning++;
      else if (hour >= 12 && hour < 18) hourBuckets.afternoon++;
      else if (hour >= 18 && hour < 22) hourBuckets.evening++;
      else hourBuckets.night++;
    }

    // If all buckets are 0 (no timestamp data), use the habit's stored time_of_day
    const totalLogs = Object.values(hourBuckets).reduce((s, v) => s + v, 0);
    if (totalLogs === 0) {
      const tod = (habit as Record<string, unknown>).time_of_day as string;
      if (tod && HOUR_LABELS[tod]) {
        // Still suggest based on stored preference
        const templates = COACHING_TEMPLATES.optimal_time;
        const message = templates[0](habit.title, HOUR_LABELS[tod]); // Use neutral template
        insights.push({
          id: coachId(),
          type: 'optimal_time',
          habitId: habit.id,
          habitTitle: habit.title,
          priority: 4,
          message,
          timestamp: new Date().toISOString(),
        });
      }
      continue;
    }

    // Find the dominant time bucket
    const bestTime = Object.entries(hourBuckets)
      .sort(([, a], [, b]) => b - a)[0];

    if (bestTime[1] < 2) continue; // Need at least 2 completions at that time

    const bestTimeLabel = HOUR_LABELS[bestTime[0]] || bestTime[0];
    const templates = COACHING_TEMPLATES.optimal_time;

    // Only suggest if there's a clear dominant time (≥60% of completions)
    if (bestTime[1] / totalLogs >= 0.6) {
      const message = templates[Math.floor(Math.random() * templates.length)](
        habit.title,
        bestTimeLabel
      );

      insights.push({
        id: coachId(),
        type: 'optimal_time',
        habitId: habit.id,
        habitTitle: habit.title,
        priority: 4,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return insights;
}

// ─── Main Entry Point ───────────────────────────────

/**
 * Generate coaching insights from habit data.
 * Returns up to MAX_INSIGHTS insights, sorted by priority.
 */
export function generateHabitCoaching(input: CoachingInput): CoachingInsight[] {
  const allInsights: CoachingInsight[] = [
    ...detectStreaksAtRisk(input),
    ...detectRecoveries(input),
    ...detectPairingSuggestions(input),
    ...detectOptimalTimes(input),
  ];

  // Sort by priority (1 = urgent, 4 = info)
  allInsights.sort((a, b) => a.priority - b.priority);

  // Deduplicate by habitId (keep highest priority per habit)
  const seen = new Set<string>();
  const deduped: CoachingInsight[] = [];
  for (const insight of allInsights) {
    const key = `${insight.habitId}:${insight.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(insight);
    }
  }

  return deduped.slice(0, MAX_INSIGHTS);
}

/**
 * Convert CoachingInsight to ProactiveSuggestion format for dashboard integration.
 */
export function coachingToSuggestion(insight: CoachingInsight) {
  return {
    id: insight.id,
    type: insight.type === 'streak_at_risk' ? 'streak_at_risk' as const
      : insight.type === 'recovery' ? 'habit_nudge' as const
      : 'habit_nudge' as const,
    priority: insight.priority,
    title: insight.habitTitle,
    message: insight.message,
    action: insight.action ? {
      label: insight.action.label,
      intent: {
        type: insight.action.intent,
        data: insight.action.data,
        summary: insight.message,
        confidence: 0.85,
      },
    } : undefined,
    dismissed: false,
    timestamp: insight.timestamp,
  };
}

// Helper — same as in useHabitsStore for date calculations
function localDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}