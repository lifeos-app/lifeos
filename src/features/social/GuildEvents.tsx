// LifeOS Social — Guild Events & Calendar Page
// Upcoming events calendar, RSVP system, countdown timers, results, recurring events

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar, Clock, Users, Trophy, X, Plus, ChevronLeft, ChevronRight,
  Flame, Swords, BookOpen, Dragon, PartyPopper, CheckCircle2, Star, Timer, Repeat
} from 'lucide-react';
import { useGuildEvents, EVENT_TYPE_CONFIG } from './useGuildEvents';
import type { GuildEvent, GuildEventType, RSVPStatus, EventRecurrence, GuildEventResult } from './useGuildEvents';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface GuildEventsProps {
  guildId: string;
  userId: string;
  userRole: 'owner' | 'admin' | 'member';
}

type ViewMode = 'calendar' | 'list';

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function formatCountdown(countdown: { days: number; hours: number; minutes: number; seconds: number; isPast: boolean }): string {
  if (countdown.isPast) return 'Started!';
  const parts: string[] = [];
  if (countdown.days > 0) parts.push(`${countdown.days}d`);
  if (countdown.hours > 0) parts.push(`${countdown.hours}h`);
  if (countdown.minutes > 0) parts.push(`${countdown.minutes}m`);
  if (parts.length === 0) parts.push('<1m');
  return parts.join(' ');
}

function getEventTypeIcon(type: GuildEventType): string {
  return EVENT_TYPE_CONFIG[type]?.icon || '📅';
}

function getStatusBadgeStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'upcoming': return { background: 'rgba(59,130,246,0.2)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)' };
    case 'active': return { background: 'rgba(34,197,94,0.2)', color: '#4ADE80', border: '1px solid rgba(34,197,94,0.3)' };
    case 'completed': return { background: 'rgba(139,92,246,0.2)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.3)' };
    case 'cancelled': return { background: 'rgba(239,68,68,0.2)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' };
    default: return {};
  }
}

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

export function GuildEvents({ guildId, userId, userRole }: GuildEventsProps) {
  const {
    events, loading, error,
    createEvent, updateEvent, cancelEvent, deleteEvent,
    rsvpEvent, completeEvent,
    getUpcomingEvents, getActiveEvents, getPastEvents,
    getEventCountdown,
    refreshEvents,
  } = useGuildEvents(guildId, userId);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<GuildEvent | null>(null);
  const [filterType, setFilterType] = useState<GuildEventType | ''>('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<GuildEventType>('meetup');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formDuration, setFormDuration] = useState('60');
  const [formMaxParticipants, setFormMaxParticipants] = useState('20');
  const [formRecurrence, setFormRecurrence] = useState<EventRecurrence>('none');
  const [creating, setCreating] = useState(false);

  // Results form
  const [showResultsForm, setShowResultsForm] = useState<string | null>(null);
  const [resultsWinners, setResultsWinners] = useState('');
  const [resultsXPAwarded, setResultsXPAwarded] = useState('100');

  // Countdown timer updates
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const upcomingEvents = getUpcomingEvents();
  const activeEvents = getActiveEvents();
  const pastEvents = getPastEvents();

  const filteredEvents = useMemo(() => {
    let result = [...events];
    if (filterType) {
      result = result.filter(e => e.type === filterType);
    }
    return result;
  }, [events, filterType]);

  const canCreate = userRole === 'owner' || userRole === 'admin';

  // ── Create Event Handler ──────────────────────────────────────────
  const handleCreateEvent = useCallback(async () => {
    if (!formName.trim() || !formDate || !formTime) return;
    setCreating(true);

    const startTime = new Date(`${formDate}T${formTime}`).toISOString();
    const durationMinutes = parseInt(formDuration) || 60;
    const endTimeDate = new Date(startTime);
    endTimeDate.setMinutes(endTimeDate.getMinutes() + durationMinutes);

    await createEvent({
      guild_id: guildId,
      created_by: userId,
      name: formName.trim(),
      description: formDesc.trim(),
      type: formType,
      start_time: startTime,
      end_time: endTimeDate.toISOString(),
      recurrence: formRecurrence,
      max_participants: parseInt(formMaxParticipants) || 20,
    });

    setFormName('');
    setFormDesc('');
    setFormType('meetup');
    setFormDate('');
    setFormTime('');
    setFormDuration('60');
    setFormMaxParticipants('20');
    setFormRecurrence('none');
    setShowCreateForm(false);
    setCreating(false);
  }, [formName, formDesc, formType, formDate, formTime, formDuration, formMaxParticipants, formRecurrence, createEvent, guildId, userId]);

  // ── Complete Event Handler ──────────────────────────────────────
  const handleCompleteEvent = useCallback(async (eventId: string) => {
    const winners = resultsWinners.split(',').map(w => w.trim()).filter(Boolean);
    const xpAwarded = parseInt(resultsXPAwarded) || 100;
    await completeEvent(eventId, { winners, xp_awarded: xpAwarded });
    setShowResultsForm(null);
    setResultsWinners('');
    setResultsXPAwarded('100');
  }, [resultsWinners, resultsXPAwarded, completeEvent]);

  // ── Calendar helper ──────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { date: number; events: GuildEvent[] }[] = [];

    // Pad start
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: 0, events: [] });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.start_time.startsWith(dateStr));
      days.push({ date: d, events: dayEvents });
    }

    return days;
  }, [calendarMonth, events]);

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  return (
    <div className="ge-container">
      {/* Header */}
      <div className="ge-header">
        <div className="ge-header-left">
          <Calendar size={20} style={{ color: '#A855F7' }} />
          <h3 className="ge-title">Guild Events</h3>
          <span className="ge-count">{events.length}</span>
        </div>
        <div className="ge-header-right">
          <div className="ge-view-toggle">
            <button
              className={`ge-toggle-btn ${viewMode === 'calendar' ? 'ge-toggle-btn--active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              <Calendar size={14} />
            </button>
            <button
              className={`ge-toggle-btn ${viewMode === 'list' ? 'ge-toggle-btn--active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <Users size={14} />
            </button>
          </div>
          {canCreate && (
            <button className="ge-create-btn" onClick={() => setShowCreateForm(true)}>
              <Plus size={14} /> New Event
            </button>
          )}
        </div>
      </div>

      {/* Type filter */}
      <div className="ge-filter-row">
        <button
          className={`ge-filter-chip ${filterType === '' ? 'ge-filter-chip--active' : ''}`}
          onClick={() => setFilterType('')}
        >
          All
        </button>
        {(Object.entries(EVENT_TYPE_CONFIG) as [GuildEventType, typeof EVENT_TYPE_CONFIG[GuildEventType]][]).map(([type, config]) => (
          <button
            key={type}
            className={`ge-filter-chip ${filterType === type ? 'ge-filter-chip--active' : ''}`}
            onClick={() => setFilterType(type === filterType ? '' : type)}
            style={filterType === type ? { borderColor: config.color, color: config.color } : {}}
          >
            {config.icon} {config.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="ge-error">
          ⚠️ {error}
          <button onClick={() => void refreshEvents()} style={{ marginLeft: 8, color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="ge-loading">Loading events…</div>}

      {/* ── CREATE EVENT FORM ────────────────────────────────────── */}
      {showCreateForm && (
        <div className="ge-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateForm(false); }}>
          <div className="ge-modal">
            <div className="ge-modal-header">
              <h3 className="ge-modal-title">⚔️ Create Guild Event</h3>
              <button className="ge-modal-close" onClick={() => setShowCreateForm(false)}><X size={18} /></button>
            </div>

            <div className="ge-form">
              <label className="ge-label">Event Name *</label>
              <input
                className="ge-input"
                type="text"
                placeholder="e.g., 7-Day Habit Challenge"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                maxLength={80}
              />

              <label className="ge-label">Event Type</label>
              <div className="ge-type-grid">
                {(Object.entries(EVENT_TYPE_CONFIG) as [GuildEventType, typeof EVENT_TYPE_CONFIG[GuildEventType]][]).map(([type, config]) => (
                  <button
                    key={type}
                    className={`ge-type-card ${formType === type ? 'ge-type-card--active' : ''}`}
                    onClick={() => setFormType(type)}
                    style={formType === type ? { borderColor: config.color } : {}}
                  >
                    <span className="ge-type-card-icon">{config.icon}</span>
                    <span className="ge-type-card-label">{config.label}</span>
                    <span className="ge-type-card-desc">{config.description}</span>
                  </button>
                ))}
              </div>

              <div className="ge-form-row">
                <div className="ge-form-field">
                  <label className="ge-label">Date *</label>
                  <input className="ge-input" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
                </div>
                <div className="ge-form-field">
                  <label className="ge-label">Time *</label>
                  <input className="ge-input" type="time" value={formTime} onChange={e => setFormTime(e.target.value)} />
                </div>
              </div>

              <div className="ge-form-row">
                <div className="ge-form-field">
                  <label className="ge-label">Duration (min)</label>
                  <select className="ge-input" value={formDuration} onChange={e => setFormDuration(e.target.value)}>
                    <option value="30">30 min</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="1440">All day</option>
                  </select>
                </div>
                <div className="ge-form-field">
                  <label className="ge-label">Max Participants</label>
                  <input className="ge-input" type="number" min="2" max="100" value={formMaxParticipants} onChange={e => setFormMaxParticipants(e.target.value)} />
                </div>
              </div>

              <label className="ge-label">Recurrence</label>
              <div className="ge-recurrence-row">
                {(['none', 'weekly', 'monthly'] as EventRecurrence[]).map(r => (
                  <button
                    key={r}
                    className={`ge-recurrence-btn ${formRecurrence === r ? 'ge-recurrence-btn--active' : ''}`}
                    onClick={() => setFormRecurrence(r)}
                  >
                    <Repeat size={12} />
                    {r === 'none' ? 'One-time' : r === 'weekly' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>

              <label className="ge-label">Description</label>
              <textarea
                className="ge-textarea"
                placeholder="What's this event about?"
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                rows={3}
                maxLength={300}
              />

              <div className="ge-form-actions">
                <button className="ge-btn-secondary" onClick={() => setShowCreateForm(false)}>Cancel</button>
                <button
                  className="ge-btn-primary"
                  onClick={() => void handleCreateEvent()}
                  disabled={!formName.trim() || !formDate || !formTime || creating}
                >
                  {creating ? 'Creating…' : '🎉 Create Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EVENT DETAIL MODAL ─────────────────────────────────────── */}
      {selectedEvent && (() => {
        const evt = selectedEvent;
        const config = EVENT_TYPE_CONFIG[evt.type];
        const countdown = getEventCountdown(evt.id);
        const myRsvp = evt.rsvps.find(r => r.user_id === userId);
        const goingCount = evt.rsvps.filter(r => r.status === 'going').length;
        const interestedCount = evt.rsvps.filter(r => r.status === 'interested').length;

        return (
          <div className="ge-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedEvent(null); }}>
            <div className="ge-modal">
              <div className="ge-modal-header">
                <h3 className="ge-modal-title">
                  {config?.icon} {evt.name}
                </h3>
                <button className="ge-modal-close" onClick={() => setSelectedEvent(null)}><X size={18} /></button>
              </div>

              {/* Status + Type badges */}
              <div className="ge-detail-badges">
                <span className="ge-status-badge" style={getStatusBadgeStyle(evt.status)}>
                  {evt.status}
                </span>
                <span className="ge-type-badge" style={{ background: `${config?.color}22`, color: config?.color, border: `1px solid ${config?.color}44` }}>
                  {config?.icon} {config?.label}
                </span>
              </div>

              {/* Countdown */}
              {evt.status === 'upcoming' && countdown && !countdown.isPast && (
                <div className="ge-countdown" style={{ borderColor: config?.color }}>
                  <Timer size={14} />
                  <span>Starts in {formatCountdown(countdown)}</span>
                </div>
              )}
              {evt.status === 'active' && (
                <div className="ge-countdown ge-countdown--active">
                  🔥 Event is LIVE!
                </div>
              )}

              {/* Details */}
              <div className="ge-detail-grid">
                <div className="ge-detail-item">
                  <Clock size={14} />
                  <span>{new Date(evt.start_time).toLocaleDateString()} · {new Date(evt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="ge-detail-item">
                  <Users size={14} />
                  <span>{goingCount} going · {interestedCount} interested · {evt.max_participants} max</span>
                </div>
                {evt.recurrence !== 'none' && (
                  <div className="ge-detail-item">
                    <Repeat size={14} />
                    <span>Repeats {evt.recurrence}</span>
                  </div>
                )}
              </div>

              {evt.description && (
                <p className="ge-detail-desc">{evt.description}</p>
              )}

              {/* RSVP */}
              {evt.status !== 'completed' && evt.status !== 'cancelled' && (
                <div className="ge-rsvp-section">
                  <div className="ge-rsvp-label">Your RSVP</div>
                  <div className="ge-rsvp-buttons">
                    <button
                      className={`ge-rsvp-btn ${myRsvp?.status === 'going' ? 'ge-rsvp-btn--going' : ''}`}
                      onClick={() => void rsvpEvent(evt.id, 'going')}
                    >
                      ✅ Going
                    </button>
                    <button
                      className={`ge-rsvp-btn ${myRsvp?.status === 'interested' ? 'ge-rsvp-btn--interested' : ''}`}
                      onClick={() => void rsvpEvent(evt.id, 'interested')}
                    >
                      🤔 Interested
                    </button>
                    <button
                      className={`ge-rsvp-btn ${myRsvp?.status === 'declined' ? 'ge-rsvp-btn--declined' : ''}`}
                      onClick={() => void rsvpEvent(evt.id, 'declined')}
                    >
                      ❌ Can't make it
                    </button>
                  </div>
                </div>
              )}

              {/* Participants */}
              {goingCount > 0 && (
                <div className="ge-participants">
                  <div className="ge-participants-label">{goingCount} Going</div>
                  <div className="ge-participants-avatars">
                    {evt.rsvps.filter(r => r.status === 'going').slice(0, 8).map(r => (
                      <div key={r.user_id} className="ge-avatar-sm" title={r.user_id}>
                        {r.user_id.slice(0, 2).toUpperCase()}
                      </div>
                    ))}
                    {goingCount > 8 && <span className="ge-avatar-more">+{goingCount - 8}</span>}
                  </div>
                </div>
              )}

              {/* Results */}
              {evt.status === 'completed' && evt.results && (
                <div className="ge-results">
                  <div className="ge-results-header">
                    <Trophy size={16} style={{ color: '#FFD700' }} /> Results
                  </div>
                  <div className="ge-results-winner">
                    🏆 Winners: {evt.results.winners.length > 0 ? evt.results.winners.join(', ') : 'N/A'}
                  </div>
                  <div className="ge-results-xp">
                    ⚡ {evt.results.xp_awarded} XP awarded
                  </div>
                </div>
              )}

              {/* Complete event (admin) */}
              {canCreate && evt.status === 'active' && (
                <div className="ge-admin-actions">
                  {showResultsForm === evt.id ? (
                    <div className="ge-results-form">
                      <label className="ge-label">Winner User IDs (comma-separated)</label>
                      <input className="ge-input" value={resultsWinners} onChange={e => setResultsWinners(e.target.value)} placeholder="user1, user2" />
                      <label className="ge-label">XP Awarded</label>
                      <input className="ge-input" type="number" value={resultsXPAwarded} onChange={e => setResultsXPAwarded(e.target.value)} />
                      <div className="ge-form-actions">
                        <button className="ge-btn-secondary" onClick={() => setShowResultsForm(null)}>Cancel</button>
                        <button className="ge-btn-primary" onClick={() => void handleCompleteEvent(evt.id)}>🏆 Complete & Award</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button className="ge-btn-primary" onClick={() => setShowResultsForm(evt.id)}>
                        <Trophy size={14} /> Mark Complete & Enter Results
                      </button>
                      <button className="ge-btn-danger" onClick={() => void cancelEvent(evt.id)}>
                        Cancel Event
                      </button>
                    </>
                  )}
                </div>
              )}

              {canCreate && evt.status === 'upcoming' && (
                <div className="ge-admin-actions">
                  <button className="ge-btn-danger" onClick={() => void cancelEvent(evt.id)}>
                    Cancel Event
                  </button>
                  <button className="ge-btn-secondary" onClick={() => void deleteEvent(evt.id).then(() => setSelectedEvent(null))}>
                    Delete Event
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── CALENDAR VIEW ──────────────────────────────────────────── */}
      {viewMode === 'calendar' && (
        <div className="ge-calendar">
          <div className="ge-calendar-nav">
            <button className="ge-cal-nav-btn" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}>
              <ChevronLeft size={16} />
            </button>
            <span className="ge-cal-month">
              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button className="ge-cal-nav-btn" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="ge-calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="ge-cal-day-header">{day}</div>
            ))}
            {calendarDays.map((day, i) => (
              <div
                key={i}
                className={`ge-cal-day ${day.date === 0 ? 'ge-cal-day--empty' : ''}`}
                onClick={() => {
                  if (day.events.length > 0) setSelectedEvent(day.events[0]);
                }}
              >
                {day.date > 0 && (
                  <>
                    <span className="ge-cal-day-num">{day.date}</span>
                    {day.events.length > 0 && (
                      <div className="ge-cal-day-events">
                        {day.events.slice(0, 2).map(evt => (
                          <div
                            key={evt.id}
                            className="ge-cal-event-dot"
                            style={{ background: EVENT_TYPE_CONFIG[evt.type]?.color || '#64748B' }}
                            title={evt.name}
                          />
                        ))}
                        {day.events.length > 2 && (
                          <span className="ge-cal-more">+{day.events.length - 2}</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LIST VIEW ─────────────────────────────────────────────── */}
      {viewMode === 'list' && !loading && (
        <div className="ge-list">
          {/* Active Events */}
          {activeEvents.length > 0 && (
            <div className="ge-section">
              <div className="ge-section-title"><Flame size={14} /> Active Now</div>
              {activeEvents.map(evt => (
                <EventCard key={evt.id} event={evt} countdown={getEventCountdown(evt.id)} tick={tick} onClick={() => setSelectedEvent(evt)} />
              ))}
            </div>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div className="ge-section">
              <div className="ge-section-title"><Clock size={14} /> Upcoming</div>
              {upcomingEvents.filter(e => filterType ? e.type === filterType : true).map(evt => (
                <EventCard key={evt.id} event={evt} countdown={getEventCountdown(evt.id)} tick={tick} onClick={() => setSelectedEvent(evt)} />
              ))}
            </div>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div className="ge-section">
              <div className="ge-section-title"><CheckCircle2 size={14} /> Past Events</div>
              {pastEvents.filter(e => filterType ? e.type === filterType : true).slice(0, 5).map(evt => (
                <EventCard key={evt.id} event={evt} countdown={null} tick={tick} onClick={() => setSelectedEvent(evt)} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {events.length === 0 && !loading && (
            <div className="ge-empty">
              <span className="ge-empty-icon">📅</span>
              <p>No events yet</p>
              {canCreate && <button className="ge-btn-primary" onClick={() => setShowCreateForm(true)}>Create the first event!</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── EVENT CARD ─────────────────────────────────────────────────────

interface EventCardProps {
  event: GuildEvent;
  countdown: { days: number; hours: number; minutes: number; seconds: number; isPast: boolean } | null;
  tick: number;
  onClick: () => void;
}

function EventCard({ event, countdown, tick, onClick }: EventCardProps) {
  const config = EVENT_TYPE_CONFIG[event.type];
  const goingCount = event.rsvps.filter(r => r.status === 'going').length;

  return (
    <div className="ge-card" onClick={onClick} style={{ borderLeftColor: config?.color }}>
      <div className="ge-card-icon">{config?.icon}</div>
      <div className="ge-card-content">
        <div className="ge-card-header">
          <span className="ge-card-name">{event.name}</span>
          <span className="ge-status-badge" style={getStatusBadgeStyle(event.status)}>
            {event.status}
          </span>
        </div>
        <div className="ge-card-meta">
          <span>{new Date(event.start_time).toLocaleDateString()}</span>
          <span>·</span>
          <span><Users size={12} /> {goingCount}/{event.max_participants}</span>
        </div>
        {countdown && !countdown.isPast && event.status === 'upcoming' && (
          <div className="ge-card-countdown">
            <Timer size={12} /> {formatCountdown(countdown)}
          </div>
        )}
        {event.status === 'active' && (
          <div className="ge-card-live">🔥 LIVE</div>
        )}
      </div>
      <ChevronRight size={16} style={{ color: '#64748B', flexShrink: 0 }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

export const guildEventsStyles = `
.ge-container { max-width: 600px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; }
.ge-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.ge-header-left { display: flex; align-items: center; gap: 8px; }
.ge-title { font-size: 1.1rem; font-weight: 700; color: white; margin: 0; }
.ge-count { font-size: 0.75rem; background: rgba(168,85,247,0.2); color: #A855F7; padding: 2px 8px; border-radius: 9999px; }
.ge-header-right { display: flex; align-items: center; gap: 8px; }
.ge-view-toggle { display: flex; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow: hidden; }
.ge-toggle-btn { padding: 6px 10px; background: transparent; border: none; color: #64748B; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; }
.ge-toggle-btn--active { background: rgba(168,85,247,0.15); color: #A855F7; }
.ge-create-btn { display: flex; align-items: center; gap: 4px; padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(168,85,247,0.3); background: rgba(168,85,247,0.1); color: #A855F7; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
.ge-create-btn:hover { background: rgba(168,85,247,0.2); }

/* Filter row */
.ge-filter-row { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; }
.ge-filter-chip { font-size: 0.7rem; padding: 4px 10px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #94A3B8; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
.ge-filter-chip--active { background: rgba(168,85,247,0.15); border-color: rgba(168,85,247,0.3); color: #A855F7; }

/* Sections */
.ge-section { margin-bottom: 16px; }
.ge-section-title { font-size: 0.8rem; font-weight: 600; color: #94A3B8; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }

/* Event cards */
.ge-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: #1e293b; border: 1px solid rgba(255,255,255,0.06); border-left: 3px solid #A855F7; border-radius: 10px; cursor: pointer; transition: all 0.15s; margin-bottom: 8px; }
.ge-card:hover { background: #253449; border-color: rgba(255,255,255,0.12); }
.ge-card-icon { font-size: 1.5rem; }
.ge-card-content { flex: 1; min-width: 0; }
.ge-card-header { display: flex; align-items: center; gap: 8px; }
.ge-card-name { font-size: 0.85rem; font-weight: 600; color: white; }
.ge-card-meta { font-size: 0.7rem; color: #94A3B8; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.ge-card-countdown { font-size: 0.7rem; color: #F97316; display: flex; align-items: center; gap: 4px; margin-top: 4px; }
.ge-card-live { font-size: 0.7rem; color: #EF4444; font-weight: 700; }

/* Status badge */
.ge-status-badge { font-size: 0.65rem; padding: 1px 6px; border-radius: 9999px; font-weight: 600; }

/* Modal */
.ge-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; }
.ge-modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; max-height: 85vh; overflow-y: auto; width: 100%; max-width: 520px; padding: 20px; }
.ge-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.ge-modal-title { font-size: 1rem; font-weight: 700; color: white; margin: 0; }
.ge-modal-close { background: none; border: none; color: #94A3B8; cursor: pointer; padding: 4px; }

/* Form */
.ge-form { display: flex; flex-direction: column; gap: 12px; }
.ge-label { font-size: 0.75rem; font-weight: 600; color: #94A3B8; margin-bottom: 4px; }
.ge-input, .ge-textarea { width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 8px 12px; color: white; font-size: 0.85rem; }
.ge-input:focus, .ge-textarea:focus { outline: none; border-color: rgba(168,85,247,0.5); }
.ge-textarea { resize: vertical; min-height: 60px; }
.ge-form-row { display: flex; gap: 8px; }
.ge-form-field { flex: 1; }

/* Type grid */
.ge-type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.ge-type-card { padding: 10px; background: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.15s; }
.ge-type-card--active { border-color: rgba(168,85,247,0.5); background: rgba(168,85,247,0.08); }
.ge-type-card-icon { font-size: 1.25rem; display: block; }
.ge-type-card-label { font-size: 0.75rem; font-weight: 600; color: white; display: block; }
.ge-type-card-desc { font-size: 0.65rem; color: #64748B; display: block; }

/* Recurrence */
.ge-recurrence-row { display: flex; gap: 6px; }
.ge-recurrence-btn { display: flex; align-items: center; gap: 4px; padding: 5px 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: transparent; color: #94A3B8; font-size: 0.75rem; cursor: pointer; }
.ge-recurrence-btn--active { background: rgba(168,85,247,0.15); border-color: rgba(168,85,247,0.3); color: #A855F7; }

/* Buttons */
.ge-form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
.ge-btn-primary { padding: 8px 18px; border-radius: 8px; background: linear-gradient(135deg, #A855F7, #7C3AED); color: white; font-size: 0.85rem; font-weight: 600; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.ge-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.ge-btn-secondary { padding: 8px 18px; border-radius: 8px; background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #94A3B8; font-size: 0.85rem; cursor: pointer; }
.ge-btn-danger { padding: 8px 18px; border-radius: 8px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #EF4444; font-size: 0.85rem; cursor: pointer; }

/* Detail view */
.ge-detail-badges { display: flex; gap: 6px; margin-bottom: 12px; }
.ge-type-badge { font-size: 0.7rem; padding: 3px 8px; border-radius: 9999px; }
.ge-detail-grid { display: grid; gap: 6px; margin-bottom: 12px; }
.ge-detail-item { font-size: 0.8rem; color: #94A3B8; display: flex; align-items: center; gap: 6px; }
.ge-detail-desc { font-size: 0.8rem; color: #CBD5E1; margin: 8px 0; line-height: 1.5; }

/* Countdown */
.ge-countdown { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(249,115,22,0.3); background: rgba(249,115,22,0.06); color: #F97316; font-size: 0.85rem; font-weight: 600; margin-bottom: 12px; }
.ge-countdown--active { border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.06); color: #4ADE80; }

/* RSVP */
.ge-rsvp-section { margin: 12px 0; }
.ge-rsvp-label { font-size: 0.75rem; font-weight: 600; color: #94A3B8; margin-bottom: 6px; }
.ge-rsvp-buttons { display: flex; gap: 6px; }
.ge-rsvp-btn { padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #94A3B8; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; }
.ge-rsvp-btn--going { background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.3); color: #4ADE80; }
.ge-rsvp-btn--interested { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.3); color: #60A5FA; }
.ge-rsvp-btn--declined { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.2); color: #F87171; }

/* Participants */
.ge-participants { margin: 10px 0; }
.ge-participants-label { font-size: 0.75rem; font-weight: 600; color: #94A3B8; margin-bottom: 6px; }
.ge-participants-avatars { display: flex; gap: 4px; align-items: center; }
.ge-avatar-sm { width: 28px; height: 28px; border-radius: 50%; background: rgba(168,85,247,0.2); color: #A855F7; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; }
.ge-avatar-more { font-size: 0.7rem; color: #94A3B8; }

/* Results */
.ge-results { background: rgba(234,179,8,0.06); border: 1px solid rgba(234,179,8,0.2); border-radius: 10px; padding: 12px; margin: 10px 0; }
.ge-results-header { font-size: 0.85rem; font-weight: 700; color: #FFD700; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.ge-results-winner { font-size: 0.8rem; color: #FCD34D; }
.ge-results-xp { font-size: 0.75rem; color: #94A3B8; margin-top: 2px; }
.ge-results-form { display: flex; flex-direction: column; gap: 8px; }

/* Admin actions */
.ge-admin-actions { display: flex; gap: 8px; margin-top: 12px; }

/* Calendar */
.ge-calendar { margin-bottom: 16px; }
.ge-calendar-nav { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 12px; }
.ge-cal-nav-btn { background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #94A3B8; cursor: pointer; padding: 4px 8px; }
.ge-cal-month { font-size: 0.9rem; font-weight: 600; color: white; }
.ge-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.ge-cal-day-header { font-size: 0.65rem; color: #64748B; text-align: center; padding: 4px; font-weight: 600; }
.ge-cal-day { min-height: 48px; background: rgba(255,255,255,0.02); border-radius: 6px; padding: 4px; cursor: pointer; }
.ge-cal-day--empty { background: transparent; }
.ge-cal-day-num { font-size: 0.7rem; color: #94A3B8; }
.ge-cal-day-events { margin-top: 2px; display: flex; flex-direction: column; gap: 2px; }
.ge-cal-event-dot { width: 100%; height: 4px; border-radius: 2px; }
.ge-cal-more { font-size: 0.6rem; color: #64748B; }

/* Error & Loading */
.ge-error { padding: 10px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; color: #F87171; font-size: 0.8rem; margin-bottom: 12px; }
.ge-loading { text-align: center; color: #64748B; padding: 24px; font-size: 0.85rem; }
.ge-empty { text-align: center; padding: 32px; color: #64748B; }
.ge-empty-icon { font-size: 2rem; display: block; margin-bottom: 8px; }
.ge-empty p { font-size: 0.85rem; margin: 0 0 12px; }
`;