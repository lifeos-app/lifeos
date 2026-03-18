import { useState } from 'react';
import { Circle, CheckCircle2, ChevronRight, ChevronDown, Plus } from 'lucide-react';
import type { Task } from '../types/database';
import './SubtaskTree.css';

interface SubtaskTreeProps {
  tasks: Task[];
  parentId: string | null;
  depth?: number;
  onToggle: (id: string, currentStatus: Task['status']) => void;
  onAdd?: (parentId: string) => void;
  onClick: (id: string) => void;
}

export function SubtaskTree({
  tasks,
  parentId,
  depth = 0,
  onToggle,
  onAdd,
  onClick
}: SubtaskTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const childTasks = tasks.filter(t => t.parent_task_id === parentId);
  const hasChildren = (taskId: string) => tasks.some(t => t.parent_task_id === taskId);

  const toggleCollapse = (taskId: string) => {
    const newCollapsed = new Set(collapsed);
    if (collapsed.has(taskId)) {
      newCollapsed.delete(taskId);
    } else {
      newCollapsed.add(taskId);
    }
    setCollapsed(newCollapsed);
  };

  const getSubtaskProgress = (taskId: string) => {
    const subtasks = tasks.filter(t => t.parent_task_id === taskId);
    if (subtasks.length === 0) return null;

    const completed = subtasks.filter(t =>
      t.status === 'done' || t.status === 'completed'
    ).length;
    return { total: subtasks.length, completed };
  };

  if (childTasks.length === 0) return null;

  return (
    <div className={`subtask-tree depth-${depth}`}>
      {childTasks.map(task => {
        const hasSubtasks = hasChildren(task.id);
        const isCollapsed = collapsed.has(task.id);
        const progress = getSubtaskProgress(task.id);
        const isDone = task.status === 'done' || task.status === 'completed';

        return (
          <div key={task.id} className="subtask-item">
            <div className={`subtask-row ${isDone ? 'done' : ''}`}>
              {/* Collapse toggle */}
              {hasSubtasks && (
                <button
                  className="subtask-toggle"
                  onClick={() => toggleCollapse(task.id)}
                  aria-label={isCollapsed ? 'Expand subtasks' : 'Collapse subtasks'}
                >
                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
              {!hasSubtasks && <span className="subtask-spacer" />}

              {/* Checkbox */}
              <button
                className="subtask-check"
                onClick={() => onToggle(task.id, task.status)}
                aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                style={{ color: isDone ? '#39FF14' : 'rgba(255,255,255,0.3)' }}
              >
                {isDone ? <CheckCircle2 size={15} /> : <Circle size={15} />}
              </button>

              {/* Title */}
              <span
                className={`subtask-title ${isDone ? 'strikethrough' : ''}`}
                onClick={() => onClick(task.id)}
              >
                {task.title}
              </span>

              {/* Progress badge */}
              {progress && progress.total > 0 && (
                <span className="subtask-progress">
                  {progress.completed}/{progress.total}
                </span>
              )}

              {/* Add sub-subtask button (only if depth < 2) */}
              {depth < 2 && onAdd && (
                <button
                  className="subtask-add"
                  onClick={() => onAdd(task.id)}
                  title="Add subtask"
                >
                  <Plus size={11} />
                </button>
              )}
            </div>

            {/* Recursive children */}
            {hasSubtasks && !isCollapsed && (
              <SubtaskTree
                tasks={tasks}
                parentId={task.id}
                depth={depth + 1}
                onToggle={onToggle}
                onAdd={onAdd}
                onClick={onClick}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
