import { useGoalsStore, type GoalNode } from '../../stores/useGoalsStore';
import { generateTasksFromGoal } from '../goal-task-engine';

export const GoalService = {
  getActive(): GoalNode[] {
    return useGoalsStore.getState().goals.filter(g =>
      !g.is_deleted && (g.status === 'active' || g.status === 'in_progress')
    );
  },
  getById(id: string): GoalNode | undefined {
    return useGoalsStore.getState().getGoalById(id);
  },
  create(data: Partial<GoalNode>): Promise<string | null> {
    return useGoalsStore.getState().createGoal(data);
  },
  updateProgress(id: string, progress: number): Promise<void> {
    return useGoalsStore.getState().updateGoal(id, { progress });
  },
  suggestTasks(goalId: string) {
    const goal = useGoalsStore.getState().getGoalById(goalId);
    if (!goal) return Promise.resolve([]);
    return generateTasksFromGoal(goalId, goal.title, goal.description);
  },
  stats() {
    const goals = useGoalsStore.getState().goals.filter(g => !g.is_deleted);
    const active = goals.filter(g => g.status === 'active' || g.status === 'in_progress');
    const completed = goals.filter(g => g.status === 'completed' || g.status === 'done');
    const avgProgress = active.length > 0
      ? Math.round(active.reduce((s, g) => s + (g.progress ?? 0), 0) / active.length)
      : 0;
    return { total: goals.length, active: active.length, completed: completed.length, avgProgress };
  },
};
