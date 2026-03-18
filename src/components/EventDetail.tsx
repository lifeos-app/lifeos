import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, MapPin, Trash2, Save, Loader2, Edit3, Play, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useEventOverlay } from './EventOverlay';
import { WorkoutDetail, MealDetail, SleepDetail, MeditationDetail, StudyDetail, GenericDetail } from './event-details';
import type { ScheduleEvent } from '../types/database';
import './EventDetail.css';
import './event-details/event-details.css';

interface EventDetailProps {
  event: ScheduleEvent;
  onClose: () => void;
  onUpdate: () => void;
}

type DetailType = 'exercise' | 'meal' | 'sleep' | 'meditation' | 'study' | 'generic';

/** Detect which detail component to render based on event_type and title */
function detectDetailType(event: ScheduleEvent): DetailType {
  const et = (event.event_type || '').toLowerCase();
  const title = event.title.toLowerCase();

  // Exercise / workout
  if (et === 'exercise' || et === 'workout' || et === 'health') return 'exercise';
  if (/\b(workout|exercise|gym|lift|squat|bench|cardio|run)\b/.test(title)) return 'exercise';

  // Meal
  if (et === 'meal') return 'meal';
  if (/\b(breakfast|lunch|dinner|meal|snack|cook|eat|food)\b/.test(title)) return 'meal';

  // Sleep
  if (et === 'sleep') return 'sleep';
  if (/\b(sleep|nap|bed|rest)\b/.test(title)) return 'sleep';

  // Meditation / Prayer
  if (et === 'meditation' || et === 'prayer') return 'meditation';
  if (/\b(meditat|pray|mindful|contemplat)\b/.test(title)) return 'meditation';

  // Study / Education
  if (et === 'education') return 'study';
  if (/\b(study|learn|course|class|lecture|homework|read|book)\b/.test(title)) return 'study';

  return 'generic';
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time };
}

function durationStr(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function EventDetail({ event, onClose, onUpdate }: EventDetailProps) {
  const { startOverlay } = useEventOverlay();
  const isGoogleEvent = event.source === 'google';
  const googleHtmlLink = event.htmlLink;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title || '');
  const [description, setDescription] = useState((event.description as string) || '');
  const [location, setLocation] = useState(event.location || '');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState({ title: '', message: '' });

  const detailType = detectDetailType(event);

  useEffect(() => {
    if (event) {
      const s = new Date(event.start_time);
      const e = new Date(event.end_time!);
      setTitle(event.title || '');
      setDescription((event.description as string) || '');
      setLocation(event.location || '');
      setStartDate(s.toLocaleDateString('en-CA'));
      setStartTime(`${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`);
      setEndDate(e.toLocaleDateString('en-CA'));
      setEndTime(`${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`);
    }
  }, [event]);

  const handleSave = async () => {
    setSaving(true);
    const start = new Date(`${startDate}T${startTime}:00`);
    const end = new Date(`${endDate}T${endTime}:00`);
    const { error } = await supabase.from('schedule_events').update({
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', event.id);
    setSaving(false);
    if (error) { showToast('Failed to save', 'error'); return; }
    showToast('Event updated', 'success');
    setEditing(false);
    onUpdate();
  };

  const handleDelete = async () => {
    await supabase.from('schedule_events').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', event.id);
    showToast('Event deleted', 'success');
    onClose();
    onUpdate();
  };

  const start = fmtDateTime(event.start_time);
  const end = fmtDateTime(event.end_time!);
  const duration = durationStr(event.start_time, event.end_time!);

  return createPortal(
    <div className="evd-overlay" onClick={onClose}>
      <div className="evd-panel" onClick={e => e.stopPropagation()}>
        {/* Header — consistent across all types */}
        <div className="evd-header" style={{ borderColor: event.color || '#64748B' }}>
          <div className="evd-header-left">
            <div className="evd-color-dot" style={{ background: event.color || '#64748B' }} />
            {editing ? (
              <input className="evd-title-input" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
            ) : (
              <h2 className="evd-title">{event.title}</h2>
            )}
          </div>
          <div className="evd-header-actions">
            {isGoogleEvent ? (
              <>
                {googleHtmlLink && (
                  <a className="evd-btn" href={googleHtmlLink} target="_blank" rel="noopener noreferrer" title="Open in Google Calendar" aria-label="Open in Google Calendar"><ExternalLink size={14} /></a>
                )}
                <button className="evd-btn" onClick={onClose} title="Close" aria-label="Close"><X size={16} /></button>
              </>
            ) : (
              <>
                <button className="evd-btn start-event" onClick={() => {
                  startOverlay(event);
                  onClose();
                }} title="Start Focus Mode" aria-label="Start focus mode"><Play size={14} /></button>
                {!editing && <button className="evd-btn" onClick={() => setEditing(true)} title="Edit" aria-label="Edit event"><Edit3 size={14} /></button>}
                <button className="evd-btn danger" onClick={() => {
                  setConfirmMsg({ title: 'Delete event?', message: `Remove "${event.title}" from your schedule?` });
                  setConfirmAction(() => handleDelete);
                }} title="Delete" aria-label="Delete"><Trash2 size={14} /></button>
                <button className="evd-btn" onClick={onClose} title="Close" aria-label="Close"><X size={16} /></button>
              </>
            )}
          </div>
        </div>

        {/* Details — Time, Duration, Location (always shown) */}
        <div className="evd-body">
          {/* Time */}
          <div className="evd-row">
            <Calendar size={14} className="evd-icon" />
            {editing ? (
              <div className="evd-edit-time">
                <div className="evd-time-group">
                  <label>Start</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="evd-time-group">
                  <label>End</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="evd-time-display">
                <span className="evd-date">{start.date}</span>
                <span className="evd-time">{start.time} → {end.time}</span>
              </div>
            )}
          </div>

          <div className="evd-row">
            <Clock size={14} className="evd-icon" />
            <span className="evd-duration">{duration}</span>
          </div>

          {/* Location */}
          {(event.location || editing) && (
            <div className="evd-row">
              <MapPin size={14} className="evd-icon" />
              {editing ? (
                <input className="evd-input" placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} />
              ) : (
                <span>{event.location}</span>
              )}
            </div>
          )}

          {/* Google Calendar badge */}
          {isGoogleEvent && (
            <div className="evd-row">
              <span className="evd-badge" style={{ background: 'rgba(66,133,244,0.12)', color: '#4285F4' }}>📅 Google Calendar</span>
            </div>
          )}

          {/* Category / Day Type */}
          {event.day_type && !isGoogleEvent && (
            <div className="evd-row">
              <span className="evd-badge" style={{ background: `${event.color || '#64748B'}22`, color: event.color || '#64748B' }}>{event.day_type}</span>
            </div>
          )}

          {/* ═══ Context-Aware Body Section ═══ */}
          {!editing && (
            <div style={{ marginTop: 8 }}>
              {detailType === 'exercise' && <WorkoutDetail event={event} />}
              {detailType === 'meal' && <MealDetail event={event} />}
              {detailType === 'sleep' && <SleepDetail event={event} />}
              {detailType === 'meditation' && <MeditationDetail event={event} />}
              {detailType === 'study' && <StudyDetail event={event} />}
              {detailType === 'generic' && <GenericDetail event={event} />}
            </div>
          )}

          {/* Edit-mode description (shown in edit mode for all types) */}
          {editing && (
            <div className="evd-section">
              <label className="evd-label">Notes</label>
              <textarea className="evd-textarea" placeholder="Add notes..." value={description} onChange={e => setDescription(e.target.value)} rows={4} />
            </div>
          )}
        </div>

        {/* Footer — edit mode */}
        {editing && (
          <div className="evd-footer">
            <button className="evd-cancel" onClick={() => setEditing(false)}>Cancel</button>
            <button className="evd-save" onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? <><Loader2 size={14} className="spin" /> Saving...</> : <><Save size={14} /> Save</>}
            </button>
          </div>
        )}

        {confirmAction && (
          <ConfirmDialog
            open={!!confirmAction}
            title={confirmMsg.title}
            message={confirmMsg.message}
            onConfirm={() => { confirmAction(); setConfirmAction(null); }}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
