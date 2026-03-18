import { DAYS_SHORT, getMonthGrid } from './utils';

interface ScheduleMonthViewProps {
  year: number;
  month: number;
  selectedDateStr: string;
  todayStr: string;
  eventsByDay: Record<string, number>;
  onDaySelect: (dateStr: string) => void;
  onGoToday: () => void;
}

export function ScheduleMonthView({
  year,
  month,
  selectedDateStr,
  todayStr,
  eventsByDay,
  onDaySelect,
  onGoToday,
}: ScheduleMonthViewProps) {
  const monthGrid = getMonthGrid(year, month);

  return (
    <div className="sched-calendar">
      <div className="cal-header">
        {DAYS_SHORT.map(d => (
          <div key={d} className="cal-header-cell">{d}</div>
        ))}
      </div>
      <div className="cal-grid">
        {monthGrid.map((d, i) => {
          const count = eventsByDay[d.iso] || 0;
          const isSel = d.iso === selectedDateStr;
          const isT = d.iso === todayStr;
          return (
            <div
              key={i}
              className={`cal-cell ${!d.inMonth ? 'faded' : ''} ${isSel ? 'selected' : ''} ${isT ? 'today' : ''}`}
              onClick={() => onDaySelect(d.iso)}
            >
              <span className="cal-date">{d.date}</span>
              {count > 0 && (
                <div className="cal-dots">
                  {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                    <div key={j} className="cal-dot" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="sched-today-btn cal-today" onClick={onGoToday}>
        ← Go to today
      </button>
    </div>
  );
}
