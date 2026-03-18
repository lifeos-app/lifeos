import { useState, useMemo, useCallback } from 'react';
import { Plus, ChevronDown, Info } from 'lucide-react';
import { EmojiIcon } from '../lib/emoji-icon';
import { ProgressRing } from './ui/ProgressRing';
import { NodeDetail } from './NodeDetail';
import { TaskDetail } from './TaskDetail';
import './VisionTree.css';

interface TreeNode {
  id: string;
  title: string;
  icon: string;
  color: string;
  progress: number;
  category: string;
  parent_goal_id: string | null;
  description?: string | null;
  sort_order?: number;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority?: string;
  due_date?: string;
  goal_id?: string;
}

interface TaskInfo { total: number; done: number; }

interface VisionTreeProps {
  goals: TreeNode[];
  tasks: Record<string, TaskInfo>;
  allTasks?: TaskItem[];
  onCreateNode: (parentId: string | null, category: string) => void;
  onSelectGoal: (id: string) => void;
  onMoveGoal: (goalId: string, newParentId: string | null) => void;
  onToggleTask?: (taskId: string, currentStatus: string) => void;
}

function rollUp(node: TreeNode, all: TreeNode[], taskMap: Record<string, TaskInfo>): number {
  const children = all.filter(n => n.parent_goal_id === node.id);
  if (children.length === 0) {
    const t = taskMap[node.id];
    if (t && t.total > 0) return t.done / t.total;
    return node.progress || 0;
  }
  const cp = children.map(c => rollUp(c, all, taskMap));
  return cp.reduce((a, b) => a + b, 0) / cp.length;
}

// ProgressRing — now using consolidated component from ui/ProgressRing

export function VisionTree({ goals, tasks, allTasks = [], onCreateNode, onSelectGoal: _onSelectGoal, onMoveGoal: _onMoveGoal, onToggleTask: _onToggleTask }: VisionTreeProps) {
  // Focus state per level: which node is selected at each depth
  const [focusedObjective, setFocusedObjective] = useState<string | null>(null);
  const [focusedEpic, setFocusedEpic] = useState<string | null>(null);
  const [focusedGoal] = useState<string | null>(null);
  // Detail modal state
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const objectives = useMemo(() =>
    goals.filter(g => g.category === 'objective' && !g.parent_goal_id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [goals]
  );

  const getChildren = useCallback((parentId: string) =>
    goals.filter(g => g.parent_goal_id === parentId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [goals]
  );

  const _getTasksForGoal = useCallback((goalId: string) =>
    allTasks.filter(t => t.goal_id === goalId),
    [allTasks]
  );

  const totalPct = useMemo(() => {
    if (objectives.length === 0) return 0;
    return Math.round(objectives.reduce((s, o) => s + rollUp(o, goals, tasks), 0) / objectives.length * 100);
  }, [objectives, goals, tasks]);

  // Current epics (children of focused objective)
  const currentEpics = focusedObjective ? getChildren(focusedObjective) : [];
  // Current goals (children of focused epic)
  const currentGoals = focusedEpic ? getChildren(focusedEpic) : [];
  // Tasks now shown via NodeDetail modal, not inline

  const handleObjectiveClick = (id: string) => {
    if (focusedObjective === id) {
      setFocusedObjective(null);
      setFocusedEpic(null);
      setFocusedGoal(null);
    } else {
      setFocusedObjective(id);
      setFocusedEpic(null);
      setFocusedGoal(null);
    }
  };

  const handleEpicClick = (id: string) => {
    if (focusedEpic === id) {
      setFocusedEpic(null);
      setFocusedGoal(null);
    } else {
      setFocusedEpic(id);
      setFocusedGoal(null);
    }
  };

  const handleGoalClick = (id: string) => {
    // Open NodeDetail modal directly instead of inline task tier
    setDetailNodeId(id);
  };

  // Render a node card — different sizes based on focus
  const renderNode = (node: TreeNode, isFocused: boolean, isCompressed: boolean, onClick: () => void, depth: number) => {
    const pct = Math.round(rollUp(node, goals, tasks) * 100);
    const cat = node.category || 'goal';
    const color = node.color || '#00D4FF';
    const children = getChildren(node.id);
    const nodeTasks = tasks[node.id];
    const childLabel = cat === 'objective' ? 'epics' : cat === 'epic' ? 'goals' : 'tasks';
    const childCount = cat === 'goal' ? (nodeTasks?.total || 0) : children.length;

    return (
      <div
        key={node.id}
        className={`vp-node cat-${cat} ${isFocused ? 'focused' : ''} ${isCompressed ? 'compressed' : ''} depth-${depth}`}
        onClick={onClick}
        style={{ '--node-color': color } as any}
      >
        {/* Compressed: just icon + abbreviated */}
        {isCompressed ? (
          <div className="vp-node-compact">
            <ProgressRing value={pct} color={color} size={36} strokeWidth={3} />
            <span className="vp-node-icon-sm"><EmojiIcon emoji={node.icon || '🎯'} size={14} fallbackAsText /></span>
            <span className="vp-node-title-sm">{node.title}</span>
            <button
              className="vp-info-btn vp-info-btn-compact"
              onClick={(e) => { e.stopPropagation(); setDetailNodeId(node.id); }}
              title="View details"
            >
              <Info size={12} />
            </button>
          </div>
        ) : (
          <div className="vp-node-full">
            <div className="vp-node-header">
              <ProgressRing value={pct} color={color} size={isFocused ? 56 : 48} strokeWidth={3} />
              <div className="vp-node-body">
                <span className="vp-node-icon"><EmojiIcon emoji={node.icon || '🎯'} size={20} fallbackAsText /></span>
                <span className="vp-node-title">{node.title}</span>
                <div className="vp-node-stats">
                  {childCount > 0 && <span className="vp-stat">{childCount} {childLabel}</span>}
                  {nodeTasks && nodeTasks.total > 0 && cat !== 'goal' && (
                    <span className="vp-stat">{nodeTasks.done}/{nodeTasks.total} tasks</span>
                  )}
                </div>
              </div>
              <button
                className="vp-info-btn"
                onClick={(e) => { e.stopPropagation(); setDetailNodeId(node.id); }}
                title="View details"
              >
                <Info size={14} />
              </button>
            </div>
            {isFocused && node.description && (
              <p className="vp-node-desc">{node.description.split('\n')[0]}</p>
            )}
            {isFocused && <ChevronDown size={14} className="vp-expand-indicator" />}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="vp-wrap">
      {/* ====== APEX ====== */}
      <div className="vp-apex">
        <ProgressRing value={totalPct} color="#00D4FF" size={64} strokeWidth={4} />
        <div className="vp-apex-info">
          <h2 className="vp-apex-title">LifeOS</h2>
          <span className="vp-apex-sub">{objectives.length} objectives · {goals.length} nodes</span>
        </div>
      </div>

      <div className="vp-connector" />

      {/* ====== TIER 1: OBJECTIVES ====== */}
      <div className="vp-tier-label">OBJECTIVES</div>
      <div className={`vp-tier ${focusedObjective ? 'has-focus' : ''}`}>
        {objectives.map(obj =>
          renderNode(
            obj,
            focusedObjective === obj.id,
            focusedObjective !== null && focusedObjective !== obj.id,
            () => handleObjectiveClick(obj.id),
            0
          )
        )}
      </div>

      {/* ====== TIER 2: EPICS (visible when objective focused) ====== */}
      {focusedObjective && currentEpics.length > 0 && (
        <>
          <div className="vp-connector" />
          <div className="vp-tier-label">EPICS — {goals.find(g => g.id === focusedObjective)?.title}</div>
          <div className={`vp-tier ${focusedEpic ? 'has-focus' : ''}`}>
            {currentEpics.map(epic =>
              renderNode(
                epic,
                focusedEpic === epic.id,
                focusedEpic !== null && focusedEpic !== epic.id,
                () => handleEpicClick(epic.id),
                1
              )
            )}
          </div>
        </>
      )}

      {focusedObjective && currentEpics.length === 0 && (
        <>
          <div className="vp-connector" />
          <div className="vp-empty-tier">
            <p>No epics yet</p>
            <button className="vp-add-btn" onClick={() => onCreateNode(focusedObjective, 'epic')}>
              <Plus size={12} /> Add Epic
            </button>
          </div>
        </>
      )}

      {/* ====== TIER 3: GOALS (visible when epic focused) ====== */}
      {focusedEpic && currentGoals.length > 0 && (
        <>
          <div className="vp-connector" />
          <div className="vp-tier-label">GOALS — {goals.find(g => g.id === focusedEpic)?.title}</div>
          <div className={`vp-tier ${focusedGoal ? 'has-focus' : ''}`}>
            {currentGoals.map(goal =>
              renderNode(
                goal,
                focusedGoal === goal.id,
                focusedGoal !== null && focusedGoal !== goal.id,
                () => handleGoalClick(goal.id),
                2
              )
            )}
          </div>
        </>
      )}

      {focusedEpic && currentGoals.length === 0 && (
        <>
          <div className="vp-connector" />
          <div className="vp-empty-tier">
            <p>No goals yet</p>
            <button className="vp-add-btn" onClick={() => onCreateNode(focusedEpic, 'goal')}>
              <Plus size={12} /> Add Goal
            </button>
          </div>
        </>
      )}

      {/* NodeDetail Modal */}
      {detailNodeId && (
        <NodeDetail
          nodeId={detailNodeId}
          allGoals={goals}
          allTasks={allTasks}
          onClose={() => setDetailNodeId(null)}
          onNavigate={(id) => setDetailNodeId(id)}
        />
      )}

      {/* TaskDetail Modal */}
      {detailTaskId && (
        <TaskDetail
          taskId={detailTaskId}
          allGoals={goals}
          allTasks={allTasks}
          onClose={() => setDetailTaskId(null)}
          onNavigateToNode={(id) => { setDetailTaskId(null); setDetailNodeId(id); }}
        />
      )}
    </div>
  );
}
