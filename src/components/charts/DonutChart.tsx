import { useState, useId } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  icon?: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
  onSegmentTap?: (index: number, segment: DonutSegment) => void;
  selectedIndex?: number | null;
  className?: string;
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToXY(cx, cy, r, startAngle);
  const end = polarToXY(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function DonutChart({
  segments,
  size = 200,
  strokeWidth = 28,
  centerLabel,
  centerValue,
  onSegmentTap,
  selectedIndex,
  className = '',
}: DonutChartProps) {
  const uid = useId().replace(/:/g, '');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0 || segments.length === 0) {
    return (
      <div className={`donut-chart-empty ${className}`} style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={(size - strokeWidth) / 2} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
        </svg>
        <div className="donut-center" style={{ position: 'absolute' }}>
          <span className="donut-center-label" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>No data</span>
        </div>
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;

  let cumAngle = 0;
  const arcs = segments.map((seg, i) => {
    const startAngle = cumAngle;
    const sweep = (seg.value / total) * 360;
    const endAngle = cumAngle + sweep - (sweep < 360 ? 0.8 : 0); // small gap
    cumAngle += sweep;
    const isActive = selectedIndex === i || hoveredIndex === i;
    const midAngle = startAngle + sweep / 2;
    const labelR = r + strokeWidth * 0.5 + 10;
    const labelPt = polarToXY(cx, cy, labelR, midAngle);
    return { seg, startAngle, endAngle, sweep, midAngle, labelPt, isActive, i };
  });

  const activeIdx = selectedIndex ?? hoveredIndex;

  return (
    <div className={`donut-chart ${className}`} style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {segments.map((seg, i) => (
            <filter key={i} id={`donut-glow-${uid}-${i}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
              <feFlood floodColor={seg.color} floodOpacity="0.7" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
        </defs>

        {/* Track ring */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={strokeWidth}
        />

        {/* Segments */}
        {arcs.map(({ seg, startAngle, endAngle, sweep, isActive, i }) => {
          if (sweep < 0.1) return null;
          const activeScale = isActive ? 1.06 : 1;
          const rActive = isActive ? r + 3 : r;
          return (
            <g
              key={i}
              style={{ cursor: onSegmentTap ? 'pointer' : 'default', transformOrigin: `${cx}px ${cy}px`, transform: `scale(${activeScale})`, transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onSegmentTap?.(i, seg)}
            >
              <path
                d={describeArc(cx, cy, rActive, startAngle, endAngle)}
                fill="none"
                stroke={seg.color}
                strokeWidth={isActive ? strokeWidth + 4 : strokeWidth}
                strokeLinecap="round"
                style={{
                  filter: isActive ? `url(#donut-glow-${uid}-${i})` : 'none',
                  transition: 'stroke-width 0.2s, filter 0.2s',
                  opacity: activeIdx !== null && !isActive ? 0.35 : 1,
                }}
              />
            </g>
          );
        })}

        {/* Center content */}
        {(centerLabel || centerValue) && (
          <g>
            {centerValue && (
              <text x={cx} y={activeIdx !== null ? cy - 6 : cy + (centerLabel ? -8 : 6)} textAnchor="middle"
                fill={activeIdx !== null ? segments[activeIdx]?.color || '#fff' : '#fff'}
                fontSize={activeIdx !== null ? 18 : 20}
                fontWeight="700"
                fontFamily="var(--font-display)"
                style={{ transition: 'font-size 0.2s, fill 0.2s' }}
              >
                {activeIdx !== null ? segments[activeIdx]?.value !== undefined
                  ? `$${Math.abs(segments[activeIdx].value).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`
                  : centerValue
                  : centerValue}
              </text>
            )}
            {centerLabel && (
              <text x={cx} y={cy + (centerValue ? 16 : 6)} textAnchor="middle"
                fill={activeIdx !== null ? segments[activeIdx]?.color || 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.5)'}
                fontSize="10"
                fontWeight="600"
                fontFamily="var(--font-body)"
                letterSpacing="0.05em"
                style={{ textTransform: 'uppercase', transition: 'fill 0.2s' }}
              >
                {activeIdx !== null ? segments[activeIdx]?.label || centerLabel : centerLabel}
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
