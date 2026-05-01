/**
 * LocationHistory.tsx — Location history viewer
 *
 * Timeline of today's movements, time-at-location breakdown,
 * "Where was I at 2pm?" query, pattern detection,
 * and privacy mode (blurs exact addresses).
 */

import { useState, useMemo } from 'react';
import { useLocationContext } from './useLocationContext';
import { localDateStr } from '../../utils/date';
import type { LocationHistoryEntry } from '../../stores/locationStore';

export function LocationHistory() {
  const ctx = useLocationContext();
  const today = localDateStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const [queryTime, setQueryTime] = useState('14:00');
  const [queryResult, setQueryResult] = useState<LocationHistoryEntry | undefined>(undefined);

  // History for selected date
  const dayHistory = useMemo(() => {
    return ctx.getHistoryForDate(selectedDate).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [ctx.history, selectedDate]);

  // Time-at-location breakdown
  const locationBreakdown = useMemo(() => {
    const sorted = [...dayHistory].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const segments: { locationId?: string; label: string; start: string; end: string; durationMin: number }[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      const nextEntry = sorted[i + 1];
      const start = entry.timestamp;
      const end = nextEntry ? nextEntry.timestamp : new Date().toISOString();

      const durationMin = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);

      if (durationMin > 0) {
        segments.push({
          locationId: entry.locationId,
          label: entry.label || (entry.locationId
            ? ctx.places.find(p => p.id === entry.locationId)?.name || 'Unknown'
            : 'Unknown'),
          start,
          end,
          durationMin,
        });
      }
    }

    return segments;
  }, [dayHistory, ctx.places]);

  // Pattern detection
  const patterns = useMemo(() => {
    return ctx.arrivalPatterns;
  }, [ctx.arrivalPatterns]);

  // "Where was I at...?" query
  const handleQuery = () => {
    const [h, m] = queryTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return;
    const queryDate = new Date(selectedDate + 'T00:00:00');
    queryDate.setHours(h, m, 0, 0);
    const result = ctx.getHistoryAtTime(queryDate.toISOString());
    setQueryResult(result);
  };

  // Total time at each location today
  const locationTimeMap = useMemo(() => {
    const map: Record<string, { label: string; totalMin: number; color: string }> = {};
    for (const seg of locationBreakdown) {
      const key = seg.locationId || seg.label;
      if (!map[key]) {
        const place = seg.locationId ? ctx.places.find(p => p.id === seg.locationId) : null;
        map[key] = { label: seg.label, totalMin: 0, color: place?.color || '#64748B' };
      }
      map[key].totalMin += seg.durationMin;
    }
    return Object.entries(map).sort((a, b) => b[1].totalMin - a[1].totalMin);
  }, [locationBreakdown, ctx.places]);

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (min: number) => {
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-white/80">Location History</h2>
          <p className="text-[10px] text-white/30 mt-0.5">
            {dayHistory.length} entries today · {locationBreakdown.length} segments
          </p>
        </div>
        {ctx.privacyMode && (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-amber-900/30 border border-amber-500/20 text-amber-300">
            🔒 Privacy
          </span>
        )}
      </div>

      {/* Date Selector */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none"
        />
        {selectedDate !== today && (
          <button
            onClick={() => setSelectedDate(today)}
            className="px-2 py-1.5 rounded text-[10px] text-cyan-300/60 hover:text-cyan-300 bg-cyan-900/20 transition-all"
          >
            Today
          </button>
        )}
      </div>

      {/* "Where was I at...?" */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-900/20 to-violet-900/20 border border-indigo-500/15">
        <label className="text-[10px] uppercase tracking-widest text-indigo-400/60 mb-1.5 block">
          Where was I at...?
        </label>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={queryTime}
            onChange={e => setQueryTime(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono outline-none flex-1"
          />
          <button
            onClick={handleQuery}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/50 hover:bg-indigo-500/50 border border-indigo-500/30 transition-all"
          >
            🔍 Find
          </button>
        </div>
        {queryResult && (
          <div className="mt-2 p-2 rounded-lg bg-white/5 text-xs">
            <div className="text-white/80">
              {queryResult.label || 'Unknown location'}
            </div>
            <div className="text-[10px] text-white/30 font-mono">
              {ctx.privacyMode
                ? `${(Math.round(queryResult.lat * 100) / 100).toFixed(2)}, ${(Math.round(queryResult.lng * 100) / 100).toFixed(2)}`
                : `${queryResult.lat.toFixed(4)}, ${queryResult.lng.toFixed(4)}`
              }
              <span className="ml-2">±{Math.round(queryResult.accuracy)}m</span>
            </div>
          </div>
        )}
      </div>

      {/* Time-at-Location Breakdown */}
      {locationTimeMap.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-cyan-400/60 mb-2 px-1">
            Time at Location
          </h3>
          <div className="space-y-1.5">
            {locationTimeMap.map(([key, data]) => {
              const totalDayMin = locationBreakdown.reduce((s, seg) => s + seg.durationMin, 0) || 1;
              const pct = (data.totalMin / totalDayMin) * 100;
              return (
                <div key={key} className="p-2.5 rounded-lg bg-[#111132]/40 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/70">{data.label}</span>
                    <span className="text-xs font-mono text-white/50">{formatDuration(data.totalMin)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: data.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      {dayHistory.length > 0 ? (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-cyan-400/60 mb-2 px-1">
            Timeline
          </h3>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />

            <div className="space-y-0.5">
              {dayHistory.map((entry, i) => {
                const place = entry.locationId
                  ? ctx.places.find(p => p.id === entry.locationId)
                  : null;
                return (
                  <div key={entry.id} className="flex items-center gap-3 py-1.5 pl-1">
                    <div className="relative z-10">
                      <div
                        className="w-3.5 h-3.5 rounded-full border-2"
                        style={{
                          borderColor: place?.color || '#64748B',
                          backgroundColor: i === 0 ? (place?.color || '#06B6D4') + '60' : 'transparent',
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white/60 truncate">
                        {entry.label || (ctx.privacyMode
                          ? `${(Math.round(entry.lat * 100) / 100).toFixed(2)}, ${(Math.round(entry.lng * 100) / 100).toFixed(2)}`
                          : `${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)}`
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-white/30">±{Math.round(entry.accuracy)}m</span>
                      <span className="text-[10px] text-white/40 font-mono w-12 text-right">
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-white/30 text-sm">
          <div className="text-2xl mb-2">🕐</div>
          <p>No location history for this date.</p>
          <p className="text-[10px] mt-1">Enable tracking to build your movement timeline.</p>
        </div>
      )}

      {/* Pattern Detection */}
      {patterns.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-violet-400/60 mb-2 px-1">
            Detected Patterns
          </h3>
          <div className="space-y-1.5">
            {patterns.map(pattern => (
              <div key={pattern.locationId} className="p-2.5 rounded-lg bg-violet-900/15 border border-violet-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-violet-200">
                    🧠 Typically arrive at <span className="font-medium">{pattern.locationName}</span>
                  </span>
                  <span className="text-xs font-mono text-violet-300">{pattern.avgArrivalTime}</span>
                </div>
                <div className="text-[10px] text-violet-300/40 mt-0.5">
                  Based on {pattern.count} observations
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy Note */}
      <div className="p-3 rounded-xl bg-amber-900/15 border border-amber-500/10">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm">🔒</span>
          <span className="text-xs font-medium text-amber-200">Privacy</span>
        </div>
        <p className="text-[10px] text-amber-300/50">
          {ctx.privacyMode
            ? 'Privacy mode is ON. Exact coordinates are rounded to 2 decimal places (~1km accuracy) in history. Geofencing still works with full accuracy.'
            : 'Privacy mode is OFF. Full coordinates are stored. Enable privacy mode to blur your exact addresses in history logs.'
          }
        </p>
      </div>
    </div>
  );
}