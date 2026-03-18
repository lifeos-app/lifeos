/**
 * Life Planner Orchestrator — The Master Pipeline
 *
 * Owns the full plan-to-schedule flow:
 * 1. Decompose user input into hierarchy (LLM)
 * 2. Generate domain-specific content (exercises, meals, etc.)
 * 3. Create all goals and tasks
 * 4. Compute optimal schedule
 * 5. Create schedule events
 * 6. Return complete result with feedback
 *
 * This is the SINGLE entry point for plan execution.
 * All other callers (NLPDecomposer, intent-engine) should use this.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { computeSmartSchedule, type ScheduleSlot } from '../smart-scheduler';
import { scheduleTaskAtTime } from '../task-scheduler';
import { generateDomainContent } from './domain-generators';
import { createRecurringSeries } from './schedule-mapper';
import type { Task, ScheduleEvent } from '../../types/database';
import type { PlanResult, PlanOptions, ScheduleableItem } from './types';
import { logger } from '../../utils/logger';

/**
 * Schedule tasks that were just created, passing them directly
 * to avoid the race condition of re-fetching from Supabase
 * before local-first sync has completed.
 *
 * This replaces the fire-and-forget scheduleObjectiveTasks() pattern.
 */
export async function schedulePreloadedTasks(
  supabase: SupabaseClient,
  userId: string,
  tasks: Task[],
  options?: { weeklyHours?: number },
): Promise<{ scheduled: number; slots: ScheduleSlot[]; warnings: string[] }> {
  if (tasks.length === 0) return { scheduled: 0, slots: [], warnings: [] };

  // Fetch existing events for conflict avoidance
  const today = new Date();
  const todayStr = formatDate(today);
  const sixMonthsOut = formatDate(new Date(today.getTime() + 180 * 86400000));

  const { data: existingEvents } = await supabase
    .from('schedule_events')
    .select('id, start_time, end_time, is_deleted, status')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gte('start_time', `${todayStr}T00:00:00`)
    .lte('start_time', `${sixMonthsOut}T23:59:59`);

  // Compute optimal schedule — keep AI-planned tasks light (max 3hrs/day default)
  const constraints = options?.weeklyHours
    ? { maxHoursPerDay: Math.min(3, Math.ceil(options.weeklyHours / 5)) }
    : undefined;

  const slots = computeSmartSchedule(
    tasks,
    (existingEvents || []) as ScheduleEvent[],
    constraints ? { ...{ workingHoursStart: 6, workingHoursEnd: 22, maxHoursPerDay: 8, bufferMinutes: 15 }, ...constraints } : undefined,
  );

  // Create schedule events (awaited, not fire-and-forget)
  let scheduled = 0;
  const warnings: string[] = [];

  for (const slot of slots) {
    const task = tasks.find(t => t.id === slot.taskId);
    if (!task) continue;

    const startTime = `${slot.suggestedDate}T${slot.suggestedStartTime}:00`;
    const endTime = `${slot.suggestedDate}T${slot.suggestedEndTime}:00`;

    const result = await scheduleTaskAtTime(supabase, userId, task as any, startTime, endTime);
    if (result) {
      scheduled++;
    } else {
      warnings.push(`Could not schedule: ${task.title}`);
    }
  }

  if (scheduled > 0) {
    try { window.dispatchEvent(new Event('lifeos-refresh')); } catch { /* SSR safe */ }
  }

  logger.log(`[life-planner] Scheduled ${scheduled}/${tasks.length} tasks (${warnings.length} warnings)`);
  return { scheduled, slots, warnings };
}

/**
 * Schedule domain-specific items (exercises, meals, etc.)
 * alongside the main task schedule.
 */
export async function scheduleDomainItems(
  supabase: SupabaseClient,
  userId: string,
  items: ScheduleableItem[],
): Promise<{ created: number; warnings: string[] }> {
  if (items.length === 0) return { created: 0, warnings: [] };

  let totalCreated = 0;
  const allWarnings: string[] = [];

  // Handle recurring items
  const recurring = items.filter(i => i.recurrence);
  for (const item of recurring) {
    const { created, warnings } = await createRecurringSeries(supabase, userId, item);
    totalCreated += created;
    allWarnings.push(...warnings);
  }

  // One-off items would go through computeSlots + applySlots
  // (currently domain generators only produce recurring items)

  logger.log(`[life-planner] Created ${totalCreated} domain schedule events`);
  return { created: totalCreated, warnings: allWarnings };
}

/**
 * Full pipeline: generate domain content + schedule everything.
 * Called after goals/tasks are already created.
 *
 * @param tasks - The just-created tasks (passed directly, no re-fetch)
 * @param hierarchy - The decomposed hierarchy (for domain detection)
 * @param options - Planning options (weeklyHours, domains, etc.)
 */
export async function executeFullScheduling(
  supabase: SupabaseClient,
  userId: string,
  tasks: Task[],
  hierarchy: { objective: { title: string; domain: string } },
  options?: PlanOptions,
): Promise<PlanResult & { domainItemsCreated: number }> {
  const warnings: string[] = [];

  // 1. Schedule tasks
  const taskResult = await schedulePreloadedTasks(supabase, userId, tasks, {
    weeklyHours: options?.weeklyHours,
  });
  warnings.push(...taskResult.warnings);

  // 2. Generate and schedule domain content
  let domainItemsCreated = 0;
  if (options?.domains && options.domains.length > 0) {
    try {
      const { decomposeObjective } = await import('../llm/objective-decomposer');
      // We only need the hierarchy shape for domain detection, not a full decompose
      // Use a minimal hierarchy object
      const minimalHierarchy = {
        objective: { title: hierarchy.objective.title, description: '', domain: hierarchy.objective.domain, targetDate: null },
        epics: [],
      };
      const domainItems = await generateDomainContent(minimalHierarchy, options.domains);
      const domainResult = await scheduleDomainItems(supabase, userId, domainItems);
      domainItemsCreated = domainResult.created;
      warnings.push(...domainResult.warnings);
    } catch (e) {
      logger.warn('[life-planner] Domain content generation failed:', e);
      warnings.push('Domain content generation failed');
    }
  }

  return {
    objectiveId: '',
    objectiveTitle: hierarchy.objective.title,
    epicCount: 0,
    goalCount: 0,
    taskCount: tasks.length,
    scheduledCount: taskResult.scheduled,
    scheduleSlots: taskResult.slots,
    warnings,
    domainItemsCreated,
  };
}

// ── Helpers ──

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
