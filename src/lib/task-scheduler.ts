/**
 * Task Scheduler — Auto-populate schedule from tasks
 * 
 * When tasks have due dates, they should appear on the schedule.
 * When habits are active, they should reflect on the scheduler too.
 * 
 * This module bridges the gap between:
 * - Tasks (what needs doing)
 * - Schedule (when you'll do it)
 * 
 * Philosophy: Tasks become events. Everything lives on the timeline.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildScheduleEvent, inferEventType, type ScheduleEventInput } from './schedule-events';
import { logger } from '../utils/logger';

// ── Types ──

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  goal_id: string | null;
  priority: string | null;
  status: string;
  estimated_minutes?: number;
  suggested_week?: number | null;
  domain?: string;
}

interface Habit {
  id: string;
  title: string;
  frequency: string; // daily, weekly, etc.
  preferred_time?: string; // e.g. "06:00"
  duration_minutes?: number;
  icon?: string;
}

// ── Task → Schedule Event ──

/**
 * Schedule a task as an event on its due date.
 * If no preferred time, uses smart defaults based on task type.
 * Returns the created event ID, or null if already scheduled.
 */
export async function scheduleTask(
  supabase: SupabaseClient,
  userId: string,
  task: Task,
): Promise<string | null> {
  if (!task.due_date && !task.suggested_week) return null;

  // Check if this task already has a schedule event
  const { data: existing } = await supabase
    .from('schedule_events')
    .select('id')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .like('description', `%[task:${task.id}]%`)
    .limit(1);

  if (existing?.length) return null; // Already scheduled

  // Infer event type from task title
  const eventType = inferEventType(task.title);

  // Smart time allocation based on priority and type
  const duration = task.estimated_minutes || getDefaultDuration(eventType, task.priority);
  const preferredHour = getPreferredHour(eventType);

  // Determine the target date from due_date or suggested_week
  let targetDate: string;
  if (task.due_date) {
    targetDate = task.due_date;
  } else {
    // Use suggested_week: week 1 = this week, week 2 = next week, etc.
    const today = new Date();
    const offset = ((task.suggested_week || 1) - 1) * 7;
    const target = new Date(today.getTime() + offset * 86400000);
    targetDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
  }

  const startTime = `${targetDate}T${String(preferredHour).padStart(2, '0')}:00:00`;
  const endDate = new Date(new Date(startTime).getTime() + duration * 60000);

  const input: ScheduleEventInput = {
    userId,
    title: `📋 ${task.title}`,
    startTime,
    endTime: endDate.toISOString(),
    eventType,
    source: 'system',
    description: `[task:${task.id}]${task.goal_id ? ` [goal:${task.goal_id}]` : ''}`,
    priority: task.priority,
  };

  const row = buildScheduleEvent(input);

  const { data, error } = await supabase
    .from('schedule_events')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    logger.warn('[TaskScheduler] Failed to schedule task:', error.message);
    return null;
  }

  return data?.id || null;
}

/**
 * Bulk schedule all unscheduled tasks with due dates.
 * Safe to run multiple times — skips already-scheduled tasks.
 */
export async function scheduleAllPendingTasks(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  // Fetch tasks with due_date OR suggested_week
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, goal_id, priority, status, estimated_minutes, suggested_week, domain')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .neq('status', 'done')
    .neq('status', 'completed')
    .or('due_date.not.is.null,suggested_week.not.is.null');

  if (!tasks?.length) return 0;

  // Tasks with suggested_week (no due_date) go through smart scheduler
  const simpleTasks = tasks.filter(t => t.due_date || !t.suggested_week);
  const smartTasks = tasks.filter(t => t.suggested_week && !t.due_date);

  let scheduled = 0;

  // Simple path: schedule by due_date
  for (const task of simpleTasks) {
    const result = await scheduleTask(supabase, userId, task as Task);
    if (result) scheduled++;
  }

  // Smart path: use computeSmartSchedule for week-distributed tasks
  if (smartTasks.length > 0) {
    try {
      const { computeSmartSchedule } = await import('./smart-scheduler');

      // Fetch existing events to avoid conflicts
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const { data: existingEvents } = await supabase
        .from('schedule_events')
        .select('id, start_time, end_time, is_deleted, status')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .gte('start_time', `${todayStr}T00:00:00`);

      const slots = computeSmartSchedule(
        smartTasks as any[],
        (existingEvents || []) as any[],
      );

      for (const slot of slots) {
        const task = smartTasks.find(t => t.id === slot.taskId);
        if (!task) continue;

        const slotStart = `${slot.suggestedDate}T${slot.suggestedStartTime}`;
        const slotEnd = `${slot.suggestedDate}T${slot.suggestedEndTime}`;
        const result = await scheduleTaskAtTime(supabase, userId, task as Task, slotStart, slotEnd);
        if (result) scheduled++;
      }
    } catch (e) {
      logger.warn('[TaskScheduler] Smart scheduling failed, falling back to simple:', e);
      // Fallback: schedule smart tasks through simple path
      for (const task of smartTasks) {
        const result = await scheduleTask(supabase, userId, task as Task);
        if (result) scheduled++;
      }
    }
  }

  if (scheduled > 0) {
    window.dispatchEvent(new Event('lifeos-refresh'));
  }

  return scheduled;
}

/**
 * Schedule active daily habits as recurring schedule blocks.
 * Creates events for today if they don't already exist.
 */
export async function scheduleHabitsForToday(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data: habits } = await supabase
    .from('habits')
    .select('id, title, frequency, icon')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .eq('is_active', true);

  if (!habits?.length) return 0;

  // Today's date in local time
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let scheduled = 0;

  for (const habit of habits) {
    // Only schedule daily habits (weekly etc need different logic)
    if (habit.frequency !== 'daily') continue;

    // Check if already on today's schedule
    const { data: existing } = await supabase
      .from('schedule_events')
      .select('id')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .like('description', `%[habit:${habit.id}]%`)
      .gte('start_time', `${today}T00:00:00`)
      .lte('start_time', `${today}T23:59:59`)
      .limit(1);

    if (existing?.length) continue; // Already scheduled today

    const eventType = inferEventType(habit.title);
    const duration = 30; // Default 30min for habits
    const preferredHour = getPreferredHour(eventType);

    const input: ScheduleEventInput = {
      userId,
      title: `${habit.icon || '✅'} ${habit.title}`,
      startTime: `${today}T${String(preferredHour).padStart(2, '0')}:00:00`,
      endTime: new Date(new Date(`${today}T${String(preferredHour).padStart(2, '0')}:00:00`).getTime() + duration * 60000).toISOString(),
      eventType,
      source: 'system',
      description: `[habit:${habit.id}]`,
    };

    const row = buildScheduleEvent(input);

    const { error } = await supabase
      .from('schedule_events')
      .insert(row);

    if (!error) scheduled++;
  }

  if (scheduled > 0) {
    window.dispatchEvent(new Event('lifeos-refresh'));
  }

  return scheduled;
}

/**
 * Schedule a task at a specific time (used by smart-scheduler).
 * Like scheduleTask but with explicit start/end times.
 */
export async function scheduleTaskAtTime(
  supabase: SupabaseClient,
  userId: string,
  task: Task,
  startTime: string,
  endTime: string,
): Promise<string | null> {
  // Check if already scheduled
  const { data: existing } = await supabase
    .from('schedule_events')
    .select('id')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .like('description', `%[task:${task.id}]%`)
    .limit(1);

  if (existing?.length) return null;

  const eventType = inferEventType(task.title);

  const input: ScheduleEventInput = {
    userId,
    title: `📋 ${task.title}`,
    startTime,
    endTime,
    eventType,
    source: 'system',
    description: `[task:${task.id}]${task.goal_id ? ` [goal:${task.goal_id}]` : ''}`,
    priority: task.priority,
  };

  const row = buildScheduleEvent(input);

  const { data, error } = await supabase
    .from('schedule_events')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    logger.warn('[TaskScheduler] Failed to schedule task at time:', error.message);
    return null;
  }

  return data?.id || null;
}

// ── Smart Defaults ──

function getDefaultDuration(eventType: string, priority: string | null): number {
  const base: Record<string, number> = {
    work: 120,
    education: 60,
    exercise: 45,
    health: 30,
    financial: 30,
    personal: 45,
    general: 60,
  };
  const d = base[eventType] || 60;

  // Higher priority = more time allocated
  if (priority === 'critical') return Math.round(d * 1.5);
  if (priority === 'high') return Math.round(d * 1.25);
  return d;
}

function getPreferredHour(eventType: string): number {
  // Smart time-of-day defaults based on activity type
  const defaults: Record<string, number> = {
    education: 6,   // Morning study
    exercise: 7,    // Morning workout
    prayer: 5,      // Dawn prayer
    meditation: 6,  // Early morning
    meal: 12,       // Lunchtime
    work: 10,       // Mid-morning
    financial: 14,  // Afternoon admin
    health: 15,     // Afternoon health
    social: 18,     // Evening social
    personal: 16,   // Afternoon personal
    sleep: 22,      // Night
    general: 9,     // Default morning
  };
  return defaults[eventType] || 9;
}
