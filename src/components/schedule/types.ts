import type { ScheduleEvent as DBScheduleEvent } from '../../types/database';
import type { ScheduleLayer } from '../../lib/schedule-events';

export interface ScheduleEvent extends DBScheduleEvent {
  schedule_layer?: string | null;
  all_day?: boolean;
  [key: string]: unknown;
}

export interface ScheduleTask {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  completed_at: string | null;
  goal_id: string | null;
  user_id: string;
  is_deleted: boolean;
  [key: string]: unknown;
}

export interface ScheduleHabit {
  id: string;
  title: string;
  icon: string | null;
  target_count: number;
  is_active: boolean;
  [key: string]: unknown;
}

export interface ScheduleBill {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  status: string;
  [key: string]: unknown;
}

export interface ScheduleGoal {
  id: string;
  title: string;
  parent_goal_id: string | null;
  type?: string;
  [key: string]: unknown;
}

export type LayerFilter = 'all' | ScheduleLayer;

export type ViewType = 'day' | 'week' | 'month' | 'timeline' | 'board';
