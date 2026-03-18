/**
 * RitualManager — Define & manage recurring activity patterns
 * 
 * Rituals auto-generate schedule events. This component provides:
 * - List view with toggle, day dots, time ranges
 * - Add/Edit form with emoji picker, type selector, day toggles
 * - Preset rituals for quick-add
 * - Sync button to push rituals → schedule events
 */

import { useState, useCallback } from 'react';
import { Plus, RefreshCw, ChevronDown, Trash2, Edit2, Loader2, Check } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { supabase } from '../../lib/supabase';
import { EVENT_TYPE_COLORS, type EventType } from '../../lib/schedule-events';
import {
  type Ritual,
  type RitualType,
  type RitualSchedule,
  getRituals,
  saveRitual,
  deleteRitual,
  toggleRitual,
  createRitualFromPreset,
  syncRitualsToSchedule,
  RITUAL_TYPES,
  RITUAL_PRESETS,
  EMOJI_PRESETS,
  DAY_LETTERS,
  formatTime12h,
  getRitualDuration,
} from '../../lib/rituals';
import './RitualManager.css';
import { logger } from '../../utils/logger';

// ── Form state defaults ──
const EMPTY_FORM = {
  id: '',
  title: '',
  emoji: '📅',
  type: 'custom' as RitualType,
  eventType: 'general' as EventType,
  days: [1, 2, 3, 4, 5] as number[],
  startTime: '09:00',
  endTime: '',
  durationMinutes: 60,
  useDuration: true,
  weekendOverride: false,
  weekendStartTime: '',
  weekendEndTime: '',
  weekendDurationMinutes: 60,
  notes: '',
};

export function RitualManager() {
  const user = useUserStore(s => s.user);

  // State
  const [rituals, setRituals] = useState<Ritual[]>(() => getRituals());
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; cleared: number } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Refresh from localStorage
  const refresh = useCallback(() => setRituals(getRituals()), []);

  // ── Handlers ──

  const handleToggle = (id: string) => {
    toggleRitual(id);
    refresh();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteRitual(id);
    refresh();
  };

  const handleEdit = (ritual: Ritual) => {
    const hasWeekendOverride = !!ritual.weekendOverride;
    const useDuration = !!ritual.schedule.durationMinutes;
    setForm({
      id: ritual.id,
      title: ritual.title,
      emoji: ritual.emoji,
      type: ritual.type,
      eventType: ritual.eventType,
      days: [...ritual.schedule.days],
      startTime: ritual.schedule.startTime,
      endTime: ritual.schedule.endTime || '',
      durationMinutes: ritual.schedule.durationMinutes || 60,
      useDuration,
      weekendOverride: hasWeekendOverride,
      weekendStartTime: ritual.weekendOverride?.startTime || '',
      weekendEndTime: ritual.weekendOverride?.endTime || '',
      weekendDurationMinutes: ritual.weekendOverride?.durationMinutes || 60,
      notes: ritual.notes || '',
    });
    setShowForm(true);
    setShowPresets(false);
  };

  const handleAddPreset = (presetIdx: number) => {
    const preset = RITUAL_PRESETS[presetIdx];
    createRitualFromPreset(preset);
    refresh();
  };

  const handleSave = () => {
    if (!form.title.trim()) return;

    const schedule: RitualSchedule = {
      days: form.days,
      startTime: form.startTime,
    };
    if (form.useDuration) {
      schedule.durationMinutes = form.durationMinutes;
    } else if (form.endTime) {
      schedule.endTime = form.endTime;
    }

    const weekendOverride = form.weekendOverride ? {
      startTime: form.weekendStartTime || form.startTime,
      ...(form.useDuration
        ? { durationMinutes: form.weekendDurationMinutes }
        : form.weekendEndTime ? { endTime: form.weekendEndTime } : {}),
    } : undefined;

    const ritualType = RITUAL_TYPES.find(t => t.id === form.type);
    const color = EVENT_TYPE_COLORS[form.eventType] || '#64748B';

    saveRitual({
      id: form.id || undefined,
      title: form.title.trim(),
      emoji: form.emoji,
      type: form.type,
      eventType: form.eventType || ritualType?.eventType || 'general',
      schedule,
      weekendOverride,
      enabled: true,
      color,
      notes: form.notes || undefined,
    });

    setForm(EMPTY_FORM);
    setShowForm(false);
    refresh();
  };

  const handleSync = async () => {
    if (!user?.id || syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncRitualsToSchedule(supabase, user.id);
      setSyncResult(result);
      // Dispatch refresh event so schedule updates
      window.dispatchEvent(new CustomEvent('lifeos-refresh'));
      // Auto-dismiss result after 5s
      setTimeout(() => setSyncResult(null), 5000);
    } catch (err) {
      logger.error('[Rituals] Sync failed:', err);
    }
    setSyncing(false);
  };

  const handleTypeChange = (type: RitualType) => {
    const typeInfo = RITUAL_TYPES.find(t => t.id === type);
    setForm(f => ({
      ...f,
      type,
      eventType: typeInfo?.eventType || f.eventType,
      emoji: typeInfo?.emoji || f.emoji,
    }));
  };

  const toggleDay = (day: number) => {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day].sort(),
    }));
  };

  const enabledCount = rituals.filter(r => r.enabled).length;

  return (
    <div className="rituals-section">
      {/* Collapsible Header */}
      <div className="rituals-header" onClick={() => setExpanded(!expanded)}>
        <div className="rituals-header-left">
          <span>🔄</span>
          <h3>Rituals</h3>
          <span className="rituals-count">{enabledCount} active</span>
        </div>
        <div className="rituals-header-right">
          <ChevronDown size={16} className={`rituals-toggle-icon ${expanded ? 'expanded' : ''}`} />
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="rituals-body">
          {/* Sync Result */}
          {syncResult && (
            <div className="rituals-sync-result">
              <Check size={14} />
              Synced! Created {syncResult.created} events (cleared {syncResult.cleared} old)
            </div>
          )}

          {/* Toolbar */}
          <div className="rituals-toolbar">
            <button className="rituals-btn primary" onClick={() => { setForm(EMPTY_FORM); setShowForm(true); setShowPresets(false); }}>
              <Plus size={14} /> New Ritual
            </button>
            <button className="rituals-btn" onClick={() => { setShowPresets(!showPresets); setShowForm(false); }}>
              ⚡ Presets
            </button>
            {rituals.length > 0 && (
              <button className="rituals-btn sync" onClick={handleSync} disabled={syncing || enabledCount === 0}>
                {syncing ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                {syncing ? 'Syncing...' : 'Sync to Schedule'}
              </button>
            )}
          </div>

          {/* Presets */}
          {showPresets && (
            <div className="rituals-presets">
              <div className="rituals-presets-title">Quick-add presets</div>
              <div className="rituals-presets-grid">
                {RITUAL_PRESETS.map((preset, i) => (
                  <button key={i} className="preset-chip" onClick={() => handleAddPreset(i)}>
                    <span>{preset.emoji}</span>
                    <span>{preset.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add/Edit Form */}
          {showForm && (
            <div className="ritual-form">
              <div className="ritual-form-title">{form.id ? 'Edit Ritual' : 'New Ritual'}</div>

              {/* Title + Emoji */}
              <div className="ritual-form-row">
                <div className="ritual-form-group" style={{ flex: 2 }}>
                  <label>Title</label>
                  <input
                    className="ritual-form-input"
                    placeholder="e.g., Morning Workout"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    autoFocus
                  />
                </div>
              </div>

              {/* Emoji Picker */}
              <div className="ritual-form-row">
                <div className="ritual-form-group">
                  <label>Emoji</label>
                  <div className="emoji-picker">
                    {EMOJI_PRESETS.map(em => (
                      <button
                        key={em}
                        className={`emoji-btn ${form.emoji === em ? 'selected' : ''}`}
                        onClick={() => setForm(f => ({ ...f, emoji: em }))}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Type */}
              <div className="ritual-form-row">
                <div className="ritual-form-group">
                  <label>Type</label>
                  <div className="type-pills">
                    {RITUAL_TYPES.map(t => (
                      <button
                        key={t.id}
                        className={`type-pill ${form.type === t.id ? 'active' : ''}`}
                        onClick={() => handleTypeChange(t.id)}
                      >
                        {t.emoji} {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Days */}
              <div className="ritual-form-row">
                <div className="ritual-form-group">
                  <label>Active Days</label>
                  <div className="day-toggles">
                    {[0, 1, 2, 3, 4, 5, 6].map(d => (
                      <button
                        key={d}
                        className={`day-toggle ${form.days.includes(d) ? 'active' : ''}`}
                        onClick={() => toggleDay(d)}
                      >
                        {DAY_LETTERS[d]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Time */}
              <div className="ritual-form-row">
                <div className="ritual-form-group">
                  <label>Start Time</label>
                  <input
                    className="ritual-form-input"
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div className="ritual-form-group">
                  <label>
                    <span
                      style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                      onClick={() => setForm(f => ({ ...f, useDuration: !f.useDuration }))}
                    >
                      {form.useDuration ? 'Duration (min)' : 'End Time'}
                    </span>
                  </label>
                  {form.useDuration ? (
                    <input
                      className="ritual-form-input"
                      type="number"
                      min={5}
                      max={720}
                      step={5}
                      value={form.durationMinutes}
                      onChange={e => setForm(f => ({ ...f, durationMinutes: Math.max(5, parseInt(e.target.value) || 5) }))}
                    />
                  ) : (
                    <input
                      className="ritual-form-input"
                      type="time"
                      value={form.endTime}
                      onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    />
                  )}
                </div>
              </div>

              {/* Weekend Override */}
              <div className="ritual-form-row">
                <div className="ritual-form-group">
                  <div className="weekend-override-toggle">
                    <input
                      type="checkbox"
                      id="weekend-override"
                      checked={form.weekendOverride}
                      onChange={e => setForm(f => ({ ...f, weekendOverride: e.target.checked }))}
                    />
                    <label htmlFor="weekend-override">Different times on weekends</label>
                  </div>
                </div>
              </div>

              {form.weekendOverride && (
                <div className="ritual-form-row">
                  <div className="ritual-form-group">
                    <label>Weekend Start</label>
                    <input
                      className="ritual-form-input"
                      type="time"
                      value={form.weekendStartTime}
                      onChange={e => setForm(f => ({ ...f, weekendStartTime: e.target.value }))}
                    />
                  </div>
                  <div className="ritual-form-group">
                    <label>{form.useDuration ? 'Weekend Duration (min)' : 'Weekend End'}</label>
                    {form.useDuration ? (
                      <input
                        className="ritual-form-input"
                        type="number"
                        min={5}
                        max={720}
                        step={5}
                        value={form.weekendDurationMinutes}
                        onChange={e => setForm(f => ({ ...f, weekendDurationMinutes: Math.max(5, parseInt(e.target.value) || 5) }))}
                      />
                    ) : (
                      <input
                        className="ritual-form-input"
                        type="time"
                        value={form.weekendEndTime}
                        onChange={e => setForm(f => ({ ...f, weekendEndTime: e.target.value }))}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="ritual-form-row">
                <div className="ritual-form-group">
                  <label>Notes (optional)</label>
                  <textarea
                    className="ritual-form-textarea"
                    placeholder="Any additional notes..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="ritual-form-actions">
                <button className="ritual-form-cancel" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
                  Cancel
                </button>
                <button className="ritual-form-save" onClick={handleSave} disabled={!form.title.trim() || form.days.length === 0}>
                  {form.id ? 'Update Ritual' : 'Add Ritual'}
                </button>
              </div>
            </div>
          )}

          {/* Ritual List */}
          {rituals.length === 0 && !showForm && !showPresets ? (
            <div className="rituals-empty">
              <p>🔄 No rituals yet</p>
              <p>Define your recurring patterns to auto-populate the schedule</p>
            </div>
          ) : (
            <div className="rituals-list">
              {rituals.map(ritual => (
                <div
                  key={ritual.id}
                  className={`ritual-card ${!ritual.enabled ? 'disabled' : ''}`}
                  style={{ '--ritual-color': ritual.color } as React.CSSProperties}
                  onClick={() => handleEdit(ritual)}
                >
                  <span className="ritual-emoji">{ritual.emoji}</span>
                  <div className="ritual-info">
                    <div className="ritual-title">{ritual.title}</div>
                    <div className="ritual-meta">
                      <div className="ritual-days">
                        {[0, 1, 2, 3, 4, 5, 6].map(d => (
                          <span
                            key={d}
                            className={`ritual-day-dot ${ritual.schedule.days.includes(d) ? 'active' : ''}`}
                            style={{ '--ritual-color': ritual.color } as React.CSSProperties}
                          >
                            {DAY_LETTERS[d]}
                          </span>
                        ))}
                      </div>
                      <span className="ritual-time">
                        {getRitualDuration(ritual.schedule)}
                        {ritual.weekendOverride && ' (🔄 weekend)'}
                      </span>
                    </div>
                  </div>
                  <div className="ritual-actions">
                    <button
                      className="ritual-delete-btn"
                      onClick={e => handleDelete(e, ritual.id)}
                      title="Delete ritual"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div
                      className={`ritual-toggle ${ritual.enabled ? 'on' : ''}`}
                      onClick={e => { e.stopPropagation(); handleToggle(ritual.id); }}
                      title={ritual.enabled ? 'Disable' : 'Enable'}
                    >
                      <div className="ritual-toggle-knob" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
