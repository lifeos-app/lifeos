// ═══ EventDrawer — DailyPulseStrip, InlineEventDetail, QuickAddForm, MiniTimeline ═══

import React, { useState, useEffect, useRef } from 'react';
import {
  Clock, Calendar,
  ChevronLeft,
  Heart, CheckSquare, Flame, DollarSign, BatteryCharging,
  Edit3, Trash2, Save, Loader2,
  Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ScheduleEvent } from '../../hooks/useCurrentEvent';
import { useLiveActivityStore } from '../../stores/useLiveActivityStore';
import type { DailyPulse } from './hooks';
import { formatTime, formatHour } from './helpers';

// ═══ Daily Pulse Strip ═══
export function DailyPulseStrip({ pulse, loading, onNavigate }: { pulse: DailyPulse; loading: boolean; onNavigate: (path: string) => void }) {
  const metrics: Array<{
    icon: React.ReactNode; label: string; value: string; sub: string; color: string; path: string;
  }> = [
    {
      icon: <Heart size={13} />,
      label: 'Health',
      value: pulse.healthScore !== null ? `${pulse.healthScore}` : '—',
      sub: 'score',
      color: '#F97316',
      path: '/health',
    },
    {
      icon: <CheckSquare size={13} />,
      label: 'Tasks',
      value: loading ? '…' : `${pulse.tasksDone}/${pulse.tasksTotal}`,
      sub: 'done',
      color: '#39FF14',
      path: '/goals',
    },
    {
      icon: <Flame size={13} />,
      label: 'Habits',
      value: loading ? '…' : `${pulse.habitsDone}/${pulse.habitsTotal}`,
      sub: 'done',
      color: '#F97316',
      path: '/habits',
    },
    {
      icon: <DollarSign size={13} />,
      label: 'Income',
      value: loading ? '…' : `$${Math.round(pulse.todayIncome)}`,
      sub: 'today',
      color: '#FACC15',
      path: '/finances',
    },
    {
      icon: <BatteryCharging size={13} />,
      label: 'Energy',
      value: pulse.energyLevel !== null ? `${pulse.energyLevel}/10` : '—',
      sub: 'level',
      color: '#A855F7',
      path: '/health',
    },
  ];

  return (
    <div className="ed-pulse-strip">
      {metrics.map(m => (
        <button
          key={m.label}
          className="ed-pulse-metric"
          onClick={() => onNavigate(m.path)}
          title={`Go to ${m.label}`}
        >
          <span className="ed-pulse-icon" style={{ color: m.color }}>{m.icon}</span>
          <span className="ed-pulse-value" style={{ color: m.color }}>{m.value}</span>
          <span className="ed-pulse-sub">{m.sub}</span>
        </button>
      ))}
    </div>
  );
}

// ═══ Inline Event Detail (for NON-current timeline events) ═══
export function InlineEventDetail({ event, onClose, onUpdate }: {
  event: ScheduleEvent;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title || '');
  const [description, setDescription] = useState(event.description || '');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setTitle(event.title || '');
    setDescription(event.description || '');
    setEditing(false);
  }, [event]);

  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const durationStr = durationMin < 60
    ? `${durationMin}m`
    : durationMin % 60 === 0
      ? `${durationMin / 60}h`
      : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;
  const cleanDesc = (event.description || '').replace(/^\[goal:[^\]]+\]/, '').replace(/^\[priority:[^\]]+\]/, '').trim();

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('schedule_events').update({
      title: title.trim(),
      description: description.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', event.id);
    setSaving(false);
    setEditing(false);
    onUpdate();
  };

  const handleDelete = async () => {
    await supabase.from('schedule_events').update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    }).eq('id', event.id);
    onClose();
    onUpdate();
  };

  return (
    <div className="ed-inline-detail">
      <div className="ed-id-header">
        <button className="ed-id-back" onClick={onClose} aria-label="Go back">
          <ChevronLeft size={16} />
          <span>Back</span>
        </button>
        <div className="ed-id-actions">
          {!editing && (
            <button className="ed-id-action-btn" onClick={() => setEditing(true)} title="Edit" aria-label="Edit event">
              <Edit3 size={13} />
            </button>
          )}
          <button
            className="ed-id-action-btn danger"
            onClick={() => setConfirmingDelete(true)}
            title="Delete" aria-label="Delete event"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="ed-id-title-row">
        <div className="ed-id-color-dot" style={{ background: event.color || '#64748B' }} />
        {editing ? (
          <input
            className="ed-id-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
        ) : (
          <h3 className="ed-id-title">{event.title}</h3>
        )}
      </div>

      <div className="ed-id-row">
        <Calendar size={13} className="ed-id-icon" />
        <div className="ed-id-time-info">
          <span className="ed-id-date">
            {start.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          <span className="ed-id-time">
            {formatTime(start)} → {formatTime(end)}
          </span>
        </div>
      </div>

      <div className="ed-id-row">
        <Clock size={13} className="ed-id-icon" />
        <span className="ed-id-duration">{durationStr}</span>
      </div>

      {event.day_type && (
        <div className="ed-id-row">
          <span
            className="ed-id-badge"
            style={{ background: `${event.color || '#64748B'}22`, color: event.color || '#64748B' }}
          >
            {event.day_type}
          </span>
        </div>
      )}

      <div className="ed-id-section">
        <span className="ed-id-label">Notes</span>
        {editing ? (
          <textarea
            className="ed-id-textarea"
            placeholder="Add notes..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
        ) : cleanDesc ? (
          <p className="ed-id-desc">{cleanDesc}</p>
        ) : (
          <p className="ed-id-desc empty">No notes</p>
        )}
      </div>

      {editing && (
        <div className="ed-id-edit-actions">
          <button className="ed-id-cancel" onClick={() => { setEditing(false); setTitle(event.title || ''); setDescription(event.description || ''); }}>
            Cancel
          </button>
          <button className="ed-id-save" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? <><Loader2 size={13} className="spin" /> Saving…</> : <><Save size={13} /> Save</>}
          </button>
        </div>
      )}

      {confirmingDelete && (
        <div className="ed-id-confirm-delete">
          <p>Delete "<strong>{event.title}</strong>"?</p>
          <div className="ed-id-confirm-actions">
            <button className="ed-id-cancel" onClick={() => setConfirmingDelete(false)}>Cancel</button>
            <button className="ed-id-delete-confirm" onClick={handleDelete}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ Quick Add Form ═══
export function QuickAddForm({ onAdd, onCancel }: {
  onAdd: (title: string, startTime: string, duration: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState(() => {
    const now = new Date();
    const m = Math.ceil(now.getMinutes() / 15) * 15;
    now.setMinutes(m, 0, 0);
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    await onAdd(title, `${today}T${time}:00`, duration);
    setSaving(false);
  };

  return (
    <div className="ed-quick-add">
      <input
        className="ed-qa-input"
        placeholder="Event title..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        autoFocus
      />
      <div className="ed-qa-row">
        <input
          type="time"
          className="ed-qa-time"
          value={time}
          onChange={e => setTime(e.target.value)}
        />
        <div className="ed-qa-dur-pills">
          {[30, 60, 90, 120].map(d => (
            <button
              key={d}
              className={`ed-qa-dur-pill${duration === d ? ' active' : ''}`}
              onClick={() => setDuration(d)}
            >
              {d < 60 ? `${d}m` : `${d / 60}h`}
            </button>
          ))}
        </div>
      </div>
      <div className="ed-qa-actions">
        <button className="ed-qa-cancel" onClick={onCancel}>Cancel</button>
        <button
          className="ed-qa-save"
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
        >
          {saving ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

// ═══ Mini Timeline ═══
const WINDOW_BEFORE_MIN = 120;
const WINDOW_AFTER_MIN  = 180;
const TOTAL_WINDOW_MIN  = WINDOW_BEFORE_MIN + WINDOW_AFTER_MIN;
const PX_PER_MIN        = 1.5;

export function MiniTimeline({
  events, currentEvent, onEventTap,
}: {
  events: ScheduleEvent[];
  currentEvent: ScheduleEvent | null;
  onEventTap: (event: ScheduleEvent) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeEvent = useLiveActivityStore(s => s.activeEvent);
  const [now, setNow] = useState(new Date());

  // Update "now" every second to extend live event in real-time
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const windowStart = new Date(now.getTime() - WINDOW_BEFORE_MIN * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + WINDOW_AFTER_MIN  * 60 * 1000);
  const totalPx     = TOTAL_WINDOW_MIN * PX_PER_MIN;
  const nowPx = WINDOW_BEFORE_MIN * PX_PER_MIN;

  useEffect(() => {
    if (wrapRef.current) {
      const targetScroll = nowPx - wrapRef.current.clientHeight / 3;
      wrapRef.current.scrollTop = Math.max(0, targetScroll);
    }
  }, [nowPx]);

  // Filter regular events, exclude live event (we'll render it separately)
  const visibleEvents = events.filter(ev => {
    if (activeEvent && ev.id === activeEvent.id) return false; // Don't show live event twice
    const s = new Date(ev.start_time).getTime();
    const e = new Date(ev.end_time).getTime();
    return e > windowStart.getTime() && s < windowEnd.getTime();
  });

  const hourLabels: Array<{ label: string; px: number }> = [];
  const hourCursor = new Date(windowStart);
  hourCursor.setMinutes(0, 0, 0);
  if (hourCursor < windowStart) hourCursor.setHours(hourCursor.getHours() + 1);
  while (hourCursor <= windowEnd) {
    const offsetMin = (hourCursor.getTime() - windowStart.getTime()) / 60000;
    const px = offsetMin * PX_PER_MIN;
    if (px >= 0 && px <= totalPx) {
      hourLabels.push({ label: formatHour(hourCursor), px });
    }
    hourCursor.setHours(hourCursor.getHours() + 1);
  }

  return (
    <div className="ed-mini-timeline-wrap" ref={wrapRef}>
      <div className="ed-mini-timeline" style={{ height: totalPx }}>
        {hourLabels.map(hl => (
          <div key={hl.label} className="ed-mt-hour-row" style={{ top: hl.px }}>
            <span className="ed-mt-hour-label">{hl.label}</span>
            <div className="ed-mt-hour-line" />
          </div>
        ))}

        {/* Live Event — extending in real time */}
        {activeEvent && (
          (() => {
            const evStart = Math.max(new Date(activeEvent.start_time).getTime(), windowStart.getTime());
            const evEnd   = Math.min(now.getTime(), windowEnd.getTime()); // Extend to NOW
            const startMin = (evStart - windowStart.getTime()) / 60000;
            const durMin   = (evEnd - evStart) / 60000;
            const top    = startMin * PX_PER_MIN;
            const height = Math.max(durMin * PX_PER_MIN, 24);
            const color  = activeEvent.color || '#00D4FF';

            return (
              <button
                key={`live-${activeEvent.id}`}
                className="ed-mt-event ed-mt-event--current"
                style={{
                  top,
                  height,
                  '--ec': color,
                  boxShadow: `0 0 14px ${color}88, 0 0 8px ${color}44`,
                  animation: 'ed-pulse 2s ease-in-out infinite',
                } as React.CSSProperties}
                onClick={() => {}} // Live event can't be tapped to detail (already in drawer)
                title={`🔴 LIVE: ${activeEvent.title}`}
              >
                <span className="ed-mt-event-title">🔴 {activeEvent.title}</span>
                <span className="ed-mt-event-time">
                  {formatTime(new Date(activeEvent.start_time))} • LIVE
                </span>
              </button>
            );
          })()
        )}

        {visibleEvents.map(ev => {
          const evStart = Math.max(new Date(ev.start_time).getTime(), windowStart.getTime());
          const evEnd   = Math.min(new Date(ev.end_time).getTime(),   windowEnd.getTime());
          const startMin = (evStart - windowStart.getTime()) / 60000;
          const durMin   = (evEnd - evStart) / 60000;
          const top    = startMin * PX_PER_MIN;
          const height = Math.max(durMin * PX_PER_MIN, 24);
          const color  = ev.color || '#64748B';
          const isCurrent = currentEvent?.id === ev.id;

          return (
            <button
              key={ev.id}
              className={`ed-mt-event${isCurrent ? ' ed-mt-event--current' : ''}`}
              style={{
                top,
                height,
                '--ec': color,
                boxShadow: isCurrent ? `0 0 14px ${color}44` : undefined,
              } as React.CSSProperties}
              onClick={() => onEventTap(ev)}
              title={ev.title}
            >
              <span className="ed-mt-event-title">{ev.title}</span>
              {height >= 32 && (
                <span className="ed-mt-event-time">
                  {formatTime(new Date(ev.start_time))}
                </span>
              )}
            </button>
          );
        })}

        <div className="ed-mt-now-marker" style={{ top: nowPx }}>
          <span className="ed-mt-now-dot" />
          <div className="ed-mt-now-line" />
        </div>

        {visibleEvents.length === 0 && (
          <div className="ed-mt-empty">
            No events nearby
          </div>
        )}
      </div>
    </div>
  );
}
