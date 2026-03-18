/**
 * QuickAddTask — Minimal task form in a bottom sheet.
 * Title, optional date, priority. One-tap add.
 */

import { useState, useRef, useEffect } from 'react';
import { Plus, Send } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import { useScheduleStore } from '../../../stores/useScheduleStore';
import { useUserStore } from '../../../stores/useUserStore';
import { localDateStr } from '../../../utils/date';
import { showToast } from '../../Toast';
import { PRIORITY_CONFIGS, getPriorityDbValue } from '../../../constants/priorities';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRIORITIES = [
  { value: 1, label: 'P1', emoji: '🔴', color: PRIORITY_CONFIGS[1].color },
  { value: 2, label: 'P2', emoji: '🟠', color: PRIORITY_CONFIGS[2].color },
  { value: 3, label: 'P3', emoji: '🟡', color: PRIORITY_CONFIGS[3].color },
  { value: 4, label: 'P4', emoji: '🔵', color: PRIORITY_CONFIGS[4].color },
];

export function QuickAddTask({ open, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<1 | 2 | 3 | 4>(3);
  const [dueDate, setDueDate] = useState(localDateStr());
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const user = useUserStore(s => s.user);
  const createTask = useScheduleStore(s => s.createTask);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 350);
    } else {
      setTitle('');
      setPriority(3);
      setDueDate(localDateStr());
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim() || !user?.id || saving) return;

    setSaving(true);
    const priorityDbValue = getPriorityDbValue(priority);
    const success = await createTask(user.id, title.trim(), priorityDbValue);

    if (success) {
      showToast('Task added! ✓', '📋', '#00D4FF');
      setTitle('');
      setPriority(3);
      // Keep sheet open for rapid entry — focus input again
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      showToast('Failed to add task', '❌', '#F43F5E');
    }
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Add Task" icon={<Plus size={18} />}>
      <div className="bs-field">
        <label className="bs-label">What needs doing?</label>
        <input
          ref={inputRef}
          className="bs-input"
          placeholder="e.g. Buy groceries, Call dentist..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </div>

      <div className="bs-row">
        <div className="bs-field">
          <label className="bs-label">Due Date</label>
          <input
            className="bs-input"
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>
        <div className="bs-field">
          <label className="bs-label">Priority</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                className={`bs-rating-dot ${priority === p.value ? 'bs-rating-active' : ''}`}
                onClick={() => setPriority(p.value)}
                style={priority === p.value ? { borderColor: p.color, color: p.color, background: `${p.color}15` } : {}}
                title={p.label}
              >
                <span style={{ fontSize: '14px' }}>{p.emoji}</span>
                <span style={{ fontSize: '9px', fontWeight: 600 }}>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        className="bs-submit"
        onClick={handleSubmit}
        disabled={!title.trim() || saving}
      >
        <Send size={16} />
        {saving ? 'Adding...' : 'Add Task'}
      </button>
    </BottomSheet>
  );
}
