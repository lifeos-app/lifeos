// LifeOS Gamification — Radar/Hexagon Chart for 6 Stats
// v2: Cleaner, more readable, mobile-optimized, animated

import { useMemo } from 'react';
import type { UserStats } from '../../lib/gamification';
import './gamification.css';

interface StatsRadarProps {
  stats: UserStats;
  size?: number;
}

const STAT_LABELS: { key: keyof UserStats; label: string; emoji: string; color: string }[] = [
  { key: 'productivity', label: 'PROD', emoji: '⚡', color: '#39FF14' },
  { key: 'consistency',  label: 'CONS', emoji: '🔗', color: '#F97316' },
  { key: 'health',       label: 'HP',   emoji: '❤️', color: '#F43F5E' },
  { key: 'finance',      label: 'FIN',  emoji: '💰', color: '#FACC15' },
  { key: 'knowledge',    label: 'INT',  emoji: '📚', color: '#A855F7' },
  { key: 'social',       label: 'SOC',  emoji: '🤝', color: '#00D4FF' },
];

export function StatsRadar({ stats, size = 180 }: StatsRadarProps) {
  const center = size / 2;
  const radius = (size / 2) - 28;
  const numSides = 6;
  const angleStep = (Math.PI * 2) / numSides;

  const getPoint = (index: number, value: number): [number, number] => {
    const angle = angleStep * index - Math.PI / 2;
    const r = radius * value;
    return [
      center + r * Math.cos(angle),
      center + r * Math.sin(angle),
    ];
  };

  // Grid lines (25%, 50%, 75%, 100%)
  const gridLines = useMemo(() => {
    return [0.25, 0.5, 0.75, 1.0].map(pct => {
      const points = Array.from({ length: numSides }, (_, i) => getPoint(i, pct));
      return points.map(p => p.join(',')).join(' ');
    });
  }, [size]);

  // Axis lines
  const axisLines = useMemo(() => {
    return Array.from({ length: numSides }, (_, i) => {
      const [x, y] = getPoint(i, 1);
      return { x1: center, y1: center, x2: x, y2: y };
    });
  }, [size]);

  // Data polygon
  const dataPoints = useMemo(() => {
    return STAT_LABELS.map((stat, i) => {
      const value = Math.max(0, Math.min(100, stats[stat.key] || 0)) / 100;
      return getPoint(i, Math.max(value, 0.05)); // min 5% for visibility
    });
  }, [stats, size]);

  const dataPath = dataPoints.map(p => p.join(',')).join(' ');

  // Label positions (outside the hexagon)
  const labelPositions = useMemo(() => {
    return STAT_LABELS.map((_, i) => {
      const [x, y] = getPoint(i, 1.3);
      return { x, y };
    });
  }, [size]);

  return (
    <div className="stats-radar">
      <svg
        className="stats-radar__svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Grid hexagons */}
        {gridLines.map((points, i) => (
          <polygon
            key={`grid-${i}`}
            className="stats-radar__grid-line"
            points={points}
            strokeDasharray={i === 1 ? '3,3' : undefined}
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            key={`axis-${i}`}
            className="stats-radar__axis"
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
          />
        ))}

        {/* Data area with gradient */}
        <defs>
          <linearGradient id="radar-fill-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#39FF14" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        <polygon
          className="stats-radar__area"
          points={dataPath}
          fill="url(#radar-fill-grad)"
        />

        {/* Data points with stat-specific colors */}
        {dataPoints.map(([x, y], i) => {
          const value = stats[STAT_LABELS[i].key] || 0;
          const isStrong = value >= 60;
          return (
            <circle
              key={`dot-${i}`}
              className={`stats-radar__dot ${isStrong ? 'stats-radar__dot--strong' : ''}`}
              cx={x}
              cy={y}
              r={isStrong ? 4 : 3}
              fill={STAT_LABELS[i].color}
            />
          );
        })}

        {/* Labels — compact for mobile */}
        {labelPositions.map((pos, i) => {
          const stat = STAT_LABELS[i];
          const value = stats[stat.key] || 0;
          return (
            <g key={`label-${i}`}>
              <text
                className="stats-radar__label"
                x={pos.x}
                y={pos.y - 5}
                fill={stat.color}
              >
                {stat.label}
              </text>
              <text
                className="stats-radar__value"
                x={pos.x}
                y={pos.y + 7}
              >
                {value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default StatsRadar;
