/**
 * ScheduleBoardView — Board/Kanban view for growth plan tasks
 *
 * Encapsulates the board view layout: header, KanbanBoard, and empty state.
 */
import { KanbanBoard } from '../KanbanBoard';
import type { ScheduleTask, ScheduleGoal } from './types';

interface ScheduleBoardViewProps {
  growthTasks: ScheduleTask[];
  onBoardStatusChange: (id: string, newStatus: string) => void;
  onBoardPositionChange: (id: string, newPosition: number, newStatus: string) => void;
}

export function ScheduleBoardView({
  growthTasks,
  onBoardStatusChange,
  onBoardPositionChange,
}: ScheduleBoardViewProps) {
  return (
    <div className="sched-board-view">
      <div className="sbv-header glass-card">
        <h2 className="sbv-title">TCS Growth Plan</h2>
        <span className="sbv-subtitle">{growthTasks.length} tasks across 3 milestones</span>
      </div>
      <KanbanBoard
        tasks={growthTasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status as 'pending' | 'in_progress' | 'done' | 'completed' | 'todo' | 'cancelled',
          priority: (t.priority as 'low' | 'medium' | 'high' | 'urgent') || undefined,
          due_date: t.due_date,
          board_status: (t as Record<string, unknown>).board_status as 'todo' | 'in_progress' | 'done' | undefined,
          board_position: (t as Record<string, unknown>).board_position as number | undefined,
        }))}
        onStatusChange={onBoardStatusChange}
        onPositionChange={onBoardPositionChange}
        enableManualSort
      />
      {growthTasks.length === 0 && (
        <div className="sbv-empty glass-card">
          <p>No growth plan tasks yet. Seed the 90-day plan from the TCS Growth Overview on the Work tab.</p>
        </div>
      )}
    </div>
  );
}