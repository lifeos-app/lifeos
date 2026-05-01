/**
 * ProjectionCharts.tsx — SVG chart components for the Predictive Life Simulator
 *
 * - AreaChartWithBands: Area chart with confidence interval bands
 * - BeforeAfterLineChart: Side-by-side trajectory comparison
 * - DomainRadarChart: Domain impact radar visualization
 * - MiniSparkline: Compact trend indicator
 */

import { useState, useMemo, useId } from 'react';

// ── Domain Colors ─────────────────────────────────────────────────

export const DOMAIN_COLORS: Record<string, { primary: string; bg: string; label: string }> = {
  health: { primary: '#22C55E', bg: 'rgba(34,197,94,0.15)', label: 'Health' },
  finances: { primary: '#FACC15', bg: 'rgba(250,204,21,0.15)', label: 'Finances' },
  habits: { primary: '#A855F7', bg: 'rgba(168,85,247,0.15)', label: 'Habits' },
  goals: { primary: '#3B82F6', bg: 'rgba(59,130,246,0.15)', label: 'Goals' },
  energy: { primary: '#00D4FF', bg: 'rgba(0,212,255,0.15)', label: 'Energy' },
  mood: { primary: '#EC4899', bg: 'rgba(236,72,153,0.15)', label: 'Mood' },
};

// ── Helpers ────────────────────────────────────────────────────────

function bezierPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    d += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

// ── AreaChartWithBands ─────────────────────────────────────────────

interface BandDataPoint {
  date: string;
  value: number;
  bandHigh?: number;
  bandLow?: number;
  baseline?: number;
}

interface AreaChartWithBandsProps {
  data: BandDataPoint[];
  color: string;
  label: string;
  unit?: string;
  height?: number;
  showConfidenceBand?: boolean;
  showBaseline?: boolean;
  className?: string;
}

export function AreaChartWithBands({
  data,
  color,
  label,
  unit = '',
  height = 200,
  showConfidenceBand = true,
  showBaseline = true,
  className = '',
}: AreaChartWithBandsProps) {
  const uid = useId().replace(/:/g, '');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const svgWidth = 400;
  const padL = 40;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const chartW = svgWidth - padL - padR;
  const chartH = height - padT - padB;

  const allVals = data.flatMap(d => [d.value, d.bandHigh ?? d.value, d.bandLow ?? d.value, d.baseline ?? d.value]);
  const maxVal = Math.max(...allVals, 1) * 1.1;
  const minVal = Math.min(...allVals, 0) * 0.9;
  const range = maxVal - minVal || 1;

  const getX = (i: number) => padL + (data.length <= 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
  const getY = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;

  const pointData = useMemo(() =>
    data.map((d, i) => ({
      x: getX(i),
      yValue: getY(d.value),
      yHigh: getY(d.bandHigh ?? d.value),
      yLow: getY(d.bandLow ?? d.value),
      yBaseline: d.baseline != null ? getY(d.baseline) : null,
      ...d,
    })),
  [data, chartW, chartH, padL, padT, minVal, range]);

  const linePath = bezierPath(pointData.map(p => ({ x: p.x, y: p.yValue })));

  // Shaded area under main curve
  const areaPath = pointData.length > 1
    ? `${linePath} L ${pointData[pointData.length - 1].x} ${padT + chartH} L ${pointData[0].x} ${padT + chartH} Z`
    : '';

  // Confidence band area
  const bandPath = pointData.length > 1 && showConfidenceBand
    ? `M ${pointData[0].x} ${pointData[0].yHigh} ` +
      pointData.slice(1).map(p => `L ${p.x} ${p.yHigh}`).join(' ') +
      ` L ${pointData[pointData.length - 1].x} ${pointData[pointData.length - 1].yLow}` +
      pointData.slice(0, -1).reverse().map(p => `L ${p.x} ${p.yLow}`).join(' ') +
      ' Z'
    : '';

  // Baseline path
  const baselinePath = showBaseline && pointData.some(p => p.yBaseline != null)
    ? bezierPath(pointData.filter(p => p.yBaseline != null).map(p => ({ x: p.x, y: p.yBaseline! })))
    : '';

  const activeIdx = hoverIdx;

  return (
    <div className={`relative ${className}`} style={{ width: '100%' }}>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-sm font-semibold" style={{ color }}>{label}</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{unit}</span>
      </div>
      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={`band-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="50%" stopColor={color} stopOpacity="0.08" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`area-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
          <filter id={`glow-${uid}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = padT + chartH * (1 - t);
          const val = Math.round(minVal + range * t);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={svgWidth - padR} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="var(--font-body)">
                {val}
              </text>
            </g>
          );
        })}

        {/* Confidence band */}
        {bandPath && (
          <path d={bandPath} fill={`url(#band-grad-${uid})`} stroke={color} strokeWidth="0.5" strokeOpacity="0.15" />
        )}

        {/* Area fill */}
        {areaPath && (
          <path d={areaPath} fill={`url(#area-grad-${uid})`} />
        )}

        {/* Baseline (dashed) */}
        {baselinePath && (
          <path d={baselinePath} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="6 4" strokeLinecap="round" />
        )}

        {/* Main line */}
        {linePath && (
          <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `url(#glow-${uid})` }} />
        )}

        {/* Data points */}
        {pointData.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.yValue}
            r={activeIdx === i ? 5 : 3}
            fill={activeIdx === i ? color : '#0A1628'}
            stroke={color}
            strokeWidth={activeIdx === i ? 2.5 : 1.5}
            style={{ cursor: 'pointer', transition: 'r 0.15s, fill 0.15s' }}
          />
        ))}

        {/* Hover line */}
        {activeIdx != null && (
          <line
            x1={pointData[activeIdx]?.x} y1={padT}
            x2={pointData[activeIdx]?.x} y2={padT + chartH}
            stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3"
          />
        )}

        {/* X-axis date labels (show ~5 labels) */}
        {data.map((d, i) => {
          const showLabel = data.length <= 10 || i % Math.ceil(data.length / 6) === 0 || i === data.length - 1;
          if (!showLabel) return null;
          return (
            <text key={i} x={getX(i)} y={height - 4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="var(--font-body)">
              {d.date.slice(5)}
            </text>
          );
        })}

        {/* Invisible hover areas */}
        {data.map((_, i) => {
          const hitW = chartW / (data.length - 1 || 1);
          return (
            <rect
              key={`hit-${i}`}
              x={getX(i) - hitW / 2} y={padT} width={hitW} height={chartH}
              fill="transparent" style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {activeIdx != null && data[activeIdx] && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            top: 4,
            left: `clamp(8px, ${(pointData[activeIdx]?.x / svgWidth) * 100}%, calc(100% - 120px))`,
            transform: 'translateX(-50%)',
            background: 'rgba(10,22,40,0.96)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '6px 10px',
          }}
        >
          <div className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{data[activeIdx].date}</div>
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color, fontWeight: 700 }}>{Math.round(data[activeIdx].value)}{unit}</span>
            {data[activeIdx].baseline != null && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                vs {Math.round(data[activeIdx].baseline!)}{unit} baseline
              </span>
            )}
          </div>
          {showConfidenceBand && data[activeIdx].bandHigh != null && (
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Range: {Math.round(data[activeIdx].bandLow!)}–{Math.round(data[activeIdx].bandHigh!)}{unit}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── BeforeAfterLineChart ───────────────────────────────────────────

interface LineDataPoint {
  date: string;
  baseline: number;
  simulated: number;
}

interface BeforeAfterLineChartProps {
  data: LineDataPoint[];
  baselineColor?: string;
  simulatedColor?: string;
  label?: string;
  unit?: string;
  height?: number;
  className?: string;
}

export function BeforeAfterLineChart({
  data,
  baselineColor = 'rgba(255,255,255,0.3)',
  simulatedColor = '#00D4FF',
  label,
  unit = '',
  height = 180,
  className = '',
}: BeforeAfterLineChartProps) {
  const uid = useId().replace(/:/g, '');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const svgWidth = 400;
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const chartW = svgWidth - padL - padR;
  const chartH = height - padT - padB;

  const allVals = data.flatMap(d => [d.baseline, d.simulated]);
  const maxVal = Math.max(...allVals, 1) * 1.1;
  const minVal = Math.min(...allVals, 0) * 0.9;
  const range = maxVal - minVal || 1;

  const getX = (i: number) => padL + (data.length <= 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
  const getY = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;

  const baselinePath = bezierPath(data.map((d, i) => ({ x: getX(i), y: getY(d.baseline) })));
  const simulatedPath = bezierPath(data.map((d, i) => ({ x: getX(i), y: getY(d.simulated) })));

  // Shaded area between the two curves
  const gapPath = data.length > 1
    ? `M ${getX(0)} ${getY(data[0].baseline)} ` +
      data.slice(1).map((d, i) => `L ${getX(i + 1)} ${getY(d.baseline)}`).join(' ') +
      ` L ${getX(data.length - 1)} ${getY(data[data.length - 1].simulated)} ` +
      data.slice(0, -1).reverse().map((d, i) => `L ${getX(data.length - 2 - i)} ${getY(d.simulated)}`).join(' ') +
      ' Z'
    : '';

  return (
    <div className={`relative ${className}`} style={{ width: '100%' }}>
      {label && (
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-sm font-semibold" style={{ color: simulatedColor }}>{label}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs" style={{ color: baselineColor }}>
              <span style={{ width: 12, height: 2, background: baselineColor, display: 'inline-block', borderRadius: 1 }} />
              Current
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: simulatedColor }}>
              <span style={{ width: 12, height: 2, background: simulatedColor, display: 'inline-block', borderRadius: 1 }} />
              Simulated
            </span>
          </div>
        </div>
      )}
      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={`gap-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={simulatedColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={simulatedColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0, 0.5, 1].map(t => {
          const y = padT + chartH * (1 - t);
          const val = Math.round(minVal + range * t);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={svgWidth - padR} y2={y} stroke="rgba(255,255,255,0.04)" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize="8">
                {val}
              </text>
            </g>
          );
        })}

        {/* Gap area */}
        {gapPath && <path d={gapPath} fill={`url(#gap-grad-${uid})`} />}

        {/* Baseline line */}
        {baselinePath && (
          <path d={baselinePath} fill="none" stroke={baselineColor} strokeWidth="1.5" strokeDasharray="6 4" strokeLinecap="round" />
        )}

        {/* Simulated line */}
        {simulatedPath && (
          <path d={simulatedPath} fill="none" stroke={simulatedColor} strokeWidth="2.5" strokeLinecap="round" />
        )}

        {/* Hover */}
        {data.map((d, i) => (
          <rect
            key={i}
            x={getX(i) - chartW / data.length / 2} y={padT}
            width={chartW / data.length} height={chartH}
            fill="transparent" style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}

        {hoverIdx != null && (
          <line
            x1={getX(hoverIdx)} y1={padT}
            x2={getX(hoverIdx)} y2={padT + chartH}
            stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3"
          />
        )}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const show = data.length <= 10 || i % Math.ceil(data.length / 6) === 0;
          if (!show) return null;
          return <text key={i} x={getX(i)} y={height - 4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8">{d.date.slice(5)}</text>;
        })}
      </svg>

      {hoverIdx != null && data[hoverIdx] && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            top: 4,
            left: `clamp(8px, ${(getX(hoverIdx) / svgWidth) * 100}%, calc(100% - 140px))`,
            transform: 'translateX(-50%)',
            background: 'rgba(10,22,40,0.96)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '6px 10px',
          }}
        >
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{data[hoverIdx].date}</div>
          <div className="text-sm font-bold" style={{ color: simulatedColor }}>
            {Math.round(data[hoverIdx].simulated)}{unit}
            <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              vs {Math.round(data[hoverIdx].baseline)}{unit}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DomainRadarChart ──────────────────────────────────────────────

interface RadarDomainScore {
  domain: string;
  score: number; // 0–1
  baseline?: number; // 0–1
}

interface DomainRadarChartProps {
  domains: RadarDomainScore[];
  size?: number;
  className?: string;
}

export function DomainRadarChart({
  domains,
  size = 220,
  className = '',
}: DomainRadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) - 30;
  const n = domains.length || 6;
  const angleStep = (2 * Math.PI) / n;

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Domain positions
  const domainPoints = domains.map((d, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + Math.cos(angle) * radius * d.score;
    const y = cy + Math.sin(angle) * radius * d.score;
    const bx = d.baseline != null ? cx + Math.cos(angle) * radius * d.baseline : 0;
    const by = d.baseline != null ? cy + Math.sin(angle) * radius * d.baseline : 0;
    const labelX = cx + Math.cos(angle) * (radius + 18);
    const labelY = cy + Math.sin(angle) * (radius + 18);
    return { ...d, x, y, bx, by, labelX, labelY, angle };
  });

  // Baseline polygon
  const baselinePoly = domains.every(d => d.baseline != null)
    ? domainPoints.map(p => `${p.bx},${p.by}`).join(' ')
    : '';

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      {/* Grid rings */}
      {rings.map((r, i) => {
        const ringPoints = Array.from({ length: n }, (_, j) => {
          const angle = -Math.PI / 2 + j * angleStep;
          return `${cx + Math.cos(angle) * radius * r},${cy + Math.sin(angle) * radius * r}`;
        }).join(' ');
        return <polygon key={i} points={ringPoints} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
      })}

      {/* Axis lines */}
      {domainPoints.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(p.angle) * radius} y2={cy + Math.sin(p.angle) * radius} stroke="rgba(255,255,255,0.06)" />
      ))}

      {/* Baseline polygon */}
      {baselinePoly && (
        <polygon points={baselinePoly} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" />
      )}

      {/* Simulated polygon */}
      <polygon
        points={domainPoints.map(p => `${p.x},${p.y}`).join(' ')}
        fill="rgba(0,212,255,0.1)"
        stroke="#00D4FF"
        strokeWidth="2"
      />

      {/* Domain dots */}
      {domainPoints.map((p, i) => {
        const color = DOMAIN_COLORS[p.domain]?.primary ?? '#00D4FF';
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="#0A1628" strokeWidth="2" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
          </g>
        );
      })}

      {/* Domain labels */}
      {domainPoints.map((p, i) => {
        const color = DOMAIN_COLORS[p.domain]?.primary ?? 'rgba(255,255,255,0.5)';
        const label = DOMAIN_COLORS[p.domain]?.label ?? p.domain;
        const score = Math.round(p.score * 100);
        return (
          <text
            key={`label-${i}`}
            x={p.labelX} y={p.labelY}
            textAnchor="middle" dominantBaseline="middle"
            fill={color} fontSize="10" fontWeight="600"
            fontFamily="var(--font-body)"
          >
            <tspan>{label}</tspan>
            <tspan x={p.labelX} dy="12" fontSize="9" fill="rgba(255,255,255,0.5)">{score}%</tspan>
          </text>
        );
      })}
    </svg>
  );
}

// ── MiniSparkline ──────────────────────────────────────────────────

interface MiniSparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function MiniSparkline({
  data,
  color = '#00D4FF',
  width = 80,
  height = 32,
  className = '',
}: MiniSparklineProps) {
  if (data.length < 2) return null;

  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;
  const padX = 2;
  const chartW = width - padX * 2;
  const chartH = height - 4;

  const points = data.map((v, i) => ({
    x: padX + (i / (data.length - 1)) * chartW,
    y: 2 + chartH - ((v - minVal) / range) * chartH,
  }));

  const path = bezierPath(points);
  const areaPath = points.length > 1
    ? `${path} L ${points[points.length - 1].x} ${height - 2} L ${points[0].x} ${height - 2} Z`
    : '';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill={`url(#spark-${color.replace('#', '')})`} />}
      {path && <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  );
}