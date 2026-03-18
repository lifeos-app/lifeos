/**
 * DashboardSchedule — Today's events + habits chip bar + bills due.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ChevronRight, Receipt, CheckCircle2 } from 'lucide-react';
import { EmojiIcon } from '../../lib/emoji-icon';
import { formatDate, formatTime, localDateStr } from '../../utils/date';
import { useLiveActivityStore } from '../../stores/useLiveActivityStore';
import type { ScheduleEvent, Habit, HabitLog, Bill } from '../../types/database';

interface DashboardScheduleProps {
  selectedDate: string;
  events: ScheduleEvent[];
  habits: Habit[];
  habitLogs: HabitLog[];
  bills: Bill[];
  onToggleHabit: (id: string) => void;
}

export function DashboardSchedule({
  selectedDate,
  events,
  habits,
  habitLogs,
  bills,
  onToggleHabit,
}: DashboardScheduleProps) {
  const isToday = selectedDate === localDateStr();
  const todayStr = formatDate(selectedDate);
  const activeEvent = useLiveActivityStore(s => s.activeEvent);

  const dayEvents = useMemo(() => {
    const dayStart = `${selectedDate}T00:00:00`;
    const dayEnd = `${selectedDate}T23:59:59`;
    return events.filter(e => {
      if (!e.start_time) return isToday;
      return e.start_time <= dayEnd && (e.end_time ? e.end_time > dayStart : e.start_time.startsWith(selectedDate));
    });
  }, [events, selectedDate, isToday]);

  const dayHabitLogs = useMemo(() => habitLogs.filter((l: HabitLog) => l.date === selectedDate), [habitLogs, selectedDate]);

  const dayBills = useMemo(() => bills.filter((b: Bill) => b.due_date === selectedDate && b.status !== 'paid'), [bills, selectedDate]);

  return (
    <section className="dash-card">
      <div className="card-top">
        <h2><Clock size={16} /> {isToday ? "Today's Schedule" : todayStr}</h2>
        <Link to="/schedule" className="card-link">Full schedule <ChevronRight size={14} /></Link>
      </div>

      {isToday && dayEvents.length > 0 ? (
        <>
          <h3 style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next 3 Events</h3>
          <div className="ds-events">
            {dayEvents.slice(0, 3).map(ev => {
              const isLive = activeEvent && activeEvent.id === ev.id;
              return (
                <div 
                  key={ev.id} 
                  className={`ds-event ds-event-prominent ${isLive ? 'ds-event-live' : ''}`} 
                  style={{ '--ev-color': ev.color || '#00D4FF' } as React.CSSProperties}
                >
                  <span className="ds-event-time">{formatTime(ev.start_time)}</span>
                  <div className="ds-event-bar" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="ds-event-title">
                      {isLive && '🔴 '}
                      {ev.title}
                    </span>
                    {ev.description && <span className="ds-event-desc">{ev.description}</span>}
                  </div>
                </div>
              );
            })}
            {dayEvents.length > 3 && <span className="ds-more">+{dayEvents.length - 3} more events</span>}
          </div>
        </>
      ) : dayEvents.length > 0 ? (
        <div className="ds-events">
          {dayEvents.slice(0, 4).map(ev => (
            <div key={ev.id} className="ds-event" style={{ '--ev-color': ev.color || '#00D4FF' } as React.CSSProperties}>
              <span className="ds-event-time">{formatTime(ev.start_time)}</span>
              <div className="ds-event-bar" />
              <span className="ds-event-title">{ev.title}</span>
            </div>
          ))}
          {dayEvents.length > 4 && <span className="ds-more">+{dayEvents.length - 4} more</span>}
        </div>
      ) : (
        <p className="ds-empty">No events scheduled</p>
      )}

      {dayBills.length > 0 && (
        <div className="ds-section">
          {dayBills.map((b: Bill) => (
            <div key={b.id} className="ds-bill">
              <Receipt size={12} /><span>{b.title}</span><strong>${b.amount}</strong>
            </div>
          ))}
        </div>
      )}

      {habits.length > 0 && (
        <div className="ds-habits">
          {habits.map((h: Habit) => {
            const hLogs = dayHabitLogs.filter((l: HabitLog) => l.habit_id === h.id);
            const done = hLogs.reduce((s: number, l: HabitLog) => s + (l.count || 1), 0) >= (h.target_count || 1);
            return (
              <button key={h.id} className={`ds-habit-chip ${done ? 'done' : ''}`} onClick={() => onToggleHabit(h.id)} title={h.title}>
                <EmojiIcon emoji={h.icon || '💪'} size={14} fallbackAsText />
                {done && <CheckCircle2 size={10} />}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
