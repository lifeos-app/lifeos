/**
 * HeroSlide — Opening slide for Year in Review 2.0
 *
 * "Your 2026" with animated countdown, character avatar,
 * level badge, ambient particles, cinematic gradient.
 */

import React, { useEffect, useState } from 'react';
import { CountUp, AmbientParticles, ProgressRing } from './SlideTransition';
import type { YearSummary } from './useYearInReview';

interface HeroSlideProps {
  data: YearSummary;
  active: boolean;
}

export function HeroSlide({ data, active }: HeroSlideProps) {
  const [countdownDone, setCountdownDone] = useState(false);
  const [yearVisible, setYearVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setCountdownDone(false);
      setYearVisible(false);
      setSubtitleVisible(false);
      return;
    }
    const t1 = setTimeout(() => setYearVisible(true), 800);
    const t2 = setTimeout(() => setCountdownDone(true), 2000);
    const t3 = setTimeout(() => setSubtitleVisible(true), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Gradient Background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${data.year % 2 === 0 ? '#0f0c29' : '#1a0a2e'} 0%, #302b63 40%, #24243e 100%)`,
        }}
      />

      {/* Ambient particles */}
      <AmbientParticles count={40} color="rgba(168, 85, 247, 0.25)" />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #a855f7, transparent)', animation: 'yir-float 8s ease-in-out infinite' }}
      />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, #00D4FF, transparent)', animation: 'yir-float 12s 3s ease-in-out infinite' }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-4">
        {/* Avatar / Level Badge */}
        <div className="relative mb-2">
          <div className="w-24 h-24 rounded-full border-2 border-purple-400/50 flex items-center justify-center bg-purple-900/30 backdrop-blur-sm overflow-hidden">
            {data.avatarUrl ? (
              <img src={data.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl" role="img" aria-label="hero">
                ⚔️
              </span>
            )}
          </div>
          {/* Level badge */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold px-3 py-0.5 rounded-full text-xs whitespace-nowrap shadow-lg">
            LVL {data.level}
          </div>
        </div>

        {/* Year Number */}
        <div className="relative">
          <h1
            className="text-7xl sm:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-white to-cyan-300"
            style={{
              opacity: yearVisible ? 1 : 0,
              transform: yearVisible ? 'scale(1)' : 'scale(0.5)',
              transition: 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
              textShadow: '0 0 80px rgba(168,85,247,0.4)',
            }}
          >
            {countdownDone ? data.year : (
              <CountUp end={data.year} duration={1500} trigger={active && yearVisible} />
            )}
          </h1>

          {/* "Your" prefix */}
          <div
            className="absolute -top-8 left-1/2 -translate-x-1/2 text-lg sm:text-2xl font-medium text-purple-300/80 tracking-widest uppercase"
            style={{
              opacity: yearVisible ? 1 : 0,
              transform: yearVisible ? 'translateY(0)' : 'translateY(10px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            Your
          </div>
        </div>

        {/* XP Progress Ring */}
        <div className="flex items-center gap-3" style={{
          opacity: yearVisible ? 1 : 0,
          transform: yearVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <ProgressRing value={0.7} size={48} strokeWidth={3} color="#a855f7">
            <span className="text-xs font-bold text-purple-300">✦</span>
          </ProgressRing>
          <div className="text-sm">
            <div className="text-white/80 font-semibold">
              <CountUp end={data.totalXP} duration={2000} trigger={active} suffix=" XP" />
            </div>
            <div className="text-white/40 text-xs">{data.levelTitle}</div>
          </div>
        </div>

        {/* Subtitle */}
        <p
          className="text-xl sm:text-2xl text-white/60 font-light tracking-wide"
          style={{
            opacity: subtitleVisible ? 1 : 0,
            transform: subtitleVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          Let's look back at your journey
        </p>

        {/* Scroll hint */}
        <div
          className="mt-8 text-white/20 text-sm animate-bounce"
          style={{
            opacity: subtitleVisible ? 1 : 0,
            transition: 'opacity 1s 1s',
          }}
        >
          ↓ Swipe to continue ↓
        </div>
      </div>
    </div>
  );
}

export default HeroSlide;