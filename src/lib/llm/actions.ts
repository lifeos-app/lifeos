/**
 * LifeOS LLM Action System
 *
 * Parses AI responses for structured action intents and executes them
 * against the Supabase database.
 *
 * The AI can embed action markers in its response using JSON blocks:
 *
 *   ```action
 *   {"type":"create_task","params":{"title":"Buy coffee","priority":"medium"}}
 *   ```
 *
 * OR the system can detect intent from natural language (simpler heuristics).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createScheduleEvent } from '../schedule-events';

// ── TYPES ──────────────────────────────────────────────────────────────────────

export type AIActionType =
  | 'create_task'
  | 'log_habit'
  | 'log_health'
  | 'create_event'
  | 'log_income'
  | 'log_expense'
  | 'complete_task'
  | 'navigate';

export interface AIAction {
  type: AIActionType;
  params: Record<string, unknown>;
}

export interface AIActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ── PARSER ─────────────────────────────────────────────────────────────────────

/**
 * Parse an AI response string for embedded action blocks.
 *
 * Looks for JSON blocks fenced with ```action ... ``` or inline JSON objects
 * that match the AIAction schema.
 *
 * Returns all valid actions found in the response.
 */
export function parseAIActions(response: string): AIAction[] {
  const actions: AIAction[] = [];

  // Pattern 1: fenced action blocks
  //   ```action
  //   { "type": "create_task", "params": { ... } }
  //   ```
  const fencedPattern = /```action\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = fencedPattern.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as Partial<AIAction>;
      if (isValidAction(parsed)) {
        actions.push(parsed as AIAction);
      }
    } catch { /* skip malformed JSON */ }
  }

  // Pattern 2: [ACTION: {...}] inline markers
  const inlinePattern = /\[ACTION:\s*(\{[\s\S]*?\})\]/gi;

  while ((match = inlinePattern.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as Partial<AIAction>;
      if (isValidAction(parsed)) {
        actions.push(parsed as AIAction);
      }
    } catch { /* skip malformed JSON */ }
  }

  return actions;
}

function isValidAction(obj: Partial<AIAction>): obj is AIAction {
  const validTypes: AIActionType[] = [
    'create_task', 'log_habit', 'log_health', 'create_event',
    'log_income', 'log_expense', 'complete_task', 'navigate',
  ];
  return (
    typeof obj.type === 'string' &&
    validTypes.includes(obj.type as AIActionType) &&
    typeof obj.params === 'object' &&
    obj.params !== null
  );
}

// ── EXECUTORS ──────────────────────────────────────────────────────────────────

/**
 * Execute a single AI action against the Supabase database.
 * Returns a human-readable result string.
 */
export async function executeAIAction(
  action: AIAction,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  try {
    switch (action.type) {
      case 'create_task':
        return await execCreateTask(action.params, userId, supabase);
      case 'log_habit':
        return await execLogHabit(action.params, userId, supabase);
      case 'log_health':
        return await execLogHealth(action.params, userId, supabase);
      case 'create_event':
        return await execCreateEvent(action.params, userId, supabase);
      case 'log_income':
        return await execLogIncome(action.params, userId, supabase);
      case 'log_expense':
        return await execLogExpense(action.params, userId, supabase);
      case 'complete_task':
        return await execCompleteTask(action.params, userId, supabase);
      case 'navigate':
        return `Navigating to ${String(action.params.target ?? 'page')}...`;
      default:
        return `Unknown action type: ${String((action as AIAction).type)}`;
    }
  } catch (err) {
    return `Action failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Execute multiple AI actions in sequence and collect results.
 */
export async function executeAIActions(
  actions: AIAction[],
  userId: string,
  supabase: SupabaseClient
): Promise<string[]> {
  const results: string[] = [];
  for (const action of actions) {
    const result = await executeAIAction(action, userId, supabase);
    results.push(result);
  }
  return results;
}

// ── ACTION IMPLEMENTATIONS ─────────────────────────────────────────────────────

async function execCreateTask(
  params: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const title = String(params.title ?? 'Untitled task');
  const priority = String(params.priority ?? 'medium');
  const dueDate = params.due_date ? String(params.due_date) : null;
  const goalId = params.goal_id ? String(params.goal_id) : null;

  const { error } = await supabase.from('tasks').insert({
    user_id:   userId,
    title,
    priority,
    due_date:  dueDate,
    goal_id:   goalId,
    status:    'todo',
    is_deleted: false,
  });

  if (error) throw new Error(error.message);
  return `✅ Task created: "${title}"${dueDate ? ` (due ${dueDate})` : ''}`;
}

async function execLogHabit(
  params: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const habitId = params.habit_id ? String(params.habit_id) : null;
  const habitName = params.habit_name ? String(params.habit_name) : null;
  const date = String(params.date ?? new Date().toISOString().split('T')[0]);

  // Resolve habit by name if id not provided
  let resolvedId = habitId;
  if (!resolvedId && habitName) {
    const { data: habit } = await supabase
      .from('habits')
      .select('id')
      .eq('user_id', userId)
      .ilike('title', `%${habitName}%`)
      .maybeSingle();
    resolvedId = habit?.id ?? null;
  }

  if (!resolvedId) throw new Error('Habit not found');

  const { error } = await supabase.from('habit_logs').insert({
    user_id:  userId,
    habit_id: resolvedId,
    date,
    value:    params.value ?? 1,
    notes:    params.notes ? String(params.notes) : null,
  });

  if (error) throw new Error(error.message);
  return `🔄 Habit logged for ${date}`;
}

async function execLogHealth(
  params: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const metricType = String(params.metric_type ?? 'general');
  const value = Number(params.value ?? 0);
  const notes = params.notes ? String(params.notes) : null;
  const today = new Date().toISOString().split('T')[0];

  // Map metric types to health_metrics columns
  const columnMap: Record<string, string> = {
    mood: 'mood_score',
    energy: 'energy_score',
    sleep: 'sleep_hours',
    sleep_quality: 'sleep_quality',
    water: 'water_glasses',
    weight: 'weight_kg',
    height: 'height_cm',
  };

  const column = columnMap[metricType];
  const upsertData: Record<string, unknown> = {
    user_id: userId,
    date: today,
  };

  if (column) {
    upsertData[column] = value;
  }
  if (notes) {
    upsertData.notes = notes;
  }

  const { error } = await supabase.from('health_metrics').upsert(upsertData, {
    onConflict: 'user_id,date',
  });

  if (error) throw new Error(error.message);
  return `❤️ Health logged: ${metricType} = ${value}${column ? '' : ' (general note)'}`;
}

async function execCreateEvent(
  params: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const title = String(params.title ?? 'Event');
  const startTime = String(params.start_time ?? new Date().toISOString());

  const result = await createScheduleEvent(supabase, {
    userId,
    title,
    startTime,
    endTime:     params.end_time ? String(params.end_time) : null,
    description: params.notes ? String(params.notes) : (params.description ? String(params.description) : null),
    location:    params.location ? String(params.location) : null,
    category:    params.day_type ? String(params.day_type) : null,
    color:       params.color ? String(params.color) : null,
    allDay:      params.all_day === true,
  });

  return `📅 Event created: "${result.title}" at ${result.start_time}`;
}

async function execLogIncome(
  params: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const amount = Number(params.amount ?? 0);
  const description = String(params.description ?? 'Income');
  const date = String(params.date ?? new Date().toISOString().split('T')[0]);
  const source = params.source ? String(params.source) : 'manual';

  const { error } = await supabase.from('transactions').insert({
    user_id:     userId,
    type:        'income',
    amount,
    description,
    date,
    source,
  });

  if (error) throw new Error(error.message);
  return `💰 Income logged: $${amount.toFixed(2)} — ${description}`;
}

async function execLogExpense(
  params: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const amount = Number(params.amount ?? 0);
  const description = String(params.description ?? 'Expense');
  const date = String(params.date ?? new Date().toISOString().split('T')[0]);
  const category = params.category ? String(params.category) : null;

  const { error } = await supabase.from('transactions').insert({
    user_id:     userId,
    type:        'expense',
    amount,
    description,
    date,
    category_id: category,
  });

  if (error) throw new Error(error.message);
  return `💸 Expense logged: $${amount.toFixed(2)} — ${description}`;
}

async function execCompleteTask(
  params: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const taskId = params.task_id ? String(params.task_id) : null;
  const taskName = params.task_name ? String(params.task_name) : null;

  let query = supabase
    .from('tasks')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (taskId) {
    query = query.eq('id', taskId);
  } else if (taskName) {
    query = query.ilike('title', `%${taskName}%`);
  } else {
    throw new Error('task_id or task_name required');
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
  return `✅ Task completed: "${taskName ?? taskId}"`;
}
