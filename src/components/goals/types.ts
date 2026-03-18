import type { GoalNode } from '../../stores/useGoalsStore';
import type { GoalStatus } from '../../types/database';

export type { GoalNode, GoalStatus };

export interface GoalTask {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  goal_id: string | null;
  financial_amount: number | null;
  financial_type: string | null;
  due_date: string | null;
  completed_at: string | null;
  [key: string]: unknown;
}

export type GoalView = 'tree' | 'list' | 'vision' | 'planning';
