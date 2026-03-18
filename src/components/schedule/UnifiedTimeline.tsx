/**
 * UnifiedTimeline — Vertical day timeline for all life events
 * 
 * Shows events from unified_events table in a Google Calendar-style day view.
 * Color-coded by type, with current time indicator and tap-to-expand.
 */

import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { Plus, Clock, ZoomIn, ZoomOut, Sun, Loader2, ChevronDown, ChevronUp, X, Calendar, UtensilsCrossed } from 'lucide-react';
import {
  getEventsByDate, createEvent, deleteEvent as deleteUnifiedEvent,
  EVENT_TYPE_CONFIG, type UnifiedEvent, type UnifiedEventType,
} from '../../lib/events';
import { localDateStr } from '../../utils/date';
import { useUserStore } from '../../stores/useUserStore';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { getTraditionIcon, type PrayerTime } from '../../lib/prayer-times';
import { useLogPractice } from '../../hooks/useJunction';
import { useFasting } from '../../hooks/useFasting';
import './UnifiedTimeline.css';

// ── Constants ──
const MIN_HOUR_H = 30;
const MAX_HOUR_H = 80;
const DEFAULT_HOUR_H = 48;
const ZOOM_STEP = 10;
const WAKE_START = 5;
const WAKE_END = 24;

function fmtHourLabel(h: number, use24h: boolean): string {
  if (use24h) return `${String(h).padStart(2, '0')}:00`;
  return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
}

function fmtTime(iso: string, use24h: boolean): string {
  try {
    const d = new Date(iso);
    if (use24h) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m} ${ampm}`;
  } catch { return ''; }
}

// ── Add Event Form Types ──
const QUICK_TYPES: { type: UnifiedEventType; label: React.ReactNode }[] = [
  { type: 'event', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Calendar size={14} /> Event</span> },
  { type: 'exercise', label: '🏋️ Exercise' },
  { type: 'meal', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><UtensilsCrossed size={14} /> Meal</span> },
  { type: 'work', label: '💼 Work' },
  { type: 'sleep', label: '😴 Sleep' },
  { type: 'medication', label: '💊 Medication' },
  { type: 'mood', label: '😊 Mood' },
  { type: 'custom', label: '⭐ Custom' },
];

const DURATIONS = [15, 30, 45, 60, 90, 120];

interface Props {
  date: Date;
}

export const UnifiedTimeline = memo(function UnifiedTimeline({ date }: Props) {
  const user = useUserStore(s => s.user);
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hourH, setHourH] = useState(DEFAULT_HOUR_H);
  const [showAllHours, setShowAllHours] = useState(false);
  const [use24h, setUse24h] = useState(() => {
    try { return localStorage.getItem('lifeos-schedule-24h') === 'true'; } catch { return false; }
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [, setAddAtHour] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Add form state
  const [addTitle, setAddTitle] = useState('');
  const [addType, setAddType] = useState<UnifiedEventType>('event');
  const [addTime, setAddTime] = useState('09:00');
  const [addDuration, setAddDuration] = useState(60);
  const [addNotes, setAddNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const dateStr = localDateStr(date);

  // ── Prayer Times ──
  const { prayerTimes } = usePrayerTimes();
  const { logPractice } = useLogPractice();
  const [completedPrayers, setCompletedPrayers] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`lifeos-prayer-completed-${localDateStr(date)}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  const handlePrayerComplete = async (prayer: PrayerTime) => {
    if (completedPrayers.has(prayer.id)) return;
    const newCompleted = new Set(completedPrayers);
    newCompleted.add(prayer.id);
    setCompletedPrayers(newCompleted);
    try {
      localStorage.setItem(`lifeos-prayer-completed-${dateStr}`, JSON.stringify([...newCompleted]));
    } catch { /* ignore */ }
    // Log practice and award XP
    await logPractice(prayer.id, prayer.duration_minutes, `Completed ${prayer.name}`, 15);
  };

  // ── Fetch ──
  const fetchEvents = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const data = await getEventsByDate(user.id, dateStr);
    setEvents(data);
    setLoading(false);
  }, [user?.id, dateStr]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Refresh on visibility change
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') fetchEvents(); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [fetchEvents]);

  // ── Derived ──
  const hours = useMemo(() => {
    if (showAllHours) return Array.from({ length: 24 }, (_, i) => i);
    return Array.from({ length: WAKE_END - WAKE_START }, (_, i) => i + WAKE_START);
  }, [showAllHours]);

  const firstHour = showAllHours ? 0 : WAKE_START;
  const nowDate = new Date();
  const isToday = localDateStr(nowDate) === dateStr;
  const nowMin = isToday ? nowDate.getHours() * 60 + nowDate.getMinutes() : -1;

  // Compute event blocks with overlap handling
  const evBlocks = useMemo(() => {
    const blocks = events.map(ev => {
      const s = new Date(ev.timestamp);
      const startMin = s.getHours() * 60 + s.getMinutes();
      let endMin: number;
      if (ev.end_timestamp) {
        const e = new Date(ev.end_timestamp);
        endMin = e.getHours() * 60 + e.getMinutes() + (e.getDate() !== s.getDate() ? 1440 : 0);
      } else if (ev.duration_minutes) {
        endMin = startMin + ev.duration_minutes;
      } else {
        endMin = startMin + 30; // default 30min
      }
      return { ...ev, startMin, endMin, col: 0, totalCols: 1 };
    }).sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

    // Calculate overlapping columns
    for (let i = 0; i < blocks.length; i++) {
      const overlapping = blocks.filter((b, j) => j < i && b.endMin > blocks[i].startMin && b.startMin < blocks[i].endMin);
      const usedCols = new Set(overlapping.map(b => b.col));
      let col = 0;
      while (usedCols.has(col)) col++;
      blocks[i].col = col;
    }
    for (const block of blocks) {
      const group = blocks.filter(b => b.endMin > block.startMin && b.startMin < block.endMin);
      const maxCol = Math.max(...group.map(b => b.col)) + 1;
      for (const b of group) b.totalCols = Math.max(b.totalCols, maxCol);
    }
    return blocks;
  }, [events]);

  // ── Zoom ──
  const zoomIn = () => setHourH(h => Math.min(h + ZOOM_STEP, MAX_HOUR_H));
  const zoomOut = () => setHourH(h => Math.max(h - ZOOM_STEP, MIN_HOUR_H));

  // ── Time format toggle ──
  const toggleTimeFormat = () => {
    setUse24h(prev => {
      const next = !prev;
      try { localStorage.setItem('lifeos-schedule-24h', String(next)); } catch {}
      return next;
    });
  };

  // ── Add event at hour ──
  const openAddAtHour = (hour: number) => {
    setAddTime(`${String(hour).padStart(2, '0')}:00`);
    setAddAtHour(hour);
    setShowAddForm(true);
  };

  const handleAddEvent = async () => {
    if (!addTitle.trim() || !user?.id) return;
    setSaving(true);

    const start = new Date(`${dateStr}T${addTime}:00`);
    const end = new Date(start.getTime() + addDuration * 60000);
    const config = EVENT_TYPE_CONFIG[addType];

    await createEvent({
      user_id: user.id,
      timestamp: start.toISOString(),
      end_timestamp: end.toISOString(),
      type: addType,
      title: addTitle.trim(),
      details: addNotes.trim() ? { notes: addNotes.trim() } : {},
      module_source: 'manual',
      color: config.color,
      icon: config.icon,
      duration_minutes: addDuration,
    });

    setAddTitle('');
    setAddType('event');
    setAddTime('09:00');
    setAddDuration(60);
    setAddNotes('');
    setShowAddForm(false);
    setAddAtHour(null);
    setSaving(false);
    fetchEvents();
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteUnifiedEvent(id);
    setExpandedId(null);
    fetchEvents();
  };

  // ── Scroll to current time on mount ──
  useEffect(() => {
    if (isToday && timelineRef.current && !loading) {
      const offset = ((nowMin / 60) - firstHour) * hourH - 100;
      if (offset > 0) {
        timelineRef.current.scrollTop = offset;
      }
    }
  }, [isToday, loading, nowMin, firstHour, hourH]);

  // ── Fasting overlay ──
  const { currentFast, fastingLabel } = useFasting();

  // Check if events exist outside visible range
  const hasOutsideWaking = useMemo(() => {
    return events.some(ev => {
      const h = new Date(ev.timestamp).getHours();
      return h < WAKE_START || h >= WAKE_END;
    });
  }, [events]);

  if (loading) {
    return (
      <div className="ut-loading">
        <Loader2 size={20} className="spin" />
        <span>Loading timeline...</span>
      </div>
    );
  }

  return (
    <div className="ut-container">
      {/* Summary bar */}
      <div className="ut-summary">
        <span className="ut-summary-count">{events.length} event{events.length !== 1 ? 's' : ''}</span>
        <div className="ut-type-chips">
          {Object.entries(
            events.reduce((acc, ev) => {
              acc[ev.type] = (acc[ev.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          ).map(([type, count]) => {
            const config = EVENT_TYPE_CONFIG[type as UnifiedEventType];
            return (
              <span key={type} className="ut-type-chip" style={{ '--chip-color': config?.color } as React.CSSProperties}>
                {config?.lucideIcon && <config.lucideIcon size={12} />} {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="ut-controls">
        <div className="ut-controls-left">
          <button
            className={`ut-ctrl-btn ${showAllHours ? 'active' : ''}`}
            onClick={() => setShowAllHours(!showAllHours)}
            title={showAllHours ? 'Show waking hours' : 'Show all 24h'}
          >
            <Sun size={13} />
            <span>{showAllHours ? '24h' : `${WAKE_START}–${WAKE_END}`}</span>
          </button>
          <button className="ut-ctrl-btn" onClick={toggleTimeFormat} title="Toggle time format" aria-label="Toggle time format">
            <Clock size={13} />
            <span>{use24h ? '24h' : '12h'}</span>
          </button>
          {hasOutsideWaking && !showAllHours && (
            <span className="ut-hint">Events outside visible hours</span>
          )}
        </div>
        <div className="ut-zoom">
          <button className="ut-ctrl-btn" onClick={zoomOut} disabled={hourH <= MIN_HOUR_H} aria-label="Zoom out"><ZoomOut size={13} /></button>
          <span className="ut-zoom-label">{Math.round((hourH / DEFAULT_HOUR_H) * 100)}%</span>
          <button className="ut-ctrl-btn" onClick={zoomIn} disabled={hourH >= MAX_HOUR_H} aria-label="Zoom in"><ZoomIn size={13} /></button>
        </div>
      </div>

      {/* Add Event Form */}
      {showAddForm && (
        <div className="ut-add-form glass-card">
          <div className="ut-add-header">
            <h3>Add Event</h3>
            <button className="ut-close" onClick={() => { setShowAddForm(false); setAddAtHour(null); }}>
              <X size={16} />
            </button>
          </div>

          <input
            autoFocus
            className="ut-input"
            placeholder="What happened?"
            value={addTitle}
            onChange={e => setAddTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddEvent()}
          />

          <div className="ut-type-selector">
            {QUICK_TYPES.map(qt => (
              <button
                key={qt.type}
                className={`ut-type-btn ${addType === qt.type ? 'active' : ''}`}
                style={{ '--type-color': EVENT_TYPE_CONFIG[qt.type].color } as React.CSSProperties}
                onClick={() => setAddType(qt.type)}
              >
                {qt.label}
              </button>
            ))}
          </div>

          <div className="ut-form-row">
            <div className="ut-form-group">
              <label>Time</label>
              <input type="time" className="ut-input small" value={addTime} onChange={e => setAddTime(e.target.value)} />
            </div>
            <div className="ut-form-group">
              <label>Duration</label>
              <div className="ut-dur-pills">
                {DURATIONS.map(d => (
                  <button
                    key={d}
                    className={`ut-dur-pill ${addDuration === d ? 'active' : ''}`}
                    onClick={() => setAddDuration(d)}
                  >
                    {d < 60 ? `${d}m` : d === 60 ? '1h' : `${d / 60}h`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <input
            className="ut-input small"
            placeholder="Notes (optional)"
            value={addNotes}
            onChange={e => setAddNotes(e.target.value)}
          />

          <div className="ut-form-actions">
            <button className="ut-cancel" onClick={() => { setShowAddForm(false); setAddAtHour(null); }}>Cancel</button>
            <button className="ut-save" onClick={handleAddEvent} disabled={saving || !addTitle.trim()}>
              {saving ? <><Loader2 size={14} className="spin" /> Saving...</> : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {events.length === 0 && !showAddForm && (
        <div className="ut-empty">
          <p>No events logged for this day</p>
          <button className="ut-empty-add" onClick={() => setShowAddForm(true)}>
            <Plus size={14} /> Add your first event
          </button>
        </div>
      )}

      {/* Timeline */}
      <div
        className="ut-timeline"
        ref={timelineRef}
        style={{ minHeight: hours.length * hourH }}
      >
        {/* Fasting overlay band */}
        {currentFast && (() => {
          const fastStartMin = currentFast.startTime.getHours() * 60 + currentFast.startTime.getMinutes();
          const fastEndMin = currentFast.endTime.getHours() * 60 + currentFast.endTime.getMinutes();
          const fastTopPx = ((fastStartMin / 60) - firstHour) * hourH;
          const fastBottomPx = ((fastEndMin / 60) - firstHour) * hourH;
          const fastHeight = fastBottomPx - fastTopPx;
          if (fastHeight <= 0) return null;
          const startTimeStr = fmtTime(currentFast.startTime.toISOString(), use24h);
          const endTimeStr = fmtTime(currentFast.endTime.toISOString(), use24h);
          return (
            <>
              <div
                className="ut-fasting-overlay"
                data-tradition={currentFast.tradition}
                style={{ top: fastTopPx, height: fastHeight }}
              >
                <span className="ut-fasting-label">{fastingLabel}</span>
              </div>
              <div className="ut-fasting-boundary" style={{ top: fastTopPx }} />
              <span className="ut-fasting-time-label" style={{ top: fastTopPx }}>
                {currentFast.tradition === 'islam' ? '☪️' : '✝️'} {startTimeStr}
              </span>
              <div className="ut-fasting-boundary" style={{ top: fastBottomPx }} />
              <span className="ut-fasting-time-label" style={{ top: fastBottomPx }}>
                {endTimeStr}
              </span>
            </>
          );
        })()}

        {/* Hour rows */}
        {hours.map((h, idx) => {
          const top = idx * hourH;
          const isPast = isToday && nowDate.getHours() > h;
          return (
            <div
              key={h}
              className={`ut-hour ${isPast ? 'past' : ''}`}
              style={{ top, height: hourH }}
            >
              <span className="ut-hour-label">{fmtHourLabel(h, use24h)}</span>
              <div className="ut-hour-line" />
              <button className="ut-hour-add" onClick={() => openAddAtHour(h)} title="Add event">
                <Plus size={11} />
              </button>
            </div>
          );
        })}

        {/* Current time indicator */}
        {nowMin >= 0 && (() => {
          const nowOffset = ((nowMin / 60) - firstHour) * hourH;
          if (nowOffset < 0 || nowOffset > hours.length * hourH) return null;
          return (
            <div className="ut-now" style={{ top: nowOffset }}>
              <div className="ut-now-dot" />
              <div className="ut-now-line" />
            </div>
          );
        })()}

        {/* Prayer time markers */}
        {prayerTimes.map(prayer => {
          const pMin = prayer.time.getHours() * 60 + prayer.time.getMinutes();
          const topPx = ((pMin / 60) - firstHour) * hourH;
          if (!showAllHours && (pMin / 60 < WAKE_START || pMin / 60 >= WAKE_END)) return null;
          if (topPx < 0) return null;
          const isCompleted = completedPrayers.has(prayer.id);
          const tradIcon = getTraditionIcon(prayer.tradition);
          const timeStr = fmtTime(prayer.time.toISOString(), use24h);

          return (
            <div
              key={prayer.id}
              className={`ut-prayer-marker ${isCompleted ? 'completed' : ''}`}
              style={{
                top: topPx,
                borderLeftColor: prayer.color,
                background: `${prayer.color}0D`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isCompleted) handlePrayerComplete(prayer);
              }}
              title={isCompleted ? `${prayer.name} — completed ✓` : `${prayer.name} — tap to mark complete`}
            >
              <span className="ut-prayer-icon">{tradIcon}</span>
              <span className="ut-prayer-name" style={{ color: prayer.color }}>
                {prayer.name}
                {prayer.nameArabic && <span className="ut-prayer-native"> {prayer.nameArabic}</span>}
                {prayer.nameAmharic && <span className="ut-prayer-native"> {prayer.nameAmharic}</span>}
              </span>
              <span className="ut-prayer-time">{timeStr}</span>
              {isCompleted && <span className="ut-prayer-check">✓</span>}
            </div>
          );
        })}

        {/* Event blocks */}
        {evBlocks.map(ev => {
          const topPx = ((ev.startMin / 60) - firstHour) * hourH;
          const height = Math.max(((ev.endMin - ev.startMin) / 60) * hourH, 24);
          const leftPct = 56 + (ev.col / ev.totalCols) * 42;
          const widthPct = (1 / ev.totalCols) * 42;
          const durationMin = ev.endMin - ev.startMin;
          const isShort = durationMin <= 20 || height < 36;
          const isExpanded = expandedId === ev.id;
          const config = EVENT_TYPE_CONFIG[ev.type];
          const evColor = ev.color || config?.color || '#64748B';
          const EvLucideIcon = config?.lucideIcon;

          if (!showAllHours && (ev.startMin / 60 < WAKE_START || ev.startMin / 60 >= WAKE_END)) return null;

          return (
            <div
              key={ev.id}
              className={`ut-event ${isExpanded ? 'expanded' : ''}`}
              style={{
                top: topPx,
                height: isExpanded ? 'auto' : height,
                minHeight: height,
                left: `${leftPct}%`,
                width: `calc(${widthPct}% - 4px)`,
                '--ev-color': evColor,
              } as React.CSSProperties}
              onClick={() => setExpandedId(isExpanded ? null : ev.id)}
            >
              <div className="ut-event-header">
                <span className="ut-event-icon">{EvLucideIcon ? <EvLucideIcon size={14} /> : (ev.icon || '📅')}</span>
                <span className="ut-event-title">{ev.title}</span>
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </div>
              {!isShort && !isExpanded && (
                <span className="ut-event-time">
                  {fmtTime(ev.timestamp, use24h)}
                  {ev.end_timestamp && ` – ${fmtTime(ev.end_timestamp, use24h)}`}
                </span>
              )}

              {/* Expanded detail */}
              {isExpanded && (
                <div className="ut-event-details" onClick={e => e.stopPropagation()}>
                  <div className="ut-detail-row">
                    <span className="ut-detail-label">Time</span>
                    <span>{fmtTime(ev.timestamp, use24h)}{ev.end_timestamp && ` – ${fmtTime(ev.end_timestamp, use24h)}`}</span>
                  </div>
                  <div className="ut-detail-row">
                    <span className="ut-detail-label">Type</span>
                    <span className="ut-detail-type" style={{ '--chip-color': evColor } as React.CSSProperties}>
                      {EvLucideIcon ? <EvLucideIcon size={14} /> : (ev.icon || '📅')} {config?.label || ev.type}
                    </span>
                  </div>
                  {ev.duration_minutes && (
                    <div className="ut-detail-row">
                      <span className="ut-detail-label">Duration</span>
                      <span>{ev.duration_minutes < 60 ? `${ev.duration_minutes}m` : `${Math.floor(ev.duration_minutes / 60)}h ${ev.duration_minutes % 60 ? `${ev.duration_minutes % 60}m` : ''}`}</span>
                    </div>
                  )}
                  {ev.module_source && (
                    <div className="ut-detail-row">
                      <span className="ut-detail-label">Source</span>
                      <span>{ev.module_source}</span>
                    </div>
                  )}
                  {ev.details && Object.keys(ev.details).length > 0 && (
                    <div className="ut-detail-notes">
                      {Object.entries(ev.details).map(([key, val]) => (
                        <div key={key} className="ut-detail-row">
                          <span className="ut-detail-label">{key}</span>
                          <span>{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="ut-delete-btn" onClick={() => handleDeleteEvent(ev.id)}>
                    Delete Event
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
