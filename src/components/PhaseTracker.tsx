/**
 * Phase Tracker — Apple Watch style 3-ring progress display.
 * Shows Life, Health, Finance onboarding phases.
 */
import { Link } from 'react-router-dom';
import { PHASE_ORDER, PHASES, getPhasePercents, type PhaseId } from '../lib/onboarding-phases';
import { ChevronRight } from 'lucide-react';

interface PhaseTrackerProps {
  preferences: Record<string, any> | null;
  onboardingComplete?: boolean;
}

const RING_CONFIGS: { id: PhaseId; radius: number; stroke: number }[] = [
  { id: 'life', radius: 38, stroke: 5 },
  { id: 'health', radius: 29, stroke: 5 },
  { id: 'finance', radius: 20, stroke: 5 },
];

export function PhaseTracker({ preferences }: PhaseTrackerProps) {
  const percents = getPhasePercents(preferences);
  const overall = Math.round((percents.life + percents.health + percents.finance) / 3);
  const allComplete = percents.life >= 100 && percents.health >= 100 && percents.finance >= 100;

  // Hide if all phases are done
  if (allComplete) return null;

  // Find the next incomplete phase
  const nextPhase = PHASE_ORDER.find(id => percents[id] < 100) || 'life';
  const nextPhaseConfig = PHASES[nextPhase];
  const routeMap: Record<PhaseId, string> = {
    life: '/setup',
    health: '/setup/health',
    finance: '/setup/finance',
  };

  // Title logic: friendly copy when at 0%
  const title = overall === 0 ? 'Personalize LifeOS' : 'Continue Setup';

  return (
    <Link to={routeMap[nextPhase]} className="phase-tracker" style={{ textDecoration: 'none', color: 'inherit' }}>
      {/* 3-Ring SVG */}
      <div className="phase-rings">
        <svg width="90" height="90" viewBox="0 0 90 90">
          {RING_CONFIGS.map(({ id, radius, stroke }) => {
            const phase = PHASES[id];
            const pct = percents[id];
            const circumference = 2 * Math.PI * radius;
            const offset = circumference * (1 - pct / 100);

            return (
              <g key={id}>
                {/* Background ring */}
                <circle
                  cx="45" cy="45" r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={stroke}
                />
                {/* Progress ring */}
                <circle
                  cx="45" cy="45" r={radius}
                  fill="none"
                  stroke={phase.color}
                  strokeWidth={stroke}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  transform="rotate(-90 45 45)"
                  style={{
                    transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    filter: pct > 0 ? `drop-shadow(0 0 3px ${phase.color}40)` : 'none',
                  }}
                />
              </g>
            );
          })}
          {/* Center text */}
          <text x="45" y="43" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" fontFamily="'Poppins', sans-serif">
            {overall}%
          </text>
          <text x="45" y="55" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)" fontFamily="'Poppins', sans-serif">
            setup
          </text>
        </svg>
      </div>

      {/* Phase labels */}
      <div className="phase-info">
        <span className="phase-tracker-title">{title}</span>
        <div className="phase-labels">
          {RING_CONFIGS.map(({ id }) => {
            const phase = PHASES[id];
            const pct = percents[id];
            return (
              <div key={id} className="phase-label-row">
                <span className="phase-dot" style={{ background: phase.color, opacity: pct >= 100 ? 0.3 : 1 }} />
                <span className="phase-label-text" style={{ opacity: pct >= 100 ? 0.4 : 0.8 }}>
                  {phase.title}
                </span>
                <span className="phase-label-pct" style={{ color: pct >= 100 ? '#4ECB71' : 'rgba(255,255,255,0.4)' }}>
                  {pct >= 100 ? '✓' : `${pct}%`}
                </span>
              </div>
            );
          })}
        </div>
        <span className="phase-next">
          Next: {nextPhaseConfig.icon} {nextPhaseConfig.title}
          <ChevronRight size={12} />
        </span>
      </div>
    </Link>
  );
}
