/**
 * Skeleton — Lightweight shimmer loading placeholder
 *
 * Uses the design-system.css skeleton classes for consistent look.
 * For page-level skeletons, see src/components/skeletons/.
 */

import './SkeletonLoader.css';

export interface SkeletonProps {
  /** Shape variant */
  variant?: 'text' | 'title' | 'card' | 'circle' | 'chart';
  /** CSS width (string or number for px) */
  width?: string | number;
  /** CSS height (string or number for px) */
  height?: string | number;
  /** Number of repeated elements */
  count?: number;
  /** Additional class names */
  className?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  count = 1,
  className = '',
}: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  const cls = variant === 'text' ? 'sk sk-text'
    : variant === 'title' ? 'sk sk-title'
    : variant === 'card' ? 'sk sk-card'
    : variant === 'circle' ? 'sk sk-circle'
    : variant === 'chart' ? 'sk sk-chart'
    : 'sk sk-text';

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`${cls} ${className}`}
          style={{ ...style, animationDelay: `${i * 80}ms` }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

export default Skeleton;
