import React, { useState, useCallback, type DragEvent } from 'react';
import { GripVertical, Calendar, AlertTriangle, AlertCircle, Minus, CheckCircle2 } from 'lucide-react';
import './KanbanBoard.css';
import type { Task } from '../types/database';

interface KanbanTask {
  id: string;
  title: string;
  status: Task['status'];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string | null;
  board_status?: 'todo' | 'in_progress' | 'done';
  board_position?: number;
  subtask_count?: number;
  subtasks_completed?: number;
}

interface KanbanColumn {
  status: Task['status'];
  label: string;
  color: string;
}

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onStatusChange: (id: string, newStatus: Task['status']) => void;
  onPositionChange?: (id: string, newPosition: number, newStatus: Task['status']) => void;
  onTaskClick?: (id: string) => void;
  columns?: KanbanColumn[];
  enableManualSort?: boolean;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { status: 'pending', label: 'To Do', color: '#5A7A9A' },
  { status: 'in_progress', label: 'In Progress', color: '#F97316' },
  { status: 'done', label: 'Done', color: '#39FF14' },
];

const PRIORITY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; label: string }> = {
  urgent: { icon: AlertTriangle, color: '#F43F5E', label: 'Urgent' },
  high:   { icon: AlertCircle, color: '#F97316', label: 'High' },
  medium: { icon: Minus, color: '#F97316', label: 'Medium' },
  low:    { icon: Minus, color: '#5A7A9A', label: 'Low' },
};

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function isDueOverdue(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now();
}

function KanbanCard({
  task,

  onTaskClick,
}: {
  task: KanbanTask;
  onStatusChange: KanbanBoardProps['onStatusChange'];
  onTaskClick?: KanbanBoardProps['onTaskClick'];
}) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).classList.add('kb-card-dragging');
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).classList.remove('kb-card-dragging');
  };

  const priorityConf = task.priority ? PRIORITY_CONFIG[task.priority] : null;
  const PriorityIcon = priorityConf?.icon;

  return (
    <div
      className="kb-card"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onTaskClick?.(task.id)}
    >
      <div className="kb-card-grip">
        <GripVertical size={14} />
      </div>
      <div className="kb-card-content">
        <span className="kb-card-title">{task.title}</span>
        <div className="kb-card-meta">
          {priorityConf && PriorityIcon && (
            <span
              className="kb-priority-badge"
              style={{ '--pri-color': priorityConf.color } as React.CSSProperties}
            >
              <PriorityIcon size={10} />
              {priorityConf.label}
            </span>
          )}
          {task.due_date && (
            <span className={`kb-due-badge ${isDueOverdue(task.due_date) && task.status !== 'done' ? 'overdue' : ''}`}>
              <Calendar size={10} />
              {formatDueDate(task.due_date)}
            </span>
          )}
          {task.subtask_count && task.subtask_count > 0 && (
            <span className="kb-subtask-badge">
              <CheckCircle2 size={10} />
              {task.subtasks_completed || 0}/{task.subtask_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export const KanbanBoard = React.memo(function KanbanBoard({
  tasks,
  onStatusChange,
  onPositionChange,
  onTaskClick,
  columns = DEFAULT_COLUMNS,
  enableManualSort = false,
}: KanbanBoardProps) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(status);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Only clear if leaving the column entirely
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      setDragOverCol(null);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, status: Task['status']) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    if (enableManualSort && onPositionChange) {
      // Calculate drop position based on Y coordinate
      const dropY = e.clientY;
      const column = e.currentTarget;
      const cards = Array.from(column.querySelectorAll('.kb-card'));

      let newPosition = 0;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        if (dropY < rect.top + rect.height / 2) {
          newPosition = i;
          break;
        }
        newPosition = i + 1;
      }

      onPositionChange(taskId, newPosition, status);
    } else {
      onStatusChange(taskId, status);
    }
  }, [enableManualSort, onStatusChange, onPositionChange]);

  return (
    <div className="kb-board">
      {columns.map(col => {
        const colTasks = tasks
          .filter(t => {
            const taskStatus = t.board_status || t.status;
            return taskStatus === col.status;
          })
          .sort((a, b) => {
            if (enableManualSort) {
              // Manual sort by board_position
              const posA = a.board_position ?? 999999;
              const posB = b.board_position ?? 999999;
              return posA - posB;
            }
            // Auto-sort by priority (urgent/P1 first)
            const priorityMap: Record<string, number> = { urgent: 1, high: 2, medium: 3, low: 4 };
            const priA = priorityMap[a.priority || 'medium'] || 3;
            const priB = priorityMap[b.priority || 'medium'] || 3;
            return priA - priB;
          });
        const isOver = dragOverCol === col.status;

        return (
          <div
            key={col.status}
            className={`kb-column ${isOver ? 'kb-col-dragover' : ''}`}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.status)}
            style={{ '--col-color': col.color } as React.CSSProperties}
          >
            <div className="kb-col-header">
              <div className="kb-col-indicator" />
              <h3 className="kb-col-title">{col.label}</h3>
              <span className="kb-col-count">{colTasks.length}</span>
            </div>
            <div className="kb-col-body">
              {colTasks.length === 0 && (
                <div className="kb-col-empty">
                  {isOver ? 'Drop here' : 'No tasks'}
                </div>
              )}
              {colTasks.map(task => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  onTaskClick={onTaskClick}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export type { KanbanTask, KanbanColumn };
