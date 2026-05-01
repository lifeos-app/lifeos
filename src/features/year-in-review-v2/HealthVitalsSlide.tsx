/**
 * HealthVitalsSlide — Health story
 *
 * Mood over time with seasonal overlay, avg sleep/energy/mood,
 * best/worst health month, correlation insights,
 * exercise minutes, health improvement trajectory.
 */

import React, { useEffect, useState } from 'react';
import { CountUp, ProgressRing, AmbientParticles } from './SlideTransition';
import type { HealthYearData } from './useYearInReview';

interface HealthVitalsSlideProps {
  data: HealthYearData;
  active: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEASON_COLORS: Record<string, string> = {
  spring: '#39FF14',
  summer: '#FACC15',
  fall: '#F97316',
  winter: '#60A5FA',
};

function getSeasonForMonth(m: number): string {
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'fall';
  return 'winter';
}

export function HealthVitalsSlide({ data, active }: HealthVitalsSlideProps) {
  const [chartVisible, setChartVisible] = useState(false);
  const [insightsVisible, setInsightsVisible] = useState(false);

  useEffect(() => {
    if (!active) { setChartVisible(false); setInsightsVisible(false); return; }
    const t1 = setTimeout(() => setChartVisible(true), 400);
    const t2 = setTimeout(() => setInsightsVisible(true), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);

  const chartH = 120;
  const moodValues = data.monthlyMood.map(v => v ?? 5);
  const maxMood = 10;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Background */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #0f0720 100%)' }}
      />

      <AmbientParticles count={20} color="rgba(244, 63, 94, 0.12)" />

      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-5">
        {/* Title */}
        <div className="text-center" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-2">
            Your Health Story
          </h2>
          <p className="text-white/50 text-base sm:text-lg">
            Mood, energy, sleep — the full picture
          </p>
        </div>

        {/* Average Stats */}
        <div className="grid grid-cols-3 gap-4 w-full" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/5">
            <ProgressRing value={data.avgMood / 10} size={56} strokeWidth={4} color="#F43F5E">
              <span className="text-white font-bold text-sm">
                {data.avgMood.toFixed(1)}
              </span>
            </ProgressRing>
            <span className="text-white/50 text-xs">Avg Mood</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/5">
            <ProgressRing value={data.avgEnergy / 10} size={56} strokeWidth={4} color="#FACC15">
              <span className="text-white font-bold text-sm">
                {data.avgEnergy.toFixed(1)}
              </span>
            </ProgressRing>
            <span className="text-white/50 text-xs">Avg Energy</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/5">
            <ProgressRing value={data.avgSleep / 10} size={56} strokeWidth={4} color="#60A5FA">
              <span className="text-white font-bold text-sm">
                {data.avgSleep.toFixed(1)}h
              </span>
            </ProgressRing>
            <span className="text-white/50 text-xs">Avg Sleep</span>
          </div>
        </div>

        {/* Mood Chart with Seasonal Overlay */}
        <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/5" style={{
          opacity: chartVisible ? 1 : 0,
          transform: chartVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div className="text-white/50 text-xs mb-2">Mood Over Time</div>
          <div className="relative" style={{ height: chartH }}>
            {/* Season color bands */}
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full opacity-5"
                style={{
                  left: `${(i / 12) * 100}%`,
                  width: `${100 / 12}%`,
                  background: SEASON_COLORS[getSeasonForMonth(i)],
                }}
              />
            ))}

            {/* Mood line */}
            <svg className="absolute inset-0 w-full" height={chartH} preserveAspectRatio="none">
              <path
                d={buildLinePath(moodValues, maxMood, chartH)}
                fill="none"
                stroke="#F43F5E"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 2000,
                  strokeDashoffset: chartVisible ? 0 : 2000,
                  transition: 'stroke-dashoffset 2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
              {/* Glow effect */}
              <path
                d={buildLinePath(moodValues, maxMood, chartH)}
                fill="none"
                stroke="#F43F5E"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.15"
                style={{
                  strokeDasharray: 2000,
                  strokeDashoffset: chartVisible ? 0 : 2000,
                  transition: 'stroke-dashoffset 2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </svg>

            {/* Month labels */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1">
              {MONTHS.map((m, i) => (
                <span key={i} className="text-white/20 text-[8px] sm:text-[10px]">{m}</span>
              ))}
            </div>
          </div>

          {/* Season legend */}
          <div className="flex gap-3 mt-2 flex-wrap">
            {['spring', 'summer', 'fall', 'winter'].map(s => (
              <div key={s} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: SEASON_COLORS[s], opacity: 0.6 }} />
                <span className="text-white/30 text-[10px] capitalize">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Best/Worst Months */}
        <div className="w-full grid grid-cols-2 gap-3" style={{
          opacity: chartVisible ? 1 : 0,
          transition: 'opacity 0.6s 1s',
        }}>
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-white/40 text-xs mb-1">🌟 Best Month</div>
            <div className="text-emerald-400 font-bold text-lg">{MONTHS[data.bestMonth.month]}</div>
            <div className="text-white/30 text-xs">Mood: {data.bestMonth.mood.toFixed(1)} · Energy: {data.bestMonth.energy.toFixed(1)}</div>
          </div>
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="text-white/40 text-xs mb-1">💪 Toughest Month</div>
            <div className="text-red-400 font-bold text-lg">{MONTHS[data.worstMonth.month]}</div>
            <div className="text-white/30 text-xs">Mood: {data.worstMonth.mood.toFixed(1)} · Energy: {data.worstMonth.energy.toFixed(1)}</div>
          </div>
        </div>

        {/* Exercise Total */}
        <div className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-center" style={{
          opacity: chartVisible ? 1 : 0,
          transition: 'opacity 0.6s 1.2s',
        }}>
          <span className="text-white/60 text-sm">🏃 You exercised for </span>
          <span className="text-cyan-400 font-bold">
            <CountUp end={data.totalExerciseMinutes} duration={2000} trigger={active && chartVisible} />
          </span>
          <span className="text-white/60 text-sm"> minutes total</span>
        </div>

        {/* Insights */}
        {data.insights.length > 0 && (
          <div className="w-full space-y-2" style={{
            opacity: insightsVisible ? 1 : 0,
            transition: 'opacity 0.6s 1.6s',
          }}>
            {data.insights.map((insight, i) => (
              <div key={i} className="px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/10 text-center">
                <span className="text-purple-300/80 text-sm">🧠 {insight}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function buildLinePath(values: number[], maxVal: number, height: number): string {
  const padding = 4;
  return values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = height - padding - ((v / maxVal) * (height - padding * 2));
    return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
  }).join(' ');
}

export default HealthVitalsSlide;