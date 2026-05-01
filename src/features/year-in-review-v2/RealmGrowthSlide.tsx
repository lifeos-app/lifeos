/**
 * RealmGrowthSlide — Character growth
 *
 * Level progression, class evolution, XP earned, achievements unlocked,
 * companion bonds, garden growth, before/after character comparison.
 */

import React, { useEffect, useState } from 'react';
import { CountUp, ProgressRing, AmbientParticles } from './SlideTransition';
import type { RealmYearData } from './useYearInReview';

interface RealmGrowthSlideProps {
  data: RealmYearData;
  active: boolean;
}

export function RealmGrowthSlide({ data, active }: RealmGrowthSlideProps) {
  const [beforeVisible, setBeforeVisible] = useState(false);
  const [afterVisible, setAfterVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    if (!active) { setBeforeVisible(false); setAfterVisible(false); setStatsVisible(false); return; }
    const t1 = setTimeout(() => setBeforeVisible(true), 300);
    const t2 = setTimeout(() => setAfterVisible(true), 1200);
    const t3 = setTimeout(() => setStatsVisible(true), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  const levelDiff = data.levelEnd - data.levelStart;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Background */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #2e0a1a 0%, #4e1b2d 50%, #1a0815 100%)' }}
      />

      <AmbientParticles count={20} color="rgba(212, 175, 55, 0.12)" />

      {/* Decorative glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #D4AF37, transparent)' }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-lg mx-auto px-4 sm:px-6 flex flex-col items-center gap-6">
        {/* Title */}
        <div className="text-center" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-2">
            Your Character Grew
          </h2>
          <p className="text-white/50 text-base sm:text-lg">
            XP earned, levels gained, achievements unlocked
          </p>
        </div>

        {/* Before / After Character */}
        <div className="w-full flex items-center justify-center gap-4 sm:gap-8">
          {/* Before */}
          <div
            className="flex flex-col items-center gap-2"
            style={{
              opacity: beforeVisible ? 1 : 0,
              transform: beforeVisible ? 'translateX(0) scale(1)' : 'translateX(-20px) scale(0.9)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center text-3xl sm:text-4xl">
              ⚔️
            </div>
            <ProgressRing value={data.levelStart / (data.levelEnd + 10)} size={40} strokeWidth={3} color="rgba(255,255,255,0.3)">
              <span className="text-white/60 text-[10px] font-bold">L{data.levelStart}</span>
            </ProgressRing>
            <span className="text-white/30 text-xs">Start of Year</span>
          </div>

          {/* Transformation Arrow */}
          <div
            className="flex flex-col items-center gap-1"
            style={{
              opacity: afterVisible ? 1 : 0,
              transition: 'opacity 0.6s 1s',
            }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(212,175,55,0.2))',
                border: '2px solid rgba(212,175,55,0.3)',
                animation: afterVisible ? 'yir-pulse 2s ease-in-out infinite' : 'none',
              }}
            >
              <span className="text-2xl">✨</span>
            </div>
            <div className="text-amber-400 font-bold text-sm">
              +{levelDiff} LVL{levelDiff !== 1 ? 'S' : ''}
            </div>
          </div>

          {/* After */}
          <div
            className="flex flex-col items-center gap-2"
            style={{
              opacity: afterVisible ? 1 : 0,
              transform: afterVisible ? 'translateX(0) scale(1)' : 'translateX(20px) scale(1.1)',
              transition: 'all 0.8s 800ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-3xl sm:text-4xl"
              style={{
                background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(168,85,247,0.15))',
                border: '2px solid rgba(212,175,55,0.5)',
                boxShadow: '0 0 30px rgba(212,175,55,0.2)',
              }}
            >
              ⚔️
            </div>
            <ProgressRing value={data.levelEnd / (data.levelEnd + 5)} size={40} strokeWidth={3} color="#D4AF37">
              <span className="text-amber-300 text-[10px] font-bold">L{data.levelEnd}</span>
            </ProgressRing>
            <span className="text-white/50 text-xs">End of Year</span>
          </div>
        </div>

        {/* Class Evolution */}
        {data.classEvolution && (
          <div
            className="px-6 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center"
            style={{
              opacity: afterVisible ? 1 : 0,
              transition: 'opacity 0.6s 1.4s',
            }}
          >
            <span className="text-amber-300 text-sm font-semibold">
              🎓 Class Evolved! Your discipline unlocked new abilities.
            </span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="w-full grid grid-cols-2 gap-3" style={{
          opacity: statsVisible ? 1 : 0,
          transform: statsVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s 1.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-2xl mb-1">⚡</div>
            <div className="text-amber-400 font-bold text-lg">
              <CountUp end={data.totalXPEarned} duration={2000} trigger={statsVisible} />
            </div>
            <div className="text-white/40 text-xs">XP Earned</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-2xl mb-1">🏆</div>
            <div className="text-purple-400 font-bold text-lg">
              <CountUp end={data.achievementsUnlocked} duration={1500} trigger={statsVisible} />
            </div>
            <div className="text-white/40 text-xs">Achievements</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-2xl mb-1">🐾</div>
            <div className="text-cyan-400 font-bold text-lg">
              <CountUp end={data.companionBonds} duration={1500} trigger={statsVisible} />
            </div>
            <div className="text-white/40 text-xs">Companion Bonds</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-2xl mb-1">🌿</div>
            <div className="text-emerald-400 font-bold text-lg">
              <CountUp end={data.gardenGrowth} duration={1500} suffix="%" trigger={statsVisible} />
            </div>
            <div className="text-white/40 text-xs">Garden Growth</div>
          </div>
        </div>

        {/* Level Progression Bar */}
        <div className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5" style={{
          opacity: statsVisible ? 1 : 0,
          transition: 'opacity 0.6s 2.2s',
        }}>
          <div className="text-white/40 text-xs mb-2">Level Progression</div>
          <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 via-amber-500 to-yellow-400"
              style={{
                width: statsVisible ? `${(data.levelEnd / (data.levelEnd + 5)) * 100}%` : '0%',
                transition: 'width 1.5s 2.4s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
            {/* Level markers */}
            {Array.from({ length: data.levelsGained + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full w-px bg-white/20"
                style={{
                  left: `${((data.levelStart + i) / (data.levelEnd + 5)) * 100}%`,
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-white/20 text-[9px] mt-1">
            <span>L{data.levelStart}</span>
            <span>L{data.levelEnd}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RealmGrowthSlide;