/**
 * EnergyWave — Canvas sinusoidal wave visualization of energy scores.
 *
 * Renders the last 14 days of energy data as a purple sinusoidal wave
 * over a dark #0A1628 background. Features:
 * - Amplitude/frequency statistics label
 * - Subtle fill below the wave
 * - Glow effect for streaks >= 3 consecutive days
 * - X-axis: day letters, Y-axis: 1-5 scale
 *
 * Design: No emoji. Poppins font. Dark theme. Container 280x160px.
 */

import { useRef, useEffect, useMemo } from 'react';
import { useHealthMetrics } from '../../hooks/useHealthMetrics';
import './EnergyWave.css';

const CONTAINER_WIDTH = 280;
const CONTAINER_HEIGHT = 160;
const PADDING_LEFT = 28;
const PADDING_RIGHT = 10;
const PADDING_TOP = 24;
const PADDING_BOTTOM = 24;
const WAVE_COLOR = '#A855F7';
const WAVE_FILL_ALPHA = 0.12;
const GLOW_COLOR = 'rgba(168, 85, 247, 0.45)';
const BG_COLOR = '#0A1628';
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const LABEL_COLOR = '#5A7A9A';
const VALUE_LABEL_COLOR = '#8BA4BE';
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STREAK_THRESHOLD = 3;

export function EnergyWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { data } = useHealthMetrics();

  // Extract last 14 days of energy data, sorted oldest-first
  const recentData = useMemo(() => {
    const sorted = [...data]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
    return sorted;
  }, [data]);

  // Energy values array
  const energyValues = useMemo(
    () => recentData.map(d => d.energy_score ?? null),
    [recentData]
  );

  // Calculate streak of consecutive days with energy logged
  const streakDays = useMemo(() => {
    let streak = 0;
    for (let i = energyValues.length - 1; i >= 0; i--) {
      if (energyValues[i] !== null) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [energyValues]);

  // Amplitude stats
  const amplitude = useMemo(() => {
    const valid = energyValues.filter((v): v is number => v !== null);
    if (valid.length === 0) return { avg: 0, range: 0, freq: 0 };

    const avg = valid.reduce((s, v) => s + v, 0) / valid.length;
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min;

    // Frequency = number of direction changes (oscillations)
    let crossings = 0;
    for (let i = 1; i < valid.length; i++) {
      if ((valid[i] > avg && valid[i - 1] <= avg) || (valid[i] <= avg && valid[i - 1] > avg)) {
        crossings++;
      }
    }
    return { avg, range, freq: crossings };
  }, [energyValues]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CONTAINER_WIDTH * dpr;
    canvas.height = CONTAINER_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    const chartW = CONTAINER_WIDTH - PADDING_LEFT - PADDING_RIGHT;
    const chartH = CONTAINER_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

    // Clear
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, CONTAINER_WIDTH, CONTAINER_HEIGHT);

    // Y-axis labels (1-5)
    ctx.font = '9px Poppins, sans-serif';
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = 1; v <= 5; v++) {
      const y = PADDING_TOP + chartH - ((v - 1) / 4) * chartH;
      ctx.fillText(String(v), PADDING_LEFT - 6, y);

      // Horizontal grid line
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PADDING_LEFT, y);
      ctx.lineTo(PADDING_LEFT + chartW, y);
      ctx.stroke();
    }

    // X-axis: day letters
    const numPoints = recentData.length;
    if (numPoints === 0) {
      // No data — show placeholder text
      ctx.font = '11px Poppins, sans-serif';
      ctx.fillStyle = LABEL_COLOR;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Log energy to see your vibration', CONTAINER_WIDTH / 2, CONTAINER_HEIGHT / 2);
      return;
    }

    const stepX = numPoints > 1 ? chartW / (numPoints - 1) : chartW / 2;

    // Draw X-axis day labels
    ctx.font = '8px Poppins, sans-serif';
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    recentData.forEach((d, i) => {
      const dateObj = new Date(d.date + 'T00:00:00');
      const dayLetter = DAY_LABELS[dateObj.getDay()];
      const x = numPoints > 1 ? PADDING_LEFT + i * stepX : PADDING_LEFT + stepX;
      ctx.fillText(dayLetter, x, PADDING_TOP + chartH + 6);
    });

    // Build wave points (only where energy_score exists)
    type Point = { x: number; y: number; value: number; index: number };
    const points: Point[] = [];

    recentData.forEach((d, i) => {
      if (d.energy_score == null) return;
      const x = numPoints > 1 ? PADDING_LEFT + i * stepX : PADDING_LEFT + stepX;
      const y = PADDING_TOP + chartH - ((d.energy_score - 1) / 4) * chartH;
      points.push({ x, y, value: d.energy_score, index: i });
    });

    if (points.length < 2) {
      // Draw single point as a dot
      if (points.length === 1) {
        const p = points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = WAVE_COLOR;
        ctx.fill();
      }
      return;
    }

    // Draw filled area beneath wave (subtle)
    ctx.beginPath();
    ctx.moveTo(points[0].x, PADDING_TOP + chartH);
    ctx.lineTo(points[0].x, points[0].y);

    // Smooth curve using quadratic bezier through midpoints
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;

      // Check for gap (skip missing points)
      if (curr.index - prev.index > 1) {
        ctx.lineTo(prev.x, PADDING_TOP + chartH);
        ctx.moveTo(curr.x, PADDING_TOP + chartH);
        ctx.lineTo(curr.x, curr.y);
        continue;
      }

      ctx.quadraticCurveTo(prev.x + (curr.x - prev.x) * 0.5, prev.y, cpx, (prev.y + curr.y) / 2);
      ctx.quadraticCurveTo(curr.x - (curr.x - prev.x) * 0.5, curr.y, curr.x, curr.y);
    }

    // Close fill path
    ctx.lineTo(points[points.length - 1].x, PADDING_TOP + chartH);
    ctx.closePath();
    ctx.fillStyle = WAVE_COLOR + Math.round(WAVE_FILL_ALPHA * 255).toString(16).padStart(2, '0');
    ctx.fill();

    // Draw glow effect if streak >= threshold
    const applyGlow = streakDays >= STREAK_THRESHOLD;

    // Draw the wave line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;

      if (curr.index - prev.index > 1) {
        ctx.moveTo(curr.x, curr.y);
        continue;
      }

      ctx.quadraticCurveTo(prev.x + (curr.x - prev.x) * 0.5, prev.y, cpx, (prev.y + curr.y) / 2);
      ctx.quadraticCurveTo(curr.x - (curr.x - prev.x) * 0.5, curr.y, curr.x, curr.y);
    }

    if (applyGlow) {
      ctx.shadowColor = GLOW_COLOR;
      ctx.shadowBlur = 12;
    }

    ctx.strokeStyle = WAVE_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw data point dots
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = WAVE_COLOR;
      ctx.fill();

      if (applyGlow) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.strokeStyle = GLOW_COLOR;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }, [recentData, energyValues, streakDays, amplitude]);

  return (
    <div className="energy-wave-container">
      <div className="energy-wave-header">
        <span className="energy-wave-title">Your Vibration</span>
        <div className="energy-wave-stats">
          <span className="energy-wave-stat">
            Avg: {amplitude.avg > 0 ? amplitude.avg.toFixed(1) : '--'}
          </span>
          <span className="energy-wave-stat-sep">|</span>
          <span className="energy-wave-stat">
            Range: {amplitude.range > 0 ? amplitude.range.toFixed(1) : '--'}
          </span>
          <span className="energy-wave-stat-sep">|</span>
          <span className="energy-wave-stat">
            Oscillations: {amplitude.freq}
          </span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="energy-wave-canvas"
        style={{
          width: CONTAINER_WIDTH,
          height: CONTAINER_HEIGHT,
        }}
      />
    </div>
  );
}