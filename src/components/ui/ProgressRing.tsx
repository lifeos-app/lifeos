/**
 * ProgressRing — Consolidated SVG progress ring component.
 *
 * Replaces 4 separate implementations:
 *   - components/ProgressRing.tsx (progress 0-1, animated)
 *   - components/charts/ProgressRing.tsx (value 0-100, auto-color)
 *   - EventDrawer inline ProgressRing (progress 0-100, glow)
 *   - VisionTree inline ProgressRing (pct 0-100, minimal)
 *
 * Accepts value 0-100 as canonical input. For 0-1 usage, use the
 * `progress01` prop instead.
 */

import { useEffect, useState, useId } from 'react';

interface ProgressRingProps {
  /** Progress value from 0 to 100 */
  value?: number;
  /** Progress value from 0 to 1 (convenience — takes precedence if set) */
  progress?: number;
  /** Outer diameter in px */
  size?: number;
  /** Ring stroke width */
  strokeWidth?: number;
  /** Ring color (auto-resolves if not set: green<75, yellow<90, red>=90) */
  color?: string;
  /** Track ring color */
  trackColor?: string;
  /** Label text below the percentage */
  label?: string;
  /** Sublabel text below the label */
  sublabel?: string;
  /** Custom center content (replaces default % + label) */
  centerContent?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Extra CSS class */
  className?: string;
  /** Force danger color */
  danger?: boolean;
  /** Force warning color */
  warning?: boolean;
  /** Enable glow filter */
  glow?: boolean;
  /** Animate on mount */
  animate?: boolean;
}

export function ProgressRing({
  value,
  progress,
  size = 80,
  strokeWidth = 8,
  color,
  trackColor = 'rgba(255,255,255,0.06)',
  label,
  sublabel,
  centerContent,
  onClick,
  className = '',
  danger,
  warning,
  glow = true,
  animate = true,
}: ProgressRingProps) {
  // Normalize: progress (0-1) takes precedence, else value (0-100)
  const rawPct = progress != null ? progress * 100 : (value ?? 0);
  const targetPct = Math.min(Math.max(rawPct, 0), 100);

  const [animatedPct, setAnimatedPct] = useState(animate ? 0 : targetPct);
  const uid = useId().replace(/:/g, '');

  useEffect(() => {
    if (!animate) {
      setAnimatedPct(targetPct);
      return;
    }
    const timer = setTimeout(() => setAnimatedPct(targetPct), 50);
    return () => clearTimeout(timer);
  }, [targetPct, animate]);

  // Auto color based on pct if not supplied
  const resolvedColor = color ?? (
    danger || animatedPct >= 90 ? '#F43F5E' :
    warning || animatedPct >= 75 ? '#FBBF24' :
    '#00D4FF'
  );

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - animatedPct / 100);

  return (
    <div
      className={`progress-ring-wrapper ${className}`}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {glow && (
          <defs>
            <filter id={`ring-glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
              <feFlood floodColor={resolvedColor} floodOpacity="0.5" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}

        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />

        {/* Progress arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{
            filter: glow ? `url(#ring-glow-${uid})` : undefined,
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </svg>

      {/* Center content */}
      <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
        {centerContent ?? (
          <>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: size >= 80 ? 14 : size >= 48 ? 11 : 9,
              fontWeight: 700,
              color: resolvedColor,
              lineHeight: 1,
            }}>
              {Math.round(animatedPct)}%
            </div>
            {label && (
              <div style={{
                fontSize: size >= 80 ? 8 : 7,
                color: 'rgba(255,255,255,0.45)',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginTop: 2,
                maxWidth: size - strokeWidth * 2 - 8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sublabel below ring */}
      {sublabel && (
        <div style={{
          position: 'absolute',
          bottom: -18,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 9,
          color: 'rgba(255,255,255,0.4)',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}
