/**
 * LifeOS Intent Engine — Action Executor
 *
 * Executes structured IntentActions against the database.
 * Heavy action types are delegated to dedicated executor modules
 * (goal-plan-executor, recurring-event-expander, grocery-actions,
 * health-actions).
 */

import { supabase } from '../data-access';
import { useUserStore } from '../../stores/useUserStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { createScheduleEvent } from '../schedule-events';
import { syncNowImmediate } from '../sync-engine';
import { getErrorMessage } from '../../utils/error';
import { logger } from '../../utils/logger';
import type { IntentAction } from './types';
import { parseTimeToToday } from './shorthand-parser';
import { executeGoalPlan } from './goal-plan-executor';
import { executeRecurringEvent } from './recurring-event-expander';
import { executeGroceryAdd, executeGroceryRemove, executeGroceryClear, executeGroceryCheck } from './grocery-actions';
import {
  executeHealthLog, executeMealLog, executeMeditationLog,
  executeGratitude, executeJournal, executeLogWorkout, executeBodyMarker,
} from './health-actions';

// ─── UUID validation ─────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Data Sanitization ──────────────────────────────────────────

/** Sanitize data — null out any foreign key fields that aren't valid UUIDs */
export function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const fkFields = ['category_id', 'goal_id', 'business_id', 'parent_goal_id', 'client_id', 'project_id', 'parent_task_id', 'financial_category_id', 'habit_id', 'list_id', 'template_id'];
  const cleaned = { ...data };
  for (const field of fkFields) {
    if (cleaned[field] && typeof cleaned[field] === 'string' && !UUID_REGEX.test(cleaned[field] as string)) {
      cleaned[field] = null;
    }
  }
  return cleaned;
}

// ─── Database Search ─────────────────────────────────────────────

export async function searchDatabase(userId: string, table: string, query: string): Promise<Record<string, unknown>[]> {
  const allowedTables: Record<string, { searchCol: string; selectCols: string }> = {
    tasks: { searchCol: 'title', selectCols: 'id,title,status,due_date,priority,description' },
    schedule_events: { searchCol: 'title', selectCols: 'id,title,start_time,end_time,location,description' },
    expenses: { searchCol: 'description', selectCols: 'id,description,amount,date,category_id' },
  };

  const config = allowedTables[table];
  if (!config) return [];

  const keywords = query.split(/\s+/).filter(Boolean);
  let q = supabase
    .from(table)
    .select(config.selectCols)
    .eq('user_id', userId)
    .eq('is_deleted', false);

  for (const kw of keywords) {
    q = q.ilike(config.searchCol, `%${kw}%`);
  }

  const { data, error } = await q.order('created_at', { ascending: false }).limit(10);
  if (error || !data) return [];
  return data as unknown as Record<string, unknown>[];
}

// ─── Companion Schedule Event Creator ────────────────────────────

async function createCompanionEvent(opts: {
  userId: string;
  title: string;
  color?: string;
  durationMin?: number;
  startTime?: string;
}) {
  try {
    const now = new Date();
    const dur = opts.durationMin || 60;
    let start: Date;
    if (opts.startTime) {
      start = opts.startTime.includes('T') ? new Date(opts.startTime) : parseTimeToToday(opts.startTime);
    } else {
      start = now;
    }
    const end = new Date(start.getTime() + dur * 60 * 1000);
    await supabase.from('schedule_events').insert({
      user_id: opts.userId, title: opts.title,
      start_time: start.toISOString(), end_time: end.toISOString(),
      color: opts.color || '#A855F7', is_deleted: false, sync_status: 'synced',
    });
  } catch (err) {
    logger.warn('Companion event creation failed:', err);
  }
}

// ─── Main Action Executor ────────────────────────────────────────

export async function executeActions(actions: IntentAction[]): Promise<{
  successes: string[];
  failures: string[];
}> {
  const successes: string[] = [];
  const failures: string[] = [];

  for (const action of actions) {
    try {
      const data = sanitizeData(action.data as Record<string, unknown>);
      switch (action.type) {
        case 'task': {
          const { error } = await supabase.from('tasks').insert(data);
          if (error) throw error;
          successes.push(`✅ Task: ${action.summary}`);
          break;
        }
        case 'expense': {
          const { useFinanceStore } = await import('../../stores/useFinanceStore');
          const result = await useFinanceStore.getState().addExpense({
            user_id: data.user_id as string,
            amount: data.amount as number,
            date: data.date as string,
            description: data.description as string,
            category_id: (data.category_id as string) || null,
            is_deductible: (data.is_deductible as boolean) || false,
            is_recurring: (data.is_recurring as boolean) || false,
            business_id: (data.business_id as string) || null,
          });
          if (!result) throw new Error('Failed to create expense');
          successes.push(`✅ Expense: ${action.summary}`);
          await createCompanionEvent({
            userId: data.user_id as string,
            title: `💸 ${data.description || 'Expense'}: $${data.amount}`,
            color: '#F97316', durationMin: 15,
          });
          break;
        }
        case 'income': {
          const { useFinanceStore } = await import('../../stores/useFinanceStore');
          const result = await useFinanceStore.getState().addIncome({
            user_id: data.user_id as string,
            amount: data.amount as number,
            date: data.date as string,
            description: data.description as string,
            source: (data.source as string) || 'manual',
            client_id: (data.client_id as string) || null,
            is_recurring: (data.is_recurring as boolean) || false,
          });
          if (!result) throw new Error('Failed to create income');
          successes.push(`✅ Income: ${action.summary}`);
          await createCompanionEvent({
            userId: data.user_id as string,
            title: `💰 ${data.source || 'Income'}: $${data.amount}`,
            color: '#22C55E',
          });
          break;
        }
        case 'bill': {
          const { error } = await supabase.from('bills').insert(data);
          if (error) throw error;
          successes.push(`✅ Bill: ${action.summary}`);
          break;
        }
        case 'event': {
          await createScheduleEvent(supabase, {
            userId:      data.user_id as string,
            title:       String(data.title || 'Event'),
            startTime:   String(data.start_time || new Date().toISOString()),
            endTime:     data.end_time ? String(data.end_time) : null,
            description: data.description ? String(data.description) : null,
            location:    data.location ? String(data.location) : null,
            category:    data.day_type ? String(data.day_type) : null,
            color:       data.color ? String(data.color) : null,
            allDay:      data.all_day === true,
          });
          successes.push(`✅ Event: ${action.summary}`);
          break;
        }
        case 'recurring_event':
          await executeRecurringEvent(data, successes, failures);
          break;
        case 'habit': {
          const { error } = await supabase.from('habits').insert(data);
          if (error) throw error;
          successes.push(`✅ Habit: ${action.summary}`);
          break;
        }
        case 'habit_log': {
          const { error } = await supabase.from('habit_logs').insert(data);
          if (error) throw error;
          successes.push(`✅ Habit logged: ${action.summary}`);
          await createCompanionEvent({
            userId: data.user_id as string, title: `✅ ${action.summary}`, color: '#FACC15',
          });
          break;
        }
        case 'goal': {
          const { error } = await supabase.from('goals').insert(data);
          if (error) throw error;
          successes.push(`✅ Goal: ${action.summary}`);
          break;
        }
        // ─── UPDATE actions ───────────────────────────────
        case 'update_task': {
          const id = data.id as string;
          const updates = sanitizeData(data.updates as Record<string, unknown> || {});
          if (!id || !UUID_REGEX.test(id)) throw new Error('Invalid task ID');
          const { error } = await supabase.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
          if (error) throw error;
          successes.push(`✏️ Task updated: ${action.summary}`);
          break;
        }
        case 'update_event': {
          let eventId = data.id as string;
          const updates = data.updates as Record<string, unknown> || {};
          if (!eventId || !UUID_REGEX.test(eventId)) {
            const searchTitle = data.title as string || data.id as string || '';
            if (searchTitle) {
              const today = new Date();
              const dayStart = new Date(today); dayStart.setHours(0,0,0,0);
              const dayEnd = new Date(today); dayEnd.setHours(23,59,59,999);
              const { data: found } = await supabase.from('schedule_events')
                .select('id, title').eq('is_deleted', false)
                .eq('user_id', data.user_id as string)
                .ilike('title', `%${searchTitle}%`)
                .gte('start_time', dayStart.toISOString())
                .lte('start_time', dayEnd.toISOString())
                .order('start_time', { ascending: false }).limit(1);
              if (found?.length) {
                eventId = found[0].id;
              } else {
                const { data: broader } = await supabase.from('schedule_events')
                  .select('id, title').eq('is_deleted', false)
                  .ilike('title', `%${searchTitle}%`)
                  .order('start_time', { ascending: false }).limit(1);
                if (broader?.length) eventId = broader[0].id;
                else throw new Error(`Could not find event matching "${searchTitle}"`);
              }
            } else throw new Error('No event ID or title provided');
          }
          const eventUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (updates.title) eventUpdates.title = updates.title;
          if (updates.start_time) eventUpdates.start_time = updates.start_time;
          if (updates.end_time) eventUpdates.end_time = updates.end_time;
          if (updates.location !== undefined) eventUpdates.location = updates.location;
          if (updates.description !== undefined) eventUpdates.description = updates.description;
          if (updates.color) eventUpdates.color = updates.color;
          if (updates.day_type) eventUpdates.day_type = updates.day_type;
          const { error } = await supabase.from('schedule_events').update(eventUpdates).eq('id', eventId);
          if (error) throw error;
          successes.push(`✏️ Event updated: ${action.summary}`);
          break;
        }
        case 'update_expense': {
          const id = data.id as string;
          const updates = sanitizeData(data.updates as Record<string, unknown> || {});
          if (!id || !UUID_REGEX.test(id)) throw new Error('Invalid expense ID');
          const { useFinanceStore } = await import('../../stores/useFinanceStore');
          await useFinanceStore.getState().updateExpense(id, updates);
          successes.push(`✏️ Expense updated: ${action.summary}`);
          break;
        }
        // ─── DELETE actions ───────────────────────────────
        case 'delete_task': {
          const id = data.id as string;
          if (!id || !UUID_REGEX.test(id)) throw new Error('Invalid task ID');
          const { error } = await supabase.from('tasks').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
          if (error) throw error;
          successes.push(`🗑️ Task deleted: ${action.summary}`);
          break;
        }
        case 'delete_event': {
          let delEventId = data.id as string;
          if (!delEventId || !UUID_REGEX.test(delEventId)) {
            const searchTitle = data.title as string || data.id as string || '';
            if (searchTitle) {
              const { data: found } = await supabase.from('schedule_events')
                .select('id').eq('is_deleted', false)
                .ilike('title', `%${searchTitle}%`)
                .order('start_time', { ascending: false }).limit(1);
              if (found?.length) delEventId = found[0].id;
              else throw new Error(`Could not find event matching "${searchTitle}"`);
            } else throw new Error('No event ID or title provided');
          }
          const { error } = await supabase.from('schedule_events').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', delEventId);
          if (error) throw error;
          successes.push(`🗑️ Event cancelled: ${action.summary}`);
          break;
        }
        case 'delete_expense': {
          const id = data.id as string;
          if (!id || !UUID_REGEX.test(id)) throw new Error('Invalid expense ID');
          const { useFinanceStore } = await import('../../stores/useFinanceStore');
          await useFinanceStore.getState().deleteExpense(id);
          successes.push(`🗑️ Expense removed: ${action.summary}`);
          break;
        }
        // ─── GROCERY actions (delegated) ─────────────────
        case 'grocery_add':
          await executeGroceryAdd(data, successes, failures);
          break;
        case 'grocery_remove':
          await executeGroceryRemove(data, successes, failures);
          break;
        case 'grocery_clear':
          await executeGroceryClear(data, successes, failures);
          break;
        case 'grocery_check':
          await executeGroceryCheck(data, successes, failures);
          break;
        // ─── HEALTH actions (delegated) ─────────────────
        case 'health_log':
          await executeHealthLog(data, action, successes, failures);
          break;
        case 'meal_log':
          await executeMealLog(data, action, successes);
          break;
        case 'meditation_log':
          await executeMeditationLog(data, action, successes);
          break;
        case 'gratitude':
          await executeGratitude(data, action, successes);
          break;
        case 'journal':
          await executeJournal(data, action, successes);
          break;
        case 'log_workout':
          await executeLogWorkout(data, action, successes);
          break;
        case 'body_marker':
          await executeBodyMarker(data, action, successes);
          break;
        // ─── GOAL PLAN (delegated) ──────────────────────
        case 'goal_plan':
          await executeGoalPlan(data, successes, failures);
          break;
        // ─── BUSINESS actions ─────────────────────────────
        case 'business': {
          const { error } = await supabase.from('businesses').insert(data);
          if (error) throw error;
          successes.push(`🏢 ${action.summary}`);
          break;
        }
        case 'create_client': {
          const clientData: Record<string, unknown> = {
            user_id: data.user_id, name: data.name,
            business_id: data.business_id || null,
            rate: data.rate || null, rate_type: data.rate_type || 'per_clean',
            notes: data.notes || null, is_active: true,
          };
          const { error } = await supabase.from('clients').insert(clientData);
          if (error) throw error;
          successes.push(`👤 Client added: ${data.name}`);
          break;
        }
        // ─── SCHEDULE actions ─────────────────────────────
        case 'schedule_shift': {
          const shift = data as Record<string, any>;
          const shiftUserId = shift.user_id as string;
          const newPrefs = {
            shift_pattern: shift.shift_pattern || 'custom',
            wake_time: shift.wake_time || null, sleep_time: shift.sleep_time || null,
            work_blocks: shift.work_blocks || [], blocked_times: shift.blocked_times || [],
          };
          await supabase.from('user_profiles').update({
            schedule_preferences: newPrefs,
          }).eq('user_id', shiftUserId);
          if (shift.reschedule_from && shift.reschedule_rules) {
            const { data: futureTasks } = await supabase.from('tasks')
              .select('id,title,due_date,estimated_minutes')
              .eq('user_id', shiftUserId).eq('is_deleted', false).eq('status', 'todo')
              .gte('due_date', shift.reschedule_from).order('due_date');
            if (futureTasks && futureTasks.length > 0) {
              const rules = shift.reschedule_rules as Array<{task_id: string; new_due_date: string}>;
              for (const rule of rules) {
                await supabase.from('tasks').update({ due_date: rule.new_due_date }).eq('id', rule.task_id);
              }
              successes.push(`🔄 Schedule shifted: ${rules.length} tasks rescheduled to fit ${shift.shift_pattern || 'new'} pattern`);
            } else {
              successes.push(`🔄 Schedule preferences updated to ${shift.shift_pattern || 'custom'} pattern`);
            }
          } else {
            successes.push(`🔄 Schedule preferences updated: ${shift.shift_pattern || 'custom'} shift pattern saved`);
          }
          break;
        }
        case 'reschedule_tasks': {
          const reschData = data as Record<string, any>;
          const moves = reschData.moves as Array<{task_id: string; new_due_date: string}> || [];
          let moved = 0;
          for (const m of moves) {
            const { error } = await supabase.from('tasks').update({ due_date: m.new_due_date }).eq('id', m.task_id);
            if (!error) moved++;
          }
          successes.push(`📅 Rescheduled ${moved} tasks`);
          break;
        }
        case 'update_schedule_preferences': {
          const prefData = data as Record<string, any>;
          await supabase.from('user_profiles').update({
            schedule_preferences: prefData.preferences,
          }).eq('user_id', prefData.user_id);
          successes.push(`⚙️ Schedule preferences updated`);
          break;
        }
        case 'orchestrator_tool': {
          const toolName = data.tool as string;
          successes.push(`🧠 Running AI tool: ${toolName}`);
          break;
        }
        case 'navigate':
        case 'info':
          successes.push(`ℹ️ ${action.summary}`);
          break;
        default:
          failures.push(`❓ Unknown action type: ${action.type}`);
      }
    } catch (err: unknown) {
      failures.push(`❌ ${action.summary}: ${getErrorMessage(err)}`);
    }
  }

  // Sync Supabase → local IndexedDB after any successful writes
  if (successes.length > 0) {
    try {
      const { data: { session } } = await useUserStore.getState().getSessionCached();
      if (session?.user) {
        await syncNowImmediate(session.user.id);
        useGoalsStore.getState().invalidate();
        useScheduleStore.getState().invalidate();
        useHabitsStore.getState().invalidate();
        useFinanceStore.getState().invalidate();
      }
    } catch (syncErr) {
      logger.warn('[executeActions] Post-action sync failed:', syncErr);
    }
  }

  return { successes, failures };
}