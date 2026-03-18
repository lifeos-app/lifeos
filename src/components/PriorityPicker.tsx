import { AlertTriangle } from 'lucide-react';
import { PRIORITY_CONFIGS, type PriorityConfig } from '../constants/priorities';
import './PriorityPicker.css';

interface PriorityPickerProps {
  value?: 1 | 2 | 3 | 4;
  onChange: (level: 1 | 2 | 3 | 4) => void;
  variant?: 'full' | 'compact' | 'badge';
  disabled?: boolean;
}

export function PriorityPicker({
  value = 3,
  onChange,
  variant = 'full',
  disabled = false
}: PriorityPickerProps) {
  const priorities: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];

  if (variant === 'badge') {
    const config = PRIORITY_CONFIGS[value];
    return (
      <button
        className="priority-badge"
        onClick={() => {
          const nextLevel = ((value % 4) + 1) as 1 | 2 | 3 | 4;
          onChange(nextLevel);
        }}
        disabled={disabled}
        style={{
          color: config.color,
          backgroundColor: config.bgColor,
          border: `1px solid ${config.color}40`,
        }}
      >
        {config.level === 1 && <AlertTriangle size={11} />}
        {config.shortLabel}
      </button>
    );
  }

  return (
    <div className={`priority-picker priority-picker-${variant}`}>
      {priorities.map(level => {
        const config = PRIORITY_CONFIGS[level];
        const isActive = value === level;

        return (
          <button
            key={level}
            className={`priority-option ${isActive ? 'active' : ''}`}
            onClick={() => onChange(level)}
            disabled={disabled}
            style={isActive ? {
              backgroundColor: config.color,
              color: '#000',
              fontWeight: 600,
            } : {
              backgroundColor: config.bgColor,
              color: config.color,
              border: `1px solid ${config.color}30`,
            }}
          >
            {level === 1 && <AlertTriangle size={12} />}
            {variant === 'compact' ? config.shortLabel : config.label}
          </button>
        );
      })}
    </div>
  );
}
