/**
 * YearInReviewV2 — Main orchestrator page
 *
 * Full-screen immersive slideshow experience with auto-play,
 * manual navigation, background music toggle, year selector,
 * "Generate My Year" button, share/export functionality.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useYearInReview } from './useYearInReview';
import { SlideTransition } from './SlideTransition';
import { HeroSlide } from './HeroSlide';
import { StatsSlide } from './StatsSlide';
import { HabitStreaksSlide } from './HabitStreaksSlide';
import { FinancialJourneySlide } from './FinancialJourneySlide';
import { HealthVitalsSlide } from './HealthVitalsSlide';
import { TopMomentsSlide } from './TopMomentsSlide';
import { RealmGrowthSlide } from './RealmGrowthSlide';
import { ShareSlide } from './ShareSlide';
import type { YearSlideData } from './useYearInReview';

// ── Available Years ──────────────────────────────────────────────

function getAvailableYears(): number[] {
  const current = new Date().getFullYear();
  return [current - 2, current - 1, current].filter(y => y >= 2024);
}

// ── Slide Duration Map (ms per slide type) ────────────────────────

const SLIDE_DURATIONS: Record<string, number> = {
  hero: 7000,
  stats: 9000,
  habit_streaks: 8000,
  financial_journey: 8000,
  health_vitals: 8000,
  goal_achievements: 7000,
  realm_growth: 8000,
  top_moments: 10000,
  seasons: 7000,
  gratitude: 8000,
  prediction: 6000,
  share: 0, // No auto-advance on share slide
};

// ── Component ────────────────────────────────────────────────────

export function YearInReviewV2() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [started, setStarted] = useState(false);

  const {
    slides,
    yearSummary,
    habitYearData,
    financeYearData,
    healthYearData,
    realmYearData,
    goalYearData,
    generating,
    generated,
    generate,
  } = useYearInReview(selectedYear);

  const availableYears = getAvailableYears();
  const activeSlide = slides[currentSlide];
  const totalSlides = slides.length;

  // ── Navigation ─────────────────────────────────────────────────

  const goNext = useCallback(() => {
    setCurrentSlide(prev => Math.min(prev + 1, totalSlides - 1));
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrentSlide(prev => Math.max(prev - 1, 0));
  }, []);

  const goTo = useCallback((index: number) => {
    setCurrentSlide(Math.max(0, Math.min(index, totalSlides - 1)));
  }, [totalSlides]);

  // ── Keyboard navigation ─────────────────────────────────────────

  useEffect(() => {
    if (!started) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'Escape':
          setStarted(false);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [started, goNext, goPrev]);

  // ── Auto-advance logic ──────────────────────────────────────────

  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    if (!autoPlay || !started) return;

    const duration = activeSlide ? (SLIDE_DURATIONS[activeSlide.type] || 6000) : 6000;
    if (duration === 0) return; // Don't auto-advance (e.g. share slide)

    autoAdvanceRef.current = setTimeout(() => {
      if (currentSlide < totalSlides - 1) {
        goNext();
      } else {
        setAutoPlay(false);
      }
    }, duration);

    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [autoPlay, started, currentSlide, activeSlide, totalSlides, goNext]);

  // ── Generate & Start ────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!generated) {
      await generate();
    }
    setStarted(true);
    setCurrentSlide(0);
  }, [generated, generate]);

  const handleRestart = useCallback(() => {
    setCurrentSlide(0);
    setAutoPlay(false);
  }, []);

  // ── Music toggle (placeholder) ──────────────────────────────────

  const toggleMusic = useCallback(() => {
    setMusicOn(prev => !prev);
    // In production: load and play ambient background track
  }, []);

  // ── Pre-start screen ────────────────────────────────────────────

  if (!started) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}
      >
        {/* Background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 50 }, (_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: Math.random() * 3 + 1,
                height: Math.random() * 3 + 1,
                background: `rgba(168, 85, 247, ${Math.random() * 0.3 + 0.1})`,
                animation: `yir-float ${Math.random() * 20 + 10}s ${Math.random() * -20}s ease-in-out infinite, yir-pulse ${Math.random() * 5 + 3}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
          {/* Logo / Title */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/20">
              ✨
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white">
              Year in Review
            </h1>
            <p className="text-white/40 text-lg sm:text-xl max-w-md">
              Your life, cinematically retold. Habits, health, finances, growth — the whole story.
            </p>
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-3">
            {availableYears.map(y => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-5 py-2.5 rounded-xl font-bold text-lg transition-all duration-300 ${
                  y === selectedYear
                    ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60'
                }`}
              >
                {y}
              </button>
            ))}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="group relative px-10 py-4 rounded-2xl font-bold text-lg text-white overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 active:scale-[0.98] disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
            }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <div className="relative z-10 flex items-center gap-2">
              {generating ? (
                <>
                  <span className="animate-spin text-xl">⚙️</span>
                  <span>Compiling Your Year...</span>
                </>
              ) : (
                <>
                  <span className="text-xl">🎬</span>
                  <span>Generate My {selectedYear}</span>
                </>
              )}
            </div>
          </button>

          {/* Hint */}
          <p className="text-white/20 text-sm">
            Full-screen cinematic experience · Works best with sound on
          </p>
        </div>
      </div>
    );
  }

  // ── Slideshow Experience ────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden select-none">
      {/* Slide Content */}
      <div className="w-full h-full">
        <SlideTransition
          animation={activeSlide?.animation || 'fadeIn'}
          active={true}
          duration={900}
        >
          {activeSlide && (
            <div className="w-full h-full">
              {renderSlide(activeSlide, {
                yearSummary,
                habitYearData,
                financeYearData,
                healthYearData,
                realmYearData,
                goalYearData,
                currentSlide,
              })}
            </div>
          )}
        </SlideTransition>
      </div>

      {/* ── UI Overlay ──────────────────────────────────────────────── */}

      {/* Top bar: year + controls */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none z-20">
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Year badge */}
          <span className="text-white/60 text-sm font-medium px-3 py-1 rounded-lg bg-white/5 backdrop-blur-sm border border-white/5">
            {selectedYear}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {/* Music toggle */}
          <button
            onClick={toggleMusic}
            className="w-9 h-9 rounded-lg bg-white/5 backdrop-blur-sm border border-white/5 flex items-center justify-center transition-all hover:bg-white/10"
          >
            <span className="text-sm">{musicOn ? '🔊' : '🔇'}</span>
          </button>

          {/* Auto-play toggle */}
          <button
            onClick={() => setAutoPlay(prev => !prev)}
            className={`w-9 h-9 rounded-lg backdrop-blur-sm border flex items-center justify-center transition-all ${
              autoPlay
                ? 'bg-purple-500/20 border-purple-500/30'
                : 'bg-white/5 border-white/5 hover:bg-white/10'
            }`}
          >
            <span className="text-sm">{autoPlay ? '⏸️' : '▶️'}</span>
          </button>

          {/* Close */}
          <button
            onClick={() => setStarted(false)}
            className="w-9 h-9 rounded-lg bg-white/5 backdrop-blur-sm border border-white/5 flex items-center justify-center transition-all hover:bg-white/10"
          >
            <span className="text-sm">✕</span>
          </button>
        </div>
      </div>

      {/* Slide counter */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {/* Dot navigation */}
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/5">
          {slides.map((slide, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                background: i === currentSlide
                  ? '#a855f7'
                  : i < currentSlide
                    ? 'rgba(255,255,255,0.4)'
                    : 'rgba(255,255,255,0.15)',
                transform: i === currentSlide ? 'scale(1.5)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Arrow navigation (desktop) */}
      {currentSlide > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center transition-all hover:bg-white/10 hover:border-white/20"
        >
          <span className="text-white/60">‹</span>
        </button>
      )}
      {currentSlide < totalSlides - 1 && (
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center transition-all hover:bg-white/10 hover:border-white/20"
        >
          <span className="text-white/60">›</span>
        </button>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 z-20">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ── Slide Renderer ──────────────────────────────────────────────

interface SlideRenderContext {
  yearSummary: ReturnType<typeof useYearInReview>['yearSummary'];
  habitYearData: ReturnType<typeof useYearInReview>['habitYearData'];
  financeYearData: ReturnType<typeof useYearInReview>['financeYearData'];
  healthYearData: ReturnType<typeof useYearInReview>['healthYearData'];
  realmYearData: ReturnType<typeof useYearInReview>['realmYearData'];
  goalYearData: ReturnType<typeof useYearInReview>['goalYearData'];
  currentSlide: number;
}

function renderSlide(slide: YearSlideData, ctx: SlideRenderContext) {
  switch (slide.type) {
    case 'hero':
      return <HeroSlide data={ctx.yearSummary} active={true} />;

    case 'stats':
      return <StatsSlide data={ctx.yearSummary} active={true} />;

    case 'habit_streaks':
      return <HabitStreaksSlide habits={ctx.habitYearData} summary={ctx.yearSummary} active={true} />;

    case 'financial_journey':
      return <FinancialJourneySlide data={ctx.financeYearData} active={true} />;

    case 'health_vitals':
      return <HealthVitalsSlide data={ctx.healthYearData} active={true} />;

    case 'goal_achievements':
      return <GoalAchievementSlide data={ctx.goalYearData} year={ctx.yearSummary.year} active={true} />;

    case 'realm_growth':
      return <RealmGrowthSlide data={ctx.realmYearData} active={true} />;

    case 'top_moments':
      return <TopMomentsSlide moments={ctx.yearSummary.topMoments} year={ctx.yearSummary.year} active={true} />;

    case 'seasons':
      return <SeasonsSlide seasons={ctx.yearSummary.seasonalBreakdown} active={true} />;

    case 'gratitude':
      return <GratitudeSlide narrative={ctx.yearSummary.narrativeArc} year={ctx.yearSummary.year} active={true} />;

    case 'prediction':
      return <PredictionSlide growth={ctx.yearSummary.growthFromLastYear} level={ctx.yearSummary.level} year={ctx.yearSummary.year} active={true} />;

    case 'share':
      return <ShareSlide data={ctx.yearSummary} active={true} />;

    default:
      return null;
  }
}

// ── Inline Mini-Slides (goal_achievements, seasons, gratitude, prediction) ──

import type { GoalYearData, SeasonData, NarrativeArc } from './useYearInReview';
import { CountUp, AmbientParticles, ProgressRing, TypewriterText } from './SlideTransition';

// Goal Achievement Slide
function GoalAchievementSlide({ data, year, active }: { data: GoalYearData; year: number; active: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, [active]);

  const completionRate = data.total > 0 ? data.completed / data.total : 0;
  const domains = Object.entries(data.byDomain);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0a2e1a 0%, #1b4e2d 50%, #071a0f 100%)' }} />
      <AmbientParticles count={15} color="rgba(57, 255, 20, 0.1)" />

      <div className="relative z-10 w-full max-w-lg mx-auto px-4 sm:px-6 flex flex-col items-center gap-6">
        <div className="text-center" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-2">Goals Crushed</h2>
          <p className="text-white/50">You set out. You showed up. You delivered.</p>
        </div>

        <div className="flex items-center gap-5" style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.8)',
          transition: 'all 0.8s 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <ProgressRing value={completionRate} size={100} strokeWidth={6} color="#39FF14">
            <div className="text-center">
              <div className="text-white font-bold text-2xl">
                <CountUp end={data.completed} duration={1500} trigger={visible} />
              </div>
              <div className="text-white/40 text-xs">of {data.total}</div>
            </div>
          </ProgressRing>
          <div>
            <div className="text-emerald-400 font-bold text-3xl">
              <CountUp end={Math.round(completionRate * 100)} duration={1500} suffix="%" trigger={visible} />
            </div>
            <div className="text-white/40 text-sm">Completion Rate</div>
          </div>
        </div>

        {domains.length > 0 && (
          <div className="w-full space-y-2" style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s 1s',
          }}>
            <div className="text-white/40 text-xs text-center mb-3">By Domain</div>
            {domains.map(([domain, stats]) => (
              <div key={domain} className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5">
                <span className="text-white/60 text-sm flex-1">{domain}</span>
                <span className="text-emerald-400 font-mono text-sm">{stats.completed}/{stats.total}</span>
                <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Seasons Slide
function SeasonsSlide({ seasons, active }: { seasons: SeasonData[]; active: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, [active]);

  const seasonIcons: Record<string, string> = {
    spring: '🌱', summer: '☀️', fall: '🍂', winter: '❄️',
  };
  const seasonGradients: Record<string, [string, string]> = {
    spring: ['#2e7d32', '#1b5e20'],
    summer: ['#f57c00', '#e65100'],
    fall: ['#bf360c', '#6d2c0a'],
    winter: ['#1565c0', '#0d47a1'],
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0a1e2e 0%, #1b3b4e 50%, #071520 100%)' }} />
      <AmbientParticles count={20} color="rgba(96, 165, 250, 0.1)" />

      <div className="relative z-10 w-full max-w-lg mx-auto px-4 sm:px-6 flex flex-col items-center gap-6">
        <div className="text-center" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-2">Through the Seasons</h2>
          <p className="text-white/50">Each season had its own story</p>
        </div>

        <div className="w-full grid grid-cols-2 gap-4">
          {seasons.map((season, i) => (
            <div
              key={season.season}
              className="p-4 rounded-2xl border border-white/5"
              style={{
                background: `linear-gradient(135deg, ${seasonGradients[season.season][0]}15, ${seasonGradients[season.season][1]}10)`,
                borderColor: `${seasonGradients[season.season][0]}20`,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                transition: `all 0.6s ${i * 150 + 400}ms cubic-bezier(0.16, 1, 0.3, 1)`,
              }}
            >
              <div className="text-3xl mb-2">{seasonIcons[season.season]}</div>
              <div className="text-white font-semibold text-sm capitalize mb-1">{season.season}</div>
              <div className="text-white/40 text-xs mb-2">{season.label.split('—')[1]?.trim() || ''}</div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/30">Mood</span>
                  <span className="text-white/60">{season.avgMood.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/30">Energy</span>
                  <span className="text-white/60">{season.avgEnergy.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/30">Habits</span>
                  <span className="text-white/60">{Math.round(season.habitCompletionRate * 100)}%</span>
                </div>
              </div>
              <div className="text-white/20 text-[10px] mt-2 italic">{season.highlight}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Gratitude Slide
function GratitudeSlide({ narrative, year, active }: { narrative: NarrativeArc; year: number; active: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) { setPhase(0); return; }
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2200),
      setTimeout(() => setPhase(3), 4200),
      setTimeout(() => setPhase(4), 6200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active]);

  const phases = [
    { icon: '🌅', text: narrative.beginning, color: '#F97316' },
    { icon: '⚡', text: narrative.struggle, color: '#EF4444' },
    { icon: '💡', text: narrative.breakthrough, color: '#00D4FF' },
    { icon: '🏆', text: narrative.triumph, color: '#FFD700' },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #2e1e0a 0%, #4e3b1b 50%, #1a1005 100%)' }} />
      <AmbientParticles count={25} color="rgba(255, 215, 0, 0.08)" />

      <div className="relative z-10 w-full max-w-lg mx-auto px-4 sm:px-6 flex flex-col items-center gap-6">
        <div className="text-center" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-2">A Year of Gratitude</h2>
          <p className="text-white/50">Your {year} narrative</p>
        </div>

        <div className="w-full space-y-4">
          {phases.map((p, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-xl border"
              style={{
                background: `${p.color}08`,
                borderColor: `${p.color}15`,
                opacity: phase > i ? 1 : 0,
                transform: phase > i ? 'translateX(0)' : 'translateX(-20px)',
                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <span className="text-2xl flex-shrink-0">{p.icon}</span>
              <p className="text-white/70 text-sm sm:text-base leading-relaxed">
                {phase > i ? p.text : ''}
              </p>
            </div>
          ))}
        </div>

        {/* Gratitude Input */}
        <div
          className="w-full p-5 rounded-2xl text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(168,85,247,0.1))',
            border: '1px solid rgba(236,72,153,0.15)',
            opacity: phase >= 4 ? 1 : 0,
            transition: 'opacity 0.8s 1s',
          }}
        >
          <div className="text-pink-300 text-sm mb-2">🙏 What are you most grateful for?</div>
          <input
            type="text"
            placeholder="Type your gratitude..."
            className="w-full bg-transparent text-center text-white/80 text-sm border-b border-white/10 pb-2 outline-none placeholder:text-white/20 focus:border-pink-400/30 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

// Prediction Slide
function PredictionSlide({ growth, level, year, active }: { growth: number; level: number; year: number; active: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, [active]);

  const nextYear = year + 1;
  const predictedLevel = level + Math.max(1, Math.floor(growth / 10));
  const predictionTexts = [
    `At this pace, you'll hit Level ${predictedLevel} by ${nextYear}.`,
    `Your consistency score is trending ${growth > 0 ? 'up' : 'steady'} — ${growth > 20 ? 'the sky is the limit.' : 'small steps compound.'}`,
    `${nextYear} has the potential to be your best year yet.`,
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0a2e2e 0%, #1b4e4e 50%, #071a1a 100%)' }} />
      <AmbientParticles count={25} color="rgba(0, 212, 255, 0.1)" />

      {/* Crystal ball glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #00D4FF, transparent)' }}
      />

      <div className="relative z-10 w-full max-w-lg mx-auto px-4 sm:px-6 flex flex-col items-center gap-6">
        <div className="text-center" style={{
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-2">{nextYear} Awaits</h2>
          <p className="text-white/50">Based on your trajectory, here's what's coming</p>
        </div>

        {/* Crystal ball icon */}
        <div
          className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
          style={{
            background: 'radial-gradient(circle, rgba(0,212,255,0.1), transparent)',
            border: '2px solid rgba(0,212,255,0.15)',
            animation: visible ? 'yir-float 4s ease-in-out infinite' : 'none',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.8s 500ms',
          }}
        >
          🔮
        </div>

        {/* Predictions */}
        <div className="w-full space-y-3">
          {predictionTexts.map((text, i) => (
            <div
              key={i}
              className="px-5 py-3 rounded-xl text-center"
              style={{
                background: 'rgba(0,212,255,0.05)',
                border: '1px solid rgba(0,212,255,0.1)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(15px)',
                transition: `all 0.6s ${i * 200 + 700}ms cubic-bezier(0.16, 1, 0.3, 1)`,
              }}
            >
              <span className="text-cyan-300/70 text-sm">{text}</span>
            </div>
          ))}
        </div>

        {/* Growth dial */}
        <div
          className="flex items-center gap-3 px-6 py-3 rounded-xl"
          style={{
            background: 'rgba(0,212,255,0.05)',
            border: '1px solid rgba(0,212,255,0.1)',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s 1.4s',
          }}
        >
          <span className="text-white/40 text-sm">Growth Trajectory:</span>
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden max-w-[120px]">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full"
              style={{
                width: visible ? `${Math.min(growth, 100)}%` : '0%',
                transition: 'width 1.5s 1.6s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>
          <span className="text-cyan-400 text-sm font-bold">{growth}%</span>
        </div>
      </div>
    </div>
  );
}

export default YearInReviewV2;