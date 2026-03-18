/**
 * Future Planning Panel
 * 
 * Shows goal timeline, milestone forecasts, task pipeline, bottleneck alerts,
 * and capacity analysis. Appears as a tab/section on the Goals page.
 */

import { useMemo, useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Clock,
  Target,
  Activity,
  Zap,
  Package,
} from 'lucide-react';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useUserStore } from '../../stores/useUserStore';
import { getFutureForecast } from '../../lib/planning-engine';
import { EmojiIcon } from '../../lib/emoji-icon';
// Auto-schedule is now available to all users (previously gated behind isDevFeatureEnabled)
import { computeSmartSchedule, DEFAULT_CONSTRAINTS, type ScheduleSlot } from '../../lib/smart-scheduler';
import { SmartSchedulePanel } from './SmartSchedulePanel';
import { scheduleTaskAtTime } from '../../lib/task-scheduler';
import { supabase } from '../../lib/supabase';
import { showToast } from '../Toast';
import type { Task } from '../../types/database';
import './FuturePlanningPanel.css';

export function FuturePlanningPanel() {
  const user = useUserStore(s => s.user);
  const tasks = useScheduleStore(s => s.tasks);
  const events = useScheduleStore(s => s.events);
  const goals = useGoalsStore(s => s.goals);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[] | null>(null);

  const forecast = useMemo(() => {
    if (!user?.id) return null;

    return getFutureForecast(user.id, {
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority as string | null,
        due_date: t.due_date as string | null,
        goal_id: t.goal_id as string | null,
        completed_at: t.completed_at as string | null,
        created_at: t.created_at || new Date().toISOString(),
      })),
      goals: goals.map(g => ({
        id: g.id,
        title: g.title,
        icon: g.icon,
        color: g.color,
        progress: g.progress || 0,
        target_date: g.target_date,
        created_at: g.created_at,
      })),
    });
  }, [user?.id, tasks, goals]);

  if (!forecast) {
    return (
      <div className="fpp-panel">
        <div className="fpp-loading">Loading forecast...</div>
      </div>
    );
  }

  const { taskPipeline, goalProjections, bottlenecks, capacity } = forecast;

  return (
    <div className="fpp-panel">
      {/* Header */}
      <div className="fpp-header">
        <div>
          <h2 className="fpp-title"><Calendar size={20} /> Future Planning</h2>
          <p className="fpp-subtitle">Project your next 4 weeks</p>
        </div>
        <button
          className="fpp-auto-schedule-btn"
          onClick={() => {
            const unscheduled = tasks.filter(
              (t: Task) => !t.scheduled_start && t.status !== 'done' && t.status !== 'completed' && !t.is_deleted
            );
            if (unscheduled.length === 0) {
              showToast('No unscheduled tasks found', '📅', '#5A7A9A');
              return;
            }
            const slots = computeSmartSchedule(unscheduled, events, DEFAULT_CONSTRAINTS);
            setScheduleSlots(slots);
          }}
        >
          <Zap size={14} /> Auto-Schedule
        </button>
      </div>

      {/* Smart Schedule Panel */}
      {scheduleSlots && (
        <SmartSchedulePanel
          slots={scheduleSlots}
          maxHoursPerDay={DEFAULT_CONSTRAINTS.maxHoursPerDay}
          onApply={async (selectedIds) => {
            const { data: { session } } = await useUserStore.getState().getSessionCached();
            if (!session?.user) return;
            let count = 0;
            for (const slot of scheduleSlots) {
              if (!selectedIds.includes(slot.taskId)) continue;
              const task = tasks.find((t: Task) => t.id === slot.taskId);
              if (!task) continue;
              const startIso = `${slot.suggestedDate}T${slot.suggestedStartTime}:00`;
              const endIso = `${slot.suggestedDate}T${slot.suggestedEndTime}:00`;
              const result = await scheduleTaskAtTime(supabase, session.user.id, task, startIso, endIso);
              if (result) count++;
            }
            if (count > 0) {
              showToast(`Scheduled ${count} tasks`, '📅', '#39FF14');
              window.dispatchEvent(new Event('lifeos-refresh'));
            }
            setScheduleSlots(null);
          }}
          onClose={() => setScheduleSlots(null)}
        />
      )}

      {/* Capacity Overview */}
      <div className="fpp-capacity-card">
        <div className="fpp-capacity-header">
          <Activity size={16} />
          <h3>Capacity Analysis</h3>
        </div>
        <div className="fpp-capacity-grid">
          <div className="fpp-capacity-stat">
            <div className="fpp-capacity-label">Avg Tasks/Day</div>
            <div className="fpp-capacity-value">{capacity.averageTasksPerDay}</div>
          </div>
          <div className="fpp-capacity-stat">
            <div className="fpp-capacity-label">Avg Tasks/Week</div>
            <div className="fpp-capacity-value">{capacity.averageTasksPerWeek}</div>
          </div>
          <div className="fpp-capacity-stat">
            <div className="fpp-capacity-label">Pending Tasks</div>
            <div className="fpp-capacity-value">{capacity.pendingTasks}</div>
          </div>
          <div className="fpp-capacity-stat">
            <div className="fpp-capacity-label">Days to Clear</div>
            <div className="fpp-capacity-value">
              {capacity.estimatedDaysToComplete === Infinity ? '∞' : capacity.estimatedDaysToComplete}
            </div>
          </div>
        </div>
        <div className="fpp-capacity-utilization">
          <div className="fpp-util-header">
            <span>Utilization Rate</span>
            <span className="fpp-util-pct">{capacity.utilizationRate}%</span>
          </div>
          <div className="fpp-util-bar-bg">
            <div
              className="fpp-util-bar-fill"
              style={{
                width: `${Math.min(capacity.utilizationRate, 100)}%`,
                background: capacity.utilizationRate > 100
                  ? '#F43F5E'
                  : capacity.utilizationRate > 80
                    ? '#F97316'
                    : '#00D4FF',
              }}
            />
          </div>
          <div className="fpp-util-recommendation">{capacity.recommendation}</div>
        </div>
      </div>

      {/* Bottleneck Alerts */}
      {bottlenecks.length > 0 && (
        <div className="fpp-section">
          <h3 className="fpp-section-title">
            <AlertTriangle size={16} style={{ color: '#F43F5E' }} />
            Bottleneck Alerts
          </h3>
          <div className="fpp-bottlenecks">
            {bottlenecks.map(alert => (
              <div key={alert.goalId} className={`fpp-bottleneck severity-${alert.severity}`}>
                <div className="fpp-bottleneck-icon">
                  <EmojiIcon emoji={alert.goalIcon || '🎯'} size={20} fallbackAsText />
                </div>
                <div className="fpp-bottleneck-content">
                  <div className="fpp-bottleneck-title">{alert.goalTitle}</div>
                  <div className="fpp-bottleneck-reason">{alert.reason}</div>
                  <div className="fpp-bottleneck-progress">
                    Expected: {Math.round(alert.expectedProgress)}% · Actual: {Math.round(alert.actualProgress)}%
                  </div>
                </div>
                <div className="fpp-bottleneck-badge">
                  {alert.daysOverdue}d behind
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal Timeline */}
      {goalProjections.length > 0 && (
        <div className="fpp-section">
          <h3 className="fpp-section-title">
            <Target size={16} />
            Goal Timeline & Milestones
          </h3>
          <div className="fpp-goals">
            {goalProjections.map(goal => (
              <div key={goal.goalId} className={`fpp-goal status-${goal.status}`}>
                <div className="fpp-goal-header">
                  <div className="fpp-goal-info">
                    <div className="fpp-goal-icon">
                      <EmojiIcon emoji={goal.goalIcon || '🎯'} size={20} fallbackAsText />
                    </div>
                    <div>
                      <div className="fpp-goal-title">{goal.goalTitle}</div>
                      <div className="fpp-goal-meta">
                        <span className={`fpp-goal-status status-${goal.status}`}>
                          {goal.status === 'behind' && '🔴'}
                          {goal.status === 'at-risk' && '🟡'}
                          {goal.status === 'on-track' && '🟢'}
                          {goal.status === 'ahead' && '🎯'}
                          {' '}
                          {goal.status.replace('-', ' ')}
                        </span>
                        {goal.targetDate && (
                          <span className="fpp-goal-target">
                            <Calendar size={10} />
                            Target: {new Date(goal.targetDate + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                        {goal.projectedCompletion && (
                          <span className="fpp-goal-projected">
                            <Clock size={10} />
                            Est: {new Date(goal.projectedCompletion + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        <span className="fpp-goal-velocity">
                          <Zap size={10} />
                          {goal.velocity.toFixed(1)} tasks/week
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="fpp-goal-progress-pct">
                    {Math.round(goal.currentProgress * 100)}%
                  </div>
                </div>

                {/* Milestones */}
                <div className="fpp-milestones">
                  {goal.milestones.map(milestone => (
                    <div
                      key={milestone.percentage}
                      className={`fpp-milestone ${milestone.achieved ? 'achieved' : ''}`}
                    >
                      <div className="fpp-milestone-marker">
                        {milestone.achieved ? <CheckCircle2 size={14} /> : <div className="fpp-milestone-dot" />}
                      </div>
                      <div className="fpp-milestone-content">
                        <div className="fpp-milestone-label">{milestone.label}</div>
                        <div className="fpp-milestone-date">
                          {milestone.achieved && milestone.currentDate && (
                            <span className="fpp-milestone-achieved">
                              ✓ {new Date(milestone.currentDate + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {!milestone.achieved && milestone.projectedDate && (
                            <span className="fpp-milestone-projected">
                              → {new Date(milestone.projectedDate + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Pipeline */}
      <div className="fpp-section">
        <h3 className="fpp-section-title">
          <Package size={16} />
          Task Pipeline (Next 4 Weeks)
        </h3>
        <div className="fpp-pipeline">
          {taskPipeline.map(week => (
            <div key={week.weekStart} className="fpp-week">
              <div className="fpp-week-header">
                <div className="fpp-week-label">{week.weekLabel}</div>
                <div className="fpp-week-count">{week.totalTasks} tasks</div>
              </div>
              {week.tasks.length > 0 ? (
                <div className="fpp-week-tasks">
                  {week.tasks.slice(0, 8).map(task => (
                    <div key={task.id} className="fpp-task">
                      {task.priority && (
                        <div
                          className="fpp-task-priority"
                          data-priority={task.priority}
                          title={task.priority}
                        />
                      )}
                      <div className="fpp-task-content">
                        <div className="fpp-task-title">{task.title}</div>
                        {task.goalTitle && (
                          <div className="fpp-task-goal">
                            {task.goalIcon && <EmojiIcon emoji={task.goalIcon} size={12} fallbackAsText />}
                            {task.goalTitle}
                          </div>
                        )}
                      </div>
                      {task.due_date && (
                        <div className="fpp-task-due">
                          {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                  ))}
                  {week.tasks.length > 8 && (
                    <div className="fpp-week-more">
                      +{week.tasks.length - 8} more tasks
                    </div>
                  )}
                </div>
              ) : (
                <div className="fpp-week-empty">No tasks scheduled</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
