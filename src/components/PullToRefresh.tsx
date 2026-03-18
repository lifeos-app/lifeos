import { useState, useRef, useCallback, type ReactNode } from 'react';
import './PullToRefresh.css';
import { logger } from '../utils/logger';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  threshold?: number;
}

export function PullToRefresh({ onRefresh, children, threshold = 80 }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only allow pull when scrolled to top
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) {
      setPullDistance(0);
      return;
    }

    const deltaY = e.touches[0].clientY - startY.current;
    if (deltaY > 0) {
      // Apply resistance — gets harder to pull the further you go
      const resistance = Math.min(deltaY * 0.5, threshold * 1.5);
      setPullDistance(resistance);
    }
  }, [pulling, refreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);

    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(threshold); // Hold at threshold during refresh
      try {
        await onRefresh();
      } catch (e) {
        logger.error('[PullToRefresh] Error:', e);
      }
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pulling, pullDistance, threshold, refreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;

  return (
    <div
      ref={containerRef}
      className="ptr-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={`ptr-indicator ${refreshing ? 'refreshing' : ''}`}
        style={{
          height: pullDistance > 0 || refreshing ? Math.max(pullDistance, refreshing ? 48 : 0) : 0,
          opacity: progress > 0.1 || refreshing ? 1 : 0,
        }}
      >
        <div className="ptr-spinner" style={{ transform: `rotate(${rotation}deg)` }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="rgba(0,212,255,0.2)" strokeWidth="2.5" />
            <path
              d="M22 12c0-5.523-4.477-10-10-10"
              stroke="#00D4FF"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={refreshing ? 'ptr-spin-path' : ''}
            />
          </svg>
        </div>
        {!refreshing && progress >= 1 && (
          <span className="ptr-release-text">Release to refresh</span>
        )}
      </div>

      {children}
    </div>
  );
}
