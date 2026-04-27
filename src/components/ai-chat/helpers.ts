import {
  CheckSquare, DollarSign, Calendar, Target, Zap,
  ArrowRight, Info, ShoppingCart, Heart, Brain,
  Sun, Coffee, Activity, type LucideIcon,
} from 'lucide-react';
import type { IntentAction, RateLimitInfo } from '../../lib/intent-engine';
import type { OrchestratorToolResult } from '../../lib/llm/orchestrator';
import type { QueryResult } from '../../lib/nl-query-engine';

// ─── Chat Message Type ──────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: IntentAction[];
  needs_confirmation?: boolean;
  executed?: boolean;
  executing?: boolean;
  executionResults?: { success: boolean; message: string; successes: string[]; failures: string[] };
  follow_up?: string;
  timestamp: Date;
  isStreaming?: boolean;
  /** Structured data from orchestrator tools (rendered as rich cards) */
  orchestratorData?: OrchestratorToolResult;
  /** Whether an orchestrator tool is currently running */
  orchestratorLoading?: boolean;
  /** Thinking text from server agent (Deep Think) */
  agentThinking?: string;
  /** Tools used by server agent */
  agentToolsUsed?: string[];
  /** Whether this message was enhanced by the server agent */
  isEnhanced?: boolean;
  /** Whether agent enhancement is currently loading */
  agentLoading?: boolean;
  /** Result from NL query engine (local data query, no LLM needed) */
  nlQueryResult?: QueryResult;
}

// ─── Action Icon & Color Maps ───────────────────────────────────
export const ACTION_ICONS: Record<string, typeof CheckSquare> = {
  task: CheckSquare,
  expense: DollarSign,
  income: DollarSign,
  bill: DollarSign,
  event: Calendar,
  habit: Zap,
  habit_log: Zap,
  goal: Target,
  navigate: ArrowRight,
  info: Info,
  update_task: CheckSquare,
  delete_task: CheckSquare,
  update_event: Calendar,
  delete_event: Calendar,
  update_expense: DollarSign,
  delete_expense: DollarSign,
  search: Info,
  grocery_add: ShoppingCart,
  grocery_remove: ShoppingCart,
  grocery_clear: ShoppingCart,
  grocery_check: ShoppingCart,
  health_log: Zap,
  meal_log: Zap,
  meditation_log: Zap,
  gratitude: Heart,
  journal: Zap,
  log_workout: Zap,
  body_marker: Info,
  goal_plan: Target,
  schedule_shift: Calendar,
  reschedule_tasks: Calendar,
  update_schedule_preferences: Calendar,
  business: DollarSign,
  orchestrator_tool: Brain,
};

export const ACTION_COLORS: Record<string, string> = {
  task: '#00D4FF',
  expense: '#F97316',
  income: '#22C55E',
  bill: '#EF4444',
  event: '#A855F7',
  habit: '#FACC15',
  habit_log: '#FACC15',
  goal: '#3B82F6',
  navigate: '#6B7280',
  info: '#6B7280',
  update_task: '#FACC15',
  delete_task: '#EF4444',
  update_event: '#FACC15',
  delete_event: '#EF4444',
  update_expense: '#FACC15',
  delete_expense: '#EF4444',
  search: '#6B7280',
  grocery_add: '#39FF14',
  grocery_remove: '#EF4444',
  grocery_clear: '#EF4444',
  grocery_check: '#39FF14',
  health_log: '#F43F5E',
  meal_log: '#FDCB6E',
  meditation_log: '#A855F7',
  gratitude: '#EC4899',
  journal: '#EC4899',
  log_workout: '#39FF14',
  body_marker: '#F43F5E',
  goal_plan: '#7C5CFC',
  schedule_shift: '#F97316',
  reschedule_tasks: '#FACC15',
  update_schedule_preferences: '#6B7280',
  business: '#22C55E',
  orchestrator_tool: '#7C5CFC',
};

// ─── Page Mode Indicator ─────────────────────────────────────────
export const PAGE_MODES: Record<string, { emoji: string; label: string; color: string }> = {
  '/':         { emoji: '🏠', label: 'Dashboard', color: '#00D4FF' },
  '/health':   { emoji: '🏋️', label: 'Health Mode', color: '#F43F5E' },
  '/finances': { emoji: '💰', label: 'Finance Mode', color: '#22C55E' },
  '/finance':  { emoji: '💰', label: 'Finance Mode', color: '#22C55E' },
  '/goals':    { emoji: '🎯', label: 'Goals Mode', color: '#3B82F6' },
  '/habits':   { emoji: '⚡', label: 'Habits Mode', color: '#FACC15' },
  '/schedule': { emoji: '📅', label: 'Schedule Mode', color: '#A855F7' },
  '/calendar': { emoji: '📅', label: 'Schedule Mode', color: '#A855F7' },
  '/journal':  { emoji: '📔', label: 'Journal Mode', color: '#EC4899' },
  '/reflect/journal':  { emoji: '📔', label: 'Journal Mode', color: '#EC4899' },
  '/social':   { emoji: '👥', label: 'Social Mode', color: '#F97316' },
  '/work':     { emoji: '💼', label: 'Work Mode', color: '#00D4FF' },
  '/business': { emoji: '💼', label: 'Business Mode', color: '#22C55E' },
  '/grocery':  { emoji: '🛒', label: 'Grocery Mode', color: '#39FF14' },
  '/review':   { emoji: '📊', label: 'Review Mode', color: '#7C5CFC' },
  '/reflect/review':   { emoji: '📊', label: 'Review Mode', color: '#7C5CFC' },
  '/reflect':  { emoji: '📖', label: 'Reflect Mode', color: '#EC4899' },
  '/settings': { emoji: '⚙️', label: 'Settings', color: '#6B7280' },
};

// ─── Suggestion Chips ────────────────────────────────────────────
export interface SuggestionChip {
  icon: LucideIcon;
  label: string;
  message: string;
  color: string;
}

const DEFAULT_SUGGESTIONS: SuggestionChip[] = [
  { icon: Sun, label: 'Morning brief', message: 'Good morning! What\'s my day looking like?', color: '#FFD700' },
  { icon: Target, label: 'Goal check', message: 'How are my goals doing?', color: '#3B82F6' },
  { icon: Activity, label: 'Balance', message: 'Am I balanced? Where should I focus?', color: '#7C5CFC' },
  { icon: CheckSquare, label: 'Add task', message: 'Add task: ', color: '#00D4FF' },
  { icon: Zap, label: 'Workout', message: 'Give me a workout', color: '#39FF14' },
  { icon: Coffee, label: 'Meal ideas', message: 'What should I eat?', color: '#FDCB6E' },
];

const PAGE_SUGGESTIONS: Record<string, SuggestionChip[]> = {
  '/health': [
    { icon: Zap, label: 'Generate workout', message: 'Give me a workout', color: '#39FF14' },
    { icon: Heart, label: 'Log health', message: 'Log my health: ', color: '#F43F5E' },
    { icon: Activity, label: 'Progress', message: 'How\'s my health progress this week?', color: '#7C5CFC' },
    { icon: Coffee, label: 'Meal ideas', message: 'What should I eat?', color: '#FDCB6E' },
  ],
  '/finances': [
    { icon: DollarSign, label: 'Log expense', message: 'Spent $', color: '#F97316' },
    { icon: DollarSign, label: 'Income', message: 'Received income: ', color: '#22C55E' },
    { icon: Activity, label: 'Summary', message: 'How\'s my spending this month?', color: '#7C5CFC' },
    { icon: Target, label: 'Budget check', message: 'Am I on track with my budget?', color: '#3B82F6' },
  ],
  '/finance': [
    { icon: DollarSign, label: 'Log expense', message: 'Spent $', color: '#F97316' },
    { icon: DollarSign, label: 'Income', message: 'Received income: ', color: '#22C55E' },
    { icon: Activity, label: 'Summary', message: 'How\'s my spending this month?', color: '#7C5CFC' },
    { icon: Target, label: 'Budget check', message: 'Am I on track with my budget?', color: '#3B82F6' },
  ],
  '/goals': [
    { icon: Target, label: 'Goal check', message: 'How are my goals doing?', color: '#3B82F6' },
    { icon: Target, label: 'New goal', message: 'Create a goal: ', color: '#22C55E' },
    { icon: Brain, label: 'Goal advice', message: 'Help me prioritize my goals', color: '#7C5CFC' },
    { icon: Activity, label: 'Progress', message: 'Show me my goal progress breakdown', color: '#F97316' },
  ],
  '/schedule': [
    { icon: Calendar, label: 'Schedule event', message: 'Schedule: ', color: '#A855F7' },
    { icon: Calendar, label: 'Today', message: 'What\'s on my schedule today?', color: '#00D4FF' },
    { icon: Calendar, label: 'Optimize', message: 'Optimize my schedule', color: '#FACC15' },
    { icon: CheckSquare, label: 'Reschedule', message: 'Reschedule my overdue tasks', color: '#F97316' },
  ],
  '/calendar': [
    { icon: Calendar, label: 'Schedule event', message: 'Schedule: ', color: '#A855F7' },
    { icon: Calendar, label: 'Today', message: 'What\'s on my schedule today?', color: '#00D4FF' },
    { icon: Calendar, label: 'Optimize', message: 'Optimize my schedule', color: '#FACC15' },
    { icon: CheckSquare, label: 'Reschedule', message: 'Reschedule my overdue tasks', color: '#F97316' },
  ],
  '/habits': [
    { icon: Zap, label: 'Log habit', message: 'Log habit: ', color: '#FACC15' },
    { icon: Activity, label: 'Streaks', message: 'How are my habit streaks?', color: '#39FF14' },
    { icon: Brain, label: 'Suggestions', message: 'What habits should I build next?', color: '#7C5CFC' },
    { icon: Target, label: 'Review', message: 'Which habits am I neglecting?', color: '#F43F5E' },
  ],
  '/grocery': [
    { icon: ShoppingCart, label: 'Add items', message: 'Add to grocery list: ', color: '#39FF14' },
    { icon: Coffee, label: 'Meal plan', message: 'Plan my meals for the week and add ingredients', color: '#FDCB6E' },
    { icon: ShoppingCart, label: 'Clear checked', message: 'Clear checked items from grocery list', color: '#EF4444' },
    { icon: DollarSign, label: 'Budget', message: 'Estimate my grocery budget', color: '#F97316' },
  ],
};

/** Get contextual suggestions based on current page path */
export function getSuggestions(pathname: string): SuggestionChip[] {
  return PAGE_SUGGESTIONS[pathname] || DEFAULT_SUGGESTIONS;
}

/** @deprecated Use getSuggestions(pathname) for contextual chips */
export const SUGGESTIONS = DEFAULT_SUGGESTIONS;

// ─── Chat Memory (localStorage, per-user) ──────────────────────────────────
const CHAT_STORAGE_PREFIX = 'lifeos_chat_';
const MAX_STORED_MESSAGES = 50;

export function getChatStorageKey(userId?: string): string {
  return userId ? `${CHAT_STORAGE_PREFIX}${userId}` : `${CHAT_STORAGE_PREFIX}anon`;
}

export function loadChatHistory(userId?: string): ChatMessage[] {
  try {
    const stored = localStorage.getItem(getChatStorageKey(userId));
    if (!stored) return [];
    const parsed = JSON.parse(stored) as ChatMessage[];
    // Restore Date objects and clear stale streaming flags
    return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp), isStreaming: false }));
  } catch { return []; }
}

export function saveChatHistory(messages: ChatMessage[], userId?: string) {
  try {
    // Keep last N messages to avoid bloating localStorage
    // Strip streaming flag before saving
    const toStore = messages.slice(-MAX_STORED_MESSAGES).map(m => {
      const { isStreaming, orchestratorLoading, agentLoading, nlQueryResult, ...rest } = m;
      return rest;
    });
    localStorage.setItem(getChatStorageKey(userId), JSON.stringify(toStore));
  } catch { /* localStorage full — ignore */ }
}

// Clean up legacy shared key (one-time migration)
export function migrateLegacyChat(userId?: string) {
  try {
    const legacy = localStorage.getItem('lifeos_chat_history');
    if (legacy && userId) {
      // Only migrate if the user-specific key doesn't exist yet
      const userKey = getChatStorageKey(userId);
      if (!localStorage.getItem(userKey)) {
        localStorage.setItem(userKey, legacy);
      }
      localStorage.removeItem('lifeos_chat_history');
    }
  } catch { /* ignore */ }
}

// ─── Format Timestamp ──────────────────────────────────────────────
export function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  // For older messages, show date
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
}

// ─── Get Current Page Context ─────────────────────────────────────
export function getPageContext(pathname: string): string {
  const routes: Record<string, string> = {
    '/': 'Dashboard',
    '/tasks': 'Tasks page',
    '/calendar': 'Calendar',
    '/habits': 'Habits tracker',
    '/goals': 'Goals',
    '/finance': 'Finance tracker',
    '/health': 'Health log',
    '/grocery': 'Grocery lists',
    '/journal': 'Journal',
    '/settings': 'Settings',
    '/social': 'Social feed',
    '/business': 'Business hub',
  };

  return routes[pathname] || `Page: ${pathname}`;
}
