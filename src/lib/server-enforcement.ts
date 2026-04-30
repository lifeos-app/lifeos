/**
 * server-enforcement.ts — Client-side validation that mirrors server constraints
 *
 * This module validates and sanitizes records before they are synced to Supabase.
 * It enforces the same rules that the server applies via RLS policies and
 * database constraints, catching bad data on the client side before it causes
 * 400/409 errors during sync.
 *
 * Rules are declarative and extensible. Each table has a set of EnforcementRule
 * entries that define required fields, valid ranges, enum constraints, etc.
 *
 * Integration: The sync-engine calls sanitizeRecord before upserting to Supabase,
 * and validateRecord to log warnings about data that might need attention.
 */

import { logger } from '../utils/logger';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type EnforcementRuleType = 'required' | 'range' | 'enum' | 'unique' | 'custom';

export interface EnforcementRule {
  table: string;
  field: string;
  type: EnforcementRuleType;
  params: Record<string, unknown>;
  message: string;
}

export interface ValidationError {
  table: string;
  field: string;
  rule: EnforcementRuleType;
  message: string;
  value: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface EnforcementResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  sanitized: Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────────
// Built-in Rules
// ──────────────────────────────────────────────────────────────

const BUILTIN_RULES: EnforcementRule[] = [
  // ── Habits ──
  { table: 'habits', field: 'title', type: 'required', params: {}, message: 'Habit name is required' },
  { table: 'habits', field: 'name', type: 'required', params: {}, message: 'Habit name is required (legacy field)' },
  { table: 'habits', field: 'frequency', type: 'enum', params: { values: ['daily', 'weekly', 'custom'] }, message: 'Frequency must be daily, weekly, or custom' },
  { table: 'habits', field: 'streak_current', type: 'range', params: { min: 0 }, message: 'Streak must be non-negative' },
  { table: 'habits', field: 'streak_best', type: 'range', params: { min: 0 }, message: 'Best streak must be non-negative' },

  // ── Goals ──
  { table: 'goals', field: 'title', type: 'required', params: {}, message: 'Goal title is required' },
  { table: 'goals', field: 'progress', type: 'range', params: { min: 0, max: 100 }, message: 'Progress must be 0-100' },
  { table: 'goals', field: 'target_date', type: 'custom', params: { validate: 'isDateString' }, message: 'Target date must be a valid date' },

  // ── Finance (expenses) ──
  { table: 'expenses', field: 'amount', type: 'required', params: {}, message: 'Expense amount is required' },
  { table: 'expenses', field: 'type', type: 'enum', params: { values: ['income', 'expense'] }, message: 'Finance type must be income or expense' },
  { table: 'expenses', field: 'date', type: 'custom', params: { validate: 'isDateString' }, message: 'Date must be a valid date string' },

  // ── Finance (income) ──
  { table: 'income', field: 'amount', type: 'required', params: {}, message: 'Income amount is required' },
  { table: 'income', field: 'date', type: 'custom', params: { validate: 'isDateString' }, message: 'Date must be a valid date string' },

  // ── Health ──
  { table: 'health_metrics', field: 'date', type: 'required', params: {}, message: 'Health metric date is required' },
  { table: 'health_metrics', field: 'mood_score', type: 'range', params: { min: 0, max: 10 }, message: 'Mood score must be 0-10' },
  { table: 'health_metrics', field: 'energy_score', type: 'range', params: { min: 0, max: 10 }, message: 'Energy score must be 0-10' },
  { table: 'health_metrics', field: 'sleep_hours', type: 'range', params: { min: 0, max: 24 }, message: 'Sleep hours must be 0-24' },
  { table: 'health_metrics', field: 'weight_kg', type: 'range', params: { min: 0 }, message: 'Weight must be positive' },

  // ── Tasks ──
  { table: 'tasks', field: 'title', type: 'required', params: {}, message: 'Task title is required' },
  { table: 'tasks', field: 'status', type: 'enum', params: { values: ['todo', 'in_progress', 'done'] }, message: 'Task status must be todo, in_progress, or done' },
  { table: 'tasks', field: 'priority', type: 'enum', params: { values: ['low', 'medium', 'high'] }, message: 'Priority must be low, medium, or high' },

  // ── Schedule Events ──
  { table: 'events', field: 'title', type: 'required', params: {}, message: 'Event title is required' },
  {
    table: 'events', field: 'start_time_end_time', type: 'custom', params: { validate: 'startTimeBeforeEndTime' },
    message: 'Start time must be before end time',
  },
  {
    table: 'events', field: 'event_type', type: 'enum',
    params: { values: ['task', 'event', 'reminder', 'custom', 'exercise', 'workout', 'meal', 'sleep', 'meditation', 'prayer', 'education', 'travel', 'health', 'social', 'work', 'personal', 'financial', 'general', 'fasting', 'observance', 'reading'] },
    message: 'Invalid event type',
  },

  // ── Bills ──
  { table: 'bills', field: 'title', type: 'required', params: {}, message: 'Bill title is required' },
  { table: 'bills', field: 'amount', type: 'range', params: { min: 0 }, message: 'Bill amount must be non-negative' },
  { table: 'bills', field: 'due_date', type: 'custom', params: { validate: 'isDateString' }, message: 'Due date must be a valid date' },

  // ── Journal ──
  { table: 'journal_entries', field: 'date', type: 'required', params: {}, message: 'Journal date is required' },

  // ── Notes ──
  { table: 'notes', field: 'title', type: 'required', params: {}, message: 'Note title is required' },

  // ── Projects ──
  { table: 'projects', field: 'title', type: 'required', params: {}, message: 'Project title is required' },
];

// ──────────────────────────────────────────────────────────────
// Default Values (for sanitization — fills missing required fields)
// ──────────────────────────────────────────────────────────────

const DEFAULT_VALUES: Record<string, Record<string, unknown>> = {
  habits: {
    frequency: 'daily',
    streak_current: 0,
    streak_best: 0,
    is_active: true,
    is_deleted: false,
  },
  goals: {
    progress: 0,
    status: 'active',
    is_deleted: false,
  },
  expenses: {
    is_deleted: false,
  },
  income: {
    is_deleted: false,
  },
  health_metrics: {},
  tasks: {
    status: 'todo',
    priority: 'medium',
    is_deleted: false,
  },
  events: {
    event_type: 'custom',
    is_deleted: false,
  },
  bills: {
    status: 'pending',
    is_deleted: false,
  },
  journal_entries: {
    is_deleted: false,
  },
  notes: {
    is_deleted: false,
  },
  projects: {
    status: 'active',
    is_deleted: false,
  },
};

// ──────────────────────────────────────────────────────────────
// Validation Helpers
// ──────────────────────────────────────────────────────────────

function isDateString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  // Accepts ISO strings, date-only strings (YYYY-MM-DD), and timestamps
  const d = new Date(value);
  return !isNaN(d.getTime());
}

function checkStartTimeBeforeEndTime(record: Record<string, unknown>): boolean {
  const start = record.start_time;
  const end = record.end_time;
  if (typeof start !== 'string' || typeof end !== 'string') return true; // skip if missing
  return new Date(start).getTime() < new Date(end).getTime();
}

// ──────────────────────────────────────────────────────────────
// Core Functions
// ──────────────────────────────────────────────────────────────

/**
 * Validate a single record against the rules for its table.
 */
export function validateRecord(
  table: string,
  record: Record<string, unknown>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  const tableRules = BUILTIN_RULES.filter(r => r.table === table);

  for (const rule of tableRules) {
    const value = record[rule.field];

    switch (rule.type) {
      case 'required': {
        if (value === undefined || value === null || value === '') {
          // Check for alternate field names (e.g., title vs name)
          errors.push({
            table,
            field: rule.field,
            rule: 'required',
            message: rule.message,
            value,
          });
        }
        break;
      }

      case 'range': {
        if (value !== undefined && value !== null) {
          const num = Number(value);
          const min = rule.params.min as number | undefined;
          const max = rule.params.max as number | undefined;
          if (isNaN(num)) {
            errors.push({
              table,
              field: rule.field,
              rule: 'range',
              message: `${rule.field} must be a number`,
              value,
            });
          } else {
            if (min !== undefined && num < min) {
              errors.push({
                table,
                field: rule.field,
                rule: 'range',
                message: rule.message,
                value,
              });
            }
            if (max !== undefined && num > max) {
              errors.push({
                table,
                field: rule.field,
                rule: 'range',
                message: rule.message,
                value,
              });
            }
          }
        }
        break;
      }

      case 'enum': {
        if (value !== undefined && value !== null && value !== '') {
          const allowed = rule.params.values as string[];
          if (!allowed.includes(String(value))) {
            errors.push({
              table,
              field: rule.field,
              rule: 'enum',
              message: rule.message,
              value,
            });
          }
        }
        break;
      }

      case 'unique': {
        // Uniqueness is a batch constraint — skip for single record validation
        break;
      }

      case 'custom': {
        const validateType = rule.params.validate as string;
        let passed = true;

        if (validateType === 'isDateString') {
          passed = isDateString(value);
        } else if (validateType === 'startTimeBeforeEndTime') {
          passed = checkStartTimeBeforeEndTime(record);
        }

        if (!passed) {
          errors.push({
            table,
            field: rule.field,
            rule: 'custom',
            message: rule.message,
            value,
          });
        }
        break;
      }
    }
  }

  // Warn about unknown fields that might be local-only
  const knownFields = new Set(tableRules.map(r => r.field));
  for (const key of Object.keys(record)) {
    // These are always-ok fields
    if (['id', 'user_id', 'synced', 'updated_at', 'deleted_at', 'is_deleted', 'created_at', 'sync_status'].includes(key)) {
      continue;
    }
    // Don't warn — this is a permissive check, not strict schema enforcement
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate multiple records at once.
 */
export function validateBatch(
  table: string,
  records: Record<string, unknown>[]
): ValidationResult[] {
  return records.map(r => validateRecord(table, r));
}

/**
 * Sanitize a record — strip invalid fields, clamp values, fill defaults.
 * This is called before syncing to Supabase to ensure data integrity.
 */
export function sanitizeRecord(
  table: string,
  record: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = { ...record };

  // Fill default values for missing fields
  const defaults = DEFAULT_VALUES[table];
  if (defaults) {
    for (const [key, value] of Object.entries(defaults)) {
      if (sanitized[key] === undefined || sanitized[key] === null) {
        sanitized[key] = value;
      }
    }
  }

  // Apply field-level sanitization based on rules
  const tableRules = BUILTIN_RULES.filter(r => r.table === table);

  for (const rule of tableRules) {
    const value = sanitized[rule.field];
    if (value === undefined || value === null) continue;

    switch (rule.type) {
      case 'range': {
        const num = Number(value);
        if (!isNaN(num)) {
          const min = rule.params.min as number | undefined;
          const max = rule.params.max as number | undefined;
          if (min !== undefined && num < min) {
            sanitized[rule.field] = min;
          }
          if (max !== undefined && num > max) {
            sanitized[rule.field] = max;
          }
        }
        break;
      }

      case 'enum': {
        const allowed = rule.params.values as string[];
        if (!allowed.includes(String(value))) {
          // Reset to first allowed value as a safe fallback
          sanitized[rule.field] = allowed[0];
        }
        break;
      }

      case 'custom': {
        const validateType = rule.params.validate as string;
        if (validateType === 'startTimeBeforeEndTime') {
          // If start >= end, extend end by 30 min
          const start = sanitized.start_time as string;
          const end = sanitized.end_time as string;
          if (typeof start === 'string' && typeof end === 'string') {
            const startMs = new Date(start).getTime();
            const endMs = new Date(end).getTime();
            if (startMs >= endMs) {
              const newEnd = new Date(startMs + 30 * 60 * 1000);
              sanitized.end_time = newEnd.toISOString();
            }
          }
        }
        break;
      }
    }
  }

  // Ensure required boolean fields are present
  if (sanitized.is_deleted === undefined) {
    sanitized.is_deleted = false;
  }

  return sanitized;
}

/**
 * Convenience function: validate and sanitize a record.
 * Returns the enforcement result with both validation status and sanitized data.
 */
export function enforceRecord(
  table: string,
  record: Record<string, unknown>
): EnforcementResult {
  const validation = validateRecord(table, record);
  const sanitized = sanitizeRecord(table, record);

  // Log warnings for non-critical issues
  if (validation.errors.length > 0) {
    logger.warn(
      `[server-enforcement] ${table} validation: ${validation.errors.length} issue(s)`,
      validation.errors.map(e => `${e.field}: ${e.message}`).join('; ')
    );
  }

  return {
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
    sanitized,
  };
}