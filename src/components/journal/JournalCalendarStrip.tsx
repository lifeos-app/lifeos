/**
 * JournalCalendarStrip — 7-day calendar navigation strip for journal entries.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { localDateStr, todayStr } from '../../utils/date';
import { MOODS } from './types';
import type { JournalEntry } from './types';

interface JournalCalendarStripProps {
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  entryDates: Set<string>;
  previousEntries: JournalEntry[];
}

export function JournalCalendarStrip({ selectedDate, setSelectedDate, entryDates, previousEntries }: JournalCalendarStripProps) {
  const calDays: string[] = [];
  const sel = new Date(selectedDate + 'T00:00:00');
  for (let i = -3; i <= 3; i++) {
    const d = new Date(sel); d.setDate(d.getDate() + i);
    calDays.push(localDateStr(d));
  }
  const shiftDays = (n: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + n);
    setSelectedDate(localDateStr(d));
  };

  return (
    <div className="jnl-cal-strip">
      <button className="jnl-cal-nav" onClick={() => shiftDays(-7)} aria-label="Previous week"><ChevronLeft size={16} /></button>
      <div className="jnl-cal-days">
        {calDays.map(d => {
          const dt = new Date(d + 'T00:00:00');
          const isToday = d === todayStr();
          const isSelected = d === selectedDate;
          const hasEntry = entryDates.has(d);
          const dayMood = previousEntries.find(e => e.date === d)?.mood;
          return (
            <button key={d} className={`jnl-cal-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${hasEntry ? 'has-entry' : ''} ${!isToday && d < todayStr() ? 'past' : ''}`}
              onClick={() => setSelectedDate(d)}
              style={hasEntry && dayMood ? {
                borderColor: MOODS.find(m => m.value === dayMood)?.color + '40',
              } : undefined}>
              <span className="jnl-cal-dow">{dt.toLocaleDateString('en-AU', { weekday: 'short' })}</span>
              <span className="jnl-cal-num">{dt.getDate()}</span>
              {hasEntry && <span className="jnl-cal-dot" style={{
                backgroundColor: dayMood ? MOODS.find(m => m.value === dayMood)?.color : '#A855F7',
              }}></span>}
            </button>
          );
        })}
      </div>
      <button className="jnl-cal-nav" onClick={() => shiftDays(7)} aria-label="Next week"><ChevronRight size={16} /></button>
    </div>
  );
}
