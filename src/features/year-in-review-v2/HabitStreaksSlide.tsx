/**
 * HabitStreaksSlide — Habit journey visualization
 *
 * GitHub-style contribution graph, longest streak callout,
 * top 3 habits, show-up %, streak recovery stories.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { CountUp, AmbientParticles } from './SlideTransition';
import type { HabitYearData, YearSummary } from './useYearInReview';

interface HabitStreaksSlideProps {
  habits: HabitYearData[];
  summary: YearSummary;
  active: boolean;
}

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getDaysInYear(year: number): number {
  return (year % 4 === 0) ? 366 : 365;
}

function getContributionGrid(dailyMap: Record<string, boolean>, year: number) {
  const grid: (number | null)[][] = []; // 7 rows x ~53 cols
  for (let row = 0; row < 7; row++) grid.push([]);

  const jan1 = new Date(year, 0, 1);
  const startDay = jan1.getDay(); // 0=Sun

  // Fill leading empty cells
  for (let i = 0; i < startDay; i++) {
    grid[i].push(null);
  }

  const daysInYear = getDaysInYear(year);
  for (let d = 1; d <= daysInYear; d++) {
    const date = new Date(year, 0, d);
    const dateStr = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayOfWeek = date.getDay();
    grid[dayOfWeek].push(dailyMap[dateStr] ? 1 : 0);
  }

  return grid;
}

export function HabitStreaksSlide({ habits, summary, active }: HabitStreaksSlideProps) {
  const [gridVisible, setGridVisible] = useState(false);
  const [topVisible, setTopVisible] = useState(false);

  useEffect(() => {
    if (!active) { setGridVisible(false); setTopVisible(false); return; }
    const t1 = setTimeout(() => setGridVisible(true), 400);
    const t2 = setTimeout(() => setTopVisible(true), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);

  // Merge all habit daily maps into one contribution graph
  const mergedDailyMap = useMemo(() => {
    const map: Record<string, number> = {};
    habits.forEach(h => {
      Object.keys(h.dailyMap).forEach(date => {
        map[date] = (map[date] || 0) + 1;
      });
    });
    return map;
  }, [habits]);

  const grid = useMemo(() => {
    const booleanMap: Record<string, boolean> = {};
    Object.keys(mergedDailyMap).forEach(k => { booleanMap[k] = mergedDailyMap[k] > 0; });
    return getContributionGrid(booleanMap, summary.year);
  }, [mergedDailyMap, summary.year]);

  const topHabits = habits.slice(0, 3);
  const streakRecovery = habits.find(h => h.streakRecovery);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Background */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0a0a1a 100%)' }}
      />

      <AmbientParticles count={15} color="rgba(249, 115, 22, 0.15)" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-6">
        {/* Title */}
        <div className="text-center" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-2">
            Your Habit Journey
          </h2>
          <p className="text-white/50 text-base sm:text-lg">
            Day by day, you showed up
          </p>
        </div>

        {/* Longest Streak Callout */}
        <div className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-orange-500/10 border border-orange-500/20" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'scale(1)' : 'scale(0.8)',
          transition: 'all 0.6s 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <span className="text-3xl">🔥</span>
          <div>
            <div className="text-white font-bold text-lg">
              <CountUp end={summary.longestStreak} duration={1500} suffix=" days" trigger={active} />
            </div>
            <div className="text-orange-300/60 text-sm">Longest Streak</div>
          </div>
        </div>

        {/* Contribution Grid */}
        <div
          className="w-full overflow-x-auto"
          style={{
            opacity: gridVisible ? 1 : 0,
            transform: gridVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s 600ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="inline-flex flex-col gap-[2px] min-w-fit mx-auto">
            {/* Month labels */}
            <div className="flex gap-[2px] ml-4 mb-1">
              {MONTH_LABELS.map((m, i) => (
                <span key={i} className="text-white/30 text-[8px]" style={{ width: `${52 / 12 * 100}%`, minWidth: 20 }}>
                  {m}
                </span>
              ))}
            </div>
            {grid.map((row, ri) => (
              <div key={ri} className="flex gap-[2px] items-center">
                <span className="text-white/20 text-[8px] w-3">{DAYS_OF_WEEK[ri]}</span>
                {row.map((cell, ci) => (
                  <div
                    key={ci}
                    className="w-[10px] h-[10px] sm:w-[12px] sm:h-[12px] rounded-[2px]"
                    style={{
                      background: cell === null ? 'transparent'
                        : cell > 0 ? '#f97316'
                        : 'rgba(255,255,255,0.05)',
                      opacity: cell === null ? 0 : gridVisible ? 1 : 0,
                      transition: `opacity 0.3s ${ci * 3}ms`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Show-up rate */}
        <div className="text-center" style={{
          opacity: gridVisible ? 1 : 0,
          transition: 'opacity 0.6s 800ms',
        }}>
          <div className="text-white/80 font-semibold">
            You showed up <CountUp end={Math.round(summary.showUpRate * 100)} duration={1500} suffix="%" trigger={active && gridVisible} /> of days
          </div>
        </div>

        {/* Top 3 Habits */}
        <div className="w-full grid grid-cols-3 gap-3" style={{
          opacity: topVisible ? 1 : 0,
          transform: topVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s 1s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {topHabits.map((h, i) => (
            <div key={h.habitId} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/5 border border-white/5">
              <span className="text-xl">{['🥇', '🥈', '🥉'][i]}</span>
              <span className="text-white/80 text-xs sm:text-sm font-medium text-center truncate w-full">
                {h.habitTitle}
              </span>
              <span className="text-orange-400 text-xs font-mono">
                {Math.round(h.consistency * 100)}%
              </span>
            </div>
          ))}
        </div>

        {/* Streak Recovery Story */}
        {streakRecovery?.streakRecovery && (
          <div className="px-5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center" style={{
            opacity: topVisible ? 1 : 0,
            transition: 'opacity 0.6s 1.4s',
          }}>
            <span className="text-white/70 text-sm">
              💪 You lost your streak on <span className="text-amber-300">{streakRecovery.streakRecovery.lostDate}</span> but rebuilt it in just{' '}
              <span className="text-amber-300 font-bold">{streakRecovery.streakRecovery.recoveredInDays} days!</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default HabitStreaksSlide;