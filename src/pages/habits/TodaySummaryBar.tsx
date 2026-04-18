import { useMemo } from 'react';
import type { Habit, HabitLog } from '../../stores/useHabitsStore';
import { todayStr, localDateStr } from '../../utils/date';

function getTodayCount(logs: HabitLog[]): number {
  return logs.filter(l => l.date === todayStr()).reduce((sum: number, l) => sum + (l.count || 1), 0);
}

function isTodayDone(logs: HabitLog[], targetCount: number): boolean {
  return getTodayCount(logs) >= targetCount;
}

interface TodaySummaryBarProps {
  habits: Habit[];
  logs: Record<string, HabitLog[]>;
}

export function TodaySummaryBar({ habits, logs }: TodaySummaryBarProps) {
  const { done, total, pct, nextHabit } = useMemo(() => {
    const totalHabits = habits.length;
    const doneCount = habits.filter(h => isTodayDone(logs[h.id] || [], h.target_count || 1)).length;
    const pct = totalHabits > 0 ? Math.round((doneCount / totalHabits) * 100) : 0;
    
    // Find next incomplete habit sorted by time_of_day
    const incomplete = habits
      .filter(h => !isTodayDone(logs[h.id] || [], h.target_count || 1))
      .sort((a, b) => (a.time_of_day || '23:59').localeCompare(b.time_of_day || '23:59'));
    
    const next = incomplete[0];
    
    // Format time_of_day for display
    let nextLabel: string | null = null;
    if (next?.time_of_day) {
      const [h, m] = next.time_of_day.split(':').map(Number);
      if (!isNaN(h)) {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        nextLabel = `${next.title} at ${hour12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
      }
    } else if (next) {
      nextLabel = next.title;
    }
    
    return { done: doneCount, total: totalHabits, pct, nextHabit: nextLabel };
  }, [habits, logs]);
  
  // Color interpolation: orange(0%) → cyan(50%) → green(100%)
  const barColor = useMemo(() => {
    if (pct <= 50) {
      const t = pct / 50;
      const r = Math.round(249 + (0 - 249) * t);
      const g = Math.round(115 + (212 - 115) * t);
      const b = Math.round(22 + (255 - 22) * t);
      return `rgb(${r},${g},${b})`;
    } else {
      const t = (pct - 50) / 50;
      const r = Math.round(0 + (57 - 0) * t);
      const g = Math.round(212 + (255 - 212) * t);
      const b = Math.round(255 + (20 - 255) * t);
      return `rgb(${r},${g},${b})`;
    }
  }, [pct]);
  
  if (total === 0) return null;
  
  return (
    <div className="today-summary-bar animate-fadeUp">
      <div className="today-summary-row">
        <div className="today-summary-left">
          <span className="today-summary-pct" style={{ color: barColor }}>{pct}%</span>
          <span className="today-summary-text">{done}/{total} done today</span>
        </div>
        {nextHabit && (
          <div className="today-summary-right">
            <span className="today-summary-next">Next: {nextHabit}</span>
          </div>
        )}
      </div>
      <div className="today-summary-track">
        <div
          className="today-summary-fill"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}