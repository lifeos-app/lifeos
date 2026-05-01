/**
 * TopMomentsSlide — Highlight reel
 *
 * 5-10 biggest moments of the year, each with date/context/emotional weight,
 * animated timeline, "The year you..." narrative summary, gratitude prompt.
 */

import React, { useEffect, useState } from 'react';
import { TypewriterText, AmbientParticles } from './SlideTransition';
import type { YearMoment } from './useYearInReview';

interface TopMomentsSlideProps {
  moments: YearMoment[];
  year: number;
  active: boolean;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  achievement: { icon: '🏆', color: '#FFD700', label: 'Achievement' },
  milestone: { icon: '⭐', color: '#A855F7', label: 'Milestone' },
  breakthrough: { icon: '💡', color: '#00D4FF', label: 'Breakthrough' },
  challenge: { icon: '🏔️', color: '#F97316', label: 'Challenge' },
  gratitude: { icon: '🙏', color: '#EC4899', label: 'Gratitude' },
};

export function TopMomentsSlide({ moments, year, active }: TopMomentsSlideProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [narrativeVisible, setNarrativeVisible] = useState(false);

  useEffect(() => {
    if (!active) { setVisibleCount(0); setNarrativeVisible(false); return; }

    // Stagger reveal of moments
    const timers: ReturnType<typeof setTimeout>[] = [];
    moments.slice(0, 6).forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), 500 + i * 400));
    });
    timers.push(setTimeout(() => setNarrativeVisible(true), 500 + moments.length * 400 + 500));

    return () => timers.forEach(clearTimeout);
  }, [active, moments]);

  // Generate "The year you..." narrative
  const narrative = buildNarrative(moments, year);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Background */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #1e0a2e 0%, #3b1b4e 40%, #1a0830 100%)' }}
      />

      <AmbientParticles count={25} color="rgba(255, 215, 0, 0.1)" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-lg mx-auto px-4 sm:px-6 flex flex-col items-center gap-5">
        {/* Title */}
        <div className="text-center" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-2">
            Top Moments
          </h2>
          <p className="text-white/50 text-base sm:text-lg">
            The year you...
          </p>
        </div>

        {/* Timeline */}
        <div className="w-full space-y-0">
          {moments.slice(0, 6).map((moment, i) => {
            const config = TYPE_CONFIG[moment.type] || TYPE_CONFIG.achievement;
            const isVisible = i < visibleCount;

            return (
              <div
                key={i}
                className="flex items-start gap-3"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'translateX(0)' : 'translateX(-30px)',
                  transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center flex-shrink-0 w-8">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                    style={{ background: `${config.color}20`, border: `2px solid ${config.color}40` }}
                  >
                    {config.icon}
                  </div>
                  {i < moments.slice(0, 6).length - 1 && (
                    <div className="w-0.5 flex-1 min-h-[2rem] bg-gradient-to-b from-white/10 to-transparent" />
                  )}
                </div>

                {/* Moment content */}
                <div className="pb-4 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${config.color}15`, color: config.color }}>
                      {config.label}
                    </span>
                    <span className="text-white/30 text-[10px]">
                      {moment.date.substring(5)}
                    </span>
                  </div>
                  <div className="text-white/90 font-semibold text-sm sm:text-base truncate">
                    {moment.title}
                  </div>
                  <div className="text-white/40 text-xs sm:text-sm line-clamp-2 mt-0.5">
                    {moment.description}
                  </div>

                  {/* Emotional weight bar */}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${moment.emotionalWeight * 10}%`,
                          background: `linear-gradient(90deg, ${config.color}, ${config.color}80)`,
                          transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      />
                    </div>
                    <span className="text-white/20 text-[9px]">{moment.emotionalWeight}/10</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Narrative Summary */}
        <div
          className="w-full p-5 rounded-2xl text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(0,212,255,0.1))',
            border: '1px solid rgba(168,85,247,0.15)',
            opacity: narrativeVisible ? 1 : 0,
            transform: narrativeVisible ? 'scale(1)' : 'scale(0.95)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="text-purple-300 text-sm font-medium mb-2">✍️ Your Year in a Sentence</div>
          <div className="text-white text-base sm:text-lg font-light leading-relaxed">
            <TypewriterText text={narrative} speed={35} trigger={narrativeVisible && active} />
          </div>
        </div>
      </div>
    </div>
  );
}

function buildNarrative(moments: YearMoment[], year: number): string {
  if (moments.length === 0) return `${year} was a year of quiet growth. Every day mattered.`;

  const achievements = moments.filter(m => m.type === 'achievement');
  const breakthroughs = moments.filter(m => m.type === 'breakthrough');
  const challenges = moments.filter(m => m.type === 'challenge');

  const parts: string[] = [`${year} was the year you`];

  if (achievements.length > 0) {
    parts.push(`crushed ${achievements.length} major goal${achievements.length > 1 ? 's' : ''}`);
  }
  if (breakthroughs.length > 0) {
    if (parts.length > 1) parts.push('and');
    parts.push('had a breakthrough that changed everything');
  }
  if (challenges.length > 0) {
    parts.push(', faced challenges head-on');
  }
  parts.push('. You showed up — and that\'s what counts.');

  return parts.join(' ');
}

export default TopMomentsSlide;