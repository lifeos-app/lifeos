/**
 * Schedule Mapper — Maps ANY ScheduleableItem to calendar events
 *
 * This is the extension point that makes the Life Planner universal.
 * Tasks, exercises, meals, study blocks — all use this to get on the schedule.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildScheduleEvent, inferEventType } from '../schedule-events';
import { computeSmartSchedule, type ScheduleSlot, type ScheduleConstraints, DEFAULT_CONSTRAINTS } from '../smart-scheduler';
import type { Task, ScheduleEvent } from '../../types/database';
import type { ScheduleableItem } from './types';
import { logger } from '../../utils/logger';

/** Convert a ScheduleableItem to the Task shape that computeSmartSchedule expects */
function toTaskFormat(item: ScheduleableItem): Task {
  return {
    id: item.id,
    user_id: '',
    title: item.title,
    status: 'todo' as const,
    priority: item.priority,
    estimated_duration: item.durationMinutes,
    domain: item.domain,
    suggested_week: item.suggestedWeek,
    depends_on_task_id: item.dependsOn,
    is_deleted: false,
    created_at: new Date().toISOString(),
  } as Task;
}

/**
 * Map one-off scheduleable items to optimal time slots.
 * Returns the computed slots (caller decides whether to apply them).
 */
export function computeSlots(
  items: ScheduleableItem[],
  existingEvents: ScheduleEvent[],
  constraints?: Partial<ScheduleConstraints>,
): ScheduleSlot[] {
  const oneOff = items.filter(i => !i.recurrence);
  if (oneOff.length === 0) return [];

  const merged = { ...DEFAULT_CONSTRAINTS, ...constraints };
  return computeSmartSchedule(oneOff.map(toTaskFormat), existingEvents, merged);
}

/**
 * Create schedule events from computed slots.
 * Returns count of successfully created events.
 */
export async function applySlots(
  supabase: SupabaseClient,
  userId: string,
  slots: ScheduleSlot[],
  items: ScheduleableItem[],
): Promise<{ created: number; warnings: string[] }> {
  let created = 0;
  const warnings: string[] = [];

  for (const slot of slots) {
    const item = items.find(i => i.id === slot.taskId);
    if (!item) continue;

    const eventType = inferEventType(item.title);
    const startTime = `${slot.suggestedDate}T${slot.suggestedStartTime}:00`;
    const endMs = new Date(`${slot.suggestedDate}T${slot.suggestedStartTime}:00`).getTime() + slot.durationMinutes * 60000;
    const endTime = new Date(endMs).toISOString();

    const row = buildScheduleEvent({
      userId,
      title: item.title,
      startTime,
      endTime,
      eventType,
      source: 'system',
      description: item.metadata?.taskId ? `[task:${item.metadata.taskId}]` : undefined,
      priority: item.priority,
    });

    const { error } = await supabase
      .from('schedule_events')
      .insert(row);

    if (error) {
      warnings.push(`Failed to schedule "${item.title}": ${error.message}`);
      logger.warn('[schedule-mapper] Insert failed:', error.message);
    } else {
      created++;
    }
  }

  if (created > 0) {
    try { window.dispatchEvent(new Event('lifeos-refresh')); } catch { /* SSR safe */ }
  }

  return { created, warnings };
}

/**
 * Create recurring schedule events for an item.
 * Generates events for the next N weeks based on recurrence rule.
 */
export async function createRecurringSeries(
  supabase: SupabaseClient,
  userId: string,
  item: ScheduleableItem,
  weeksAhead: number = 4,
): Promise<{ created: number; warnings: string[] }> {
  if (!item.recurrence) return { created: 0, warnings: [] };

  const { frequency, daysOfWeek, interval = 1, endDate } = item.recurrence;
  const eventType = inferEventType(item.title);
  const preferredHour = getPreferredHour(item);

  const today = new Date();
  const end = endDate ? new Date(endDate) : new Date(today.getTime() + weeksAhead * 7 * 86400000);
  const warnings: string[] = [];
  let created = 0;

  const current = new Date(today);
  let eventCount = 0;

  while (current <= end && eventCount < 200) { // safety cap
    const dayOfWeek = current.getDay();
    const shouldSchedule =
      frequency === 'daily' ||
      (frequency === 'weekly' && (!daysOfWeek || daysOfWeek.includes(dayOfWeek))) ||
      (frequency === 'monthly' && current.getDate() === today.getDate());

    if (shouldSchedule) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      const startTime = `${dateStr}T${String(preferredHour).padStart(2, '0')}:00:00`;
      const endMs = new Date(startTime).getTime() + item.durationMinutes * 60000;

      const row = buildScheduleEvent({
        userId,
        title: item.title,
        startTime,
        endTime: new Date(endMs).toISOString(),
        eventType,
        source: 'system',
        description: `[recurring:${item.id}]`,
        priority: item.priority,
      });

      const { error } = await supabase.from('schedule_events').insert(row);
      if (error) {
        warnings.push(`Failed: ${item.title} on ${dateStr}`);
      } else {
        created++;
      }
      eventCount++;
    }

    // Advance by interval
    if (frequency === 'daily') {
      current.setDate(current.getDate() + interval);
    } else if (frequency === 'weekly') {
      current.setDate(current.getDate() + 1); // check each day, daysOfWeek filters
    } else if (frequency === 'monthly') {
      current.setMonth(current.getMonth() + interval);
    }
  }

  if (created > 0) {
    try { window.dispatchEvent(new Event('lifeos-refresh')); } catch { /* SSR safe */ }
  }

  return { created, warnings };
}

// ── Helpers ──

const PREFERRED_HOURS: Record<string, number> = {
  exercise: 7, education: 6, prayer: 5, meditation: 6,
  meal: 12, work: 10, financial: 14, health: 15,
  social: 18, personal: 16, creative: 9, nutrition: 12,
  spiritual: 5, maintenance: 14, general: 9,
};

function getPreferredHour(item: ScheduleableItem): number {
  if (item.preferredTimeOfDay === 'morning') return 7;
  if (item.preferredTimeOfDay === 'afternoon') return 14;
  if (item.preferredTimeOfDay === 'evening') return 19;
  return PREFERRED_HOURS[item.domain] || 9;
}
