/**
 * Shared types and constants for materialization pipeline
 */

export interface MaterializeResult {
  objectivesCreated: number;
  epicsCreated: number;
  goalsCreated: number;
  tasksCreated: number;
  habitsCreated: number;
  eventsCreated: number;
  errors: string[];
}

export const SOURCE_FOUNDATION = 'onboarding_foundation';
export const SOURCE_HEALTH = 'onboarding_health';
export const SOURCE_FINANCE = 'onboarding_finance';

export const COLORS = ['#00D4FF', '#7C5CFC', '#FF6B6B', '#FFD93D', '#4ECB71', '#F97316'];
export const DAY_MS = 86400000;
export const WEEKS = 12;
