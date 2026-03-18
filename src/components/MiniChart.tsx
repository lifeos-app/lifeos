import { useState } from 'react';
import './MiniChart.css';

interface MiniChartProps {
  data: number[];
  color?: string;
  height?: number;
  labels?: string[];
  title?: string;
}

export function MiniChart({
  data,
  color = '#00D4FF',
  height = 80,
  labels = [],
  title,
}: MiniChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Take last 7 data points
  const displayData = data.slice(-7);
  const displayLabels = labels.slice(-7);
  const maxVal = Math.max(...displayData, 1);
  const barCount = displayData.length || 1;
  const padding = 4;
  const chartWidth = 200;
  const barGap = 6;
  const barWidth = (chartWidth - padding * 2 - barGap * (barCount - 1)) / barCount;
  const chartHeight = height;

  return (
    <div className="mini-chart-wrapper">
      {title && <span className="mini-chart-title">{title}</span>}
      <div className="mini-chart-container" style={{ height: chartHeight }}>
        <svg
          className="mini-chart-svg"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          width="100%"
          height={chartHeight}
        >
          <defs>
            <linearGradient id={`bar-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={color} stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {displayData.map((val, i) => {
            const barH = (val / maxVal) * (chartHeight - 20);
            const x = padding + i * (barWidth + barGap);
            const y = chartHeight - barH - 2;
            const isHovered = hoverIndex === i;
            return (
              <g key={i}>
                <rect
                  className="mini-chart-bar"
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barH, 2)}
                  rx={3}
                  fill={isHovered ? color : `url(#bar-grad-${color.replace('#', '')})`}
                  opacity={isHovered ? 1 : 0.8}
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                  style={{
                    filter: isHovered ? `drop-shadow(0 0 6px ${color})` : 'none',
                  }}
                />
                {/* Value on hover */}
                {isHovered && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    className="mini-chart-tooltip-text"
                    fill={color}
                    fontSize="10"
                    fontFamily="var(--font-display)"
                    fontWeight="700"
                  >
                    {val}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {/* Labels */}
        {displayLabels.length > 0 && (
          <div className="mini-chart-labels">
            {displayLabels.map((lbl, i) => (
              <span
                key={i}
                className={`mini-chart-label ${hoverIndex === i ? 'active' : ''}`}
                style={{ width: barWidth, marginRight: i < displayLabels.length - 1 ? barGap : 0 }}
              >
                {lbl}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* Tooltip popup */}
      {hoverIndex !== null && displayLabels[hoverIndex] && (
        <div className="mini-chart-tooltip" style={{ '--mc-color': color } as React.CSSProperties}>
          <span className="mini-chart-tooltip-label">{displayLabels[hoverIndex]}</span>
          <span className="mini-chart-tooltip-val">{displayData[hoverIndex]}</span>
        </div>
      )}
    </div>
  );
}
