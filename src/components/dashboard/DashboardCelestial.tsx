/**
 * DashboardCelestial — Moon Phase + Season + Upcoming Events Widget
 *
 * Uses canvas for moon phase rendering (per DESIGN-RULES: custom art only).
 * Reuses celestial.ts math from the Realm lighting system.
 */

import { useRef, useEffect } from 'react';
import {
  getMoonPhase,
  getMoonPhaseName,
  getSeason,
  getUpcomingEvents,
  type MoonPhaseName,
} from '../../realm/data/celestial';
import './DashboardCelestial.css';

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

const SEASON_LABELS: Record<string, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

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

  // Shadow overlay
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

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export function DashboardCelestial() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const now = new Date();
  const phase = getMoonPhase(now);
  const phaseName = getMoonPhaseName(phase);
  const season = getSeason(now);
  const upcoming = getUpcomingEvents(now, 90);
  const nextEvent = upcoming[0] ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 40 * dpr;
    canvas.height = 40 * dpr;
    ctx.scale(dpr, dpr);

    drawMoonPhase(ctx, 40, phase);
  }, [phase]);

  return (
    <div className="dash-celestial">
      <div className="dc-header">
        <canvas ref={canvasRef} className="dc-moon-canvas" width={40} height={40} />
        <div className="dc-moon-info">
          <div className="dc-phase-name">{PHASE_LABELS[phaseName]}</div>
          <div className="dc-season">{SEASON_LABELS[season]}</div>
        </div>
      </div>
      {nextEvent && (
        <div className="dc-next-event">
          <span className="dc-event-name">{nextEvent.name}</span>
          <span className="dc-event-days">
            {daysUntil(nextEvent.date) === 0 ? 'Today' : `in ${daysUntil(nextEvent.date)}d`}
          </span>
        </div>
      )}
    </div>
  );
}
