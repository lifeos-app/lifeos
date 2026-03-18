import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, Circle, CheckCircle2, Calendar, Clock, Trash2, Plus, SkipForward, AlertTriangle, CheckCircle } from 'lucide-react';
import { recalcProgression } from '../lib/progression';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useUserStore } from '../stores/useUserStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { PriorityPicker } from './PriorityPicker';
import { PRIORITY_TO_LEVEL, getPriorityDbValue } from '../constants/priorities';
import './TaskDetail.css';

// ── Types ──────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoalRecord = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskRecord = Record<string, any>;

interface TaskDetailProps {
  taskId: string;
  allGoals: GoalRecord[];
  allTasks: TaskRecord[];
  onClose: () => void;
  onNavigateToNode?: (nodeId: string) => void;
}

interface Milestone {
  title: string;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8', 'in-progress': '#00D4FF', done: '#39FF14', skipped: '#F97316',
};

export function TaskDetail({ taskId, allGoals, allTasks, onClose, onNavigateToNode }: TaskDetailProps) {
  const user = useUserStore(s => s.user);
  const { updateTask, deleteTask: storeDeleteTask, createTask, getSubtasks } = useScheduleStore();
  const task = allTasks.find((t) => t.id === taskId);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editDueDate, setEditDueDate] = useState('');
  const [editEstimated, setEditEstimated] = useState('');
  const [editActual, setEditActual] = useState('');
  const [showEstimatedInput, setShowEstimatedInput] = useState(false);
  const [showActualInput, setShowActualInput] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState({ title: '', message: '' });

  // Get subtasks from the store instead of a separate Supabase query
  const subtasks = useMemo(() => getSubtasks(taskId), [getSubtasks, taskId]);

  const confirmDelete = useCallback((title: string, message: string, action: () => void) => {
    setConfirmMsg({ title, message });
    setConfirmAction(() => action);
  }, []);

  useEffect(() => {
    if (task) {
      setEditTitle(task.title || '');
      setEditDesc(task.description || '');
      setEditDueDate(task.due_date || '');
      setEditEstimated(task.estimated_minutes ? String(task.estimated_minutes) : '');
      setEditActual(task.actual_minutes ? String(task.actual_minutes) : '');
    }
  }, [task]);

  if (!task) { onClose(); return null; }

  const goalColor = task.goal_id ? allGoals.find((g) => g.id === task.goal_id)?.color || '#00D4FF' : '#00D4FF';

  const hierarchy = useMemo(() => {
    if (!task.goal_id) return [] as GoalRecord[];
    const chain: GoalRecord[] = [];
    let current: string | null | undefined = task.goal_id;
    while (current) {
      const g = allGoals.find((x) => x.id === current);
      if (!g) break;
      chain.unshift(g);
      current = g.parent_goal_id;
    }
    return chain;
  }, [task.goal_id, allGoals]);

  const handleMilestones = async (goalId: string) => {
    const { milestones } = await recalcProgression(goalId, supabase) as { milestones: Milestone[] };
    milestones.forEach(m => showToast(`${m.title} completed!`, '🎉', m.color));
  };

  const saveTitle = async () => {
    if (!editTitle.trim()) { setEditingTitle(false); return; }
    await updateTask(taskId, { title: editTitle.trim() });
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    await updateTask(taskId, { description: editDesc.trim() || undefined });
    setEditingDesc(false);
  };

  const changeStatus = async (newStatus: string) => {
    await updateTask(taskId, {
      status: newStatus as any,
      completed_at: newStatus === 'done' ? new Date().toISOString() : undefined,
    });
    if (task.goal_id) await handleMilestones(task.goal_id);
  };

  const changePriority = async (level: 1 | 2 | 3 | 4) => {
    const dbValue = getPriorityDbValue(level);
    await updateTask(taskId, { priority: dbValue as any });
    showToast('Priority updated', '🎯', '#00D4FF');
  };

  const saveDueDate = async () => {
    await updateTask(taskId, { due_date: editDueDate || undefined });
    setShowDatePicker(false);
  };

  const saveEstimated = async () => {
    const val = editEstimated ? parseInt(editEstimated) : undefined;
    await updateTask(taskId, { estimated_duration: val });
    setShowEstimatedInput(false);
  };

  const saveActual = async () => {
    const val = editActual ? parseInt(editActual) : undefined;
    await updateTask(taskId, { actual_duration: val });
    setShowActualInput(false);
  };

  const toggleSubtask = async (subtaskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    await updateTask(subtaskId, {
      status: newStatus as any,
      completed_at: newStatus === 'done' ? new Date().toISOString() : undefined,
    });
    if (task.goal_id) await handleMilestones(task.goal_id);
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle.trim() || !user?.id) return;
    setAddingSubtask(true);
    await createTask(user.id, newSubtaskTitle.trim(), 'medium', {
      parent_task_id: taskId,
      goal_id: task.goal_id,
    });
    setNewSubtaskTitle('');
    setAddingSubtask(false);
  };

  const deleteSubtask = async (subtaskId: string) => {
    await storeDeleteTask(subtaskId);
    setConfirmAction(null);
  };

  const deleteTask = async () => {
    await storeDeleteTask(taskId);
    if (task.goal_id) await handleMilestones(task.goal_id);
    setConfirmAction(null);
    onClose();
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const StatusButton = ({ value, label }: { value: string; label: string }) => {
    const active = task.status === value;
    return (
      <button
        onClick={() => changeStatus(value)}
        className={`td-status-btn ${active ? 'active' : 'inactive'}`}
        style={active ? { background: STATUS_COLORS[value] } : undefined}
      >
        {label}
      </button>
    );
  };

  const currentPriorityLevel = PRIORITY_TO_LEVEL[task.priority || 'medium'] || 3;

  const content = (
    <div className="td-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="td-card">
        {/* Accent bar */}
        <div className="td-accent" style={{ background: goalColor }} />

        {/* Header */}
        <div className="td-header">
          <div className="td-header-content">
            <div className="td-header-label">TASK</div>
            {editingTitle ? (
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setEditTitle(task.title); } }}
                className="td-title-input" autoFocus />
            ) : (
              <h2 onClick={() => setEditingTitle(true)} className="td-title" title="Click to edit">
                {task.title}
              </h2>
            )}
          </div>
          <button aria-label="Close task detail" onClick={onClose} className="td-close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="td-body">
          {/* Breadcrumb */}
          {hierarchy.length > 0 && (
            <div className="td-breadcrumb">
              {hierarchy.map((h, i) => {
                const catLabel = (h.category || '').toLowerCase();
                const levelColor = catLabel === 'objective' ? '#7C5CFC' : catLabel === 'epic' ? '#00D4FF' : catLabel === 'goal' ? '#4ECB71' : 'rgba(255,255,255,0.5)';
                return (
                  <span key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => onNavigateToNode?.(h.id)} className="td-crumb-btn">
                      <span className="td-crumb-level" style={{ color: levelColor }}>
                        {catLabel === 'objective' ? 'OBJ' : catLabel === 'epic' ? 'EPIC' : catLabel === 'goal' ? 'GOAL' : catLabel.toUpperCase()}
                      </span>
                      {h.title}
                    </button>
                    {i < hierarchy.length - 1 && <ChevronRight size={12} className="td-crumb-sep" />}
                  </span>
                );
              })}
              <ChevronRight size={12} className="td-crumb-sep" />
              <span className="td-crumb-current" style={{ color: goalColor }}>This task</span>
            </div>
          )}

          {!task.goal_id && (
            <div className="td-standalone-warn">
              <AlertTriangle size={12} />Standalone task — not linked to any goal
            </div>
          )}

          {/* Status & Meta Grid */}
          <div className="td-meta-grid">
            <div>
              <div className="td-meta-label">Status</div>
              <div className="td-status-group">
                <StatusButton value="todo" label="Todo" />
                <StatusButton value="in-progress" label="In Progress" />
                <StatusButton value="done" label="Done" />
                <StatusButton value="skipped" label="Skipped" />
              </div>
            </div>

            <div>
              <div className="td-meta-label">Priority</div>
              <PriorityPicker
                value={currentPriorityLevel}
                onChange={changePriority}
                variant="full"
              />
            </div>

            <div>
              <div className="td-meta-label">Due Date</div>
              {showDatePicker ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="td-input" style={{ flex: 1 }} autoFocus />
                  <button onClick={saveDueDate} className="td-btn-cyan">Save</button>
                </div>
              ) : (
                <button onClick={() => setShowDatePicker(true)} className="td-btn-ghost">
                  <Calendar size={12} />
                  {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Set date'}
                </button>
              )}
            </div>

            <div>
              <div className="td-meta-label">Estimated</div>
              {showEstimatedInput ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="number" value={editEstimated} onChange={e => setEditEstimated(e.target.value)} placeholder="mins" className="td-input" style={{ width: 70 }} autoFocus />
                  <button onClick={saveEstimated} className="td-btn-cyan">Save</button>
                </div>
              ) : (
                <button onClick={() => setShowEstimatedInput(true)} className="td-btn-ghost">
                  <Clock size={12} />
                  {task.estimated_minutes ? formatTime(task.estimated_minutes) : 'Add estimate'}
                </button>
              )}
            </div>

            <div>
              <div className="td-meta-label">Actual</div>
              {showActualInput ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="number" value={editActual} onChange={e => setEditActual(e.target.value)} placeholder="mins" className="td-input" style={{ width: 70 }} autoFocus />
                  <button onClick={saveActual} className="td-btn-cyan">Save</button>
                </div>
              ) : (
                <button onClick={() => setShowActualInput(true)} className="td-btn-ghost">
                  <Clock size={12} />
                  {task.actual_minutes ? formatTime(task.actual_minutes) : 'Add time'}
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="td-section">
            <div className="td-section-label">Description</div>
            {editingDesc ? (
              <div>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4}
                  placeholder="Add instructions, context, notes..."
                  className="td-desc-textarea" autoFocus />
                <div className="td-desc-actions">
                  <button onClick={saveDesc} className="td-btn-cyan">Save</button>
                  <button onClick={() => { setEditingDesc(false); setEditDesc(task.description || ''); }} className="td-btn-ghost">Cancel</button>
                </div>
              </div>
            ) : (
              <p onClick={() => setEditingDesc(true)} className="td-desc">
                {task.description || 'Click to add description...'}
              </p>
            )}
          </div>

          {/* Checklist */}
          <div className="td-section">
            <div className="td-section-label">
              Checklist ({subtasks.filter(s => s.status === 'done').length}/{subtasks.length})
            </div>
            {subtasks.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {subtasks.map(st => (
                  <div key={st.id} className="td-subtask-row">
                    <button aria-label="Toggle subtask" onClick={() => toggleSubtask(st.id, st.status)}
                      className="td-subtask-toggle"
                      style={{ color: st.status === 'done' ? '#39FF14' : 'rgba(255,255,255,0.3)' }}>
                      {st.status === 'done' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </button>
                    <span className={`td-subtask-title ${st.status === 'done' ? 'done' : ''}`}>{st.title}</span>
                    <button onClick={() => confirmDelete('Delete this step?', `Remove "${st.title}" from checklist?`, () => deleteSubtask(st.id))}
                      className="td-subtask-delete" title="Delete step" aria-label="Delete step">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="td-add-subtask">
              <input type="text" value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubtask()} placeholder="Add a step..."
                className="td-add-subtask-input" />
              <button onClick={addSubtask} disabled={addingSubtask || !newSubtaskTitle.trim()}
                className="td-add-subtask-btn">
                <Plus size={12} /> Add
              </button>
            </div>
          </div>

          {/* Activity */}
          <div className="td-activity">
            <div className="td-section-label">Activity</div>
            <div>
              {task.created_at && <div className="td-activity-item">Created {new Date(task.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
              {task.completed_at && (
                <div className="td-activity-item completed"><CheckCircle size={12} style={{ marginRight: 4, verticalAlign: 'middle', display: 'inline' }} />Completed {new Date(task.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              )}
              {task.due_date && task.created_at && new Date(task.created_at).toISOString().split('T')[0] !== task.due_date && (
                <div className="td-activity-item"><Calendar size={12} style={{ marginRight: 4, verticalAlign: 'middle', display: 'inline' }} />Rescheduled to {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="td-actions">
          {task.status !== 'done' && (
            <button onClick={() => changeStatus('done')} className="td-btn-complete">
              <CheckCircle2 size={16} /> Complete
            </button>
          )}
          {task.status !== 'skipped' && (
            <button onClick={() => changeStatus('skipped')} className="td-btn-skip">
              <SkipForward size={16} /> Skip
            </button>
          )}
          <button onClick={() => setShowDatePicker(true)} className="td-btn-reschedule">
            <Calendar size={16} /> Reschedule
          </button>
          <button onClick={() => confirmDelete('Delete this task?', `Permanently remove "${task.title}"? This cannot be undone.`, deleteTask)}
            className="td-btn-delete">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(content, document.body)}
      <ConfirmDialog open={!!confirmAction} title={confirmMsg.title} message={confirmMsg.message}
        onConfirm={() => { confirmAction?.(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)} />
    </>
  );
}
