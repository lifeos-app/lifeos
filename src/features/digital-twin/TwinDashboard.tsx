/**
 * TwinDashboard.tsx — Personality visualization for the Digital Twin
 *
 * Animated radar chart with 7 trait axes, trait descriptions,
 * comparison mode (current vs previous), and growth arrows.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BehavioralTraits } from './useDigitalTwin';

// ── Trait metadata ────────────────────────────────────────────────────

const TRAIT_CONFIG: { key: keyof BehavioralTraits; label: string; color: string; icon: string }[] = [
  { key: 'discipline',      label: 'Discipline',       color: '#F97316', icon: '⚔️' },
  { key: 'consistency',     label: 'Consistency',      color: '#06B6D4', icon: '🔄' },
  { key: 'riskTolerance',   label: 'Risk Tolerance',   color: '#EF4444', icon: '🎲' },
  { key: 'recoverySpeed',   label: 'Recovery Speed',   color: '#10B981', icon: '💚' },
  { key: 'growthTrajectory',label: 'Growth',           color: '#8B5CF6', icon: '📈' },
  { key: 'socialInfluence', label: 'Social Influence',  color: '#EC4899', icon: '🤝' },
  { key: 'stressResponse',  label: 'Stress Response',   color: '#FACC15', icon: '🧘' },
];

function getTraitDescription(key: keyof BehavioralTraits, value: number): string {
  if (value >= 80) {
    switch (key) {
      case 'discipline': return 'Iron will. Your habits run on autopilot.';
      case 'consistency': return 'Rock steady. Day in, day out, you show up.';
      case 'riskTolerance': return 'Bold explorer. You embrace uncertainty.';
      case 'recoverySpeed': return 'Resilient. Bounces back almost instantly.';
      case 'growthTrajectory': return 'Ascending rapidly. Momentum is on your side.';
      case 'socialInfluence': return 'Deeply connected. Others influence and motivate you.';
      case 'stressResponse': return 'Zen master. Stress barely phases you.';
    }
  } else if (value >= 50) {
    switch (key) {
      case 'discipline': return 'Mostly reliable. Occasional lapses, but you recover.';
      case 'consistency': return 'Regular rhythm with some variation. Not bad.';
      case 'riskTolerance': return 'Moderate. You take calculated chances.';
      case 'recoverySpeed': return 'Decent bounce-back. Could be faster.';
      case 'growthTrajectory': return 'Steady progress. The slope is positive.';
      case 'socialInfluence': return 'Some social accountability helps you.';
      case 'stressResponse': return 'You handle moderate stress well.';
    }
  } else {
    switch (key) {
      case 'discipline': return 'Wavering. Your habits need more anchoring.';
      case 'consistency': return 'Variable. Some days great, others... not.';
      case 'riskTolerance': return 'Cautious. You prefer the safe path.';
      case 'recoverySpeed': return 'Slow to recover. One miss can spiral.';
      case 'growthTrajectory': return 'Plateauing. Time to shake things up.';
      case 'socialInfluence': return 'Self-driven. Social factors don\'t move you much.';
      case 'stressResponse': return 'Stress hits hard. Building resilience is key.';
    }
  }
}

function getGrowthArrow(current: number, previous: number | undefined): 'up' | 'down' | 'flat' | null {
  if (previous === undefined || previous === null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 3) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

// ── Radar Chart Component ─────────────────────────────────────────────

function AnimatedRadarChart({
  traits,
  previousTraits,
  size = 280,
}: {
  traits: BehavioralTraits;
  previousTraits: BehavioralTraits | null;
  size?: number;
}) {
  const [animatedValues, setAnimatedValues] = useState<Record<string, number>>(
    Object.fromEntries(TRAIT_CONFIG.map(t => [t.key, 0]))
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Animate values toward targets
  useEffect(() => {
    const targets = Object.fromEntries(TRAIT_CONFIG.map(t => [t.key, traits[t.key]]));
    const startValues = { ...animatedValues };
    const startTime = performance.now();
    const duration = 800;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      const newValues: Record<string, number> = {};
      for (const t of TRAIT_CONFIG) {
        const start = startValues[t.key] ?? 0;
        const target = targets[t.key] ?? 0;
        newValues[t.key] = start + (target - start) * eased;
      }

      setAnimatedValues(newValues);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [traits.discipline, traits.consistency, traits.riskTolerance, traits.recoverySpeed, traits.growthTrajectory, traits.socialInfluence, traits.stressResponse]); // eslint-disable-line

  // Draw radar chart on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * 0.38;
    const n = TRAIT_CONFIG.length;

    // Background
    ctx.fillStyle = '#070D1A';
    ctx.fillRect(0, 0, size, size);

    // Grid rings
    for (let ring = 1; ring <= 4; ring++) {
      const r = (ring / 4) * maxR;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(30, 58, 91, ${0.3 + ring * 0.1})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Axis lines
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + maxR * Math.cos(angle), cy + maxR * Math.sin(angle));
      ctx.strokeStyle = 'rgba(30, 58, 91, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Previous traits (ghost) — if available
    if (previousTraits) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const val = (previousTraits[TRAIT_CONFIG[i].key] ?? 0) / 100;
        const r = val * maxR;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(100, 116, 139, 0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Current traits — animated
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const val = (animatedValues[TRAIT_CONFIG[i].key] ?? 0) / 100;
      const r = val * maxR;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Gradient fill
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    gradient.addColorStop(0, 'rgba(0, 212, 255, 0.25)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.15)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Border
    const borderGradient = ctx.createLinearGradient(0, 0, size, size);
    borderGradient.addColorStop(0, '#00D4FF');
    borderGradient.addColorStop(1, '#8B5CF6');
    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Data points
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const val = (animatedValues[TRAIT_CONFIG[i].key] ?? 0) / 100;
      const r = val * maxR;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = TRAIT_CONFIG[i].color;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = TRAIT_CONFIG[i].color + '33';
      ctx.fill();

      // Label
      const labelR = maxR + 22;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);
      ctx.fillStyle = TRAIT_CONFIG[i].color;
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TRAIT_CONFIG[i].label, lx, ly);

      // Score
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '9px system-ui, sans-serif';
      ctx.fillText(String(Math.round(animatedValues[TRAIT_CONFIG[i].key] ?? 0)), lx, ly + 12);
    }

    // Center glow
    const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
    centerGlow.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
    centerGlow.addColorStop(1, 'rgba(0, 212, 255, 0)');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(cx - 20, cy - 20, 40, 40);

  }, [animatedValues, previousTraits, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="rounded-xl"
    />
  );
}

// ── Main Dashboard Component ──────────────────────────────────────────

export function TwinDashboard({
  traits,
  previousTraits,
  archetype,
}: {
  traits: BehavioralTraits;
  previousTraits: BehavioralTraits | null;
  archetype: string;
}) {
  const [compareMode, setCompareMode] = useState(false);
  const [hoveredTrait, setHoveredTrait] = useState<keyof BehavioralTraits | null>(null);

  const relevantPrevious = compareMode && previousTraits ? previousTraits : null;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Archetype badge */}
      <div
        className="px-4 py-2 rounded-full text-sm font-bold"
        style={{
          background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(139,92,246,0.15))',
          border: '1px solid rgba(0,212,255,0.3)',
          color: '#00D4FF',
        }}
      >
        {archetype}
      </div>

      {/* Radar chart */}
      <AnimatedRadarChart
        traits={traits}
        previousTraits={relevantPrevious}
        size={280}
      />

      {/* Compare toggle */}
      <button
        onClick={() => setCompareMode(!compareMode)}
        className="text-xs px-3 py-1 rounded-full transition-colors"
        style={{
          background: compareMode ? 'rgba(139,92,246,0.2)' : 'rgba(30,58,91,0.4)',
          color: compareMode ? '#C084FC' : '#8BA4BE',
          border: `1px solid ${compareMode ? 'rgba(139,92,246,0.4)' : 'rgba(30,58,91,0.6)'}`,
        }}
      >
        {compareMode ? '⟳ Comparing vs last build' : '⟳ Compare vs previous'}
      </button>

      {/* Trait cards */}
      <div className="w-full grid grid-cols-1 gap-2 mt-2">
        {TRAIT_CONFIG.map(({ key, label, color, icon }) => {
          const value = Math.round(traits[key]);
          const arrow = getGrowthArrow(value, previousTraits ? Math.round(previousTraits[key]) : undefined);
          const isHovered = hoveredTrait === key;

          return (
            <div
              key={key}
              onMouseEnter={() => setHoveredTrait(key)}
              onMouseLeave={() => setHoveredTrait(null)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200"
              style={{
                background: isHovered ? `${color}15` : 'rgba(15,23,42,0.5)',
                border: `1px solid ${isHovered ? color + '40' : 'rgba(30,58,91,0.4)'}`,
              }}
            >
              <span className="text-base">{icon}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color }}>{label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold" style={{ color: '#E2E8F0' }}>{value}</span>
                    {arrow && (
                      <span className="text-xs" style={{ color: arrow === 'up' ? '#10B981' : arrow === 'down' ? '#EF4444' : '#64748B' }}>
                        {arrow === 'up' ? '↑' : arrow === 'down' ? '↓' : '→'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,58,91,0.4)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${value}%`,
                      background: `linear-gradient(90deg, ${color}88, ${color})`,
                    }}
                  />
                </div>

                {isHovered && (
                  <p className="text-xs mt-1" style={{ color: '#8BA4BE' }}>
                    {getTraitDescription(key, value)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}