/**
 * Future Planning Engine
 * 
 * Computes task pipeline, goal projections, bottleneck detection,
 * and capacity analysis. Pure computation, no LLM required.
 */

import { localDateStr } from '../utils/date';

// ── TYPES ────────────────────────────────────────────────────────────────────

export interface FutureForecast {
  taskPipeline: WeeklyTaskGroup[];
  goalProjections: GoalProjection[];
  bottlenecks: BottleneckAlert[];
  capacity: CapacityAnalysis;
  generatedAt: string;
}

export interface WeeklyTaskGroup {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  tasks: PipelineTask[];
  totalTasks: number;
}

export interface PipelineTask {
  id: string;
  title: string;
  priority: string | null;
  due_date: string | null;
  goal_id: string | null;
  goalTitle: string | null;
  goalIcon: string | null;
}

export interface GoalProjection {
  goalId: string;
  goalTitle: string;
  goalIcon: string | null;
  goalColor: string | null;
  currentProgress: number;
  targetDate: string | null;
  milestones: Milestone[];
  projectedCompletion: string | null;
  daysRemaining: number | null;
  velocity: number; // tasks/week
  status: 'on-track' | 'at-risk' | 'behind' | 'ahead';
}

export interface Milestone {
  percentage: number;
  label: string;
  currentDate: string | null;
  projectedDate: string | null;
  achieved: boolean;
}

export interface BottleneckAlert {
  goalId: string;
  goalTitle: string;
  goalIcon: string | null;
  severity: 'critical' | 'warning' | 'info';
  reason: string;
  expectedProgress: number;
  actualProgress: number;
  daysOverdue: number;
}

export interface CapacityAnalysis {
  averageTasksPerDay: number;
  averageTasksPerWeek: number;
  pendingTasks: number;
  estimatedDaysToComplete: number;
  utilizationRate: number; // 0-100
  recommendation: string;
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Adjust to Sunday
  return new Date(d.setDate(diff));
}

function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return end;
}

function formatWeekLabel(weekStart: Date, weekEnd: Date): string {
  const start = weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  const end = weekEnd.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  return `${start} - ${end}`;
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00');
  const d2 = new Date(date2 + 'T00:00:00');
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

// ── MAIN FORECAST ────────────────────────────────────────────────────────────

export interface ForecastData {
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string | null;
    due_date: string | null;
    goal_id: string | null;
    completed_at: string | null;
    created_at: string;
  }>;
  goals: Array<{
    id: string;
    title: string;
    icon: string | null;
    color: string | null;
    progress: number;
    target_date: string | null;
    created_at: string;
  }>;
}

/**
 * Generate future forecast with task pipeline, goal projections,
 * bottlenecks, and capacity analysis.
 */
export function getFutureForecast(userId: string, data: ForecastData): FutureForecast {
  const today = localDateStr();

  // ── Task Pipeline ──
  const pendingTasks = data.tasks.filter(t => t.status !== 'done');
  const tasksByWeek = new Map<string, PipelineTask[]>();

  // Get next 4 weeks
  const weeks: { weekStart: Date; weekEnd: Date }[] = [];
  for (let i = 0; i < 4; i++) {
    const weekStart = getWeekStart(new Date());
    weekStart.setDate(weekStart.getDate() + i * 7);
    weeks.push({ weekStart, weekEnd: getWeekEnd(weekStart) });
  }

  weeks.forEach(({ weekStart, weekEnd }) => {
    const weekKey = localDateStr(weekStart);
    tasksByWeek.set(weekKey, []);
  });

  // Assign tasks to weeks
  pendingTasks.forEach(task => {
    const goal = task.goal_id ? data.goals.find(g => g.id === task.goal_id) : null;

    const pipelineTask: PipelineTask = {
      id: task.id,
      title: task.title,
      priority: task.priority,
      due_date: task.due_date,
      goal_id: task.goal_id,
      goalTitle: goal?.title || null,
      goalIcon: goal?.icon || null,
    };

    // Find which week this task belongs to
    let assigned = false;
    if (task.due_date) {
      weeks.forEach(({ weekStart, weekEnd }) => {
        const weekKey = localDateStr(weekStart);
        const dueDate = new Date(task.due_date + 'T00:00:00');
        if (dueDate >= weekStart && dueDate <= weekEnd) {
          tasksByWeek.get(weekKey)!.push(pipelineTask);
          assigned = true;
        }
      });
    }

    // If no due date or outside 4-week window, add to first week
    if (!assigned) {
      const firstWeek = localDateStr(weeks[0].weekStart);
      tasksByWeek.get(firstWeek)!.push(pipelineTask);
    }
  });

  const taskPipeline: WeeklyTaskGroup[] = weeks.map(({ weekStart, weekEnd }) => {
    const weekKey = localDateStr(weekStart);
    const tasks = tasksByWeek.get(weekKey) || [];
    return {
      weekLabel: formatWeekLabel(weekStart, weekEnd),
      weekStart: weekKey,
      weekEnd: localDateStr(weekEnd),
      tasks: tasks.sort((a, b) => {
        // Sort by priority then due date
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const aPri = priorityOrder[a.priority || 'medium'] ?? 2;
        const bPri = priorityOrder[b.priority || 'medium'] ?? 2;
        if (aPri !== bPri) return aPri - bPri;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        return a.title.localeCompare(b.title);
      }),
      totalTasks: tasks.length,
    };
  });

  // ── Goal Projections ──
  const goalProjections: GoalProjection[] = data.goals
    .filter(g => g.progress < 1 && g.target_date) // Only active goals with target dates
    .map(goal => {
      const goalTasks = data.tasks.filter(t => t.goal_id === goal.id);
      const doneTasks = goalTasks.filter(t => t.status === 'done');
      const remainingTasks = goalTasks.length - doneTasks.length;

      // Calculate velocity (tasks/week over last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentCompletions = doneTasks.filter(t =>
        t.completed_at && new Date(t.completed_at) >= thirtyDaysAgo
      );
      const velocity = (recentCompletions.length / 30) * 7;

      // Project completion date
      let projectedCompletion: string | null = null;
      if (velocity > 0 && remainingTasks > 0) {
        const weeksNeeded = remainingTasks / velocity;
        projectedCompletion = addDays(today, Math.ceil(weeksNeeded * 7));
      }

      // Days remaining until target
      const daysRemaining = goal.target_date ? daysBetween(today, goal.target_date) : null;

      // Determine status
      let status: GoalProjection['status'] = 'on-track';
      if (goal.target_date && projectedCompletion) {
        const daysUntilProjected = daysBetween(today, projectedCompletion);
        if (daysUntilProjected > (daysRemaining || 0) + 7) status = 'behind';
        else if (daysUntilProjected > (daysRemaining || 0)) status = 'at-risk';
        else if (daysUntilProjected < (daysRemaining || 0) * 0.7) status = 'ahead';
      }

      // Calculate milestones (25%, 50%, 75%, 100%)
      const milestones: Milestone[] = [25, 50, 75, 100].map(pct => {
        const achieved = goal.progress * 100 >= pct;
        let currentDate: string | null = null;
        let projectedDate: string | null = null;

        if (achieved) {
          // Find when this milestone was achieved
          const tasksNeeded = Math.ceil((goalTasks.length * pct) / 100);
          const doneSorted = doneTasks.sort((a, b) =>
            (a.completed_at || '').localeCompare(b.completed_at || '')
          );
          if (doneSorted[tasksNeeded - 1]?.completed_at) {
            currentDate = doneSorted[tasksNeeded - 1].completed_at!.split('T')[0];
          }
        } else if (velocity > 0) {
          // Project when milestone will be achieved
          const tasksNeeded = Math.ceil((goalTasks.length * pct) / 100) - doneTasks.length;
          if (tasksNeeded > 0) {
            const weeksNeeded = tasksNeeded / velocity;
            projectedDate = addDays(today, Math.ceil(weeksNeeded * 7));
          }
        }

        return {
          percentage: pct,
          label: `${pct}% Complete`,
          currentDate,
          projectedDate,
          achieved,
        };
      });

      return {
        goalId: goal.id,
        goalTitle: goal.title,
        goalIcon: goal.icon,
        goalColor: goal.color,
        currentProgress: goal.progress,
        targetDate: goal.target_date,
        milestones,
        projectedCompletion,
        daysRemaining,
        velocity,
        status,
      };
    })
    .sort((a, b) => {
      // Sort by status (behind/at-risk first), then by days remaining
      const statusOrder: Record<string, number> = { behind: 0, 'at-risk': 1, 'on-track': 2, ahead: 3 };
      if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status];
      if (a.daysRemaining !== null && b.daysRemaining !== null) return a.daysRemaining - b.daysRemaining;
      return 0;
    });

  // ── Bottleneck Detection ──
  const bottlenecks: BottleneckAlert[] = [];

  data.goals.forEach(goal => {
    if (!goal.target_date || goal.progress >= 1) return;

    const createdDate = goal.created_at?.split('T')[0] || today;
    const daysElapsed = daysBetween(createdDate, today);
    const totalDays = daysBetween(createdDate, goal.target_date);
    const expectedProgress = totalDays > 0 ? daysElapsed / totalDays : 0;
    const actualProgress = goal.progress ?? 0;

    if (actualProgress < expectedProgress * 0.7) {
      // Behind by more than 30%
      const daysOverdue = Math.round((expectedProgress - actualProgress) * totalDays);
      bottlenecks.push({
        goalId: goal.id,
        goalTitle: goal.title,
        goalIcon: goal.icon,
        severity: daysOverdue > 14 ? 'critical' : daysOverdue > 7 ? 'warning' : 'info',
        reason: `${Math.round((expectedProgress - actualProgress) * 100)}% behind schedule`,
        expectedProgress: expectedProgress * 100,
        actualProgress: actualProgress * 100,
        daysOverdue,
      });
    }
  });

  bottlenecks.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  // ── Capacity Analysis ──
  const last30Days = data.tasks.filter(t => {
    if (!t.completed_at) return false;
    const completedDate = new Date(t.completed_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return completedDate >= thirtyDaysAgo;
  });

  const averageTasksPerDay = last30Days.length / 30;
  const averageTasksPerWeek = averageTasksPerDay * 7;
  const estimatedDaysToComplete = averageTasksPerDay > 0 ? pendingTasks.length / averageTasksPerDay : Infinity;

  // Utilization rate (how much of typical capacity is being used)
  const upcomingTasksNextWeek = taskPipeline[0]?.totalTasks || 0;
  const utilizationRate = averageTasksPerWeek > 0
    ? Math.min((upcomingTasksNextWeek / averageTasksPerWeek) * 100, 100)
    : 0;

  let recommendation = '';
  if (utilizationRate > 120) {
    recommendation = 'Overloaded — consider rescheduling or delegating tasks';
  } else if (utilizationRate > 90) {
    recommendation = 'Near capacity — prioritize ruthlessly';
  } else if (utilizationRate > 60) {
    recommendation = 'Well-balanced workload';
  } else if (utilizationRate > 30) {
    recommendation = 'Light workload — good time to tackle bigger goals';
  } else {
    recommendation = 'Very light workload — consider adding stretch goals';
  }

  return {
    taskPipeline,
    goalProjections,
    bottlenecks,
    capacity: {
      averageTasksPerDay: Math.round(averageTasksPerDay * 10) / 10,
      averageTasksPerWeek: Math.round(averageTasksPerWeek * 10) / 10,
      pendingTasks: pendingTasks.length,
      estimatedDaysToComplete: Math.round(estimatedDaysToComplete),
      utilizationRate: Math.round(utilizationRate),
      recommendation,
    },
    generatedAt: new Date().toISOString(),
  };
}
