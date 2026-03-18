export { GoalService } from './goal-service';
export { HabitService } from './habit-service';
export { HealthService } from './health-service';
export { FinanceService } from './finance-service';
export { ScheduleService } from './schedule-service';

import { GoalService } from './goal-service';
import { HabitService } from './habit-service';
import { HealthService } from './health-service';
import { FinanceService } from './finance-service';
import { ScheduleService } from './schedule-service';

/** Unified snapshot of all features — for NPC dialogue, LLM context, cross-feature logic */
export function getLifeContext() {
  return {
    goals: GoalService.stats(),
    habits: HabitService.stats(),
    health: HealthService.stats(),
    finance: FinanceService.balance(),
    schedule: ScheduleService.stats(),
  };
}
