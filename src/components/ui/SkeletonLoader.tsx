/**
 * SkeletonLoader — Shared skeleton loading primitives
 *
 * Animated shimmer effect with dark theme variants.
 * Pure CSS animation — no external libraries.
 */

import './SkeletonLoader.css';

export interface SkeletonLoaderProps {
  variant?: 'text' | 'title' | 'card' | 'circle' | 'chart' | 'list';
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
}

export function SkeletonLoader({
  variant = 'text',
  width,
  height,
  count = 1,
  className = '',
}: SkeletonLoaderProps) {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'circle') {
    return (
      <>
        {items.map(i => (
          <div
            key={i}
            className={`sk sk-circle ${className}`}
            style={{ ...style, animationDelay: `${i * 100}ms` }}
          />
        ))}
      </>
    );
  }

  if (variant === 'title') {
    return (
      <>
        {items.map(i => (
          <div
            key={i}
            className={`sk sk-title ${className}`}
            style={{ ...style, animationDelay: `${i * 100}ms` }}
          />
        ))}
      </>
    );
  }

  if (variant === 'card') {
    return (
      <>
        {items.map(i => (
          <div
            key={i}
            className={`sk sk-card ${className}`}
            style={{ ...style, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </>
    );
  }

  if (variant === 'chart') {
    return (
      <>
        {items.map(i => (
          <div
            key={i}
            className={`sk sk-chart ${className}`}
            style={{ ...style, animationDelay: `${i * 100}ms` }}
          />
        ))}
      </>
    );
  }

  if (variant === 'list') {
    const lineCount = count;
    return (
      <div className={`sk-list-wrap ${className}`}>
        {Array.from({ length: lineCount }, (_, i) => (
          <div
            key={i}
            className="sk sk-list-line"
            style={{
              width: `${65 + Math.sin(i * 1.8) * 25}%`,
              animationDelay: `${i * 60}ms`,
            }}
          />
        ))}
      </div>
    );
  }

  // Default: text
  return (
    <>
      {items.map(i => (
        <div
          key={i}
          className={`sk sk-text ${className}`}
          style={{ ...style, animationDelay: `${i * 60}ms` }}
        />
      ))}
    </>
  );
}

export default SkeletonLoader;
