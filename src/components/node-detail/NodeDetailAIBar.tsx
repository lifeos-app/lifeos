import { MessageCircle, ChevronRight } from 'lucide-react';
import type { NodeDetailStateReturn } from './useNodeDetailState';

export function NodeDetailAIBar(state: NodeDetailStateReturn) {
  return (
    <div className="nd-zeroclaw-bar" onClick={state.handleZeroClawClick}>
      <MessageCircle size={18} />
      <span>Ask AI about this goal</span>
      <ChevronRight size={16} className="opacity-50" />
    </div>
  );
}