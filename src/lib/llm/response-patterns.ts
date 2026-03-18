/**
 * LLM Response Reliability — Pre-classifier & Post-validator
 *
 * quickClassify: Pattern-match obvious intents to skip the LLM entirely.
 * validateIntentResult: Fix common LLM output issues before execution.
 */

import type { IntentResult, IntentAction } from '../intent-engine';

// ── UUID regex for validation ──
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Pre-classifier patterns ──

interface PatternRule {
  pattern: RegExp;
  build: (match: RegExpMatchArray, userId: string) => IntentResult;
}

const PATTERNS: PatternRule[] = [
  // "spent $50 on groceries" / "spent 50 on food"
  {
    pattern: /^spent\s+\$?(\d+(?:\.\d{1,2})?)\s+(?:on\s+)?(.+)$/i,
    build: (m, userId) => expenseResult(parseFloat(m[1]), m[2], userId),
  },
  // "paid rent $1200" / "paid $50 for lunch"
  {
    pattern: /^paid\s+(?:\$?(\d+(?:\.\d{1,2})?)\s+(?:for\s+)?(.+)|(.+?)\s+\$?(\d+(?:\.\d{1,2})?))$/i,
    build: (m, userId) => {
      const amount = parseFloat(m[1] || m[4]);
      const desc = (m[2] || m[3]).trim();
      return expenseResult(amount, desc, userId);
    },
  },
  // "add milk to grocery list" / "add eggs to shopping list"
  {
    pattern: /^add\s+(.+?)\s+to\s+(?:grocery|shopping)\s*(?:list)?$/i,
    build: (m, userId) => ({
      actions: [{
        type: 'grocery_add',
        data: { user_id: userId, items: [m[1].trim()] },
        summary: `Add ${m[1].trim()} to grocery list`,
        confidence: 1.0,
      }],
      reply: `Added ${m[1].trim()} to your grocery list.`,
      needs_confirmation: false,
    }),
  },
  // "mark X done" / "mark X complete"
  {
    pattern: /^mark\s+(.+?)\s+(?:done|complete|completed|finished)$/i,
    build: (m) => ({
      actions: [{
        type: 'search',
        data: { table: 'tasks', query: m[1].trim(), intent: 'mark as done' },
        summary: `Mark "${m[1].trim()}" as done`,
        confidence: 1.0,
      }],
      reply: `Marking "${m[1].trim()}" as done...`,
      needs_confirmation: false,
    }),
  },
  // "delete task X"
  {
    pattern: /^delete\s+task\s+(.+)$/i,
    build: (m) => ({
      actions: [{
        type: 'search',
        data: { table: 'tasks', query: m[1].trim(), intent: 'delete' },
        summary: `Delete task "${m[1].trim()}"`,
        confidence: 1.0,
      }],
      reply: `Deleting task "${m[1].trim()}"...`,
      needs_confirmation: true,
    }),
  },
  // "log 8 hours sleep" / "log 3 glasses water"
  {
    pattern: /^log\s+(\d+(?:\.\d+)?)\s+(?:hours?\s+)?(?:of\s+)?(sleep|water|glasses?\s+(?:of\s+)?water)$/i,
    build: (m, userId) => {
      const value = parseFloat(m[1]);
      const metric = m[2].toLowerCase();
      const isSleep = metric.includes('sleep');
      return {
        actions: [{
          type: 'health_log',
          data: {
            user_id: userId,
            date: new Date().toISOString().split('T')[0],
            ...(isSleep ? { sleep_hours: value } : { water_glasses: value }),
          },
          summary: isSleep ? `Log ${value} hours sleep` : `Log ${value} glasses water`,
          confidence: 1.0,
        }],
        reply: isSleep ? `Logged ${value} hours of sleep.` : `Logged ${value} glasses of water.`,
        needs_confirmation: false,
      };
    },
  },
];

/**
 * Attempt to match a user message against known patterns.
 * Returns a full IntentResult if matched, or null to fall through to LLM.
 */
export function quickClassify(message: string, userId: string): IntentResult | null {
  const trimmed = message.trim();
  if (trimmed.length < 3 || trimmed.length > 200) return null;

  for (const rule of PATTERNS) {
    const match = trimmed.match(rule.pattern);
    if (match) {
      return rule.build(match, userId);
    }
  }

  return null;
}

// ── Post-validator ──

const VALID_ACTION_TYPES = new Set([
  'task', 'expense', 'income', 'bill', 'event', 'habit', 'habit_log', 'goal', 'navigate', 'info',
  'update_task', 'delete_task', 'update_event', 'delete_event', 'update_expense', 'delete_expense',
  'search', 'grocery_add', 'grocery_remove', 'grocery_clear', 'grocery_check',
  'health_log', 'meal_log', 'meditation_log', 'gratitude', 'journal',
  'log_workout', 'body_marker', 'goal_plan',
  'schedule_shift', 'reschedule_tasks', 'update_schedule_preferences',
  'business', 'create_client', 'recurring_event', 'orchestrator_tool',
]);

/**
 * Fix common LLM output issues in an IntentResult before execution.
 */
export function validateIntentResult(result: IntentResult): IntentResult {
  const seen = new Set<string>();
  const validActions: IntentAction[] = [];

  for (const action of result.actions) {
    // Drop invalid action types
    if (!VALID_ACTION_TYPES.has(action.type)) continue;

    // Fix invalid UUIDs in data
    const data = action.data as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && key.endsWith('_id') && value.length > 0 && !UUID_RE.test(value)) {
        data[key] = null;
      }
    }

    // Deduplicate by type + key fields
    const dedupeKey = `${action.type}:${data.title || data.description || data.id || ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    // Clamp confidence
    action.confidence = Math.max(0, Math.min(1, action.confidence ?? 0.5));

    validActions.push(action);
  }

  return {
    ...result,
    actions: validActions,
  };
}

// ── Helpers ──

function expenseResult(amount: number, description: string, userId: string): IntentResult {
  const desc = description.charAt(0).toUpperCase() + description.slice(1).toLowerCase().trim();
  return {
    actions: [{
      type: 'expense',
      data: {
        user_id: userId,
        amount,
        description: desc,
        date: new Date().toISOString().split('T')[0],
        is_recurring: false,
      },
      summary: `Log $${amount.toFixed(2)} expense for ${desc.toLowerCase()}`,
      confidence: 1.0,
    }],
    reply: `Logged $${amount.toFixed(2)} expense for ${desc.toLowerCase()}.`,
    needs_confirmation: false,
  };
}
