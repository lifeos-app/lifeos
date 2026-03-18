/**
 * Smart Scheduler — WS2
 *
 * Pure computation engine (no LLM calls) that spreads tasks
 * intelligently across days respecting capacity, dependencies,
 * existing events, and working hours.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Task, ScheduleEvent } from '../types/database';
import { scheduleTaskAtTime } from './task-scheduler';
import { logger } from '../utils/logger';

// ── Types ──

export interface ScheduleSlot {
  taskId: string;
  taskTitle: string;
  taskPriority: string;
  suggestedDate: string;
  suggestedStartTime: string;
  suggestedEndTime: string;
  durationMinutes: number;
  reason: string;
  conflict: boolean;
}

export interface ScheduleConstraints {
  workingHoursStart: number;
  workingHoursEnd: number;
  maxHoursPerDay: number;
  bufferMinutes: number;
}

export const DEFAULT_CONSTRAINTS: ScheduleConstraints = {
  workingHoursStart: 6,
  workingHoursEnd: 22,
  maxHoursPerDay: 3, // Keep AI-planned tasks light — max 3hrs/day to leave room for life
  bufferMinutes: 15,
};

// ── Preferred hours & duration (aligned with task-scheduler.ts) ──

const PREFERRED_HOURS: Record<string, number> = {
  education: 6, exercise: 7, prayer: 5, meditation: 6,
  meal: 12, work: 10, financial: 14, health: 15,
  social: 18, personal: 16, creative: 9, sleep: 22, general: 9,
};

const BASE_DURATIONS: Record<string, number> = {
  work: 120, education: 60, exercise: 45, health: 30,
  financial: 30, personal: 45, creative: 60, general: 60,
};

function getTaskDuration(task: Task): number {
  if (task.estimated_duration && task.estimated_duration > 0) return task.estimated_duration;
  const domain = task.domain || 'general';
  const base = BASE_DURATIONS[domain] || 60;
  if (task.priority === 'urgent') return Math.round(base * 1.5);
  if (task.priority === 'high') return Math.round(base * 1.25);
  return base;
}

function getTaskPreferredHour(task: Task): number {
  return PREFERRED_HOURS[task.domain || 'general'] || 9;
}

// ── Priority weights for sorting ──

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 4, high: 3, medium: 2, low: 1,
};

// ── Topological Sort ──

export function topologicalSort(tasks: Task[]): Task[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const visited = new Set<string>();
  const sorted: Task[] = [];
  const visiting = new Set<string>();

  function visit(id: string) {
    if (visited.has(id)) return;
    if (visiting.has(id)) return; // cycle — skip
    visiting.add(id);

    const task = taskMap.get(id);
    if (task?.depends_on_task_id && taskMap.has(task.depends_on_task_id)) {
      visit(task.depends_on_task_id);
    }

    visiting.delete(id);
    visited.add(id);
    if (task) sorted.push(task);
  }

  // Visit in priority order so higher-priority independent tasks come first
  const byPriority = [...tasks].sort((a, b) =>
    (PRIORITY_WEIGHT[b.priority || 'medium'] || 2) - (PRIORITY_WEIGHT[a.priority || 'medium'] || 2)
  );

  for (const task of byPriority) {
    visit(task.id);
  }

  return sorted;
}

// ── Core Scheduling ──

interface DaySlot {
  date: string;
  usedMinutes: number;
  events: Array<{ start: number; end: number }>; // minutes from midnight
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dateToStr(d);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildDayMap(
  existingEvents: ScheduleEvent[],
  startDate: string,
  numDays: number,
): Map<string, DaySlot> {
  const map = new Map<string, DaySlot>();

  // Init empty days
  for (let i = 0; i < numDays; i++) {
    const date = addDays(startDate, i);
    map.set(date, { date, usedMinutes: 0, events: [] });
  }

  // Fill in existing events
  for (const ev of existingEvents) {
    if (ev.is_deleted || ev.status === 'cancelled') continue;
    const date = ev.start_time?.split('T')[0];
    if (!date) continue;

    const day = map.get(date);
    if (!day) continue;

    const start = parseTimeToMinutes(ev.start_time);
    const end = parseTimeToMinutes(ev.end_time);
    if (start !== null && end !== null && end > start) {
      day.events.push({ start, end });
      day.usedMinutes += end - start;
    }
  }

  // Sort events per day
  for (const day of map.values()) {
    day.events.sort((a, b) => a.start - b.start);
  }

  return map;
}

function parseTimeToMinutes(iso: string | undefined): number | null {
  if (!iso) return null;
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function findSlot(
  day: DaySlot,
  durationMinutes: number,
  preferredStartMinutes: number,
  constraints: ScheduleConstraints,
  buffer: number,
): { start: number; end: number } | null {
  const dayStart = constraints.workingHoursStart * 60;
  const dayEnd = constraints.workingHoursEnd * 60;
  const maxMinutes = constraints.maxHoursPerDay * 60;

  if (day.usedMinutes + durationMinutes > maxMinutes) return null;

  // Try preferred time first
  if (canFit(day, preferredStartMinutes, durationMinutes, dayStart, dayEnd, buffer)) {
    return { start: preferredStartMinutes, end: preferredStartMinutes + durationMinutes };
  }

  // Scan from day start
  let candidate = dayStart;
  while (candidate + durationMinutes <= dayEnd) {
    if (canFit(day, candidate, durationMinutes, dayStart, dayEnd, buffer)) {
      return { start: candidate, end: candidate + durationMinutes };
    }
    candidate += 15; // 15-minute increments
  }

  return null;
}

function canFit(
  day: DaySlot,
  start: number,
  duration: number,
  dayStart: number,
  dayEnd: number,
  buffer: number,
): boolean {
  const end = start + duration;
  if (start < dayStart || end > dayEnd) return false;

  for (const ev of day.events) {
    const evStart = ev.start - buffer;
    const evEnd = ev.end + buffer;
    if (start < evEnd && end > evStart) return false;
  }

  return true;
}

// ── Main Export ──

export function computeSmartSchedule(
  unscheduledTasks: Task[],
  existingEvents: ScheduleEvent[],
  constraints: ScheduleConstraints = DEFAULT_CONSTRAINTS,
): ScheduleSlot[] {
  if (unscheduledTasks.length === 0) return [];

  const today = dateToStr(new Date());
  const numDays = 180; // Look 6 months ahead — AI plans can span months
  const dayMap = buildDayMap(existingEvents, today, numDays);

  // Sort tasks by dependency order
  const sorted = topologicalSort(unscheduledTasks);

  // Track where dependencies were scheduled
  const scheduledDates = new Map<string, string>(); // taskId -> date

  const slots: ScheduleSlot[] = [];

  for (const task of sorted) {
    const duration = getTaskDuration(task);
    const preferredHour = getTaskPreferredHour(task);
    const preferredMinutes = preferredHour * 60;

    // Determine earliest possible date
    let earliestDate = today;

    // If task has suggested_week, start from that week + spread by priority
    if (task.suggested_week && task.suggested_week > 0) {
      earliestDate = addDays(today, (task.suggested_week - 1) * 7);
      // Spread within the week by priority to avoid clustering on Monday
      const priorityOffset =
        task.priority === 'urgent' || task.priority === 'high' ? 0 :  // Mon-Tue
        task.priority === 'medium' ? 2 :                                // Wed-Thu
        4;                                                               // Fri-Sat
      earliestDate = addDays(earliestDate, Math.min(priorityOffset, 5));
    } else if (task.due_date) {
      // No suggested_week — infer from due_date: schedule well before the deadline
      const daysUntilDue = Math.max(1, Math.floor(
        (new Date(task.due_date + 'T12:00:00').getTime() - Date.now()) / 86400000
      ));
      // Start at 60% of the way to the deadline (leave buffer)
      const startOffset = Math.max(0, Math.floor(daysUntilDue * 0.3));
      earliestDate = addDays(today, startOffset);
    }

    // If task depends on another, must be after that task's date
    if (task.depends_on_task_id) {
      const depDate = scheduledDates.get(task.depends_on_task_id);
      if (depDate) {
        const dayAfterDep = addDays(depDate, 1);
        if (dayAfterDep > earliestDate) earliestDate = dayAfterDep;
      }
    }

    // Due date constraint
    const dueDate = task.due_date || null;

    logger.log(`[smart-scheduler] Task "${task.title}": suggested_week=${task.suggested_week}, earliestDate=${earliestDate}, duration=${duration}min, preferred=${preferredHour}:00`);

    // Search for a slot
    let found = false;
    for (let dayOffset = 0; dayOffset < numDays; dayOffset++) {
      const candidateDate = addDays(earliestDate, dayOffset);
      const day = dayMap.get(candidateDate);

      if (!day) {
        // Day outside our map — create and register so subsequent tasks see booked slots
        const tempDay: DaySlot = { date: candidateDate, usedMinutes: 0, events: [] };
        dayMap.set(candidateDate, tempDay);
        const slot = findSlot(tempDay, duration, preferredMinutes, constraints, constraints.bufferMinutes);
        if (slot) {
          // Book slot in the now-registered day
          tempDay.events.push(slot);
          tempDay.events.sort((a, b) => a.start - b.start);
          tempDay.usedMinutes += duration;
          scheduledDates.set(task.id, candidateDate);
          const isConflict = dueDate ? candidateDate > dueDate : false;
          slots.push({
            taskId: task.id,
            taskTitle: task.title,
            taskPriority: task.priority || 'medium',
            suggestedDate: candidateDate,
            suggestedStartTime: minutesToTime(slot.start),
            suggestedEndTime: minutesToTime(slot.end),
            durationMinutes: duration,
            reason: isConflict ? 'Scheduled after due date (capacity overflow)' : 'Best available slot',
            conflict: isConflict,
          });
          found = true;
          break;
        }
        continue;
      }

      const slot = findSlot(day, duration, preferredMinutes, constraints, constraints.bufferMinutes);
      if (slot) {
        // Book this slot
        day.events.push(slot);
        day.events.sort((a, b) => a.start - b.start);
        day.usedMinutes += duration;
        scheduledDates.set(task.id, candidateDate);

        const isConflict = dueDate ? candidateDate > dueDate : false;
        slots.push({
          taskId: task.id,
          taskTitle: task.title,
          taskPriority: task.priority || 'medium',
          suggestedDate: candidateDate,
          suggestedStartTime: minutesToTime(slot.start),
          suggestedEndTime: minutesToTime(slot.end),
          durationMinutes: duration,
          reason: isConflict ? 'Scheduled after due date (capacity overflow)' : 'Best available slot',
          conflict: isConflict,
        });
        found = true;
        break;
      }
    }

    if (!found) {
      // Week-aware fallback: use suggested_week if available, not hardcoded
      const fallbackWeek = Math.max(task.suggested_week || 1, 1);
      const fallbackDate = addDays(today, (fallbackWeek - 1) * 7);
      logger.warn(`[smart-scheduler] No slot found for "${task.title}" in ${numDays} days from ${earliestDate} — fallback to week ${fallbackWeek}`);
      slots.push({
        taskId: task.id,
        taskTitle: task.title,
        taskPriority: task.priority || 'medium',
        suggestedDate: fallbackDate,
        suggestedStartTime: minutesToTime(preferredMinutes),
        suggestedEndTime: minutesToTime(preferredMinutes + duration),
        durationMinutes: duration,
        reason: `No available slot found — placed in week ${fallbackWeek}`,
        conflict: true,
      });
    }
  }

  return slots;
}

/**
 * Fetch all tasks under an objective, compute smart schedule, and create schedule events.
 * Used after goal_plan creation to auto-populate the user's calendar.
 */
export async function scheduleObjectiveTasks(
  supabase: SupabaseClient,
  userId: string,
  objectiveId: string,
  weeklyHours?: number,
): Promise<number> {
  // 1. Fetch all goal IDs under the objective (recursive via parent_goal_id)
  const { data: allGoals } = await supabase
    .from('goals')
    .select('id, parent_goal_id, category')
    .eq('user_id', userId)
    .eq('is_deleted', false);

  if (!allGoals?.length) return 0;

  // Build set of all goal IDs in the objective tree
  const goalIds = new Set<string>();
  const queue = [objectiveId];
  while (queue.length) {
    const parentId = queue.pop()!;
    goalIds.add(parentId);
    for (const g of allGoals) {
      if (g.parent_goal_id === parentId && !goalIds.has(g.id)) {
        goalIds.add(g.id);
        queue.push(g.id);
      }
    }
  }

  // 2. Fetch all tasks under those goals (status != done)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .neq('status', 'done')
    .in('goal_id', [...goalIds]);

  if (!tasks?.length) return 0;

  // 3. Fetch existing schedule_events for the next 6 months
  const today = dateToStr(new Date());
  const sixMonthsOut = addDays(today, 180);
  const { data: existingEvents } = await supabase
    .from('schedule_events')
    .select('*')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gte('start_time', `${today}T00:00:00`)
    .lte('start_time', `${sixMonthsOut}T23:59:59`);

  // 4. Compute schedule with adjusted constraints
  const constraints = { ...DEFAULT_CONSTRAINTS };
  if (weeklyHours && weeklyHours > 0) {
    constraints.maxHoursPerDay = Math.min(constraints.maxHoursPerDay, Math.ceil(weeklyHours / 5));
  }

  const slots = computeSmartSchedule(tasks as Task[], (existingEvents || []) as ScheduleEvent[], constraints);

  // 5. Create schedule events for each slot
  let scheduled = 0;
  for (const slot of slots) {
    const task = tasks.find(t => t.id === slot.taskId);
    if (!task) continue;

    const startTime = `${slot.suggestedDate}T${slot.suggestedStartTime}:00`;
    const endTime = `${slot.suggestedDate}T${slot.suggestedEndTime}:00`;

    const result = await scheduleTaskAtTime(supabase, userId, task as any, startTime, endTime);
    if (result) scheduled++;
  }

  if (scheduled > 0) {
    try { window.dispatchEvent(new Event('lifeos-refresh')); } catch { /* SSR safe */ }
  }

  return scheduled;
}

/** Group slots by date for UI display */
export function groupSlotsByDate(slots: ScheduleSlot[]): Map<string, ScheduleSlot[]> {
  const map = new Map<string, ScheduleSlot[]>();
  for (const slot of slots) {
    const group = map.get(slot.suggestedDate) || [];
    group.push(slot);
    map.set(slot.suggestedDate, group);
  }
  // Sort groups by date
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
