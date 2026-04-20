/**
 * GoalTreeNode — Recursive tree renderer for goals hierarchy.
 *
 * Updated with: ProgressRing, motivational state badge, decomposition preview,
 * time remaining display, and icon-click-to-detail.
 */

import { useState } from 'react';
import { ChevronRight, Calendar, Plus, CheckCircle2, Circle, Trash2, Loader2, Check, Pencil, GripVertical, MoreHorizontal, Info, Flag, Zap, Clock } from 'lucide-react';
import { EmojiIcon } from '../../lib/emoji-icon';
import { MiniChart } from '../MiniChart';
import { GoalTaskGenerator } from './GoalTaskGenerator';
import { ProgressRing } from '../ui/ProgressRing';
import type { GoalNode, GoalTask, GoalView } from './types';
import { getCountdown, calcProgress, calculateVelocity, projectCompletionDate, PRIORITY_COLORS, LEVEL_COLORS, STATUS_ICONS } from './utils';

/** Motivational goal state computation */
function getGoalState(g: GoalNode, pct: number): { state: 'on-track' | 'at-risk' | 'behind' | 'completed'; label: string } {
  if (pct >= 100) return { state: 'completed', label: 'Completed' };
  if (!g.target_date || !g.created_at) return { state: 'on-track', label: 'On Track' };
  const now = Date.now();
  const start = new Date(g.created_at).getTime();
  const end = new Date(g.target_date + 'T00:00:00').getTime();
  const totalDuration = end - start;
  if (totalDuration <= 0) {
    if (pct >= 80) return { state: 'on-track', label: 'On Track' };
    if (pct >= 40) return { state: 'at-risk', label: 'At Risk' };
    return { state: 'behind', label: 'Behind' };
  }
  const timeElapsed = Math.min(1, Math.max(0, (now - start) / totalDuration));
  const progressRatio = pct / 100;
  if (timeElapsed > 0.8 && progressRatio > 0.8) return { state: 'on-track', label: 'On Track' };
  if (timeElapsed > 0.6 && progressRatio < 0.6) return { state: 'at-risk', label: 'At Risk' };
  if (timeElapsed > 0.8 && progressRatio < 0.4) return { state: 'behind', label: 'Behind' };
  if (progressRatio >= timeElapsed) return { state: 'on-track', label: 'On Track' };
  if (timeElapsed > 0.6 && progressRatio < timeElapsed * 0.75) return { state: 'at-risk', label: 'At Risk' };
  return { state: 'on-track', label: 'On Track' };
}

/** Human-readable time remaining */
function getTimeRemaining(targetDate: string | null): { text: string; urgency: 'ok' | 'warning' | 'overdue' } | null {
  if (!targetDate) return null;
  const target = new Date(targetDate + 'T00:00:00').getTime();
  const now = Date.now();
  const diffMs = target - now;
  const absDiffDays = Math.abs(Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  if (diffMs < 0) {
    if (absDiffDays === 0) return { text: 'Overdue today', urgency: 'overdue' };
    if (absDiffDays <= 30) return { text: `Overdue by ${absDiffDays} day${absDiffDays !== 1 ? 's' : ''}`, urgency: 'overdue' };
    return { text: `Overdue by ${Math.ceil(absDiffDays / 30)} month${Math.ceil(absDiffDays / 30) !== 1 ? 's' : ''}`, urgency: 'overdue' };
  }
  if (absDiffDays === 0) return { text: 'Due today', urgency: 'warning' };
  if (absDiffDays === 1) return { text: '1 day left', urgency: 'warning' };
  if (absDiffDays <= 14) return { text: `${absDiffDays} days left`, urgency: absDiffDays <= 3 ? 'warning' : 'ok' };
  if (absDiffDays <= 45) return { text: `${Math.round(absDiffDays / 7)} weeks left`, urgency: 'ok' };
  if (absDiffDays <= 365) return { text: `${Math.round(absDiffDays / 30)} months left`, urgency: 'ok' };
  return { text: `${Math.round(absDiffDays / 365)} year${Math.round(absDiffDays / 365) !== 1 ? 's' : ''} left`, urgency: 'ok' };
}

// ── Progress Bar with Milestones ──
function ProgressBar({ pct, color, size = 'normal' }: { pct: number; color: string; size?: 'normal' | 'small' }) {
  const height = size === 'small' ? 4 : 6;
  const progressGradient = pct >= 100
    ? `linear-gradient(90deg, ${color}, #39FF14)`
    : pct >= 75
      ? `linear-gradient(90deg, ${color}, ${color}dd)`
      : color;
  return (
    <div className="g-progress-bar" style={{ height }}>
      <div className="g-progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: progressGradient }} />
      {size === 'normal' && (
        <>
          <div className="g-milestone" style={{ left: '25%' }} data-reached={pct >= 25} />
          <div className="g-milestone" style={{ left: '50%' }} data-reached={pct >= 50} />
          <div className="g-milestone" style={{ left: '75%' }} data-reached={pct >= 75} />
        </>
      )}
    </div>
  );
}

interface GoalTreeNodeProps {
  goal: GoalNode;
  depth: number;
  isLast: boolean;
  parentPath: boolean[];
  goals: GoalNode[];
  allTasks: GoalTask[];
  expandedIds: Set<string>;
  highlightedNodeId: string | null;
  celebrateGoalId: string | null;
  dragId: string | null;
  dragOverId: string | null;
  dragPosition: 'above' | 'below' | null;
  swipeId: string | null;
  swipeX: number;
  editingTitle: string | null;
  editTitleVal: string;
  newLinkedTask: string | null;
  newLinkedTaskTitle: string;
  creatingLinkedTask: boolean;
  linkedTasks: Record<string, GoalTask[]>;
  taskChartData: Record<string, { data: number[]; labels: string[] }>;
  detailTaskId: string | null;
  ringsAnimated: boolean;
  onToggleExpand: (id: string) => void;
  onCycleStatus: (id: string, status: string) => void;
  onSetDetailNodeId: (id: string) => void;
  onSetDetailTaskId: (id: string) => void;
  onSetEditingTitle: (id: string | null) => void;
  onSetEditTitleVal: (val: string) => void;
  onSaveTitle: (id: string) => void;
  onSetNewLinkedTask: (id: string | null) => void;
  onSetNewLinkedTaskTitle: (val: string) => void;
  onCreateLinkedTask: (goalId: string) => void;
  onToggleLinkedTask: (taskId: string, status: string, goalId: string) => void;
  onHandleDragStart: (e: React.DragEvent, id: string) => void;
  onHandleDragEnd: (e: React.DragEvent) => void;
  onHandleDragOver: (e: React.DragEvent, id: string) => void;
  onHandleDrop: (e: React.DragEvent, id: string) => void;
  onHandleTouchStart: (e: React.TouchEvent, id: string) => void;
  onHandleTouchMove: (e: React.TouchEvent) => void;
  onHandleTouchEnd: () => void;
  onHandleContextMenu: (e: React.MouseEvent, id: string) => void;
  onConfirmDelete: (title: string, msg: string, action: () => void) => void;
  onDeleteGoal: (id: string) => void;
  onCreateChild: (parentId: string, category: string) => void;
  onFetchGoals: () => void;
  getAllDescendants: (parentId: string, allGoals: GoalNode[]) => GoalNode[];
}

export function GoalTreeNode({
  goal: g,
  depth,
  isLast,
  parentPath,
  goals,
  allTasks,
  expandedIds,
  highlightedNodeId,
  celebrateGoalId,
  dragId,
  dragOverId,
  dragPosition,
  swipeId,
  swipeX,
  editingTitle,
  editTitleVal,
  newLinkedTask,
  newLinkedTaskTitle,
  creatingLinkedTask,
  linkedTasks,
  taskChartData,
  ringsAnimated,
  onToggleExpand,
  onCycleStatus,
  onSetDetailNodeId,
  onSetDetailTaskId,
  onSetEditingTitle,
  onSetEditTitleVal,
  onSaveTitle,
  onSetNewLinkedTask,
  onSetNewLinkedTaskTitle,
  onCreateLinkedTask,
  onToggleLinkedTask,
  onHandleDragStart,
  onHandleDragEnd,
  onHandleDragOver,
  onHandleDrop,
  onHandleTouchStart,
  onHandleTouchMove,
  onHandleTouchEnd,
  onHandleContextMenu,
  onConfirmDelete,
  onDeleteGoal,
  onCreateChild,
  onFetchGoals,
  getAllDescendants,
}: GoalTreeNodeProps) {
  const cat = g.category || 'goal';
  const computedProgress = calcProgress(g, goals, allTasks);
  const pct = Math.round(computedProgress * 100);
  const expanded = expandedIds.has(g.id);
  const tasks = allTasks.filter(t => t.goal_id === g.id);
  const doneTasks = tasks.filter(t => t.status === 'done');
  const activeTasks = tasks.filter(t => t.status !== 'done');
  const children = goals.filter(c => c.parent_goal_id === g.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const hasExpandable = children.length > 0 || tasks.length > 0;
  const levelColor = LEVEL_COLORS[cat] || '#00D4FF';
  const priorityColor = g.priority ? PRIORITY_COLORS[g.priority] : null;
  const nextChildCategory = cat === 'objective' ? 'epic' : cat === 'epic' ? 'goal' : null;
  const statusInfo = STATUS_ICONS[g.status] || STATUS_ICONS.active;
  const isDragOver = dragOverId === g.id;
  const isSwipedOpen = swipeId === g.id && swipeX < -30;

  // Progress ring color
  const ringColor = pct >= 100 ? '#FACC15' : pct >= 50 ? '#39FF14' : '#00D4FF';

  return (
    <div key={g.id} data-goal-id={g.id} className={`gt-node-wrap depth-${depth}`}>
      {depth > 0 && (
        <div className="gt-connectors">
          {parentPath.map((showLine, i) => (
            <div key={i} className={`gt-vline ${showLine ? 'active' : ''}`} style={{ left: `${i * 28 + 14}px` }} />
          ))}
          <div className="gt-hline" style={{ left: `${(depth - 1) * 28 + 14}px`, width: '14px', top: '24px' }} />
          <div className={`gt-elbow ${isLast ? 'last' : ''}`} style={{ left: `${(depth - 1) * 28 + 14}px` }} />
        </div>
      )}

      {isDragOver && dragPosition === 'above' && <div className="gt-drop-indicator" />}

      <div
        className={`gt-card cat-${cat}${expanded ? ' expanded' : ''}${highlightedNodeId === g.id ? ' highlighted' : ''}${celebrateGoalId === g.id ? ' celebrating' : ''}${dragId === g.id ? ' dragging' : ''}`}
        style={{
          '--level-color': levelColor,
          '--g-color': g.color || levelColor,
          '--progress-pct': `${pct}%`,
          marginLeft: `${depth * 28}px`,
          transform: isSwipedOpen ? `translateX(${swipeX}px)` : undefined,
          borderLeft: priorityColor ? `3px solid ${priorityColor}` : undefined,
        } as React.CSSProperties}
        draggable
        onDragStart={(e) => onHandleDragStart(e, g.id)}
        onDragEnd={onHandleDragEnd}
        onDragOver={(e) => onHandleDragOver(e, g.id)}
        onDrop={(e) => onHandleDrop(e, g.id)}
        onTouchStart={(e) => onHandleTouchStart(e, g.id)}
        onTouchMove={onHandleTouchMove}
        onTouchEnd={onHandleTouchEnd}
        onContextMenu={(e) => onHandleContextMenu(e, g.id)}
      >
        <div className="gt-swipe-bg"><Trash2 size={18} /><span>Delete</span></div>

        <div className="gt-card-inner">
          {/* Circular SVG Progress Ring */}
          <div className="gt-progress-ring" style={{ width: 42, height: 42 }} onClick={(e) => { e.stopPropagation(); onSetDetailNodeId(g.id); }} >
            <ProgressRing value={pct} size={42} strokeWidth={3} color={ringColor} glow={false} animate={ringsAnimated} />
          </div>

          {/* Status cycle button */}
          <button className="gt-status-btn" onClick={(e) => { e.stopPropagation(); onCycleStatus(g.id, g.status); }} style={{ color: statusInfo.color }} title={`Status: ${g.status} (tap to cycle)`}>
            {statusInfo.icon}
          </button>

          <GripVertical size={14} className="gt-drag-handle" />

          {/* Icon — click opens detail */}
          <div className="gt-icon-wrap" onClick={(e) => { e.stopPropagation(); onSetDetailNodeId(g.id); }} style={{ cursor: 'pointer' }}>
            <span className="gt-icon"><EmojiIcon emoji={g.icon || '🎯'} size={24} fallbackAsText /></span>
          </div>

          <div className="gt-content" onClick={() => { if (hasExpandable) onToggleExpand(g.id); }}>
            <div className="gt-title-row">
              {editingTitle === g.id ? (
                <input
                  className="gt-inline-input"
                  value={editTitleVal}
                  onChange={e => onSetEditTitleVal(e.target.value)}
                  onBlur={() => onSaveTitle(g.id)}
                  onKeyDown={e => { if (e.key === 'Enter') onSaveTitle(g.id); if (e.key === 'Escape') onSetEditingTitle(null); }}
                  onClick={e => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span className="gt-title" onClick={e => { e.stopPropagation(); onSetEditingTitle(g.id); onSetEditTitleVal(g.title); }} title="Click to edit">
                  {g.title}
                </span>
              )}
              {/* Motivational State Badge */}
              {(() => {
                const goalState = getGoalState(g, pct);
                return (
                  <span className="gt-state-badge" data-state={goalState.state}>
                    {goalState.label}
                  </span>
                );
              })()}
              <span className={`gt-cat-badge cat-${cat}`}>
                {cat === 'objective' ? '🎯' : cat === 'epic' ? '⚡' : '🏁'}
                <span>{cat}</span>
              </span>
            </div>

            <ProgressBar pct={pct} color={g.color || levelColor} />

            {/* Decomposition Preview */}
            {tasks.length > 0 && (
              <div className="gt-decomp-preview">
                <div className="gt-decomp-bar">
                  <div
                    className="gt-decomp-fill"
                    style={{
                      width: `${(doneTasks.length / tasks.length) * 100}%`,
                      background: g.color || levelColor,
                    }}
                  />
                </div>
                <span className="gt-decomp-label">{doneTasks.length}/{tasks.length} milestones</span>
              </div>
            )}

            <div className="gt-meta">
              {g.priority && (
                <span className="gt-priority-label" style={{ color: priorityColor || undefined }}>
                  {g.priority.charAt(0).toUpperCase() + g.priority.slice(1)}
                </span>
              )}
              {/* Human-readable time remaining */}
              {(() => {
                const tr = getTimeRemaining(g.target_date);
                if (!tr) return null;
                return (
                  <span className={`gt-time-remaining time-${tr.urgency}`}>
                    <Clock size={9} /> {tr.text}
                  </span>
                );
              })()}
              {children.length > 0 && (
                <span className="gt-child-count">
                  {children.length} {cat === 'objective' ? 'epic' : 'goal'}{children.length !== 1 ? 's' : ''}
                </span>
              )}
              {tasks.length > 0 && (
                <span className="gt-child-count">{doneTasks.length}/{tasks.length} tasks</span>
              )}
              {cat === 'objective' && (() => {
                const goalIds = new Set<string>();
                const q = [g.id];
                let epicCount = 0, goalCount = 0;
                while (q.length) {
                  const pid = q.pop()!;
                  goalIds.add(pid);
                  goals.filter(c => c.parent_goal_id === pid).forEach(c => {
                    q.push(c.id);
                    if (c.category === 'epic') epicCount++;
                    else if (c.category === 'goal') goalCount++;
                  });
                }
                const allObjTasks = allTasks.filter(t => t.goal_id && goalIds.has(t.goal_id));
                if (allObjTasks.length === 0 && epicCount === 0 && goalCount === 0) return null;
                const doneObjTasks = allObjTasks.filter(t => t.status === 'done').length;
                const vel = calculateVelocity(allObjTasks);
                const remaining = allObjTasks.filter(t => t.status !== 'done').length;
                const projDate = projectCompletionDate(vel, remaining);
                return (
                  <>
                    <span className="gt-obj-summary">
                      {epicCount > 0 && <>{epicCount}E</>}
                      {epicCount > 0 && goalCount > 0 && ' · '}
                      {goalCount > 0 && <>{goalCount}G</>}
                      {(epicCount > 0 || goalCount > 0) && allObjTasks.length > 0 && ' · '}
                      {allObjTasks.length > 0 && <>{doneObjTasks}/{allObjTasks.length}T</>}
                    </span>
                    {vel > 0 && <span className="gt-child-count" title="Tasks per week">{vel.toFixed(1)}/wk</span>}
                    {projDate && <span className="gt-child-count" title="Projected completion">{new Date(projDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>}
                  </>
                );
              })()}
            </div>
          </div>

          {hasExpandable && <ChevronRight size={16} className={`gt-chevron ${expanded ? 'rotated' : ''}`} onClick={() => onToggleExpand(g.id)} />}
          <button className="gt-more-btn" onClick={(e) => onHandleContextMenu(e, g.id)} title="More actions"><MoreHorizontal size={14} /></button>
          <button className="gt-info-btn" onClick={(e) => { e.stopPropagation(); onSetDetailNodeId(g.id); }} title="View details"><Info size={14} /></button>
          <button className="gt-delete-btn" onClick={(e) => {
            e.stopPropagation();
            const cc = getAllDescendants(g.id, goals).length;
            onConfirmDelete(`Delete "${g.title}"?`, cc > 0 ? `This will also delete ${cc} sub-item${cc > 1 ? 's' : ''} and their tasks.` : 'This cannot be undone.', () => onDeleteGoal(g.id));
          }} title="Delete"><Trash2 size={14} /></button>
        </div>
      </div>

      {isDragOver && dragPosition === 'below' && <div className="gt-drop-indicator" />}

      {expanded && (
        <div className="gt-children">
          {nextChildCategory && (
            <div style={{ marginLeft: `${(depth + 1) * 28}px`, marginBottom: 6 }}>
              <button className="gt-add-child-btn" onClick={(e) => { e.stopPropagation(); onCreateChild(g.id, nextChildCategory); }}>
                <Plus size={11} /> Add {nextChildCategory === 'epic' ? 'Epic' : 'Goal'}
              </button>
            </div>
          )}

          {children.map((child, idx) => (
            <GoalTreeNode
              key={child.id}
              goal={child}
              depth={depth + 1}
              isLast={idx === children.length - 1 && tasks.length === 0}
              parentPath={[...parentPath, !isLast]}
              goals={goals}
              allTasks={allTasks}
              expandedIds={expandedIds}
              highlightedNodeId={highlightedNodeId}
              celebrateGoalId={celebrateGoalId}
              dragId={dragId}
              dragOverId={dragOverId}
              dragPosition={dragPosition}
              swipeId={swipeId}
              swipeX={swipeX}
              editingTitle={editingTitle}
              editTitleVal={editTitleVal}
              newLinkedTask={newLinkedTask}
              newLinkedTaskTitle={newLinkedTaskTitle}
              creatingLinkedTask={creatingLinkedTask}
              linkedTasks={linkedTasks}
              taskChartData={taskChartData}
              detailTaskId={null}
              ringsAnimated={ringsAnimated}
              onToggleExpand={onToggleExpand}
              onCycleStatus={onCycleStatus}
              onSetDetailNodeId={onSetDetailNodeId}
              onSetDetailTaskId={onSetDetailTaskId}
              onSetEditingTitle={onSetEditingTitle}
              onSetEditTitleVal={onSetEditTitleVal}
              onSaveTitle={onSaveTitle}
              onSetNewLinkedTask={onSetNewLinkedTask}
              onSetNewLinkedTaskTitle={onSetNewLinkedTaskTitle}
              onCreateLinkedTask={onCreateLinkedTask}
              onToggleLinkedTask={onToggleLinkedTask}
              onHandleDragStart={onHandleDragStart}
              onHandleDragEnd={onHandleDragEnd}
              onHandleDragOver={onHandleDragOver}
              onHandleDrop={onHandleDrop}
              onHandleTouchStart={onHandleTouchStart}
              onHandleTouchMove={onHandleTouchMove}
              onHandleTouchEnd={onHandleTouchEnd}
              onHandleContextMenu={onHandleContextMenu}
              onConfirmDelete={onConfirmDelete}
              onDeleteGoal={onDeleteGoal}
              onCreateChild={onCreateChild}
              onFetchGoals={onFetchGoals}
              getAllDescendants={getAllDescendants}
            />
          ))}

          {(cat === 'goal' || !cat || cat === 'epic') && (
            <div style={{ marginLeft: `${(depth + 1) * 28}px`, marginBottom: 6 }}>
              <GoalTaskGenerator goalId={g.id} goalTitle={g.title} goalDescription={g.description} goalTargetDate={g.target_date} onTasksCreated={onFetchGoals} />
            </div>
          )}

          {tasks.length > 0 && (
            <div className="gt-tasks" style={{ marginLeft: `${(depth + 1) * 28}px` }}>
              <div className="gt-tasks-header">
                <span className="gt-tasks-label">Tasks ({tasks.length})</span>
                <button className="gt-add-task-btn" onClick={(e) => { e.stopPropagation(); onSetNewLinkedTask(newLinkedTask === g.id ? null : g.id); }}>
                  <Plus size={11} /> Task
                </button>
              </div>
              {newLinkedTask === g.id && (
                <div className="gt-new-task-form">
                  <input
                    className="gt-new-task-input"
                    placeholder="Task title..."
                    value={newLinkedTaskTitle}
                    onChange={e => onSetNewLinkedTaskTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onCreateLinkedTask(g.id); if (e.key === 'Escape') onSetNewLinkedTask(null); }}
                    autoFocus
                  />
                  <button className="gt-new-task-submit" onClick={() => onCreateLinkedTask(g.id)} disabled={creatingLinkedTask || !newLinkedTaskTitle.trim()}>
                    {creatingLinkedTask ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
                  </button>
                </div>
              )}
              {activeTasks.map(t => (
                <div key={t.id} className="gt-task-row">
                  <button className="gt-task-chk" onClick={e => { e.stopPropagation(); onToggleLinkedTask(t.id, t.status, g.id); }}>
                    <Circle size={14} strokeWidth={1.5} />
                  </button>
                  <span className="gt-task-title" onClick={e => { e.stopPropagation(); onSetDetailTaskId(t.id); }}>{t.title}</span>
                  {t.priority && <span className="gt-task-priority" data-priority={t.priority}>{t.priority}</span>}
                  {t.due_date && <span className="gt-task-due">{new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>}
                </div>
              ))}
              {doneTasks.length > 0 && (
                <details className="gt-done-group">
                  <summary className="gt-done-toggle"><CheckCircle2 size={11} /> {doneTasks.length} completed</summary>
                  {doneTasks.map(t => (
                    <div key={t.id} className="gt-task-row done">
                      <button className="gt-task-chk checked" onClick={e => { e.stopPropagation(); onToggleLinkedTask(t.id, t.status, g.id); }}>
                        <CheckCircle2 size={14} />
                      </button>
                      <span className="gt-task-title" onClick={e => { e.stopPropagation(); onSetDetailTaskId(t.id); }}>{t.title}</span>
                    </div>
                  ))}
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}