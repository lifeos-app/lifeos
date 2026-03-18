/**
 * Life Planner — Shared Types
 *
 * Defines the universal interfaces for anything that can be
 * planned and placed on the schedule: tasks, exercises, meals,
 * study blocks, maintenance reminders, etc.
 */

import type { ScheduleSlot } from '../smart-scheduler';

// ── Life Domains ──

export type LifeDomain =
  | 'work'
  | 'education'
  | 'exercise'
  | 'health'
  | 'nutrition'
  | 'finance'
  | 'social'
  | 'creative'
  | 'spiritual'
  | 'personal'
  | 'maintenance'
  | 'general';

// ── Scheduleable Item (universal) ──

/** Anything that can be placed on the schedule */
export interface ScheduleableItem {
  id: string;
  title: string;
  domain: LifeDomain;
  durationMinutes: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  suggestedWeek?: number;
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'any';
  recurrence?: RecurrenceRule;
  dependsOn?: string;
  metadata?: Record<string, unknown>;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: number[];   // 0=Sun … 6=Sat
  interval?: number;        // every N periods
  endDate?: string;          // ISO date
}

// ── Plan Result ──

export interface PlanResult {
  objectiveId: string;
  objectiveTitle: string;
  epicCount: number;
  goalCount: number;
  taskCount: number;
  scheduledCount: number;
  scheduleSlots: ScheduleSlot[];
  warnings: string[];
}

// ── Orchestrator Options ──

export interface PlanOptions {
  weeklyHours?: number;
  budget?: number;
  targetDate?: string;
  domains?: LifeDomain[];
  existingObjectives?: string[];
}
