/**
 * DashboardHeatmap — GitHub-style activity heatmap
 *
 * Shows combined daily activity (tasks done + habits logged + journal entries)
 * across the trailing 52 weeks. Colour intensity = activity volume.
 * Zero activity = #1A3A5C (dark). Peak activity = #39FF14 (neon green).
 */

import { useMemo, useState } from 'react';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useJournalStore } from '../../stores/useJournalStore';
import { useShallow } from 'zustand/react/shallow';

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEKS = 26; // trailing 26 weeks (~6 months, fits in widget width)
const CELL  = 9;
const GAP   = 2;
const DAYS  = WEEKS * 7;

// Colour scale: 0 activity = dark, max = neon green
const COLOR_EMPTY  = '#0F2D4A';
const COLOR_SCALE  = ['#1A4A2E', '#226E3A', '#28A64D', '#2ED667', '#39FF14'] as const;

function activityColor(count: number, max: number): string {
  if (count === 0 || max === 0) return COLOR_EMPTY;
  const ratio = Math.min(count / max, 1);
  const idx = Math.min(Math.floor(ratio * COLOR_SCALE.length), COLOR_SCALE.length - 1);
  return COLOR_SCALE[idx];
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardHeatmap() {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const tasks    = useScheduleStore(s => s.tasks);
  const habitLogs = useHabitsStore(s => s.logs);
  const { entryDates } = useJournalStore(useShallow(s => ({ entryDates: s.entryDates })));

  // Build a map of dateStr → activity count
  const activityMap = useMemo(() => {
    const map: Record<string, number> = {};

    // Tasks completed
    for (const t of tasks) {
      if (t.status === 'done' && t.completed_at) {
        const d = t.completed_at.slice(0, 10);
        map[d] = (map[d] ?? 0) + 1;
      }
    }

    // Habit logs
    for (const log of habitLogs) {
      if (log.date) {
        map[log.date] = (map[log.date] ?? 0) + 1;
      }
    }

    // Journal entries
    for (const d of entryDates) {
      map[d] = (map[d] ?? 0) + 1;
    }

    return map;
  }, [tasks, habitLogs, entryDates]);

  // Build ordered list of days (oldest → newest, padded to full weeks)
  const { days, maxCount } = useMemo(() => {
    const today = new Date();
    // Start from DAYS ago, then pad left to Monday boundary
    const startRaw = new Date(today);
    startRaw.setDate(today.getDate() - DAYS + 1);
    // Pad to nearest Monday
    const dow = startRaw.getDay(); // 0=Sun
    const padBack = (dow === 0 ? 6 : dow - 1); // days to go back to reach Monday
    const start = new Date(startRaw);
    start.setDate(startRaw.getDate() - padBack);

    const list: { key: string; date: Date; count: number }[] = [];
    const cur = new Date(start);
    while (cur <= today) {
      const key = dateKey(cur);
      list.push({ key, date: new Date(cur), count: activityMap[key] ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }

    const max = Math.max(...list.map(d => d.count), 1);
    return { days: list, maxCount: max };
  }, [activityMap]);

  // Group by week columns
  const columns = useMemo(() => {
    const cols: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) {
      cols.push(days.slice(i, i + 7));
    }
    return cols;
  }, [days]);

  const totalActivity = useMemo(
    () => Object.values(activityMap).reduce((s, v) => s + v, 0),
    [activityMap]
  );

  const DAY_LABELS = ['M', '', 'W', '', 'F', '', ''];

  return (
    <div className="dash-card" style={{ padding: '14px 16px', position: 'relative' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
          Activity — past 6 months
        </div>
        <div style={{ fontSize: 10, color: '#5A7A9A' }}>
          {totalActivity} actions total
        </div>
      </div>

      <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-start' }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginTop: 0 }}>
          {DAY_LABELS.map((label, i) => (
            <div key={i} style={{
              width: 10, height: CELL,
              fontSize: 8, color: '#5A7A9A',
              lineHeight: `${CELL}px`, textAlign: 'right',
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'flex', gap: GAP, flex: 1, overflowX: 'auto' }}>
          {columns.map((col, ci) => (
            <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
              {col.map(day => (
                <div
                  key={day.key}
                  style={{
                    width: CELL, height: CELL,
                    borderRadius: 2,
                    background: activityColor(day.count, maxCount),
                    cursor: day.count > 0 ? 'default' : undefined,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => {
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    const label = day.date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
                    setTooltip({
                      text: day.count > 0 ? `${day.count} action${day.count > 1 ? 's' : ''} on ${label}` : `No activity on ${label}`,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 6,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Colour legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        marginTop: 8, justifyContent: 'flex-end',
      }}>
        <span style={{ fontSize: 9, color: '#5A7A9A' }}>Less</span>
        {[COLOR_EMPTY, ...COLOR_SCALE].map((c, i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: 1, background: c }} />
        ))}
        <span style={{ fontSize: 9, color: '#5A7A9A' }}>More</span>
      </div>

      {/* Tooltip portal — positioned fixed so it clears card overflow */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y,
          transform: 'translate(-50%, -100%)',
          background: '#0F2D4A',
          border: '1px solid #1A3A5C',
          borderRadius: 6,
          padding: '4px 8px',
          fontSize: 10,
          color: '#fff',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 9999,
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
