import { timeStr } from './utils';
import { EVENT_TYPES } from '../../lib/schedule-events';
import type { ScheduleEvent, LayerFilter } from './types';

const CATEGORIES = EVENT_TYPES.map(t => ({ id: t.id, label: t.label, color: t.color, layer: t.layer, icon: t.icon, emoji: t.emoji }));

interface WeekDay {
  date: Date;
  iso: string;
  label: string;
  dayOfMonth: number;
  isToday: boolean;
}

interface ScheduleWeekViewProps {
  weekDays: WeekDay[];
  weekEventsByDay: Record<string, ScheduleEvent[]>;
  layerFilter: LayerFilter;
  use24h: boolean;
  onDayClick: (date: Date) => void;
  onEventClick: (event: ScheduleEvent) => void;
  onEventContextMenu: (event: ScheduleEvent) => void;
}

export function ScheduleWeekView({
  weekDays,
  weekEventsByDay,
  layerFilter,
  use24h,
  onDayClick,
  onEventClick,
  onEventContextMenu,
}: ScheduleWeekViewProps) {
  return (
    <div className="sched-week-view">
      <div className="week-grid">
        {weekDays.map((day, idx) => {
          const dayEvents = weekEventsByDay[day.iso] || [];
          const filteredEvents = dayEvents.filter(
            ev => layerFilter === 'all' || (ev.schedule_layer || 'primary') === layerFilter
          );

          return (
            <div key={idx} className={`week-day ${day.isToday ? 'today' : ''}`}>
              <div 
                className="week-day-header" 
                onClick={() => onDayClick(day.date)}
              >
                <span className="week-day-label">{day.label}</span>
                <span className={`week-day-num ${day.isToday ? 'today-num' : ''}`}>
                  {day.dayOfMonth}
                </span>
              </div>
              <div className="week-day-events">
                {filteredEvents.length === 0 && (
                  <div className="week-no-events">No events</div>
                )}
                {filteredEvents.map(ev => {
                  const cat = CATEGORIES.find(c => c.id === (ev.event_type || ev.day_type));
                  const layer = ev.schedule_layer || 'primary';
                  return (
                    <div
                      key={ev.id}
                      className={`week-event-pill ${layer === 'sacred' ? 'week-event-pill--sacred' : ''} ${layer === 'operations' ? 'week-event-pill--ops' : ''}`}
                      style={{ '--ev-color': ev.color || cat?.color || '#64748B' } as React.CSSProperties}
                      onClick={() => onDayClick(day.date)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onEventContextMenu(ev);
                      }}
                    >
                      <span className="week-event-time">{timeStr(ev.start_time, use24h)}</span>
                      <span className="week-event-title">{ev.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
