/**
 * TCSGrowthOverview — 90-Day Growth Plan visual progress
 *
 * Shows 3 month columns with their tasks, overall progress,
 * and a "Seed Growth Plan" button if no plan exists yet.
 */

import { useEffect, useState, useMemo } from 'react';
import { Rocket, Circle, CheckCircle2, Clock, Loader2, Target } from 'lucide-react';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { seedTCSGrowthPlan } from '../../lib/tcs-growth-seed';
import { useUserStore } from '../../stores/useUserStore';
import './TCSGrowthOverview.css';

const MONTH_COLORS = ['#00D4FF', '#39FF14', '#FF6B35'];
const MONTH_LABELS = ['MONTH 1', 'MONTH 2', 'MONTH 3'];

const statusIcon = (status: string) => {
  switch (status) {
    case 'done':
    case 'completed':
      return <CheckCircle2 size={16} className="tcs-growth-task-icon tcs-growth-task-icon--done" />;
    case 'in_progress':
    case 'pending':
      return <Clock size={16} className="tcs-growth-task-icon tcs-growth-task-icon--progress" />;
    default:
      return <Circle size={16} className="tcs-growth-task-icon tcs-growth-task-icon--todo" />;
  }
};

export function TCSGrowthOverview() {
  const goals = useGoalsStore(s => s.goals);
  const fetchGoals = useGoalsStore(s => s.fetchAll);
  const getChildren = useGoalsStore(s => s.getChildren);
  const tasks = useScheduleStore(s => s.tasks);
  const fetchSchedule = useScheduleStore(s => s.fetchAll);
  const user = useUserStore(s => s.user);
  const [seeding, setSeeding] = useState(false);

  // Find parent goal
  const parentGoal = useMemo(
    () => goals.find(g => g.title === 'TCS 90-Day Growth Plan' && !g.is_deleted),
    [goals]
  );

  // Get sub-goals (Month 1, 2, 3)
  const subGoals = useMemo(
    () => parentGoal ? getChildren(parentGoal.id) : [],
    [parentGoal, getChildren]
  );

  // Sort sub-goals by title to maintain order
  const sortedSubGoals = useMemo(
    () => [...subGoals].sort((a, b) => a.title.localeCompare(b.title)),
    [subGoals]
  );

  // Map tasks per sub-goal
  const tasksPerGoal = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const sg of sortedSubGoals) {
      const goalTasks = tasks.filter(t => t.goal_id === sg.id && !t.is_deleted);
      map.set(sg.id, goalTasks);
    }
    return map;
  }, [sortedSubGoals, tasks]);

  // Overall progress
  const allPlanTasks = useMemo(
    () => sortedSubGoals.flatMap(sg => tasksPerGoal.get(sg.id) || []),
    [sortedSubGoals, tasksPerGoal]
  );
  const totalTasks = allPlanTasks.length;
  const doneTasks = allPlanTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Load data on mount
  useEffect(() => {
    fetchGoals();
    fetchSchedule();
  }, [fetchGoals, fetchSchedule]);

  // Seed handler
  const handleSeed = async () => {
    if (!user?.id) return;
    setSeeding(true);
    try {
      await seedTCSGrowthPlan(user.id);
      // Refresh both stores
      useGoalsStore.getState().invalidate();
      useScheduleStore.getState().invalidate();
    } catch (err) {
      console.error('[TCSGrowthOverview] Seed failed:', err);
    } finally {
      setSeeding(false);
    }
  };

  // ── Seed button (no plan yet) ──
  if (!parentGoal) {
    return (
      <div className="tcs-growth-card">
        <div className="tcs-growth-header">
          <div className="tcs-growth-header-left">
            <Rocket size={18} className="tcs-growth-icon" />
            <h3 className="tcs-growth-title">90-Day Growth Plan</h3>
          </div>
        </div>
        <div className="tcs-growth-empty">
          <p className="tcs-growth-empty-text">
            No growth plan seeded yet. Plant your 90-day roadmap for TCS with structured milestones and tasks.
          </p>
          <button
            className="tcs-growth-seed-btn"
            onClick={handleSeed}
            disabled={seeding || !user?.id}
          >
            {seeding ? (
              <Loader2 size={16} className="tcs-growth-spin" />
            ) : (
              <Rocket size={16} />
            )}
            {seeding ? 'Seeding...' : 'Seed Growth Plan'}
          </button>
        </div>
      </div>
    );
  }

  // ── Plan overview ──
  return (
    <div className="tcs-growth-card">
      {/* Header */}
      <div className="tcs-growth-header">
        <div className="tcs-growth-header-left">
          <Rocket size={18} className="tcs-growth-icon" />
          <h3 className="tcs-growth-title">90-Day Growth Plan</h3>
        </div>
        <div className="tcs-growth-header-right">
          <span className="tcs-growth-progress-label">
            {doneTasks}/{totalTasks} complete
          </span>
          <span className="tcs-growth-progress-pct">{progressPercent}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="tcs-growth-progress-bar">
        <div
          className="tcs-growth-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Month columns */}
      <div className="tcs-growth-months">
        {sortedSubGoals.map((sg, i) => {
          const monthTasks = tasksPerGoal.get(sg.id) || [];
          const monthDone = monthTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
          const monthTotal = monthTasks.length;
          const color = MONTH_COLORS[i] || '#00D4FF';

          return (
            <div key={sg.id} className="tcs-growth-month">
              <div className="tcs-growth-month-header">
                <span className="tcs-growth-month-label" style={{ color }}>
                  {MONTH_LABELS[i] || `MONTH ${i + 1}`}
                </span>
                <span className="tcs-growth-month-count">
                  {monthDone}/{monthTotal}
                </span>
              </div>
              <p className="tcs-growth-month-subtitle">{sg.description || ''}</p>

              {/* Task list */}
              <div className="tcs-growth-tasks">
                {monthTasks.map(task => (
                  <div
                    key={task.id}
                    className={`tcs-growth-task ${
                      task.status === 'done' || task.status === 'completed'
                        ? 'tcs-growth-task--done'
                        : task.status === 'in_progress'
                        ? 'tcs-growth-task--progress'
                        : ''
                    }`}
                  >
                    {statusIcon(task.status)}
                    <span className="tcs-growth-task-title">{task.title}</span>
                    {task.priority === 'urgent' && (
                      <span className="tcs-growth-task-priority tcs-growth-task-priority--urgent">!</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Month mini progress */}
              <div className="tcs-growth-month-bar">
                <div
                  className="tcs-growth-month-bar-fill"
                  style={{
                    width: `${monthTotal > 0 ? (monthDone / monthTotal) * 100 : 0}%`,
                    background: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Target date footer */}
      {parentGoal.target_date && (
        <div className="tcs-growth-footer">
          <Target size={14} className="tcs-growth-footer-icon" />
          <span className="tcs-growth-footer-text">
            Target: {parentGoal.target_date}
          </span>
        </div>
      )}
    </div>
  );
}