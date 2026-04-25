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

import { detectStreakRisk, predictScheduleSuggestions, type DetectedPattern } from './pattern-engine';
import type { Task, Habit, HabitLog, Goal, ScheduleEvent, HealthMetric, Bill } from '../types/database';
import { getShieldInfo } from './streak-shield';

// ── Types ─────────────────────────────────────────────────────────────

export type SuggestionType =
  | 'schedule_reminder'
  | 'habit_nudge'
  | 'health_warning'
  | 'goal_progress'
  | 'streak_at_risk'
  | 'predictive_schedule'
  | 'streak_shield_available'
  | 'evening_review';

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
const COOLDOWN_MS = 4 * 60 * 60 * 1000;   // base: 4h
const STORAGE_KEY = 'lifeos_proactive_suggestions_cooldown';
const ACCEPT_KEY  = 'lifeos_proactive_suggestions_accepted';

// ── Helpers ────────────────────────────────────────────────────────────

const now = () => new Date();
const todayStr = () => now().toISOString().split('T')[0];
const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};
const genId = () => `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ── Adaptive Cooldown Storage ──────────────────────────────────────────
// Shape: { [key]: { at: number; count: number } }
interface CooldownEntry { at: number; count: number; }

function getCooldownMap(): Record<string, CooldownEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Migrate old format {key: number} to new format
    const migrated: Record<string, CooldownEntry> = {};
    for (const [k, v] of Object.entries(parsed)) {
      migrated[k] = typeof v === 'number' ? { at: v, count: 1 } : (v as CooldownEntry);
    }
    return migrated;
  } catch {
    return {};
  }
}

function getAcceptMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(ACCEPT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Adaptive cooldown duration based on how many times this key was dismissed */
function cooldownDuration(count: number): number {
  if (count >= 5) return 48 * 60 * 60 * 1000; // 48h — user really doesn't want this
  if (count >= 3) return 24 * 60 * 60 * 1000; // 24h — consistently dismissed
  return COOLDOWN_MS;                           // 4h — default
}

/** Mark a suggestion id as dismissed (adaptive cooldown) */
export function dismissSuggestion(suggestionId: string): void {
  const map = getCooldownMap();
  const prev = map[suggestionId];
  map[suggestionId] = { at: Date.now(), count: (prev?.count ?? 0) + 1 };
  // Prune entries older than 72h
  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  for (const [k, v] of Object.entries(map)) {
    if (v.at < cutoff) delete map[k];
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

/** Record that the user acted on a suggestion (signals positive reception) */
export function acceptSuggestion(key: string): void {
  const map = getAcceptMap();
  map[key] = Date.now();
  // Keep 30 days of accept history
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const [k, v] of Object.entries(map)) {
    if (v < cutoff) delete map[k];
  }
  try { localStorage.setItem(ACCEPT_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

/** Check if a suggestion key is still in adaptive cooldown */
function isInCooldown(key: string): boolean {
  const map = getCooldownMap();
  const entry = map[key];
  if (!entry) return false;
  return Date.now() - entry.at < cooldownDuration(entry.count);
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

/**
 * Predictive schedule: use pattern engine to suggest optimal time blocks.
 */
function generatePredictiveSchedule(input: SuggestionInput): ProactiveSuggestion[] {
  const key = cooldownKey('predictive_schedule', 'global');
  if (isInCooldown(key)) return [];

  const slotSuggestions = predictScheduleSuggestions(
    input.tasks, input.habits, input.habitLogs, input.goals, input.bills,
  );

  if (slotSuggestions.length === 0) return [];

  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const suggestions: ProactiveSuggestion[] = [];

  for (const slot of slotSuggestions.slice(0, 2)) {  // max 2 schedule suggestions
    const slotKey = cooldownKey('predictive_schedule', slot.id);
    if (isInCooldown(slotKey)) continue;

    const dayLabel = slot.dayOfWeek >= 0 ? DAY_NAMES[slot.dayOfWeek] + 's' : 'any day';
    const timeLabel = `${slot.startTime}–${slot.endTime}`;

    suggestions.push({
      id: genId(),
      type: 'predictive_schedule',
      priority: slot.confidence > 0.7 ? 2 : 3,
      title: slot.title,
      message: `${slot.description} Best window: ${dayLabel} ${timeLabel}.`,
      action: {
        label: slot.actionLabel,
        intent: {
          type: 'schedule_prediction',
          data: {
            slot_type: slot.type,
            day_of_week: slot.dayOfWeek,
            start_time: slot.startTime,
            end_time: slot.endTime,
            confidence: Math.round(slot.confidence * 100),
            source: slot.sourcePattern,
          },
          summary: `${slot.actionLabel}: ${dayLabel} ${timeLabel}`,
          confidence: slot.confidence,
        },
      },
      dismissed: false,
      timestamp: now().toISOString(),
    });
  }

  return suggestions;
}

/**
 * Streak Shield available: check if user has shields and habits at risk
 * of losing a streak. Suggests using a Streak Shield to preserve it.
 */
function generateStreakShieldAvailable(input: SuggestionInput): ProactiveSuggestion[] {
  const shieldInfo = getShieldInfo();
  if (!shieldInfo.canUse) return []; // No shields available

  const today = todayStr();
  const activeHabits = input.habits.filter(h => h.is_active && !h.is_deleted);
  const atRisk = activeHabits.filter(h => {
    const streak = h.streak_current || 0;
    if (streak < 3) return false; // Only suggest for meaningful streaks
    // Check if not done today
    const dayLogs = input.habitLogs.filter(l => l.habit_id === h.id && l.date === today);
    const total = dayLogs.reduce((s, l) => s + (l.count || 1), 0);
    return total < (h.target_count || 1);
  });

  if (atRisk.length === 0) return [];

  // Pick the habit with the highest streak at risk
  const topRisk = atRisk.sort((a, b) => (b.streak_current || 0) - (a.streak_current || 0))[0];
  const key = cooldownKey('streak_shield_available', topRisk.id);
  if (isInCooldown(key)) return [];

  return [{
    id: genId(),
    type: 'streak_shield_available' as SuggestionType,
    priority: 1, // High priority — streak preservation
    title: `Shield Available: ${topRisk.title}`,
    message: `Your ${topRisk.streak_current}-day "${topRisk.title}" streak is at risk! Use a Streak Shield to preserve it.`,
    action: {
      label: 'Use Shield',
      intent: {
        type: 'streak_shield',
        data: {
          habit_id: topRisk.id,
          date: today,
          user_id: input.userId,
        },
        summary: `Use Streak Shield for "${topRisk.title}"`,
        confidence: 0.95,
      },
    },
    dismissed: false,
    timestamp: now().toISOString(),
  }];
}

/**
 * Evening Review suggestion: During evening hours (18:00-22:00), suggest
 * starting an evening review if the user hasn't done one today.
 * Priority 2 (lower than streak shield).
 */
function generateEveningReview(input: SuggestionInput): ProactiveSuggestion[] {
  const hour = new Date().getHours();
  // Only suggest during evening hours (18:00-22:00)
  if (hour < 18 || hour >= 22) return [];

  const key = cooldownKey('evening_review', 'daily');
  if (isInCooldown(key)) return [];

  // Check if the user has already seen an evening review suggestion today
  const TODAY_KEY = 'lifeos_evening_review_last_shown';
  const todayStr = new Date().toISOString().split('T')[0];
  try {
    const lastShown = localStorage.getItem(TODAY_KEY);
    if (lastShown === todayStr) return [];
  } catch { /* ignore */ }

  return [{
    id: genId(),
    type: 'evening_review' as SuggestionType,
    priority: 2,
    title: 'Time for your Evening Review',
    message: 'Reflect on today\'s wins and set intentions for tomorrow. A quick review builds momentum.',
    action: {
      label: 'Start Review',
      intent: {
        type: 'navigate',
        data: { route: '/sage?prompt=evening%20review' },
        summary: 'Start evening review',
        confidence: 0.9,
      },
    },
    dismissed: false,
    timestamp: new Date().toISOString(),
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
    ...generatePredictiveSchedule(input),
    ...generateStreakShieldAvailable(input),
    ...generateEveningReview(input),
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
  if (suggestion.type === 'streak_shield_available') return 'global';
  if (suggestion.type === 'evening_review') return 'daily';
  if (suggestion.type === 'predictive_schedule') {
    const slotType = data.slot_type as string;
    return slotType || 'global';
  }
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