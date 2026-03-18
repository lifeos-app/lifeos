// ═══ EventDrawer — DetailsTab ═══

import { useState, useEffect } from 'react';
import {
  Clock, Calendar, Target,
  CalendarDays,
  Edit3, Trash2, Save, Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ScheduleEvent } from '../../hooks/useCurrentEvent';
import type { WeeklyStats } from './hooks';
import { formatTime, formatMinutes, resolveEventCategory } from './helpers';

// ═══ DETAILS Tab ═══
export function DetailsTab({ event, weeklyStats, onUpdate }: {
  event: ScheduleEvent;
  weeklyStats: WeeklyStats;
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
    setConfirmingDelete(false);
  }, [event.id]);

  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const durationStr = durationMin < 60
    ? `${durationMin}m`
    : durationMin % 60 === 0
      ? `${durationMin / 60}h`
      : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;
  const cleanDesc = (event.description || '').replace(/^\[goal:[^\]]+\]/, '').replace(/^\[priority:[^\]]+\]/, '').trim();

  // Extract linked goal
  const goalMatch = (event.description || '').match(/\[goal:([^\]]+)\]/);
  const linkedGoal = goalMatch ? goalMatch[1] : null;

  const category = resolveEventCategory(event);

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
    onUpdate();
  };

  return (
    <div className="ed-details-tab">
      {/* Actions bar */}
      <div className="ed-dt-actions-bar">
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

      {/* Title */}
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

      {/* Time row */}
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

      {/* Category badge */}
      {(event.day_type || category) && (
        <div className="ed-id-row">
          <span
            className="ed-id-badge"
            style={{ background: `${event.color || '#64748B'}22`, color: event.color || '#64748B' }}
          >
            {event.day_type || category}
          </span>
        </div>
      )}

      {/* Linked Goal */}
      {linkedGoal && (
        <div className="ed-dt-linked-goal">
          <Target size={13} />
          <span>Linked Goal: <strong>{linkedGoal}</strong></span>
        </div>
      )}

      {/* Weekly Summary */}
      <div className="ed-dt-weekly">
        <div className="ed-dt-weekly-stat">
          <CalendarDays size={13} />
          <span>Sessions this week</span>
          <strong>{weeklyStats.sessionsThisWeek}</strong>
        </div>
        <div className="ed-dt-weekly-stat">
          <Clock size={13} />
          <span>Total time this week</span>
          <strong>{formatMinutes(Math.round(weeklyStats.totalMinutesThisWeek))}</strong>
        </div>
      </div>

      {/* Notes */}
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

      {/* Save / Cancel for edit mode */}
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

      {/* Delete confirmation */}
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
