/**
 * DashboardTasks — Task list/kanban widget for the Dashboard.
 */

import { useState, forwardRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../stores/useUserStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { recalcProgression } from '../../lib/progression';
import { showToast } from '../Toast';
import { StatusColumn } from '../StatusColumn';
import { KanbanBoard } from '../KanbanBoard';
import type { KanbanTask } from '../KanbanBoard';
import { SubtaskTree } from '../SubtaskTree';
import { PriorityPicker } from '../PriorityPicker';
import { PRIORITY_TO_LEVEL, getPriorityDbValue } from '../../constants/priorities';
import { localUpdate } from '../../lib/local-db';
import { formatDateShort } from '../../utils/date';
import type { Task } from '../../types/database';
import type { GoalNode } from '../../stores/useGoalsStore';
import {
  CheckCircle2, Circle, Plus, LayoutList, Columns3, AlertTriangle, Calendar,
} from 'lucide-react';

interface MilestoneResult { title: string; color: string }

interface DashboardTasksProps {
  tasks: Task[];
  goals: GoalNode[];
  selectedDate: string;
  loading: boolean;
  taskView: 'list' | 'board';
  taskFilter: 'all' | 'today' | 'upcoming' | 'overdue';
  onSetTaskView: (v: 'list' | 'board') => void;
  onSetTaskFilter: (f: 'all' | 'today' | 'upcoming' | 'overdue') => void;
  onRefresh: () => void;
  onOpenDetail: (id: string) => void;
}

export const DashboardTasks = forwardRef<HTMLElement, DashboardTasksProps>(function DashboardTasks(
  { tasks, goals, selectedDate, loading, taskView, taskFilter, onSetTaskView, onSetTaskFilter, onRefresh, onOpenDetail },
  ref,
) {
  const user = useUserStore(s => s.user);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [creatingTask, setCreatingTask] = useState(false);

  const todayS = selectedDate;

  // Filtered tasks
  const dayTasks = tasks.filter(t =>
    t.due_date === selectedDate || (t.completed_at && t.completed_at.startsWith(selectedDate))
  );
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < selectedDate && t.status !== 'done');

  const filteredTasks = (() => {
    switch (taskFilter) {
      case 'today': return dayTasks;
      case 'upcoming': {
        const upLimit = new Date(selectedDate + 'T00:00:00');
        upLimit.setDate(upLimit.getDate() + 4);
        const upEnd = upLimit.toISOString().split('T')[0];
        return tasks.filter(t => t.due_date && t.due_date > selectedDate && t.due_date <= upEnd && t.status !== 'done');
      }
      case 'overdue': return overdueTasks;
      default: return dayTasks;
    }
  })();

  const activeTasks = filteredTasks.filter(t => t.status !== 'done');
  const doneTasks = filteredTasks.filter(t => t.status === 'done');

  const getChain = (goalId: string | null): string => {
    if (!goalId) return '';
    const chain: string[] = [];
    let cur: string | null | undefined = goalId;
    while (cur) {
      const g = goals.find(x => x.id === cur);
      if (!g) break;
      chain.unshift(g.title);
      cur = g.parent_goal_id;
    }
    return chain.join(' › ');
  };

  const createTask = async () => {
    if (!newTaskTitle.trim()) return;
    setCreatingTask(true);
    const ok = await useScheduleStore.getState().createTask(user?.id || '', newTaskTitle.trim(), newTaskPriority);
    if (ok) { setNewTaskTitle(''); setNewTaskPriority('medium'); setShowTaskForm(false); onRefresh(); }
    setCreatingTask(false);
  };

  const toggleTask = async (id: string, currentStatus: Task['status']) => {
    const task = tasks.find((t: Task) => t.id === id);
    await useScheduleStore.getState().toggleTask(id, currentStatus);
    if (task?.goal_id) {
      const { milestones } = await recalcProgression(task.goal_id, supabase);
      if (milestones.length > 0) milestones.forEach((m: MilestoneResult) => showToast(`${m.title} completed!`, '🎉', m.color));
    }
    onRefresh();
  };

  const changeTaskStatus = async (id: string, newStatus: Task['status']) => {
    const task = tasks.find((t: Task) => t.id === id);
    await useScheduleStore.getState().changeTaskStatus(id, newStatus);
    if (task?.goal_id) {
      const { milestones } = await recalcProgression(task.goal_id, supabase);
      if (milestones.length > 0) milestones.forEach((m: MilestoneResult) => showToast(`${m.title} completed!`, '🎉', m.color));
    }
    onRefresh();
  };

  const kanbanTasks: KanbanTask[] = filteredTasks.map((t: Task) => {
    const subtasks = tasks.filter(st => st.parent_task_id === t.id);

    return {
      id: t.id,
      title: t.title,
      status: t.status || 'pending',
      priority: (t.priority ?? undefined) as KanbanTask['priority'],
      due_date: t.due_date ?? undefined,
      board_status: t.board_status,
      board_position: t.board_position,
      subtask_count: subtasks.length,
      subtasks_completed: subtasks.filter(st =>
        st.status === 'done' || st.status === 'completed'
      ).length,
    };
  });

  return (
    <section ref={ref} className={`dash-card ${taskView === 'board' ? 'full-width' : ''}`}>
      <div className="card-top">
        <h2><CheckCircle2 size={16} /> Tasks</h2>
        <div className="card-top-actions">
          <div className="view-toggle">
            <button className={`view-btn ${taskView === 'list' ? 'active' : ''}`} onClick={() => onSetTaskView('list')} title="List view" aria-label="List view"><LayoutList size={14} /></button>
            <button className={`view-btn ${taskView === 'board' ? 'active' : ''}`} onClick={() => onSetTaskView('board')} title="Board view" aria-label="Board view"><Columns3 size={14} /></button>
          </div>
          <button className="card-action" onClick={() => setShowTaskForm(!showTaskForm)}><Plus size={14} /> Add</button>
        </div>
      </div>
      <div className="task-filters">
        {([
          { key: 'all' as const, label: 'Today', count: dayTasks.length },
          { key: 'upcoming' as const, label: 'Next 3 Days', count: (() => { const ul = new Date(selectedDate + 'T00:00:00'); ul.setDate(ul.getDate() + 4); const ue = ul.toISOString().split('T')[0]; return tasks.filter((t: Task) => t.due_date && t.due_date > selectedDate && t.due_date <= ue && t.status !== 'done').length; })() },
          { key: 'overdue' as const, label: 'Overdue', count: overdueTasks.length },
        ]).map(f => (
          <button key={f.key} className={`task-filter-btn ${taskFilter === f.key ? 'active' : ''} ${f.key === 'overdue' && f.count > 0 ? 'warn' : ''}`}
            onClick={() => onSetTaskFilter(f.key)}>
            {f.label} <span className="task-filter-count">{f.count}</span>
          </button>
        ))}
      </div>
      {showTaskForm && (
        <div className="inline-task-form">
          <input type="text" className="inline-task-input" placeholder="What needs to be done?" value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createTask()} autoFocus />
          <div className="inline-task-actions">
            <select className="inline-task-priority" value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
            <button className="inline-task-submit" onClick={createTask} disabled={creatingTask || !newTaskTitle.trim()}>{creatingTask ? 'Adding...' : 'Add Task'}</button>
            <button className="inline-task-cancel" onClick={() => { setShowTaskForm(false); setNewTaskTitle(''); setNewTaskPriority('medium'); }}>Cancel</button>
          </div>
        </div>
      )}
      {loading ? <p className="card-empty">Loading...</p> :
        filteredTasks.length === 0 ? (
          <div className="card-empty"><p>No tasks yet</p><p className="card-empty-hint">Click + Add above or press <kbd>⌘K</kbd></p></div>
        ) : taskView === 'board' ? (
          <KanbanBoard
            tasks={kanbanTasks}
            onStatusChange={changeTaskStatus}
            onPositionChange={(id, position, status) => {
              useScheduleStore.getState().changeTaskBoardPosition(id, position, status);
              onRefresh();
            }}
            onTaskClick={onOpenDetail}
            enableManualSort={true}
          />
        ) : (
          <div className="task-list">
            {activeTasks
              .filter(t => !t.parent_task_id)  // Only top-level tasks
              .map((t: Task) => {
                const isOD = t.due_date && t.due_date < todayS;
                const chain = getChain(t.goal_id ?? null);

                // Calculate subtask progress
                const subtasks = tasks.filter(st => st.parent_task_id === t.id);
                const subtaskCount = subtasks.length;
                const subtasksCompleted = subtasks.filter(
                  st => st.status === 'done' || st.status === 'completed'
                ).length;

                const priorityLevel = PRIORITY_TO_LEVEL[t.priority || 'medium'] || 3;

                return (
                  <div key={t.id} className="task-group">
                    {/* Main task row */}
                    <div className={`task-row ${isOD ? 'overdue' : ''}`}>
                      <button
                        className="task-chk"
                        onClick={() => toggleTask(t.id, t.status)}
                        aria-label="Mark complete"
                      >
                        <Circle size={18} strokeWidth={1.5} />
                      </button>

                      <div className="task-info">
                        <span
                          className="task-txt"
                          onClick={() => onOpenDetail(t.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          {t.title}
                        </span>

                        <div className="task-meta-row">
                          {chain ? (
                            <span className="task-chain">{chain}</span>
                          ) : (
                            <span className="task-chain standalone">⊘ No objective</span>
                          )}

                          {subtaskCount > 0 && (
                            <span className="task-subtask-count">
                              {subtasksCompleted}/{subtaskCount} subtasks
                            </span>
                          )}

                          {t.due_date && (
                            <span className={`task-due ${isOD ? 'overdue' : ''}`}>
                              {isOD ? <AlertTriangle size={11} color="#F97316" /> : <Calendar size={11} />}
                              {formatDateShort(t.due_date)}
                            </span>
                          )}
                        </div>
                      </div>

                      <StatusColumn
                        value={t.status || 'pending'}
                        onChange={(newStatus) => changeTaskStatus(t.id, newStatus as Task['status'])}
                      />

                      <PriorityPicker
                        value={priorityLevel}
                        onChange={(level) => {
                          const dbValue = getPriorityDbValue(level);
                          localUpdate('tasks', t.id, { priority: dbValue });
                          onRefresh();
                        }}
                        variant="badge"
                      />
                    </div>

                    {/* Subtask tree */}
                    {subtaskCount > 0 && (
                      <SubtaskTree
                        tasks={tasks}
                        parentId={t.id}
                        depth={0}
                        onToggle={toggleTask}
                        onAdd={(parentId) => {
                          onOpenDetail(parentId);
                        }}
                        onClick={onOpenDetail}
                      />
                    )}
                  </div>
                );
              })}
            {doneTasks.length > 0 && (
              <details className="done-group">
                <summary className="done-toggle">✓ {doneTasks.length} completed</summary>
                {doneTasks.slice(0, 5).map((t: Task) => (
                  <div key={t.id} className="task-row done">
                    <button className="task-chk checked" onClick={() => toggleTask(t.id, t.status)} aria-label="Mark task incomplete"><CheckCircle2 size={18} /></button>
                    <span className="task-txt" onClick={() => onOpenDetail(t.id)} style={{ cursor: 'pointer' }}>{t.title}</span>
                  </div>
                ))}
              </details>
            )}
          </div>
        )}
    </section>
  );
});
