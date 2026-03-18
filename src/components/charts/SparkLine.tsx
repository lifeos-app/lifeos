interface SparkLineProps {
  data: number[];
  color?: string;
  width?: number | string;
  height?: number;
  filled?: boolean;
}

function cubicPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return pts.length === 1 ? `M ${pts[0].x} ${pts[0].y}` : '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpX = (prev.x + curr.x) / 2;
    d += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

export function SparkLine({ data, color = '#00D4FF', width = 80, height = 32, filled = false }: SparkLineProps) {
  if (!data || data.length === 0) return null;
  const maxV = Math.max(...data, 1);
  const minV = 0;
  const range = maxV - minV || 1;
  const pad = 2;
  const w = 100;
  const h = height;
  const pts = data.map((v, i) => ({
    x: pad + (data.length <= 1 ? (w - pad * 2) / 2 : (i / (data.length - 1)) * (w - pad * 2)),
    y: pad + (h - pad * 2) - ((v - minV) / range) * (h - pad * 2),
  }));
  const linePath = cubicPath(pts);
  const areaPath = filled && pts.length > 1
    ? `${linePath} L ${pts[pts.length - 1].x} ${h - pad} L ${pts[0].x} ${h - pad} Z`
    : '';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
      {filled && areaPath && (
        <path d={areaPath} fill={color} fillOpacity="0.15" />
      )}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {pts[pts.length - 1] && (
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={2.5} fill={color} />
      )}
    </svg>
  );
}
