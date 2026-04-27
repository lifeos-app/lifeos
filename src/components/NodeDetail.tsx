import { createPortal } from 'react-dom';
import { useNodeDetailState } from './node-detail/useNodeDetailState';
import { NodeDetailHeader } from './node-detail/NodeDetailHeader';
import { NodeDetailHierarchy } from './node-detail/NodeDetailHierarchy';
import { NodeDetailTabBar } from './node-detail/NodeDetailTabBar';
import { NodeDetailOverview } from './node-detail/NodeDetailOverview';
import { NodeDetailTasks } from './node-detail/NodeDetailTasks';
import { NodeDetailProgress } from './node-detail/NodeDetailProgress';
import { NodeDetailResources } from './node-detail/NodeDetailResources';
import { NodeDetailAIBar } from './node-detail/NodeDetailAIBar';
import type { NodeDetailProps } from './node-detail/types';

import './NodeDetail.css';

export function NodeDetail(props: NodeDetailProps) {
  const { nodeId, allGoals, allTasks, onClose, onNavigate } = props;
  const state = useNodeDetailState(nodeId, allGoals, allTasks, onClose, onNavigate);

  // Derived section open state keys
  const { activeTab, setActiveTab, sectionsOpen, toggleSection } = state;
  const { dragOffset, sheetRef, handleTouchStart, handleTouchMove, handleTouchEnd } = state;

  if (!state.node) { onClose(); return null; }

  const content = (
    <div className="nd-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        className="nd-sheet"
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle (mobile only) */}
        <div className="nd-drag-handle">
          <div className="nd-drag-pill" />
        </div>

        <NodeDetailHeader {...state} />

        {/* BODY - scrollable */}
        <div className="nd-body">
          <NodeDetailHierarchy {...state} />

          <NodeDetailTabBar activeTab={activeTab} setActiveTab={setActiveTab} />

          <div className="nd-tab-content">
            {activeTab === 'overview' && <NodeDetailOverview {...state} />}
            {activeTab === 'tasks' && <NodeDetailTasks {...state} />}
            {activeTab === 'progress' && <NodeDetailProgress {...state} />}
            {activeTab === 'resources' && <NodeDetailResources {...state} />}
          </div>

          <NodeDetailAIBar {...state} />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}