/**
 * LifeOS Intent Engine — Type Definitions
 *
 * Shared interfaces for the intent engine pipeline.
 */

// ─── Intent Action ─────────────────────────────────────────────

export interface IntentAction {
  type: 'task' | 'expense' | 'income' | 'bill' | 'event' | 'habit' | 'habit_log' | 'goal' | 'navigate' | 'info'
    | 'update_task' | 'delete_task' | 'update_event' | 'delete_event' | 'update_expense' | 'delete_expense'
    | 'search'
    | 'grocery_add' | 'grocery_remove' | 'grocery_clear' | 'grocery_check'
    | 'health_log' | 'meal_log' | 'meditation_log' | 'gratitude' | 'journal'
    | 'log_workout' | 'body_marker'
    | 'goal_plan'
    | 'schedule_shift' | 'reschedule_tasks' | 'update_schedule_preferences'
    | 'business' | 'create_client'
    | 'recurring_event'
    | 'orchestrator_tool';
  data: Record<string, unknown>;
  summary: string;       // Human-readable description of what will happen
  confidence: number;    // 0-1
}

// ─── Rate Limit ────────────────────────────────────────────────

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  used: number;
  resetAt: number;      // Unix timestamp
  resetIn: number;      // Seconds until reset
}

// ─── Intent Result ─────────────────────────────────────────────

export interface IntentResult {
  actions: IntentAction[];
  reply: string;          // Conversational response to the user
  needs_confirmation: boolean;
  follow_up?: string;     // Optional follow-up question
  rateLimit?: RateLimitInfo;
}

// ─── Intent Context ────────────────────────────────────────────

export interface IntentContext {
  userId: string;
  userName: string;       // display name
  today: string;          // YYYY-MM-DD
  tomorrow: string;       // YYYY-MM-DD
  currentTime: string;    // HH:MM (24h)
  utcOffset: string;      // e.g. "+11:00"
  timezone: string;
  categories: { id: string; name: string; icon: string; scope: string }[];
  businesses: { id: string; name: string; type: string; icon: string }[];
  topGoals: { id: string; title: string; category: string }[];
  goalTree: { id: string; title: string; category: string; domain: string | null; parent_goal_id: string | null; target_date: string | null; status: string }[];
  recentTasks: { id: string; title: string; status: string; due_date: string | null; priority: string }[];
  recentEvents: { id: string; title: string; start_time: string; location: string | null }[];
  recentExpenses: { id: string; description: string; amount: number; date: string; category_id: string | null }[];
  activeGroceryLists: { id: string; name: string; store: string | null; item_count: number }[];
  todayHealth: { mood_score: number | null; energy_score: number | null; sleep_hours: number | null; water_glasses: number | null; weight_kg: number | null } | null;
  habits: { id: string; title: string; streak_current: number | null }[];
  financialSummary?: string; // pre-formatted financial snapshot
  habitSuggestions?: string[]; // suggested habits to mention when relevant
}

// ─── AI Settings ───────────────────────────────────────────────

export interface AISettings {
  provider: string;
  model: string;
  proxyUrl: string;
  enabled: boolean;
}

// ─── Execute Intent Result ─────────────────────────────────────

export interface ExecuteIntentResult {
  success: boolean;
  message: string;
  successes: string[];
  failures: string[];
}