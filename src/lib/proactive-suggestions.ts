/**
 * proactive-suggestions.ts — Proactive Suggestion Engine for LifeOS
 *
 * Analyzes user data from stores and pattern engine to generate
 * smart, actionable suggestions WITHOUT the user asking.
 *
 * Suggestion types:
 *   schedule_reminder  — Upcoming events today / tonight
 *   habit_nudge        — Habits not completed in N days
 *   health_warning     — Sleep / energy consistently low
 *   goal_progress      — Nearing a goal milestone
 *   streak_at_risk     — Habit streak about to break
 *
 * Rate limits:
 *   - Max 3 suggestions per session
 *   - No repeat suggestions within 4 hours (localStorage cooldown)
 *
 * Pure functions + a single `generateProactiveSuggestions()` entry point.
 * No React, no side effects beyond localStorage reads for cooldown.
 */

import { detectStreakRisk, type DetectedPattern } from './pattern-engine';
import type { Task, Habit, HabitLog, Goal, ScheduleEvent, HealthMetric, Bill } from '../types/database';

// ── Types ─────────────────────────────────────────────────────────────

export type SuggestionType =
  | 'schedule_reminder'
  | 'habit_nudge'
  | 'health_warning'
  | 'goal_progress'
  | 'streak_at_risk';

export interface ProactiveSuggestion {
  id: string;
  type: SuggestionType;
  priority: number;       // 1 (highest) – 5 (lowest)
  title: string;
  message: string;
  action: {
    label: string;        // e.g. "Set Alarm", "Log Now"
    intent: {
      type: string;       // IntentAction type
      data: Record<string, unknown>;
      summary: string;
      confidence: number;
    };
  };
  dismissed: boolean;
  timestamp: string;
}

export interface SuggestionInput {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  events: ScheduleEvent[];
  healthMetrics: HealthMetric | null;
  bills: Bill[];
  userId: string;
}

// ── Constants ─────────────────────────────────────────────────────────

const MAX_SUGGESTIONS_PER_SESSION = 3;
const COOLDOWN_HOURS = 4;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;
const STORAGE_KEY = 'lifeos_proactive_suggestions_cooldown';

// ── Helpers ────────────────────────────────────────────────────────────

const now = () => new Date();
const todayStr = () => now().toISOString().split('T')[0];
const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};
const genId = () => `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Get the cooldown map from localStorage */
function getCooldownMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Mark a suggestion id as dismissed (cooldown) */
export function dismissSuggestion(suggestionId: string): void {
  const map = getCooldownMap();
  map[suggestionId] = Date.now();
  // Prune old entries (older than 24h)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [k, v] of Object.entries(map)) {
    if (v < cutoff) delete map[k];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch { /* localStorage full — ignore */ }
}

/** Check if a suggestion key is still in cooldown */
function isInCooldown(key: string): boolean {
  const map = getCooldownMap();
  const dismissedAt = map[key];
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < COOLDOWN_MS;
}

/** Build a unique cooldown key from suggestion type + core identifier */
function cooldownKey(type: SuggestionType, identifier: string): string {
  return `${type}:${identifier}`;
}

// ── Suggestion Generators ─────────────────────────────────────────────

/**
 * Schedule reminder: check for events happening today that haven't started yet.
 */
function generateScheduleReminders(input: SuggestionInput): ProactiveSuggestion[] {
  const today = todayStr();
  const nowIso = now().toISOString();
  const upcomingEvents = input.events.filter(e => {
    if (e.is_deleted) return false;
    // Events today that haven't ended yet
    return e.start_time && e.start_time.startsWith(today) && (e.end_time ? e.end_time > nowIso : e.start_time > nowIso);
  });

  const suggestions: ProactiveSuggestion[] = [];

  for (const event of upcomingEvents.slice(0, 2)) {
    const key = cooldownKey('schedule_reminder', event.id);
    if (isInCooldown(key)) continue;

    const startTime = new Date(event.start_time);
    const h = startTime.getHours();
    const timeLabel = h >= 17 ? 'tonight' : h >= 12 ? 'this afternoon' : 'today';
    const title = event.title || 'Upcoming Event';
    const isEvening = h >= 17;

    suggestions.push({
      id: genId(),
      type: 'schedule_reminder',
      priority: isEvening ? 2 : 3,
      title: `Upcoming: ${title}`,
      message: `You have "${title}" ${timeLabel}. Set your alarm?`,
      action: {
        label: 'Set Alarm',
        intent: {
          type: 'event',
          data: {
            title: `⏰ Alarm: ${title}`,
            start_time: new Date(startTime.getTime() - 30 * 60 * 1000).toISOString(),
            end_time: startTime.toISOString(),
            user_id: input.userId,
          },
          summary: `Set alarm for "${title}"`,
          confidence: 0.9,
        },
      },
      dismissed: false,
      timestamp: now().toISOString(),
    });
  }

  return suggestions;
}

/**
 * Habit nudge: check for active habits not completed in 3+ days.
 */
function generateHabitNudges(input: SuggestionInput): ProactiveSuggestion[] {
  const activeHabits = input.habits.filter(h => h.is_active && !h.is_deleted);
  const suggestions: ProactiveSuggestion[] = [];

  for (const habit of activeHabits) {
    const key = cooldownKey('habit_nudge', habit.id);
    if (isInCooldown(key)) continue;

    // Check logs for the last 3 days (excluding today — give them the day)
    const recentDays: string[] = [];
    for (let i = 1; i <= 3; i++) recentDays.push(daysAgo(i));

    const recentLogs = input.habitLogs.filter(
      l => l.habit_id === habit.id && recentDays.includes(l.date)
    );
    const target = habit.target_count || 1;
    const missedDays = recentDays.filter(d =>
      recentLogs.filter(l => l.date === d).reduce((s, l) => s + (l.count || 1), 0) < target
    ).length;

    if (missedDays >= 3) {
      suggestions.push({
        id: genId(),
        type: 'habit_nudge',
        priority: 2,
        title: `Habit: ${habit.title}`,
        message: `You haven't ${habit.title.toLowerCase().includes('meditat') ? 'meditated' : `done "${habit.title}"`} in 3 days. Log now to get back on track.`,
        action: {
          label: 'Log Now',
          intent: {
            type: 'habit_log',
            data: {
              habit_id: habit.id,
              date: todayStr(),
              user_id: input.userId,
            },
            summary: `Log "${habit.title}" for today`,
            confidence: 0.85,
          },
        },
        dismissed: false,
        timestamp: now().toISOString(),
      });
    }

    if (suggestions.length >= 2) break; // max 2 habit nudges
  }

  return suggestions;
}

/**
 * Health warning: check for low sleep or energy over the past 4 days.
 */
function generateHealthWarnings(input: SuggestionInput): ProactiveSuggestion[] {
  const suggestions: ProactiveSuggestion[] = [];
  const metric = input.healthMetrics;

  if (metric) {
    const key = cooldownKey('health_warning', 'sleep_low');
    if (!isInCooldown(key) && metric.sleep_hours != null && metric.sleep_hours < 6) {
      suggestions.push({
        id: genId(),
        type: 'health_warning',
        priority: 1,
        title: 'Low Sleep Alert',
        message: `Your sleep has been below 6h. Consider logging your sleep to track patterns.`,
        action: {
          label: 'Log Sleep',
          intent: {
            type: 'health_log',
            data: {
              user_id: input.userId,
              sleep_hours: 7,
              date: todayStr(),
            },
            summary: 'Log sleep for today',
            confidence: 0.8,
          },
        },
        dismissed: false,
        timestamp: now().toISOString(),
      });
    }

    const energyKey = cooldownKey('health_warning', 'energy_low');
    if (!isInCooldown(energyKey) && metric.energy_score != null && metric.energy_score <= 3) {
      suggestions.push({
        id: genId(),
        type: 'health_warning',
        priority: 3,
        title: 'Low Energy',
        message: `Your energy score is ${metric.energy_score}/5. A quick walk or meditation might help.`,
        action: {
          label: 'Log Energy',
          intent: {
            type: 'health_log',
            data: {
              user_id: input.userId,
              energy_score: 4,
              date: todayStr(),
            },
            summary: 'Update energy score',
            confidence: 0.7,
          },
        },
        dismissed: false,
        timestamp: now().toISOString(),
      });
    }
  }

  return suggestions;
}

/**
 * Goal progress: detect goals nearing completion (>= 70% progress).
 */
function generateGoalProgress(input: SuggestionInput): ProactiveSuggestion[] {
  const activeGoals = input.goals.filter(
    g => !g.is_deleted && !['completed', 'done', 'archived'].includes(g.status)
  );
  const suggestions: ProactiveSuggestion[] = [];

  for (const goal of activeGoals) {
    const key = cooldownKey('goal_progress', goal.id);
    if (isInCooldown(key)) continue;

    const progress = goal.progress ?? 0;
    if (progress >= 70 && progress < 100) {
      suggestions.push({
        id: genId(),
        type: 'goal_progress',
        priority: 4,
        title: `Goal: ${goal.title}`,
        message: `You're ${Math.round(progress)}% to your "${goal.title}" goal! Keep going.`,
        action: {
          label: 'View Goal',
          intent: {
            type: 'navigate',
            data: { route: `/goals?node=${goal.id}` },
            summary: `View goal "${goal.title}"`,
            confidence: 0.9,
          },
        },
        dismissed: false,
        timestamp: now().toISOString(),
      });
    }

    if (suggestions.length >= 2) break;
  }

  return suggestions;
}

/**
 * Streak at risk: use pattern engine's streak_risk detector + supplementary checks.
 */
function generateStreakAtRisk(input: SuggestionInput): ProactiveSuggestion[] {
  const key = cooldownKey('streak_at_risk', 'global');
  if (isInCooldown(key)) return [];

  // Use the pattern engine's existing detector
  const patterns: DetectedPattern[] = detectStreakRisk(input.habits, input.habitLogs);
  if (patterns.length === 0) {
    // Fallback: check today — habits with streaks not yet logged today
    const today = todayStr();
    const atRiskToday = input.habits.filter(h => {
      if (!h.is_active || h.is_deleted || (h.streak_current || 0) < 2) return false;
      const todayLogs = input.habitLogs.filter(l => l.habit_id === h.id && l.date === today);
      const done = todayLogs.reduce((s, l) => s + (l.count || 1), 0);
      return done < (h.target_count || 1);
    });

    if (atRiskToday.length === 0) return [];

    // Pick the highest-streak one
    const top = atRiskToday.sort((a, b) => (b.streak_current || 0) - (a.streak_current || 0))[0];
    return [{
      id: genId(),
      type: 'streak_at_risk',
      priority: 2,
      title: `Streak at Risk: ${top.title}`,
      message: `Your ${top.streak_current}-day "${top.title}" streak is at risk — log today to keep it!`,
      action: {
        label: 'Log Now',
        intent: {
          type: 'habit_log',
          data: {
            habit_id: top.id,
            date: today,
            user_id: input.userId,
          },
          summary: `Log "${top.title}" to save streak`,
          confidence: 0.95,
        },
      },
      dismissed: false,
      timestamp: now().toISOString(),
    }];
  }

  // Convert pattern engine results to proactive suggestions
  const topPattern = patterns[0];
  const habitId = topPattern.data?.habitId as string;
  const habitTitle = topPattern.data?.habitTitle as string;
  const streak = topPattern.data?.currentStreak as number;

  return [{
    id: genId(),
    type: 'streak_at_risk',
    priority: 1,
    title: `Streak at Risk: ${habitTitle}`,
    message: `Your ${streak}-day "${habitTitle}" streak is at risk — log today to keep it!`,
    action: {
      label: 'Log Now',
      intent: {
        type: 'habit_log',
        data: {
          habit_id: habitId,
          date: todayStr(),
          user_id: input.userId,
        },
        summary: `Log "${habitTitle}" to save streak`,
        confidence: 0.95,
      },
    },
    dismissed: false,
    timestamp: now().toISOString(),
  }];
}

// ── Main Entry ────────────────────────────────────────────────────────

/**
 * Generate proactive suggestions from current store data.
 * Respects rate limits: max 3 suggestions, no repeats within 4h.
 * Sorted by priority (1 = highest).
 */
export function generateProactiveSuggestions(input: SuggestionInput): ProactiveSuggestion[] {
  // Gather all raw suggestions
  const all = [
    ...generateScheduleReminders(input),
    ...generateHabitNudges(input),
    ...generateHealthWarnings(input),
    ...generateGoalProgress(input),
    ...generateStreakAtRisk(input),
  ];

  // Sort by priority (1 = highest) and limit
  return all
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_SUGGESTIONS_PER_SESSION);
}

/**
 * Check if a suggestion was previously dismissed and is still in cooldown.
 */
export function isSuggestionDismissed(suggestion: ProactiveSuggestion): boolean {
  const key = cooldownKey(suggestion.type, extractIdentifier(suggestion));
  return isInCooldown(key);
}

/** Extract a stable identifier from a suggestion for cooldown purposes */
function extractIdentifier(suggestion: ProactiveSuggestion): string {
  // Try to find the habit_id or goal_id or event-related info from the intent data
  const data = suggestion.action.intent.data;
  if (data.habit_id) return data.habit_id as string;
  if (data.goal_id) return data.goal_id as string;
  // For health warnings use the sub-key
  if (suggestion.type === 'health_warning') {
    return suggestion.message.includes('Sleep') ? 'sleep_low' : 'energy_low';
  }
  if (suggestion.type === 'streak_at_risk') return 'global';
  // Fallback to id
  return suggestion.id;
}

/**
 * Dismiss a proactive suggestion (puts it in cooldown for 4 hours).
 */
export function dismissProactiveSuggestion(suggestion: ProactiveSuggestion): void {
  const key = cooldownKey(suggestion.type, extractIdentifier(suggestion));
  dismissSuggestion(key);
}