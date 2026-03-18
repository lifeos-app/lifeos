/**
 * HierarchyPreview — Interactive tree preview of a decomposed objective
 *
 * Shows Objective > Epics > Goals > Tasks with toggleable checkboxes,
 * inline title editing, and collapsible sections.
 */

import { useState } from 'react';
import { ChevronRight, ChevronDown, Check, Pencil } from 'lucide-react';
import { LEVEL_COLORS, PRIORITY_COLORS } from './utils';
import type { DecomposedHierarchy } from '../../lib/llm/objective-decomposer';

interface HierarchyPreviewProps {
  hierarchy: DecomposedHierarchy;
  excludedPaths: Set<string>;
  onToggleNode: (path: string) => void;
  onEditTitle: (path: string, newTitle: string) => void;
}

export function HierarchyPreview({ hierarchy, excludedPaths, onToggleNode, onEditTitle }: HierarchyPreviewProps) {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const toggleCollapse = (path: string) => {
    setCollapsedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const startEdit = (path: string, currentTitle: string) => {
    setEditingPath(path);
    setEditValue(currentTitle);
  };

  const commitEdit = () => {
    if (editingPath && editValue.trim()) {
      onEditTitle(editingPath, editValue.trim());
    }
    setEditingPath(null);
    setEditValue('');
  };

  const isExcluded = (path: string) => excludedPaths.has(path);

  const renderTitle = (path: string, title: string, icon?: string) => {
    if (editingPath === path) {
      return (
        <input
          className="nlp-edit-input"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingPath(null); }}
          autoFocus
        />
      );
    }
    return (
      <span className="nlp-node-title">
        {icon && <span className="nlp-node-icon">{icon}</span>}
        <span>{title}</span>
        <button className="nlp-edit-btn" onClick={e => { e.stopPropagation(); startEdit(path, title); }} title="Edit title">
          <Pencil size={11} />
        </button>
      </span>
    );
  };

  const { objective, epics } = hierarchy;

  return (
    <div className="nlp-hierarchy">
      {/* Objective */}
      <div className="nlp-node nlp-node-objective" style={{ borderLeftColor: LEVEL_COLORS.objective }}>
        <div className="nlp-node-header">
          <span className="nlp-node-level" style={{ background: LEVEL_COLORS.objective }}>Objective</span>
          {renderTitle('objective', objective.title, objective.icon)}
        </div>
        {objective.description && <p className="nlp-node-desc">{objective.description}</p>}
        {objective.targetDate && <span className="nlp-node-date">Target: {objective.targetDate}</span>}
      </div>

      {/* Epics */}
      {epics.map((epic, ei) => {
        const epicPath = `epic-${ei}`;
        const excluded = isExcluded(epicPath);
        const collapsed = collapsedPaths.has(epicPath);

        return (
          <div key={epicPath} className={`nlp-node nlp-node-epic ${excluded ? 'nlp-excluded' : ''}`} style={{ borderLeftColor: LEVEL_COLORS.epic }}>
            <div className="nlp-node-header">
              <label className="nlp-checkbox" onClick={() => onToggleNode(epicPath)}>
                <span className={`nlp-check ${excluded ? '' : 'nlp-checked'}`}>
                  {!excluded && <Check size={10} />}
                </span>
              </label>
              <button className="nlp-collapse-btn" onClick={() => toggleCollapse(epicPath)}>
                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              <span className="nlp-node-level" style={{ background: LEVEL_COLORS.epic }}>Epic</span>
              {renderTitle(epicPath, epic.title, epic.icon)}
            </div>

            {!collapsed && !excluded && epic.goals.map((goal, gi) => {
              const goalPath = `${epicPath}.goal-${gi}`;
              const goalExcluded = isExcluded(goalPath);
              const goalCollapsed = collapsedPaths.has(goalPath);

              return (
                <div key={goalPath} className={`nlp-node nlp-node-goal ${goalExcluded ? 'nlp-excluded' : ''}`} style={{ borderLeftColor: LEVEL_COLORS.goal }}>
                  <div className="nlp-node-header">
                    <label className="nlp-checkbox" onClick={() => onToggleNode(goalPath)}>
                      <span className={`nlp-check ${goalExcluded ? '' : 'nlp-checked'}`}>
                        {!goalExcluded && <Check size={10} />}
                      </span>
                    </label>
                    <button className="nlp-collapse-btn" onClick={() => toggleCollapse(goalPath)}>
                      {goalCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <span className="nlp-node-level" style={{ background: LEVEL_COLORS.goal }}>Goal</span>
                    {renderTitle(goalPath, goal.title, goal.icon)}
                  </div>
                  {goal.targetDate && <span className="nlp-node-date">Due: {goal.targetDate}</span>}

                  {!goalCollapsed && !goalExcluded && goal.tasks.map((task, ti) => {
                    const taskPath = `${goalPath}.task-${ti}`;
                    const taskExcluded = isExcluded(taskPath);

                    return (
                      <div key={taskPath} className={`nlp-node nlp-node-task ${taskExcluded ? 'nlp-excluded' : ''}`} style={{ borderLeftColor: LEVEL_COLORS.task || '#F59E0B' }}>
                        <div className="nlp-node-header">
                          <label className="nlp-checkbox" onClick={() => onToggleNode(taskPath)}>
                            <span className={`nlp-check ${taskExcluded ? '' : 'nlp-checked'}`}>
                              {!taskExcluded && <Check size={10} />}
                            </span>
                          </label>
                          {renderTitle(taskPath, task.title)}
                          <span className="nlp-task-meta">
                            <span className="nlp-priority" style={{ color: PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || '#5A7A9A' }}>
                              {task.priority}
                            </span>
                            <span className="nlp-duration">{task.estimatedMinutes}m</span>
                            <span className="nlp-week">W{task.suggestedWeek}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
