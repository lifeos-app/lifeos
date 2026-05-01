/**
 * DreamCalendar.tsx — Calendar view of dreams
 *
 * Calendar grid with dream intensity color coding,
 * streak counter, monthly summary, and day selection.
 */

import { useMemo } from 'react';
import { useDreamStore } from '../../stores/dreamStore';
import { localDateStr } from '../../utils/date';

interface DreamCalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  compact?: boolean;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function DreamCalendar({ selectedDate, onSelectDate, compact }: DreamCalendarProps) {
  const entries = useDreamStore(s => s.entries);
  const stats = useDreamStore(s => s.getStats());

  // Current view month/year
  const viewDate = useMemo(() => {
    const parts = selectedDate.split('-');
    return { year: parseInt(parts[0]), month: parseInt(parts[1]) - 1 };
  }, [selectedDate]);

  // Days in month
  const calendarDays = useMemo(() => {
    const { year, month } = viewDate;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];

    // Previous month trailing days
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dateStr = new Date(year, month - 1, d).toISOString().split('T')[0];
      days.push({ date: dateStr, day: d, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ date: dateStr, day: d, isCurrentMonth: true });
    }

    // Next month leading days
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const dateStr = new Date(year, month + 1, d).toISOString().split('T')[0];
      days.push({ date: dateStr, day: d, isCurrentMonth: false });
    }

    return days;
  }, [viewDate]);

  // Dream entries by date for quick lookup
  const dreamByDate = useMemo(() => {
    const map: Record<string, { intensity: number; isLucid: boolean; moodTags: string[] }> = {};
    entries.forEach(e => {
      map[e.date] = { intensity: e.intensity, isLucid: e.isLucid, moodTags: e.mood_tags };
    });
    return map;
  }, [entries]);

  // Monthly summary
  const monthlyEntries = useMemo(() => {
    const yearMonth = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}`;
    return entries.filter(e => e.date.startsWith(yearMonth));
  }, [entries, viewDate]);

  const monthlySummary = useMemo(() => {
    if (monthlyEntries.length === 0) return null;
    const moodCounts: Record<string, number> = {};
    const symbolCounts: Record<string, number> = {};
    let totalIntensity = 0;

    monthlyEntries.forEach(e => {
      e.mood_tags.forEach(m => { moodCounts[m] = (moodCounts[m] || 0) + 1; });
      e.symbol_tags.forEach(s => { symbolCounts[s] = (symbolCounts[s] || 0) + 1; });
      totalIntensity += e.intensity;
    });

    const topMood = Object.entries(moodCounts).sort(([, a], [, b]) => b - a)[0];
    const topSymbol = Object.entries(symbolCounts).sort(([, a], [, b]) => b - a)[0];

    return {
      count: monthlyEntries.length,
      topMood: topMood ? topMood[0] : null,
      topSymbol: topSymbol ? topSymbol[0] : null,
      avgIntensity: Math.round((totalIntensity / monthlyEntries.length) * 10) / 10,
      lucidCount: monthlyEntries.filter(e => e.isLucid).length,
    };
  }, [monthlyEntries]);

  const today = localDateStr();

  const getIntensityColor = (intensity: number) => {
    if (intensity <= 2) return 'from-indigo-900/40 to-purple-900/40';
    if (intensity <= 4) return 'from-indigo-700/40 to-purple-700/40';
    if (intensity <= 6) return 'from-purple-600/50 to-indigo-600/50';
    if (intensity <= 8) return 'from-purple-500/60 to-violet-500/60';
    return 'from-violet-400/60 to-fuchsia-400/60';
  };

  // Compact mode = week strip
  if (compact) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = localDateStr(d);
      const dream = dreamByDate[dateStr];
      return { date: dateStr, day: d.getDate(), dream, dayName: DAY_NAMES[i] };
    });

    return (
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-900/30 border border-purple-500/20">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-medium text-purple-200">
              {stats.currentStreak} day streak
            </span>
          </div>
          {stats.longestStreak > 0 && (
            <div className="text-[10px] text-purple-400/50">
              Best: {stats.longestStreak} days
            </div>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map(({ date, day, dream, dayName }) => {
            const isSelected = date === selectedDate;
            const isToday = date === today;
            return (
              <button
                key={date}
                onClick={() => onSelectDate(date)}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all ${
                  isSelected
                    ? 'bg-purple-600/40 border border-purple-400/40'
                    : dream
                    ? `bg-gradient-to-b ${getIntensityColor(dream.intensity)} border border-purple-500/15`
                    : 'bg-white/5 border border-white/5 hover:bg-white/10'
                }`}
              >
                <span className="text-[9px] text-purple-300/50">{dayName}</span>
                <span className={`text-sm font-medium ${
                  isToday ? 'text-purple-200' : 'text-white/70'
                }`}>
                  {day}
                </span>
                {dream && (
                  <div className="flex items-center gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    {dream.isLucid && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Full calendar mode
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] via-[#0d0d2b] to-[#0a0a1a] text-white">
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📅</span>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
            Dream Calendar
          </h1>
        </div>
        <p className="text-xs text-purple-300/60 ml-9 -mt-1">
          Visualize your dream patterns over time
        </p>
      </div>

      {/* Streak */}
      <div className="px-4 mb-4 flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/30 border border-purple-500/20">
          <span className="text-sm">🔥</span>
          <span className="text-sm font-medium text-purple-200">{stats.currentStreak} day streak</span>
        </div>
        {stats.longestStreak > 0 && (
          <span className="text-xs text-purple-400/50">
            Longest: {stats.longestStreak} days
          </span>
        )}
      </div>

      {/* Month Navigation + Grid */}
      <div className="px-4 mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-purple-200">
          {MONTH_NAMES[viewDate.month]} {viewDate.year}
        </h2>
        <div className="flex items-center gap-1">
          <span className="text-xs text-purple-400/50">
            {monthlyEntries.length} dream{monthlyEntries.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[10px] text-purple-400/40 font-medium">
              {d.charAt(0)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(({ date, day, isCurrentMonth }) => {
            const dream = dreamByDate[date];
            const isSelected = date === selectedDate;
            const isToday = date === today;

            if (!isCurrentMonth) {
              return (
                <div key={date} className="h-10 flex items-center justify-center">
                  <span className="text-sm text-white/15">{day}</span>
                </div>
              );
            }

            return (
              <button
                key={date}
                onClick={() => onSelectDate(date)}
                className={`h-10 flex flex-col items-center justify-center rounded-lg transition-all relative ${
                  isSelected
                    ? 'bg-purple-600/40 border-2 border-purple-400/60 ring-1 ring-purple-400/20'
                    : dream
                    ? `bg-gradient-to-b ${getIntensityColor(dream.intensity)} border border-purple-500/15 hover:border-purple-400/30`
                    : 'hover:bg-white/5'
                }`}
              >
                <span className={`text-sm ${
                  isToday ? 'font-bold text-purple-200' : 'text-white/70'
                }`}>
                  {day}
                </span>
                {dream && (
                  <div className="flex items-center gap-0.5 absolute bottom-0.5">
                    <div className="w-1 h-1 rounded-full bg-purple-300" />
                    {dream.isLucid && <div className="w-1 h-1 rounded-full bg-cyan-400" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Intensity Legend */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-purple-400/50">Intensity:</span>
          {[
            { label: 'Faint', color: 'bg-indigo-900/60' },
            { label: 'Low', color: 'bg-indigo-700/60' },
            { label: 'Medium', color: 'bg-purple-600/60' },
            { label: 'Vivid', color: 'bg-purple-500/60' },
            { label: 'Overwhelming', color: 'bg-violet-400/60' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
              <span className="text-[9px] text-purple-400/50">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 ml-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span className="text-[9px] text-purple-400/50">Lucid</span>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      {monthlySummary && (
        <div className="px-4 mb-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#111132] to-[#0d0d24] border border-purple-500/15">
            <h3 className="text-xs uppercase tracking-widest text-purple-400/60 mb-3">
              Monthly Summary
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-lg font-bold text-purple-200">{monthlySummary.count}</div>
                <div className="text-[10px] text-purple-400/60">Dreams</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-amber-200">{monthlySummary.avgIntensity}</div>
                <div className="text-[10px] text-purple-400/60">Avg Intensity</div>
              </div>
              {monthlySummary.topMood && (
                <div className="text-center">
                  <div className="text-lg font-bold text-cyan-200 capitalize">{monthlySummary.topMood}</div>
                  <div className="text-[10px] text-purple-400/60">Top Mood</div>
                </div>
              )}
              {monthlySummary.topSymbol && (
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-200 capitalize">{monthlySummary.topSymbol}</div>
                  <div className="text-[10px] text-purple-400/60">Top Symbol</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}