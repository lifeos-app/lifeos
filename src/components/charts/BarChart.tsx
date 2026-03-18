import { useState, useId, useRef, useCallback } from 'react';

export interface BarSeries {
  data: number[];
  color: string;
  label: string;
}

interface BarChartProps {
  series: BarSeries[];
  labels?: string[];
  height?: number;
  onBarTap?: (index: number, values: { label: string; value: number; color: string }[]) => void;
  onBarLongPress?: (index: number, position: { x: number; y: number }, values: { label: string; value: number; color: string }[]) => void;
  selectedIndex?: number | null;
  horizontal?: boolean;
  showValues?: boolean;
  stacked?: boolean;
  animated?: boolean;
  className?: string;
}

export function BarChart({
  series,
  labels = [],
  height = 140,
  onBarTap,
  onBarLongPress,
  selectedIndex,
  horizontal = false,
  showValues = false,
  stacked = false,
  animated = true,
  className = '',
}: BarChartProps) {
  const uid = useId().replace(/:/g, '');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const longPressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null }>({ timer: null });

  const numBars = Math.max(...series.map(s => s.data.length), 0);

  let maxVal: number;
  if (stacked) {
    maxVal = Math.max(
      ...Array.from({ length: numBars }, (_, i) =>
        series.reduce((sum, s) => sum + (s.data[i] ?? 0), 0)
      ),
      1
    );
  } else {
    maxVal = Math.max(...series.flatMap(s => s.data), 1);
  }

  const svgW = 400;
  const padL = 6;
  const padR = 6;
  const padT = showValues ? 20 : 8;
  const padB = labels.length ? 24 : 8;
  const chartW = svgW - padL - padR;
  const chartH = height - padT - padB;

  const groupGap = 4;
  const barGroupW = chartW / (numBars || 1);
  const barW = stacked
    ? barGroupW - groupGap * 2
    : (barGroupW - groupGap * 2 - (series.length - 1) * 3) / series.length;

  const getGroupX = (i: number) => padL + i * barGroupW;
  const getBarH = (v: number) => Math.max((v / maxVal) * chartH, 2);
  const getBarY = (v: number) => padT + chartH - getBarH(v);

  const activeIdx = selectedIndex ?? hoveredIndex;

  const startLongPress = useCallback((i: number, clientX: number, clientY: number) => {
    if (!onBarLongPress) return;
    longPressRef.current.timer = setTimeout(() => {
      onBarLongPress(i, { x: clientX, y: clientY }, series.map(s => ({ label: s.label, value: s.data[i] ?? 0, color: s.color })));
      longPressRef.current.timer = null;
    }, 500);
  }, [onBarLongPress, series]);

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current.timer) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
  }, []);

  if (horizontal) {
    const barH_h = Math.max(Math.floor((chartH - (numBars - 1) * 6) / numBars), 10);
    return (
      <div className={`bar-chart-wrapper ${className}`} style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${svgW} ${height}`} preserveAspectRatio="none" width="100%" height={height} style={{ overflow: 'visible' }}>
          <defs>
            {series.map((s, si) => (
              <linearGradient key={si} id={`hbar-grad-${uid}-${si}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.4" />
              </linearGradient>
            ))}
          </defs>
          {labels.map((lbl, i) => {
            const val = series[0]?.data[i] ?? 0;
            const barW_h = Math.max((val / maxVal) * (chartW - 80), 4);
            const y = padT + i * (barH_h + 6);
            const isActive = activeIdx === i;
            return (
              <g key={i}
                style={{ cursor: onBarTap || onBarLongPress ? 'pointer' : 'default' }}
                onClick={() => onBarTap?.(i, series.map(s => ({ label: s.label, value: s.data[i] ?? 0, color: s.color })))}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => { setHoveredIndex(null); cancelLongPress(); }}
                onMouseDown={(e) => startLongPress(i, e.clientX, e.clientY)}
                onMouseUp={cancelLongPress}
                onTouchStart={(e) => { const t = e.touches[0]; startLongPress(i, t.clientX, t.clientY); }}
                onTouchEnd={cancelLongPress}
              >
                <text x={padL} y={y + barH_h / 2 + 4} fill="rgba(255,255,255,0.55)" fontSize="9" fontFamily="var(--font-body)">
                  {lbl.length > 14 ? lbl.slice(0, 13) + '…' : lbl}
                </text>
                <rect
                  x={padL + 80} y={y} width={barW_h} height={barH_h} rx={4}
                  fill={isActive ? series[0]?.color : `url(#hbar-grad-${uid}-0)`}
                  style={{
                    filter: isActive ? `drop-shadow(0 0 6px ${series[0]?.color})` : 'none',
                    transition: 'filter 0.2s',
                  }}
                />
                <text
                  x={padL + 80 + barW_h + 6}
                  y={y + barH_h / 2 + 4}
                  fill={series[0]?.color}
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="var(--font-display)"
                >
                  ${val.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div className={`bar-chart-wrapper ${className}`} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${svgW} ${height}`} preserveAspectRatio="none" width="100%" height={height} style={{ overflow: 'visible' }}>
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`bar-grad-${uid}-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.4" />
            </linearGradient>
          ))}
          {series.map((s, si) => (
            <filter key={si} id={`bar-glow-${uid}-${si}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
              <feFlood floodColor={s.color} floodOpacity="0.5" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
        </defs>

        {/* Grid */}
        {[0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={padL} y1={padT + chartH * (1 - t)} x2={svgW - padR} y2={padT + chartH * (1 - t)}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}

        {/* Bars */}
        {Array.from({ length: numBars }, (_, i) => {
          const groupX = getGroupX(i);
          const isActive = activeIdx === i;
          let stackOffset = 0;

          return (
            <g key={i}
              style={{ cursor: onBarTap || onBarLongPress ? 'pointer' : 'default' }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => { setHoveredIndex(null); cancelLongPress(); }}
              onMouseDown={(e) => startLongPress(i, e.clientX, e.clientY)}
              onMouseUp={cancelLongPress}
              onTouchStart={(e) => { const t = e.touches[0]; startLongPress(i, t.clientX, t.clientY); }}
              onTouchEnd={cancelLongPress}
              onClick={() => onBarTap?.(i, series.map(s => ({ label: s.label, value: s.data[i] ?? 0, color: s.color })))}
            >
              {series.map((s, si) => {
                const val = s.data[i] ?? 0;
                const bH = getBarH(val);
                let bX: number, bY: number, bW: number;

                if (stacked) {
                  bX = groupX + groupGap;
                  bW = barGroupW - groupGap * 2;
                  bY = padT + chartH - stackOffset - bH;
                  stackOffset += bH;
                } else {
                  bX = groupX + groupGap + si * (barW + 3);
                  bW = barW;
                  bY = getBarY(val);
                }

                return (
                  <g key={si}>
                    <rect
                      x={bX} y={bY} width={Math.max(bW, 2)} height={bH} rx={3}
                      fill={isActive ? s.color : `url(#bar-grad-${uid}-${si})`}
                      style={{
                        filter: isActive ? `url(#bar-glow-${uid}-${si})` : 'none',
                        opacity: activeIdx !== null && !isActive ? 0.45 : 1,
                        transition: 'opacity 0.2s, filter 0.2s, transform 0.2s',
                        transformOrigin: `${bX + bW / 2}px ${padT + chartH}px`,
                        transform: isActive ? 'scaleY(1.02)' : 'scaleY(1)',
                      }}
                    />
                    {showValues && val > 0 && (
                      <text x={bX + bW / 2} y={bY - 4} textAnchor="middle"
                        fill={s.color} fontSize="8" fontWeight="700" fontFamily="var(--font-display)">
                        ${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Label */}
              {labels[i] && (
                <text x={groupX + barGroupW / 2} y={height - 4} textAnchor="middle"
                  fill={isActive ? '#fff' : 'rgba(255,255,255,0.35)'}
                  fontSize="9" fontFamily="var(--font-body)"
                  style={{ transition: 'fill 0.15s' }}
                >
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip for stacked bars */}
      {stacked && activeIdx !== null && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: `clamp(8px, ${((getGroupX(activeIdx) + barGroupW / 2) / svgW) * 100}%, calc(100% - 100px))`,
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
          {series.map((s, si) => {
            const val = s.data[activeIdx] ?? 0;
            if (val === 0) return null;
            return (
              <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{s.label}:</span>
                <span style={{ color: s.color, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                  ${val.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                </span>
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 3, paddingTop: 3, fontWeight: 600 }}>
            Total: ${series.reduce((s, ser) => s + (ser.data[activeIdx] ?? 0), 0).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
          </div>
        </div>
      )}
    </div>
  );
}
