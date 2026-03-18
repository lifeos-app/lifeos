import { useState } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles,
  Frown, Meh, Smile, SmilePlus,
} from 'lucide-react';
import { useLongPress } from '../../hooks/useLongPress';
import type { BodyMarker } from './types';

// ── Mood Icon Elements (shared across tabs) ──
export const MOOD_ICONS_EL = [
  <Frown size={18} strokeWidth={2} />,
  <Frown size={18} strokeWidth={2} />,
  <Meh size={18} strokeWidth={2} />,
  <Smile size={18} strokeWidth={2} />,
  <SmilePlus size={18} strokeWidth={2} />,
];

// ── SVG Body Map ──
export function BodyMapSVG({ markers, onPartClick }: { markers: BodyMarker[]; onPartClick: (part: string) => void }) {
  const getPartColor = (part: string) => {
    const partMarkers = markers.filter(m => m.body_part === part && !m.resolved);
    if (partMarkers.length === 0) return 'rgba(0, 212, 255, 0.08)';
    const maxSeverity = Math.max(...partMarkers.map(m => m.severity));
    const colors: Record<number, string> = { 1: '#74B9FF44', 2: '#FDCB6E66', 3: '#F9731688', 4: '#F43F5EAA', 5: '#EF4444CC' };
    return colors[maxSeverity] || 'rgba(0, 212, 255, 0.08)';
  };

  const getPulse = (part: string) => {
    return markers.some(m => m.body_part === part && !m.resolved && m.severity >= 4);
  };

  const parts = [
    { id: 'head', label: 'Head', cx: 100, cy: 28, rx: 18, ry: 20 },
    { id: 'neck', label: 'Neck', cx: 100, cy: 55, rx: 8, ry: 6 },
    { id: 'left_shoulder', label: 'L Shoulder', cx: 68, cy: 75, rx: 14, ry: 10 },
    { id: 'right_shoulder', label: 'R Shoulder', cx: 132, cy: 75, rx: 14, ry: 10 },
    { id: 'chest', label: 'Chest', cx: 100, cy: 90, rx: 24, ry: 14 },
    { id: 'upper_back', label: 'Upper Back', cx: 100, cy: 80, rx: 20, ry: 8 },
    { id: 'left_arm', label: 'L Arm', cx: 48, cy: 115, rx: 8, ry: 25 },
    { id: 'right_arm', label: 'R Arm', cx: 152, cy: 115, rx: 8, ry: 25 },
    { id: 'abdomen', label: 'Abdomen', cx: 100, cy: 120, rx: 20, ry: 16 },
    { id: 'lower_back', label: 'Lower Back', cx: 100, cy: 135, rx: 18, ry: 10 },
    { id: 'left_hip', label: 'L Hip', cx: 80, cy: 155, rx: 12, ry: 10 },
    { id: 'right_hip', label: 'R Hip', cx: 120, cy: 155, rx: 12, ry: 10 },
    { id: 'left_leg', label: 'L Leg', cx: 82, cy: 200, rx: 10, ry: 30 },
    { id: 'right_leg', label: 'R Leg', cx: 118, cy: 200, rx: 10, ry: 30 },
    { id: 'left_knee', label: 'L Knee', cx: 82, cy: 235, rx: 9, ry: 8 },
    { id: 'right_knee', label: 'R Knee', cx: 118, cy: 235, rx: 9, ry: 8 },
    { id: 'left_foot', label: 'L Foot', cx: 80, cy: 280, rx: 10, ry: 8 },
    { id: 'right_foot', label: 'R Foot', cx: 120, cy: 280, rx: 10, ry: 8 },
  ];

  return (
    <div className="body-map-svg-wrapper">
      <svg viewBox="0 0 200 300" className="body-map-svg">
        <path d="M100 8 C115 8 118 20 118 28 C118 40 112 48 100 52 C88 48 82 40 82 28 C82 20 85 8 100 8Z"
          fill="rgba(0,212,255,0.04)" stroke="rgba(0,212,255,0.15)" strokeWidth="0.5" />
        <path d="M82 55 L68 65 L50 70 L40 90 L38 140 L50 142 L56 130 L64 150 L68 155 L74 148 L78 165 L72 250 L70 280 L72 290 L90 292 L92 282 L90 245 L95 180 L100 170 L105 180 L110 245 L108 282 L110 292 L128 290 L130 280 L128 250 L122 165 L126 148 L132 155 L136 150 L144 130 L150 142 L162 140 L160 90 L150 70 L132 65 L118 55 Z"
          fill="rgba(0,212,255,0.03)" stroke="rgba(0,212,255,0.12)" strokeWidth="0.5" />
        {parts.map(part => (
          <g key={part.id} onClick={() => onPartClick(part.id)} className={`body-zone ${getPulse(part.id) ? 'pulse' : ''}`}>
            <ellipse cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry}
              fill={getPartColor(part.id)}
              stroke={markers.some(m => m.body_part === part.id && !m.resolved) ? 'rgba(244, 63, 94, 0.6)' : 'rgba(0, 212, 255, 0.15)'}
              strokeWidth="0.8" className="body-zone-ellipse" />
            <text x={part.cx} y={part.cy + 1} textAnchor="middle" dominantBaseline="middle"
              className="body-zone-label" fontSize="5" fill="rgba(255,255,255,0.4)">
              {part.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Breathing Circle (Meditation) ──
export function BreathingCircle({ active }: { active: boolean }) {
  return (
    <div className={`breathing-circle ${active ? 'active' : ''}`}>
      <div className="breathing-ring breathing-ring-outer" />
      <div className="breathing-ring breathing-ring-middle" />
      <div className="breathing-ring breathing-ring-inner" />
      <div className="breathing-core" />
    </div>
  );
}

// ── Date Picker ──
export function DatePicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const shiftDay = (delta: number) => {
    const d = new Date(value + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    onChange(d.toISOString().split('T')[0]);
  };
  const isToday = value === new Date().toISOString().split('T')[0];
  const label = isToday ? 'Today' : new Date(value + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="date-picker-inline">
      <button className="dp-arrow" onClick={() => shiftDay(-1)} aria-label="Previous day"><ChevronLeft size={16} /></button>
      <div className="dp-label-wrap">
        <CalendarIcon size={13} />
        <input type="date" value={value} onChange={e => onChange(e.target.value)} className="dp-hidden-input" />
        <span className="dp-label">{label}</span>
      </div>
      <button className="dp-arrow" onClick={() => shiftDay(1)} aria-label="Next day"><ChevronRight size={16} /></button>
    </div>
  );
}

// ── Insights Banner ──
export function InsightsBanner({ insights }: { insights: { text: string; type: 'positive' | 'warning' | 'insight' }[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? insights : insights.slice(0, 1);
  if (insights.length === 0) return null;
  return (
    <div className="insights-banner">
      <div className="ib-header">
        <Sparkles size={13} className="ib-icon" />
        <span className="ib-title">Insights</span>
        {insights.length > 1 && (
          <button className="ib-toggle" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Less' : `+${insights.length - 1} more`}
          </button>
        )}
      </div>
      {visible.map((insight, i) => (
        <div key={i} className={`ib-item ${insight.type}`}>
          <span className="ib-dot" />
          <span className="ib-text">{insight.text}</span>
        </div>
      ))}
    </div>
  );
}

// ── Domain snap card with long-press ──
export function SnapCard({ className, style, onClick, children }: {
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const lp = useLongPress(onClick || (() => {}), 400);
  return (
    <div {...lp} className={className} style={style} onClick={onClick}>
      {children}
    </div>
  );
}
