/**
 * Life Planner — Public API
 *
 * The AI-powered life planning engine that maps goals, tasks,
 * exercises, meals, and anything else onto the schedule.
 *
 * Usage:
 *   import { schedulePreloadedTasks, executeFullScheduling } from '../life-planner';
 */

export { schedulePreloadedTasks, scheduleDomainItems, executeFullScheduling } from './orchestrator';
export { generateDomainContent } from './domain-generators';
export { computeSlots, applySlots, createRecurringSeries } from './schedule-mapper';
export type { PlanResult, PlanOptions, ScheduleableItem, LifeDomain, RecurrenceRule } from './types';
