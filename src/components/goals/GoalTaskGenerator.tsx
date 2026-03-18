/**
 * Goal Task Generator — AI-powered task decomposition
 * 
 * Shows AI-suggested tasks for a goal, allows user to preview/edit/select
 * which ones to create, then links them to the goal.
 */

import { useState } from 'react';
import { Zap, Loader2, Check, X, Edit2, Sparkles } from 'lucide-react';
import { generateTasksFromGoal, type GeneratedTask } from '../../lib/goal-task-engine';
import { supabase } from '../../lib/supabase';
import { showToast } from '../Toast';
import { getEffectiveUserId } from '../../lib/local-db';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { scheduleObjectiveTasks } from '../../lib/smart-scheduler';
import { useGoalsStore } from '../../stores/useGoalsStore';
import './GoalTaskGenerator.css';
import { logger } from '../../utils/logger';

interface GoalTaskGeneratorProps {
  goalId: string;
  goalTitle: string;
  goalDescription: string | null;
  goalTargetDate?: string | null;
  onTasksCreated: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#F43F5E',
  high: '#F97316',
  medium: '#00D4FF',
  low: '#5A7A9A',
};

export function GoalTaskGenerator({ goalId, goalTitle, goalDescription, goalTargetDate, onTasksCreated }: GoalTaskGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tasks, setTasks] = useState<(GeneratedTask & { id: string; selected: boolean })[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    setTasks([]);
    
    try {
      const generated = await generateTasksFromGoal(goalId, goalTitle, goalDescription);
      
      setTasks(generated.map((t, i) => ({
        ...t,
        id: `temp-${i}`,
        selected: true, // All selected by default
      })));
      
    } catch (err) {
      showToast('Failed to generate tasks', '⚠️', '#F43F5E');
      logger.error('[GoalTaskGenerator] Generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async () => {
    const selected = tasks.filter(t => t.selected);
    if (selected.length === 0) {
      showToast('Select at least one task', '⚠️', '#F97316');
      return;
    }

    setCreating(true);
    const { createTask } = useScheduleStore.getState();

    try {
      const userId = getEffectiveUserId();
      const now = new Date();
      const targetDate = goalTargetDate ? new Date(goalTargetDate + 'T12:00:00') : null;

      // Calculate spacing: always 2-7 day gaps
      const daysUntilTarget = targetDate
        ? Math.max(selected.length * 2, Math.floor((targetDate.getTime() - now.getTime()) / 86400000))
        : selected.length * 3;
      const spacing = Math.min(7, Math.max(2, Math.floor(daysUntilTarget / selected.length)));

      // Create tasks via store with progressive due dates (start tomorrow)
      let created = 0;
      for (let i = 0; i < selected.length; i++) {
        const t = selected[i];
        const taskDate = new Date(now);
        taskDate.setDate(taskDate.getDate() + 1 + (i * spacing));

        const ok = await createTask(userId, t.title, t.priority, {
          goal_id: goalId,
          estimated_duration: t.estimated_minutes,
          due_date: taskDate.toISOString().split('T')[0],
          suggested_week: t.suggested_week || null,
        });
        if (ok) created++;
      }

      // Walk up goal tree to find root objective, then smart-schedule
      try {
        const allGoals = useGoalsStore.getState().goals;
        let rootId = goalId;
        let current = allGoals.find((g: Record<string, unknown>) => g.id === goalId);
        while (current?.parent_goal_id) {
          rootId = current.parent_goal_id as string;
          current = allGoals.find((g: Record<string, unknown>) => g.id === rootId);
        }
        await scheduleObjectiveTasks(supabase, userId, rootId);
      } catch (schedErr) {
        logger.warn('[GoalTaskGenerator] Smart-scheduling failed:', schedErr);
        // Non-critical - tasks are still created
      }

      showToast(`Created ${created} task${created > 1 ? 's' : ''}`, '✨', '#39FF14');
      setOpen(false);
      setTasks([]);
      onTasksCreated();

    } catch (err) {
      showToast('Failed to create tasks', '⚠️', '#F43F5E');
      logger.error('[GoalTaskGenerator] Creation failed:', err);
    } finally {
      setCreating(false);
    }
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  const updateTaskTitle = (id: string, newTitle: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, title: newTitle } : t));
    setEditingId(null);
  };

  const updateTaskPriority = (id: string, newPriority: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, priority: newPriority } : t));
  };

  const selectedCount = tasks.filter(t => t.selected).length;

  if (!open) {
    return (
      <button
        className="gtg-trigger-btn"
        onClick={() => {
          setOpen(true);
          handleGenerate();
        }}
        title="Generate tasks from this goal using AI"
      >
        <Zap size={14} />
        <span>Generate Tasks</span>
      </button>
    );
  }

  return (
    <div className="gtg-modal-backdrop" onClick={() => !generating && !creating && setOpen(false)}>
      <div className="gtg-modal" onClick={e => e.stopPropagation()}>
        <div className="gtg-header">
          <div className="gtg-header-content">
            <div className="gtg-icon">
              <Sparkles size={18} />
            </div>
            <div className="gtg-header-text">
              <h3 className="gtg-title">AI Task Generator</h3>
              <p className="gtg-subtitle">For: {goalTitle}</p>
            </div>
          </div>
          <button
            className="gtg-close-btn"
            onClick={() => setOpen(false)}
            disabled={generating || creating}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="gtg-content">
          {generating && (
            <div className="gtg-loading">
              <Loader2 size={28} className="spin" />
              <p>Analyzing goal and generating tasks...</p>
            </div>
          )}

          {!generating && tasks.length === 0 && (
            <div className="gtg-empty">
              <p>Click Generate to create task suggestions</p>
            </div>
          )}

          {!generating && tasks.length > 0 && (
            <>
              <div className="gtg-tasks">
                {tasks.map(task => (
                  <div
                    key={task.id}
                    className={`gtg-task ${task.selected ? 'selected' : ''}`}
                  >
                    <button
                      className="gtg-checkbox"
                      onClick={() => toggleTask(task.id)}
                      aria-label={task.selected ? 'Deselect' : 'Select'}
                    >
                      {task.selected ? <Check size={14} /> : <div className="gtg-checkbox-empty" />}
                    </button>

                    <div className="gtg-task-content">
                      {editingId === task.id ? (
                        <input
                          className="gtg-edit-input"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onBlur={() => updateTaskTitle(task.id, editTitle)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') updateTaskTitle(task.id, editTitle);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <div className="gtg-task-title">{task.title}</div>
                      )}

                      <div className="gtg-task-meta">
                        <select
                          className="gtg-priority-select"
                          value={task.priority}
                          onChange={e => updateTaskPriority(task.id, e.target.value)}
                          style={{ color: PRIORITY_COLORS[task.priority] }}
                        >
                          <option value="critical">Critical</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <span className="gtg-time">{task.estimated_minutes} min</span>
                      </div>
                    </div>

                    <button
                      className="gtg-edit-btn"
                      onClick={() => {
                        setEditingId(task.id);
                        setEditTitle(task.title);
                      }}
                      aria-label="Edit title"
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="gtg-footer">
                <button
                  className="gtg-regenerate-btn"
                  onClick={handleGenerate}
                  disabled={generating || creating}
                >
                  <Zap size={14} />
                  <span>Regenerate</span>
                </button>

                <div className="gtg-actions">
                  <button
                    className="gtg-cancel-btn"
                    onClick={() => setOpen(false)}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    className="gtg-create-btn"
                    onClick={handleCreate}
                    disabled={creating || selectedCount === 0}
                  >
                    {creating ? (
                      <>
                        <Loader2 size={14} className="spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Create {selectedCount} Task{selectedCount !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
