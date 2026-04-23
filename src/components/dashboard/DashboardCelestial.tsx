/**
 * DashboardCelestial — Moon Phase + Season + Celestial Events + Ethiopian Date
 *
 * Uses pure math for moon phase (Julian Day Number, no API).
 * Hemisphere-aware seasons (Australian/Southern hemisphere detected via timezone).
 * Ethiopian calendar date overlay.
 * Canvas-rendered moon with proper shadow geometry.
 */

import { useRef, useEffect, useMemo } from 'react';
import { HermeticPrincipleBar } from '../shared/HermeticPrincipleBar';
import {
  getMoonPhase,
  getMoonPhaseName,
  getSeason,
  getUpcomingEvents,
  getHemisphere,
  type MoonPhaseName,
  type Season,
} from '../../realm/data/celestial';
import './DashboardCelestial.css';

// ── Ethiopian Calendar Conversion ────────────────────────

/**
 * Convert Gregorian date to Ethiopian calendar date.
 * Ethiopian calendar: 13 months (12×30 + 1×5 or 6), starts ~Sept 11.
 * Year is ~7-8 years behind Gregorian.
 */
function toEthiopian(date: Date): { year: number; month: number; day: number; monthName: string } {
  const ETHIOPIAN_MONTHS = [
    'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
    'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagumen',
  ];

  // Ethiopian New Year starts on September 11 (or 12 in Gregorian leap year before 2024)
  const gYear = date.getFullYear();
  const gMonth = date.getMonth(); // 0-indexed
  const gDay = date.getDate();

  // Ethiopian year offset: 8 years behind for dates after Sept 10, 7 before
  const ethYearOffset = (gMonth >= 8 || (gMonth === 8 && gDay >= 11)) ? 8 : 7;
  const ethYear = gYear - ethYearOffset;

  // Calculate Ethiopian month and day
  // Ethiopian year starts Meskerem 1 = September 11
  const sept11 = new Date(gYear, 8, 11); // month 8 = September
  let daysSinceSept11 = Math.floor((date.getTime() - sept11.getTime()) / 86400000);

  // If before Sept 11, we're in the latter part of the previous Ethiopian year
  if (daysSinceSept11 < 0) {
    const prevSept11 = new Date(gYear - 1, 8, 11);
    daysSinceSept11 = Math.floor((date.getTime() - prevSept11.getTime()) / 86400000);
  }

  // Ethiopian months: 1-12 are 30 days each, 13 (Pagumen) is 5 or 6 days
  const ethMonth = Math.floor(daysSinceSept11 / 30) + 1;
  const ethDay = (daysSinceSept11 % 30) + 1;

  return {
    year: ethYear,
    month: Math.min(ethMonth, 13),
    day: Math.max(1, Math.min(ethDay, ethMonth === 13 ? 6 : 30)),
    monthName: ETHIOPIAN_MONTHS[Math.min(ethMonth - 1, 12)] || 'Pagumen',
  };
}

// ── Constants ────────────────────────────────────────────

const PHASE_LABELS: Record<MoonPhaseName, string> = {
  new: 'New Moon',
  waxing_crescent: 'Waxing Crescent',
  first_quarter: 'First Quarter',
  waxing_gibbous: 'Waxing Gibbous',
  full: 'Full Moon',
  waning_gibbous: 'Waning Gibbous',
  last_quarter: 'Last Quarter',
  waning_crescent: 'Waning Crescent',
};

const SEASON_ICONS: Record<Season, string> = {
  spring: '🌱',
  summer: '☀️',
  autumn: '🍂',
  winter: '❄️',
};

const PHASE_EMOJIS: Record<string, string> = {
  new: '🌑',
  waxing_crescent: '🌒',
  first_quarter: '🌓',
  waxing_gibbous: '🌔',
  full: '🌕',
  waning_gibbous: '🌖',
  last_quarter: '🌗',
  waning_crescent: '🌘',
};

const HEMISPHERE_LABELS = {
  northern: 'Northern',
  southern: 'Southern',
};

// ── Moon Canvas Rendering ────────────────────────────────

function drawMoonPhase(ctx: CanvasRenderingContext2D, size: number, phase: number) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  ctx.clearRect(0, 0, size, size);

  // Moon glow
  const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.3);
  glow.addColorStop(0, 'rgba(255,255,255,0.08)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // Moon base (lit side)
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#E8E0D0';
  ctx.fill();

  // Shadow overlay using proper phase geometry
  const illumination = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const shadowOffset = r * (1 - illumination);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  if (phase < 0.5) {
    // Waxing: shadow on left
    ctx.ellipse(cx - shadowOffset * 0.5, cy, r - shadowOffset * 0.5, r, 0, 0, Math.PI * 2);
  } else {
    // Waning: shadow on right
    ctx.ellipse(cx + shadowOffset * 0.5, cy, r - shadowOffset * 0.5, r, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();

  // Full moon glow halo
  if (Math.abs(phase - 0.5) < 0.1) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,200,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// ── Helper ─────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

// ── Component ──────────────────────────────────────────────

export function DashboardCelestial() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const now = new Date();

  const phase = useMemo(() => getMoonPhase(now), []);
  const phaseName = useMemo(() => getMoonPhaseName(phase), [phase]);
  const season = useMemo(() => getSeason(now), []);
  const hemisphere = useMemo(() => getHemisphere(), []);
  const upcoming = useMemo(() => getUpcomingEvents(now, 90), []);
  const ethiopian = useMemo(() => toEthiopian(now), []);

  // Next 3 upcoming events
  const nextEvents = upcoming.slice(0, 3);
  const nextEvent = nextEvents[0] ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 44 * dpr;
    canvas.height = 44 * dpr;
    ctx.scale(dpr, dpr);

    drawMoonPhase(ctx, 44, phase);
  }, [phase]);

  const isFullMoon = Math.abs(phase - 0.5) <= 0.03;

  return (
    <div className="dash-celestial">
      {/* Moon + Phase */}
      <div className="dc-header">
        <canvas
          ref={canvasRef}
          className="dc-moon-canvas"
          width={44}
          height={44}
          style={{ width: 44, height: 44 }}
        />
        <div className="dc-moon-info">
          <div className="dc-phase-name" style={{
            fontSize: 12,
            fontWeight: 700,
            color: isFullMoon ? '#FFD700' : '#00D4FF',
            letterSpacing: 0.3,
          }}>
            {isFullMoon ? '✦ ' : ''}{PHASE_LABELS[phaseName]}{isFullMoon ? ' ✦' : ''}
          </div>
          <div className="dc-season" style={{
            fontSize: 10,
            color: '#8BA4BE',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span>{SEASON_ICONS[season]}</span>
            <span>{season.charAt(0).toUpperCase() + season.slice(1)}</span>
            <span style={{ color: '#5A7A9A', fontSize: 9 }}>({HEMISPHERE_LABELS[hemisphere]})</span>
          </div>
        </div>
      </div>

      {/* Illumination bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        margin: '8px 0 4px', fontSize: 9, color: '#5A7A9A',
      }}>
        <span>{PHASE_EMOJIS[phaseName] || '🌙'}</span>
        <div style={{
          flex: 1, height: 3, borderRadius: 2,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${(phase <= 0.5 ? phase * 2 : (1 - phase) * 2) * 100}%`,
            height: '100%',
            background: isFullMoon
              ? 'linear-gradient(90deg, #FFD700, #FFA500)'
              : 'linear-gradient(90deg, #1A3A5C, #00D4FF)',
            borderRadius: 2,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <span>{phase <= 0.5 ? (phase * 200).toFixed(0) : ((1 - phase) * 200).toFixed(0)}%</span>
      </div>

      {/* Full moon XP bonus indicator */}
      {isFullMoon && (
        <div style={{
          fontSize: 10, fontWeight: 600, color: '#FFD700',
          background: 'rgba(255,215,0,0.08)',
          borderRadius: 6, padding: '3px 8px',
          border: '1px solid rgba(255,215,0,0.15)',
          textAlign: 'center', margin: '4px 0',
        }}>
          ✦ Full Moon XP +10% ✦
        </div>
      )}

      {/* Ethiopian date */}
      <div style={{
        fontSize: 10, color: '#5A7A9A',
        marginTop: 4, fontStyle: 'italic',
      }}>
        {ethiopian.monthName} {ethiopian.day}, {ethiopian.year} EC
      </div>

      {/* Upcoming events */}
      {nextEvent && (
        <div className="dc-next-event">
          {nextEvents.map((evt, i) => {
            const days = daysUntil(evt.date);
            const isToday = days === 0;
            const urgency = isToday ? 'today' : days <= 3 ? 'soon' : 'later';
            return (
              <div key={evt.date + evt.name} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '3px 0',
                fontSize: i === 0 ? 11 : 10,
                color: i === 0 ? 'rgba(255,255,255,0.85)' : '#8BA4BE',
                fontWeight: i === 0 ? 600 : 400,
              }}>
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '65%',
                }}>
                  {isToday && '★ '}{evt.name}
                </span>
                <span style={{
                  fontSize: 9,
                  color: urgency === 'today' ? '#FFD700' : urgency === 'soon' ? '#F97316' : '#5A7A9A',
                  fontWeight: urgency === 'today' ? 700 : 400,
                  whiteSpace: 'nowrap',
                }}>
                  {isToday ? 'Today!' : `${days}d`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Hermetic principle — Correspondence governs the cosmos */}
      <HermeticPrincipleBar domain="dashboard" />
    </div>
  );
}