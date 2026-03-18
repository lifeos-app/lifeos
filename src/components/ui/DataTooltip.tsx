import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface DataTooltipData {
  value: number;
  label: string;
  date?: string;
  unit?: string;
  color?: string;
  previousValue?: number | null;
  weekAgoValue?: number | null;
  monthAgoValue?: number | null;
  /** For metrics where lower is better (e.g. weight loss) */
  lowerIsBetter?: boolean;
  /** Extra rows to show */
  extras?: { label: string; value: string; color?: string }[];
}

interface DataTooltipProps {
  data: DataTooltipData | null;
  position: { x: number; y: number } | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+∞' : '0';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function trendIcon(current: number, previous: number, lowerIsBetter = false) {
  const diff = current - previous;
  if (Math.abs(diff) < 0.001) return <Minus size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />;
  const isGood = lowerIsBetter ? diff < 0 : diff > 0;
  return isGood
    ? <TrendingUp size={12} style={{ color: '#39FF14' }} />
    : <TrendingDown size={12} style={{ color: '#F43F5E' }} />;
}

export function DataTooltip({ data, position, onDismiss, autoDismissMs = 4000 }: DataTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ left: string; top: string }>({ left: '0', top: '0' });

  useEffect(() => {
    if (!data || !position) return;
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [data, position, autoDismissMs, onDismiss]);

  // Dismiss on click outside
  useEffect(() => {
    if (!data) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('touchstart', handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [data, onDismiss]);

  // Adjust position to stay in viewport
  useEffect(() => {
    if (!position || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    let left = position.x;
    let top = position.y - 10;

    // Keep within horizontal bounds
    if (left + rect.width / 2 > vw - 12) left = vw - rect.width / 2 - 12;
    if (left - rect.width / 2 < 12) left = rect.width / 2 + 12;

    // If too close to top, show below
    if (top - rect.height < 12) top = position.y + 20;
    else top = top - rect.height;

    // Keep within vertical bounds
    if (top + rect.height > vh - 12) top = vh - rect.height - 12;
    if (top < 12) top = 12;

    setAdjustedPos({
      left: `${left}px`,
      top: `${top}px`,
    });
  }, [position, data]);

  if (!data || !position) return null;

  const trendColor = data.color || '#00D4FF';

  return (
    <div
      ref={ref}
      className="data-tooltip"
      style={{
        position: 'fixed',
        left: adjustedPos.left,
        top: adjustedPos.top,
        transform: 'translateX(-50%)',
        zIndex: 9999,
      }}
    >
      <div className="data-tooltip-header">
        <span className="data-tooltip-label">{data.label}</span>
        {data.date && <span className="data-tooltip-date">{data.date}</span>}
      </div>
      
      <div className="data-tooltip-value" style={{ color: trendColor }}>
        {typeof data.value === 'number' ? data.value.toLocaleString('en-AU', { maximumFractionDigits: 2 }) : data.value}
        {data.unit && <span className="data-tooltip-unit">{data.unit}</span>}
      </div>

      {data.previousValue != null && (
        <div className="data-tooltip-trend-row">
          {trendIcon(data.value, data.previousValue, data.lowerIsBetter)}
          <span className="data-tooltip-trend-label">vs prev</span>
          <span className="data-tooltip-trend-value">
            {pctChange(data.value, data.previousValue)}
          </span>
        </div>
      )}

      {data.weekAgoValue != null && (
        <div className="data-tooltip-trend-row">
          {trendIcon(data.value, data.weekAgoValue, data.lowerIsBetter)}
          <span className="data-tooltip-trend-label">vs 7d ago</span>
          <span className="data-tooltip-trend-value">
            {pctChange(data.value, data.weekAgoValue)}
          </span>
        </div>
      )}

      {data.monthAgoValue != null && (
        <div className="data-tooltip-trend-row">
          {trendIcon(data.value, data.monthAgoValue, data.lowerIsBetter)}
          <span className="data-tooltip-trend-label">vs 30d ago</span>
          <span className="data-tooltip-trend-value">
            {pctChange(data.value, data.monthAgoValue)}
          </span>
        </div>
      )}

      {data.extras?.map((extra, i) => (
        <div key={i} className="data-tooltip-extra-row">
          <span className="data-tooltip-extra-label">{extra.label}</span>
          <span className="data-tooltip-extra-value" style={extra.color ? { color: extra.color } : undefined}>{extra.value}</span>
        </div>
      ))}
    </div>
  );
}
