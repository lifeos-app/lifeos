/**
 * Shimmer — Premium glass-loading overlay
 *
 * Renders a subtle glow sweep across skeleton containers.
 * Matches LifeOS dark glass-card aesthetic.
 * Pure CSS animation — no JS animation libraries.
 */

import './Shimmer.css';

export interface ShimmerProps {
  /** Wrapping class for the shimmer overlay */
  className?: string;
  /** Shimmer speed in seconds (default 2s) */
  duration?: number;
  /** Render as inline element instead of block overlay */
  inline?: boolean;
  children?: React.ReactNode;
}

export function Shimmer({
  className = '',
  duration = 2,
  inline = false,
  children,
}: ShimmerProps) {
  const style = { '--shimmer-duration': `${duration}s` } as React.CSSProperties;

  return (
    <div
      className={`sk-shimmer-wrap ${inline ? 'sk-shimmer-inline' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {/* Glow sweep layer */}
      <div className="sk-shimmer-sweep" />
      {/* Glass reflection pass */}
      <div className="sk-shimmer-glass" />
      {children}
    </div>
  );
}

export default Shimmer;