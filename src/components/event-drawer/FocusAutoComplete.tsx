// ═══ Focus Auto-Complete — Time's Up Flow ═══
// Shows when focus session duration expires. Offers Complete/Extend/Keep Going.

import { Check, Plus, Play } from 'lucide-react';
import type { ActiveEvent } from '../event-overlay/types';

interface FocusAutoCompleteProps {
  event: ActiveEvent;
  onComplete: () => void;
  onExtend: (minutes: number) => void;
  onKeepGoing: () => void;
  color: string;
}

export function FocusAutoComplete({ event, onComplete, onExtend, onKeepGoing, color }: FocusAutoCompleteProps) {
  return (
    <div className="edf-autocomplete-overlay">
      <div className="edf-autocomplete-card">
        <div className="edf-autocomplete-icon" style={{ color }}>⏰</div>
        <h3 className="edf-autocomplete-title">Time's Up!</h3>
        <p className="edf-autocomplete-desc">
          Your <strong>{event.title}</strong> session has ended.
        </p>
        <div className="edf-autocomplete-actions">
          <button className="edf-ac-btn edf-ac-btn--primary" onClick={onComplete} style={{ background: color }}>
            <Check size={16} /> Complete
          </button>
          <button className="edf-ac-btn edf-ac-btn--secondary" onClick={() => onExtend(15)}>
            <Plus size={16} /> Extend 15m
          </button>
          <button className="edf-ac-btn edf-ac-btn--ghost" onClick={onKeepGoing}>
            <Play size={16} /> Keep Going
          </button>
        </div>
      </div>
    </div>
  );
}
