/**
 * ShareSlide — Shareable finale
 *
 * "This was your 2026", customizable share card,
 * generate shareable PNG (canvas capture), social sharing,
 * "See you next year" sign-off.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CountUp, AmbientParticles } from './SlideTransition';
import type { YearSummary } from './useYearInReview';

interface ShareSlideProps {
  data: YearSummary;
  active: boolean;
}

interface ShareStat {
  key: string;
  label: string;
  value: string;
  selected: boolean;
}

export function ShareSlide({ data, active }: ShareSlideProps) {
  const [visible, setVisible] = useState(false);
  const [statSelections, setStatSelections] = useState<Record<string, boolean>>({
    habits: true,
    xp: true,
    streak: true,
    goals: true,
    savings: false,
    mood: false,
  });
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    if (!active) { setVisible(false); setCaptured(false); return; }
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, [active]);

  const shareStats: ShareStat[] = [
    { key: 'habits', label: 'Habit Completions', value: String(data.totalHabitCompletions), selected: statSelections.habits },
    { key: 'xp', label: 'XP Earned', value: String(data.totalXP), selected: statSelections.xp },
    { key: 'streak', label: 'Longest Streak', value: `${data.longestStreak} days`, selected: statSelections.streak },
    { key: 'goals', label: 'Goals Crushed', value: String(data.goalsCompleted), selected: statSelections.goals },
    { key: 'savings', label: 'Net Savings', value: `$${data.netSavings.toFixed(0)}`, selected: statSelections.savings },
    { key: 'mood', label: 'Avg Mood', value: data.avgMood.toFixed(1), selected: statSelections.mood },
  ];

  const toggleStat = useCallback((key: string) => {
    setStatSelections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleCapture = useCallback(async () => {
    if (!cardRef.current) return;
    setCapturing(true);

    try {
      // In production: use html2canvas or similar for real PNG export
      // For now, create a data URL from the card's visual representation
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw gradient background
      const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
      grad.addColorStop(0, '#0f0c29');
      grad.addColorStop(0.4, '#302b63');
      grad.addColorStop(1, '#24243e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1920);

      // Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 72px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`My ${data.year}`, 540, 300);

      ctx.font = '300 36px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('LifeOS Year in Review', 540, 370);

      // Stats
      ctx.font = 'bold 48px system-ui';
      ctx.fillStyle = '#ffffff';
      shareStats.filter(s => s.selected).forEach((stat, i) => {
        const y = 520 + i * 120;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '24px system-ui';
        ctx.fillText(stat.label, 540, y);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px system-ui';
        ctx.fillText(stat.value, 540, y + 55);
      });

      // Watermark
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '20px system-ui';
      ctx.fillText('lifeos.app', 540, 1850);

      // Download
      const link = document.createElement('a');
      link.download = `lifeos-year-in-review-${data.year}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setCaptured(true);
    } catch (err) {
      console.error('Capture failed:', err);
    } finally {
      setCapturing(false);
    }
  }, [data, shareStats]);

  const handleShareLink = useCallback(() => {
    const text = `My ${data.year} LifeOS Year in Review — ${data.totalHabitCompletions} habits, ${data.goalsCompleted} goals, L${data.level}! 🚀`;
    if (navigator.share) {
      navigator.share({ title: `My ${data.year} — LifeOS`, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      setCaptured(true); // Reuse for feedback
    }
  }, [data]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Background */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}
      />

      <AmbientParticles count={30} color="rgba(168, 85, 247, 0.2)" />

      {/* Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #a855f7, transparent)' }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4 sm:px-6 flex flex-col items-center gap-5">
        {/* Title */}
        <div className="text-center" style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-2">
            This Was Your {data.year}
          </h2>
          <p className="text-white/50 text-base sm:text-lg">
            Share your story with the world
          </p>
        </div>

        {/* Share Card Preview */}
        <div
          ref={cardRef}
          className="w-full p-6 rounded-3xl border border-white/10"
          style={{
            background: 'linear-gradient(135deg, rgba(15,12,41,0.8), rgba(48,43,99,0.4))',
            backdropFilter: 'blur(20px)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1)' : 'scale(0.9)',
            transition: 'all 0.8s 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Card Header */}
          <div className="text-center mb-4">
            <div className="text-white/40 text-xs uppercase tracking-widest mb-2">LifeOS</div>
            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-white to-cyan-300">
              {data.year}
            </div>
          </div>

          {/* Selected Stats */}
          <div className="grid grid-cols-2 gap-3">
            {shareStats.filter(s => s.selected).map(stat => (
              <div key={stat.key} className="p-3 rounded-xl bg-white/5 text-center">
                <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{stat.label}</div>
                <div className="text-white font-bold text-lg">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Level Badge */}
          <div className="mt-4 flex justify-center">
            <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-400/20 border border-amber-500/30">
              <span className="text-amber-300 text-sm font-bold">Lv.{data.level} {data.levelTitle}</span>
            </div>
          </div>
        </div>

        {/* Stat Selector */}
        <div className="w-full" style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.6s 600ms',
        }}>
          <div className="text-white/40 text-xs mb-2 text-center">Tap to customize your card</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {shareStats.map(stat => (
              <button
                key={stat.key}
                onClick={() => toggleStat(stat.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  stat.selected
                    ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                    : 'bg-white/5 border border-white/5 text-white/30'
                }`}
              >
                {stat.selected ? '✓ ' : ''}{stat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-3" style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s 1s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {/* Download PNG */}
          <button
            onClick={handleCapture}
            disabled={capturing}
            className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {capturing ? '⏳ Generating...' : captured ? '✅ Saved!' : '📥 Download as Image'}
          </button>

          {/* Share Link */}
          <button
            onClick={handleShareLink}
            className="w-full py-3 px-6 rounded-xl bg-white/5 border border-white/10 text-white/80 font-semibold text-sm transition-all hover:bg-white/10 active:scale-[0.98]"
          >
            🔗 Share Link
          </button>

          {/* Social Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const text = `My ${data.year} LifeOS: ${data.totalHabitCompletions} habits, ${data.goalsCompleted} goals!`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#1DA1F2]/10 border border-[#1DA1F2]/20 text-[#1DA1F2] text-sm font-medium hover:bg-[#1DA1F2]/20 transition-colors"
            >
              𝕏
            </button>
            <button
              onClick={() => {
                const text = `My ${data.year} LifeOS Year in Review`;
                window.open(`https://www.reddit.com/submit?title=${encodeURIComponent(text)}`, '_blank');
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#FF4500]/10 border border-[#FF4500]/20 text-[#FF4500] text-sm font-medium hover:bg-[#FF4500]/20 transition-colors"
            >
              Reddit
            </button>
          </div>
        </div>

        {/* Sign-off */}
        <div className="text-center mt-4" style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 1s 2s',
        }}>
          <p className="text-white/30 text-sm font-light">
            See you next year ✨
          </p>
          <p className="text-white/15 text-xs mt-1">
            — Your LifeOS Team
          </p>
        </div>
      </div>
    </div>
  );
}

export default ShareSlide;