import { useState, useId, useMemo } from 'react';

export interface AreaSeries {
  data: number[];
  color: string;
  label: string;
  fillOpacity?: number;
}

interface AreaChartProps {
  series: AreaSeries[];
  labels?: string[];
  height?: number;
  width?: number;
  onPointTap?: (monthIndex: number, values: { label: string; value: number; color: string }[]) => void;
  onPointLongPress?: (monthIndex: number, position: { x: number; y: number }, values: { label: string; value: number; color: string }[]) => void;
  selectedIndex?: number | null;
  showDots?: boolean;
  animated?: boolean;
  showTrendLine?: boolean;
  trendLineColor?: string;
  className?: string;
}

function cubicBezierPath(points: { x: number; y: number }[]): string {
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

/** Calculate 7-point (or shorter) moving average */
function movingAverage(data: number[], window = 7): number[] {
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export function AreaChart({
  series,
  labels = [],
  height = 120,
  width,
  onPointTap,
  onPointLongPress,
  selectedIndex,
  showDots = true,
  showTrendLine = false,
  trendLineColor,
  className = '',
}: AreaChartProps) {
  const uid = useId().replace(/:/g, '');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const allValues = series.flatMap(s => s.data).filter(v => typeof v === 'number');
  const maxVal = Math.max(...allValues, 1);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const numPoints = Math.max(...series.map(s => s.data.length), 0);
  const svgWidth = 400;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = labels.length ? 24 : 8;
  const chartW = svgWidth - padL - padR;
  const chartH = height - padT - padB;

  const getX = (i: number) => padL + (numPoints <= 1 ? chartW / 2 : (i / (numPoints - 1)) * chartW);
  const getY = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;

  const activeIdx = selectedIndex ?? hoveredIndex;

  // Trend line (7-point moving average)
  const trendLines = useMemo(() => {
    if (!showTrendLine) return [];
    return series.map(s => {
      const ma = movingAverage(s.data);
      return ma.map((v, i) => ({ x: getX(i), y: getY(v) }));
    });
  }, [showTrendLine, series, numPoints]);

  // Long press state
  const longPressTimer = useState<{ timer: ReturnType<typeof setTimeout> | null; startPos: { x: number; y: number } | null }>({ timer: null, startPos: null })[0];

  const handleLongPressStart = (i: number, clientX: number, clientY: number) => {
    if (!onPointLongPress) return;
    longPressTimer.startPos = { x: clientX, y: clientY };
    longPressTimer.timer = setTimeout(() => {
      onPointLongPress(i, { x: clientX, y: clientY }, series.map(s => ({ label: s.label, value: s.data[i] ?? 0, color: s.color })));
      longPressTimer.timer = null;
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.timer) {
      clearTimeout(longPressTimer.timer);
      longPressTimer.timer = null;
    }
  };

  return (
    <div
      className={`area-chart-wrapper ${className}`}
      style={{ position: 'relative', width: width ? `${width}px` : '100%' }}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`area-grad-${uid}-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={s.fillOpacity ?? 0.25} />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
            </linearGradient>
          ))}
          {series.map((_s, si) => (
            <filter key={si} id={`area-glow-${uid}-${si}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(t => (
          <line
            key={t}
            x1={padL} y1={padT + chartH * (1 - t)}
            x2={svgWidth - padR} y2={padT + chartH * (1 - t)}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}

        {/* Series fills + lines */}
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => ({ x: getX(i), y: getY(v) }));
          if (pts.length === 0) return null;
          const linePath = cubicBezierPath(pts);
          const areaPath = pts.length > 1
            ? `${linePath} L ${pts[pts.length - 1].x} ${padT + chartH} L ${pts[0].x} ${padT + chartH} Z`
            : '';
          return (
            <g key={si}>
              {areaPath && (
                <path d={areaPath} fill={`url(#area-grad-${uid}-${si})`} />
              )}
              <path
                d={linePath}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `url(#area-glow-${uid}-${si})` }}
              />
              {/* Trend line overlay */}
              {showTrendLine && trendLines[si] && trendLines[si].length > 1 && (
                <path
                  d={cubicBezierPath(trendLines[si])}
                  fill="none"
                  stroke={trendLineColor || s.color}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  opacity={0.5}
                />
              )}
              {/* Dots */}
              {showDots && pts.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x} cy={pt.y} r={activeIdx === i ? 5 : 3}
                  fill={activeIdx === i ? s.color : '#0A1628'}
                  stroke={s.color}
                  strokeWidth={activeIdx === i ? 2 : 1.5}
                  style={{
                    cursor: 'pointer',
                    transition: 'r 0.15s, fill 0.15s',
                    filter: activeIdx === i ? `drop-shadow(0 0 6px ${s.color})` : 'none',
                  }}
                />
              ))}
            </g>
          );
        })}

        {/* Invisible hit areas for touch/click */}
        {numPoints > 0 && Array.from({ length: numPoints }, (_, i) => {
          const x = getX(i);
          const hitW = chartW / (numPoints - 1 || 1);
          return (
            <rect
              key={i}
              x={x - hitW / 2} y={padT}
              width={hitW} height={chartH}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => { setHoveredIndex(null); handleLongPressEnd(); }}
              onMouseDown={(e) => handleLongPressStart(i, e.clientX, e.clientY)}
              onMouseUp={handleLongPressEnd}
              onTouchStart={(e) => {
                const t = e.touches[0];
                handleLongPressStart(i, t.clientX, t.clientY);
              }}
              onTouchEnd={handleLongPressEnd}
              onClick={() => {
                onPointTap?.(i, series.map(s => ({ label: s.label, value: s.data[i] ?? 0, color: s.color })));
              }}
            />
          );
        })}

        {/* Vertical highlight line on hover */}
        {activeIdx !== null && (
          <line
            x1={getX(activeIdx)} y1={padT}
            x2={getX(activeIdx)} y2={padT + chartH}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* X-axis labels */}
        {labels.map((lbl, i) => (
          <text
            key={i}
            x={getX(i)} y={height - 4}
            textAnchor="middle"
            fill={activeIdx === i ? '#fff' : 'rgba(255,255,255,0.35)'}
            fontSize="9"
            fontFamily="var(--font-body)"
            style={{ transition: 'fill 0.15s' }}
          >
            {lbl}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
      {activeIdx !== null && (
        <div
          className="area-chart-tooltip"
          style={{
            position: 'absolute',
            top: 4,
            left: `clamp(8px, ${(getX(activeIdx) / 400) * 100}%, calc(100% - 100px))`,
            transform: 'translateX(-50%)',
            background: 'rgba(10,22,40,0.96)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '6px 10px',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          {labels[activeIdx] && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 3 }}>{labels[activeIdx]}</div>}
          {series.map((s, si) => (
            <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{s.label}:</span>
              <span style={{ color: s.color, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                ${(s.data[activeIdx] ?? 0).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
