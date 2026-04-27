/**
 * TutorModeButton — pill selector for TutorBot modes
 */

import {
  MessageCircle, Layers, HelpCircle, Search, Network, Dumbbell,
} from 'lucide-react';
import { getModeLabel, type TutorMode } from '../../lib/llm/academy-tutor';

const ICON_MAP: Record<TutorMode, React.ReactNode> = {
  chat:       <MessageCircle size={14} />,
  deep_solve: <Layers size={14} />,
  quiz:       <HelpCircle size={14} />,
  research:   <Search size={14} />,
  visualize:  <Network size={14} />,
  practice:   <Dumbbell size={14} />,
};

interface TutorModeButtonProps {
  mode: TutorMode;
  active: boolean;
  onClick: (mode: TutorMode) => void;
}

export function TutorModeButton({ mode, active, onClick }: TutorModeButtonProps) {
  return (
    <button
      onClick={() => onClick(mode)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 12px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'all 0.15s',
        border: active ? '1px solid #00D4FF' : '1px solid rgba(255,255,255,0.1)',
        background: active ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
        color: active ? '#00D4FF' : '#8BA4BE',
      }}
    >
      {ICON_MAP[mode]}
      {getModeLabel(mode)}
    </button>
  );
}
