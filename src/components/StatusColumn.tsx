import { useState, useCallback } from 'react';
import './StatusColumn.css';

interface StatusOption {
  value: string;
  label: string;
  color: string;
}

interface StatusColumnProps {
  value: string;
  options?: StatusOption[];
  onChange: (newValue: string) => void;
}

const DEFAULT_OPTIONS: StatusOption[] = [
  { value: 'todo', label: 'To Do', color: '#5A7A9A' },
  { value: 'in_progress', label: 'In Progress', color: '#F97316' },
  { value: 'done', label: 'Done', color: '#39FF14' },
];

export function StatusColumn({ value, options = DEFAULT_OPTIONS, onChange }: StatusColumnProps) {
  const [pulsing, setPulsing] = useState(false);

  const currentIdx = options.findIndex(o => o.value === value);
  const current = currentIdx >= 0 ? options[currentIdx] : options[0];

  const handleClick = useCallback(() => {
    const nextIdx = (currentIdx + 1) % options.length;
    const next = options[nextIdx];
    onChange(next.value);

    // Trigger pulse animation
    setPulsing(true);
    setTimeout(() => setPulsing(false), 400);
  }, [currentIdx, options, onChange]);

  return (
    <button
      className={`sc-pill ${pulsing ? 'sc-pulse' : ''}`}
      onClick={handleClick}
      style={{
        '--sc-color': current.color,
        '--sc-bg': `${current.color}20`,
      } as React.CSSProperties}
      type="button"
      title={`Click to change status (current: ${current.label})`}
    >
      <span className="sc-dot" />
      <span className="sc-label">{current.label}</span>
    </button>
  );
}

export type { StatusOption };
