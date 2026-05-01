/**
 * StatsSlide — Big number stats with animated count-ups.
 *
 * Habit completions, total days streaked, XP earned,
 * journal entries written, goals crushed.
 * Animated progress rings + comparison to previous year.
 * Celebratory particle burst on completion.
 */

import React, { useState, useEffect } from 'react';
import { CountUp, ProgressRing, BurstParticles, AmbientParticles } from './SlideTransition';
import type { YearSummary } from './useYearInReview';

interface StatsSlideProps {
  data: YearSummary;
  active: boolean;
}

interface StatItem {
  label: string;
  value: number;
  suffix: string;
  prefix?: string;
  icon: string;
  color: string;
  ringValue: number; // 0–1 for progress ring
}

export function StatsSlide({ data, active }: StatsSlideProps) {
  const [showRings, setShowRings] = useState(false);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (!active) { setShowRings(false); setBurst(false); return; }
    const t1 = setTimeout(() => setShowRings(true), 600);
    const t2 = setTimeout(() => setBurst(true), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);

  const stats: StatItem[] = [
    {
      label: 'Habit Completions',
      value: data.totalHabitCompletions,
      suffix: '',
      icon: '🔥',
      color: '#F97316',
      ringValue: Math.min(data.totalHabitCompletions / 365, 1),
    },
    {
      label: 'Longest Streak',
      value: data.longestStreak,
      suffix: ' days',
      icon: '⚡',
      color: '#FACC15',
      ringValue: Math.min(data.longestStreak / 100, 1),
    },
    {
      label: 'XP Earned',
      value: data.totalXP,
      suffix: '',
      icon: '✨',
      color: '#A855F7',
      ringValue: Math.min(data.totalXP / 10000, 1),
    },
    {
      label: 'Journal Entries',
      value: data.journalEntries,
      suffix: '',
      icon: '📝',
      color: '#EC4899',
      ringValue: Math.min(data.journalEntries / 365, 1),
    },
    {
      label: 'Goals Crushed',
      value: data.goalsCompleted,
      suffix: '',
      icon: '🎯',
      color: '#39FF14',
      ringValue: data.goalsTotal > 0 ? data.goalsCompleted / data.goalsTotal : 0,
    },
    {
      label: 'Days Active',
      value: data.daysActive,
      suffix: '',
      icon: '📅',
      color: '#00D4FF',
      ringValue: data.showUpRate,
    },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Background */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #141e30 0%, #243b55 50%, #0f172a 100%)' }}
      />

      <AmbientParticles count={20} color="rgba(0, 212, 255, 0.15)" />

      {/* Burst particles on completion */}
      <BurstParticles trigger={burst} color="#FFD700" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-6 sm:px-8">
        {/* Title */}
        <div className="text-center mb-8 sm:mb-12" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-2">
            {data.year} by the Numbers
          </h2>
          <p className="text-white/50 text-base sm:text-lg">
            Every day, every action, every win — counted
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/5"
              style={{
                opacity: active ? 1 : 0,
                transform: active ? 'translateY(0)' : 'translateY(30px)',
                transition: `all 0.6s ${i * 100 + 200}ms cubic-bezier(0.16, 1, 0.3, 1)`,
              }}
            >
              <div className="text-2xl mb-1">{stat.icon}</div>

              <ProgressRing
                value={showRings ? stat.ringValue : 0}
                size={64}
                strokeWidth={4}
                color={stat.color}
              >
                <span className="text-white font-bold text-sm">
                  <CountUp
                    end={stat.value}
                    duration={2000}
                    trigger={active}
                  />
                </span>
              </ProgressRing>

              <span className="text-white/60 text-xs text-center font-medium mt-1">
                {stat.label}
              </span>

              {/* Comparison bar */}
              {data.growthFromLastYear > 0 && (
                <div className="flex items-center gap-1 text-xs text-emerald-400 mt-1">
                  <span>▲</span>
                  <span>{data.growthFromLastYear}%</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom stat: Show-up rate */}
        <div className="mt-6 sm:mt-8 text-center" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10">
            <span className="text-2xl">🏆</span>
            <span className="text-white text-sm sm:text-base font-semibold">
              You showed up <CountUp end={Math.round(data.showUpRate * 100)} duration={1500} suffix="%" trigger={active} /> of days
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsSlide;