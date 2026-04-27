import { ChevronRight, CheckSquare } from 'lucide-react';
import { EmojiIcon } from '../../lib/emoji-icon';
import type { NodeDetailStateReturn } from './useNodeDetailState';

export function NodeDetailHierarchy(state: NodeDetailStateReturn) {
  const { node, cat, ancestorChain, children, onNavigate, linkedTasks, doneTasks, allTasks } = state;

  if (ancestorChain.length === 0 && children.length === 0) return null;

  return (
    <div className="nd-hierarchy-tree">
      <div className="nd-hierarchy-label">Hierarchy</div>
      {ancestorChain.map((ancestor, i) => (
        <div key={ancestor.id} style={{ paddingLeft: i * 16 }}>
          <button className="nd-hierarchy-btn" onClick={() => onNavigate?.(ancestor.id)}>
            <EmojiIcon emoji={ancestor.icon || '🎯'} size={16} fallbackAsText />
            <span className="nd-hierarchy-title">{ancestor.title}</span>
            <ChevronRight size={12} style={{ opacity: 0.3 }} />
          </button>
          <div className="nd-hierarchy-connector" />
        </div>
      ))}
      <div style={{ paddingLeft: ancestorChain.length * 16 }}>
        <div className="nd-hierarchy-node nd-hierarchy-current">
          <EmojiIcon emoji={node?.icon || '🎯'} size={16} fallbackAsText />
          <span className="nd-hierarchy-title">{node?.title}</span>
          {cat === 'goal' && linkedTasks.length > 0 && (
            <span className="nd-hierarchy-badge">
              <CheckSquare size={10} /> {doneTasks.length}/{linkedTasks.length}
            </span>
          )}
        </div>
      </div>
      {children.slice(0, 5).map(child => (
        <div key={child.id} style={{ paddingLeft: (ancestorChain.length + 1) * 16 }}>
          <div className="nd-hierarchy-connector" />
          <button className="nd-hierarchy-btn" onClick={() => onNavigate?.(child.id)}>
            <EmojiIcon emoji={child.icon || '🎯'} size={14} fallbackAsText />
            <span className="nd-hierarchy-title">{child.title}</span>
            {child.category === 'goal' && (
              <span className="nd-hierarchy-badge">
                <CheckSquare size={10} /> {allTasks.filter(t => t.goal_id === child.id && t.status === 'done').length}/{allTasks.filter(t => t.goal_id === child.id).length}
              </span>
            )}
            <ChevronRight size={12} style={{ opacity: 0.3 }} />
          </button>
        </div>
      ))}
      {children.length > 5 && (
        <div style={{ paddingLeft: (ancestorChain.length + 1) * 16 }} className="nd-hierarchy-label">
          +{children.length - 5} more
        </div>
      )}
    </div>
  );
}