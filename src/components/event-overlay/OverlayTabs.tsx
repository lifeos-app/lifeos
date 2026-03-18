// ═══ Overlay Tabs — Log & Details ═══

import { useState } from 'react';
import {
  Check, Clock, Target,
  StickyNote, Gauge, DollarSign, Edit3,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import type { ActiveEvent } from './types';

// ═══════════════════════════════════════════════════════════
// LOG TAB — Context-aware quick logging
// ═══════════════════════════════════════════════════════════
export function LogTab({ event, eventType }: { event: ActiveEvent; eventType: string }) {
  const [odometer, setOdometer] = useState('');
  const [money, setMoney] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const saveLog = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    const logData: Record<string, string | number> = {
      user_id: user.user.id,
      schedule_event_id: event.id,
      date: new Date().toISOString().split('T')[0],
    };

    if (odometer.trim()) logData.odometer_reading = parseInt(odometer.replace(/[^0-9]/g, ''), 10);
    if (money.trim()) logData.money_amount = parseFloat(money.replace(/[^0-9.]/g, ''));
    if (notes.trim()) logData.content = notes.trim();

    await supabase.from('event_notes').insert(logData);

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setOdometer('');
      setMoney('');
      setNotes('');
    }, 2000);
  };

  // Detect category for context-aware fields
  const title = event.title.toLowerCase();
  const showOdometer = title.includes('clean') || title.includes('driv');
  const showMoney = title.includes('clean') || title.includes('work');

  return (
    <div style={{ padding: '16px' }}>
      <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-secondary)' }}>Quick Log</h4>

      {showOdometer && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Gauge size={12} style={{ display: 'inline', marginRight: 4 }} />
            Odometer Reading
          </label>
          <input
            type="number"
            className="eo-notes-textarea"
            style={{ minHeight: 'auto', padding: '8px 10px' }}
            placeholder="e.g. 226735"
            value={odometer}
            onChange={e => setOdometer(e.target.value)}
          />
        </div>
      )}

      {showMoney && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <DollarSign size={12} style={{ display: 'inline', marginRight: 4 }} />
            Income/Expense
          </label>
          <input
            type="number"
            className="eo-notes-textarea"
            style={{ minHeight: 'auto', padding: '8px 10px' }}
            placeholder="e.g. 150"
            value={money}
            onChange={e => setMoney(e.target.value)}
          />
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <StickyNote size={12} style={{ display: 'inline', marginRight: 4 }} />
          Notes
        </label>
        <textarea
          className="eo-notes-textarea"
          rows={4}
          placeholder="Capture thoughts, progress, or observations..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      <button
        className="eo-save-notes-btn"
        onClick={saveLog}
        disabled={!odometer && !money && !notes.trim()}
        style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
      >
        {saved ? <><Check size={14} /> Saved!</> : <><StickyNote size={14} /> Save Log</>}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DETAILS TAB — Event metadata and edit capability
// ═══════════════════════════════════════════════════════════
export function DetailsTab({ event }: { event: ActiveEvent }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from('schedule_events')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);

    if (error) {
      logger.error('Save failed:', error.message);
    } else {
      window.dispatchEvent(new Event('lifeos-refresh'));
      setEditing(false);
    }
    setSaving(false);
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div style={{ padding: '16px' }}>
      {editing ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Event Title
            </label>
            <input
              type="text"
              className="eo-notes-textarea"
              style={{ minHeight: 'auto', padding: '8px 10px' }}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Description
            </label>
            <textarea
              className="eo-notes-textarea"
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setEditing(false)}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Cancel
            </button>
            <button
              className="eo-save-notes-btn"
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? 'Saving...' : <><Check size={14} /> Save</>}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ fontSize: 15, margin: 0, color: 'var(--text-primary)' }}>{event.title}</h4>
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(0,212,255,0.1)',
                  border: '1px solid rgba(0,212,255,0.2)',
                  borderRadius: 6,
                  color: 'var(--cyan)',
                  cursor: 'pointer',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Edit3 size={12} /> Edit
              </button>
            </div>
            {event.description && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {event.description}
              </p>
            )}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={12} />
              <span>Start: {formatDateTime(event.start_time)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={12} />
              <span>End: {formatDateTime(event.end_time)}</span>
            </div>
            {event.event_type && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={12} />
                <span>Type: {event.event_type}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
