/**
 * TCSTodayCard — Tonight's run at a glance
 *
 * Shows venues, completion status, km, ATO deduction, and projected income.
 * Reads live completion from useScheduleStore events.
 */

import { useMemo } from 'react';
import { Briefcase, CheckCircle2, Car, DollarSign, Route } from 'lucide-react';
import { TCS_CONFIG, calcDeduction } from '../../lib/tcs-config';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { todayStr, fmtCurrency } from '../../utils/date';
import './TCSTodayCard.css';

export function TCSTodayCard() {
  const today = todayStr();
  const getEventsForDate = useScheduleStore(s => s.getEventsForDate);

  const venues = TCS_CONFIG.venues;
  const todaysEvents = useMemo(() => getEventsForDate(today), [getEventsForDate, today]);

  // Determine which venues are completed tonight
  const venueCompletion = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const venue of venues) {
      const completed = todaysEvents.some(
        e =>
          e.event_type === 'work' &&
          e.status === 'completed' &&
          e.title.toLowerCase().includes(venue.name.toLowerCase())
      );
      map.set(venue.id, completed);
    }
    return map;
  }, [venues, todaysEvents]);

  const doneCount = venues.filter(v => venueCompletion.get(v.id)).length;
  const totalVenues = venues.length;

  // Sum rates for all venues (projected nightly income = all venues on the run)
  const projectedIncome = useMemo(
    () => venues.reduce((sum, v) => sum + v.rate, 0),
    [venues]
  );

  const routeKm = TCS_CONFIG.routeKm;
  const atoDeduction = calcDeduction(routeKm);

  return (
    <div className="tcs-today-card">
      {/* Header */}
      <div className="tcs-today-header">
        <div className="tcs-today-header-left">
          <Briefcase size={18} className="tcs-today-icon" />
          <h3 className="tcs-today-title">Tonight's Run</h3>
        </div>
        <div className="tcs-today-header-right">
          <span className="tcs-today-date">{today}</span>
          <span className={`tcs-today-count ${doneCount === totalVenues ? 'tcs-today-count--done' : ''}`}>
            {doneCount}/{totalVenues} done
          </span>
        </div>
      </div>

      {/* Venue list */}
      <div className="tcs-today-venues">
        {venues.map(venue => {
          const isDone = venueCompletion.get(venue.id);
          return (
            <div
              key={venue.id}
              className={`tcs-today-venue ${isDone ? 'tcs-today-venue--done' : ''}`}
            >
              <div className="tcs-today-venue-icon">
                {isDone ? (
                  <CheckCircle2 size={16} className="tcs-today-venue-check" />
                ) : (
                  <Briefcase size={16} className="tcs-today-venue-brief" />
                )}
              </div>
              <div className="tcs-today-venue-info">
                <span className="tcs-today-venue-name">{venue.name}</span>
                <span className="tcs-today-venue-suburb">{venue.suburb}</span>
              </div>
              <span className="tcs-today-venue-rate">{fmtCurrency(venue.rate)}</span>
            </div>
          );
        })}
      </div>

      {/* Bottom stats */}
      <div className="tcs-today-stats">
        <div className="tcs-today-stat">
          <Route size={14} className="tcs-today-stat-icon" />
          <span className="tcs-today-stat-value">{routeKm}km</span>
          <span className="tcs-today-stat-label">route</span>
        </div>
        <div className="tcs-today-stat-divider" />
        <div className="tcs-today-stat">
          <Car size={14} className="tcs-today-stat-icon" />
          <span className="tcs-today-stat-value">{fmtCurrency(atoDeduction)}</span>
          <span className="tcs-today-stat-label">ATO deduction</span>
        </div>
        <div className="tcs-today-stat-divider" />
        <div className="tcs-today-stat">
          <DollarSign size={14} className="tcs-today-stat-icon" />
          <span className="tcs-today-stat-value tcs-today-stat-value--income">{fmtCurrency(projectedIncome)}</span>
          <span className="tcs-today-stat-label">projected</span>
        </div>
      </div>
    </div>
  );
}