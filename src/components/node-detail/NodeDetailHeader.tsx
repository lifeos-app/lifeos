import { X, Save, XCircle } from 'lucide-react';
import { EmojiIcon } from '../../lib/emoji-icon';
import { AIChildGenerator } from '../goals/AIChildGenerator';
import { GoalTaskGenerator } from '../goals/GoalTaskGenerator';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import type { NodeDetailStateReturn } from './useNodeDetailState';

export function NodeDetailHeader(state: NodeDetailStateReturn) {
  const { node, cat, color, editingTitle, editTitle, setEditTitle, setEditingTitle,
    saveTitle, catLabel, priorityColors, domainColors, onClose, children, nodeId } = state;

  return (
    <>
      {/* Accent bar */}
      <div className="nd-accent-bar" style={{ background: color }} />

      {/* HEADER */}
      <div className="nd-header">
        <div className="nd-header-left">
          <span className="nd-icon-wrap"><EmojiIcon emoji={node?.icon || '🎯'} size={48} fallbackAsText /></span>
          <div className="nd-header-info">
            <div className="nd-meta-badges" style={{ marginBottom: 8 }}>
              <span className={`nd-cat-badge cat-${cat}`}>{catLabel}</span>
              {node?.domain && (
                <span className="nd-meta-badge" style={{ background: `${domainColors[node.domain]}15`, borderColor: `${domainColors[node.domain]}40`, color: domainColors[node.domain], border: '1px solid' }}>
                  {node.domain}
                </span>
              )}
              {node?.priority && (
                <span className="nd-meta-badge" style={{ background: `${priorityColors[node.priority]}15`, borderColor: `${priorityColors[node.priority]}40`, color: priorityColors[node.priority], border: '1px solid' }}>
                  {node.priority}
                </span>
              )}
            </div>
            {editingTitle ? (
              <div className="flex gap-1.5">
                <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  className="nd-title-input" />
                <button onClick={saveTitle} className="px-2.5 py-1.5 bg-cyan-500/15 border border-cyan-500/30 rounded-md text-cyan-400 cursor-pointer" aria-label="Save title"><Save size={14} /></button>
                <button onClick={() => setEditingTitle(false)} className="px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md text-white cursor-pointer" aria-label="Cancel editing"><XCircle size={14} /></button>
              </div>
            ) : (
              <h2 onClick={() => setEditingTitle(true)} className="nd-title">
                {node?.title || 'Unknown'}
              </h2>
            )}
          </div>
        </div>
        <button onClick={onClose} className="nd-close">
          <X size={20} />
        </button>
      </div>

      {/* AI Generate + Task Generator buttons */}
      {(cat === 'objective' || cat === 'epic' || cat === 'goal') && (
        <div className="nd-generate-bar">
          {cat === 'objective' && (
            <AIChildGenerator
              parentId={nodeId}
              parentTitle={node?.title || ''}
              parentDescription={node?.description || null}
              parentCategory="objective"
              childCategory="epic"
              existingChildren={children}
              targetDate={node?.target_date}
              onCreated={() => useGoalsStore.getState().fetchAll()}
            />
          )}
          {cat === 'epic' && (
            <AIChildGenerator
              parentId={nodeId}
              parentTitle={node?.title || ''}
              parentDescription={node?.description || null}
              parentCategory="epic"
              childCategory="goal"
              existingChildren={children}
              targetDate={node?.target_date}
              onCreated={() => useGoalsStore.getState().fetchAll()}
            />
          )}
          {cat === 'goal' && (
            <GoalTaskGenerator
              goalId={nodeId}
              goalTitle={node?.title || ''}
              goalDescription={node?.description || null}
              goalTargetDate={node?.target_date}
              onTasksCreated={() => useScheduleStore.getState().fetchAll()}
            />
          )}
        </div>
      )}
    </>
  );
}