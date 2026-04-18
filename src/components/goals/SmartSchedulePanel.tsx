/**
 * SmartSchedulePanel — Review and apply AI-generated schedule
 *
 * Shows proposed schedule as a day-grouped list with capacity bars,
 * checkboxes per slot, and apply/cancel actions.
 */

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Check, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { groupSlotsByDate, type ScheduleSlot } from '../../lib/smart-scheduler';
import { PRIORITY_COLORS } from './utils';
import './SmartSchedulePanel.css';

interface SmartSchedulePanelProps {
  slots: ScheduleSlot[];
  maxHoursPerDay: number;
  onApply: (selectedSlotIds: string[]) => Promise<void>;
  onClose: () => void;
}

export function SmartSchedulePanel({ slots, maxHoursPerDay, onApply, onClose }: SmartSchedulePanelProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(slots.map(s => s.taskId)));
  const [applying, setApplying] = useState(false);

  const grouped = useMemo(() => groupSlotsByDate(slots), [slots]);
  const conflicts = useMemo(() => slots.filter(s => s.conflict), [slots]);

  const toggleSlot = (taskId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === slots.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(slots.map(s => s.taskId)));
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(Array.from(selected));
    } finally {
      setApplying(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  };

  const getDayUsage = (daySlots: ScheduleSlot[]): number => {
    return daySlots.reduce((sum, s) => sum + s.durationMinutes, 0);
  };

  return createPortal(
    <div className="ssp-overlay" onClick={e => { if (e.target === e.currentTarget && !applying) onClose(); }}>
      <div className="ssp-modal">
        {/* Header */}
        <div className="ssp-header">
          <div className="ssp-header-title">
            <Calendar size={18} />
            <h2>Smart Schedule</h2>
            <span className="ssp-count">{slots.length} tasks</span>
          </div>
          {!applying && <button className="ssp-close" onClick={onClose} aria-label="Close smart schedule"><X size={18} /></button>}
        </div>

        {/* Conflicts warning */}
        {conflicts.length > 0 && (
          <div className="ssp-conflicts">
            <AlertTriangle size={14} />
            <span>{conflicts.length} task{conflicts.length > 1 ? 's' : ''} couldn't fit before their due date</span>
          </div>
        )}

        {/* Day groups */}
        <div className="ssp-scroll">
          {[...grouped.entries()].map(([date, daySlots]) => {
            const usageMinutes = getDayUsage(daySlots);
            const usagePct = Math.min(100, (usageMinutes / (maxHoursPerDay * 60)) * 100);

            return (
              <div key={date} className="ssp-day">
                <div className="ssp-day-header">
                  <span className="ssp-day-label">{formatDate(date)}</span>
                  <div className="ssp-capacity">
                    <div className="ssp-capacity-bar">
                      <div
                        className={`ssp-capacity-fill ${usagePct > 90 ? 'ssp-cap-high' : usagePct > 60 ? 'ssp-cap-mid' : ''}`}
                        style={{ width: `${usagePct}%` }}
                      />
                    </div>
                    <span className="ssp-capacity-text">{Math.round(usageMinutes / 60 * 10) / 10}h / {maxHoursPerDay}h</span>
                  </div>
                </div>

                {daySlots.map(slot => (
                  <div key={slot.taskId} className={`ssp-slot ${slot.conflict ? 'ssp-slot-conflict' : ''} ${!selected.has(slot.taskId) ? 'ssp-slot-deselected' : ''}`}>
                    <label className="ssp-slot-check" onClick={() => toggleSlot(slot.taskId)}>
                      <span className={`ssp-check ${selected.has(slot.taskId) ? 'ssp-checked' : ''}`}>
                        {selected.has(slot.taskId) && <Check size={10} />}
                      </span>
                    </label>
                    <div className="ssp-slot-info">
                      <span className="ssp-slot-title">{slot.taskTitle}</span>
                      <span className="ssp-slot-meta">
                        <Clock size={10} />
                        {slot.suggestedStartTime} - {slot.suggestedEndTime}
                        <span className="ssp-slot-duration">({slot.durationMinutes}m)</span>
                      </span>
                    </div>
                    <span
                      className="ssp-slot-priority"
                      style={{ color: PRIORITY_COLORS[slot.taskPriority as keyof typeof PRIORITY_COLORS] || '#5A7A9A' }}
                    >
                      {slot.taskPriority}
                    </span>
                    {slot.conflict && <AlertTriangle size={12} className="ssp-slot-warn" />}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="ssp-footer">
          <button className="ssp-select-all" onClick={toggleAll}>
            {selected.size === slots.length ? 'Deselect All' : 'Select All'}
          </button>
          <div className="ssp-footer-actions">
            <button className="ssp-btn-secondary" onClick={onClose} disabled={applying}>Cancel</button>
            <button className="ssp-btn-primary" onClick={handleApply} disabled={applying || selected.size === 0}>
              {applying ? <><Loader2 size={14} className="ssp-spinner" /> Scheduling...</> : <>
                <Check size={14} /> Apply ({selected.size})
              </>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
