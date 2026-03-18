import { useState, useRef, useCallback, type ReactNode } from 'react';
import './SwipeActions.css';

interface SwipeAction {
  label: string;
  icon?: ReactNode;
  color: string;
  onClick: () => void;
}

interface SwipeActionsProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  threshold?: number;
}

export function SwipeActions({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 70,
}: SwipeActionsProps) {
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;

    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Determine direction on first significant movement
    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontal.current) return;

    // Limit swipe to available actions
    let newOffset = dx;
    if (dx > 0 && leftActions.length === 0) newOffset = 0;
    if (dx < 0 && rightActions.length === 0) newOffset = 0;

    // Apply resistance past threshold
    const maxSwipe = threshold * 1.5;
    if (Math.abs(newOffset) > threshold) {
      const extra = Math.abs(newOffset) - threshold;
      newOffset = Math.sign(newOffset) * (threshold + extra * 0.3);
    }
    newOffset = Math.max(-maxSwipe, Math.min(maxSwipe, newOffset));

    setOffset(newOffset);
  }, [swiping, leftActions.length, rightActions.length, threshold]);

  const handleTouchEnd = useCallback(() => {
    setSwiping(false);
    isHorizontal.current = null;

    if (Math.abs(offset) >= threshold) {
      // Trigger the action
      if (offset > 0 && leftActions.length > 0) {
        leftActions[0].onClick();
      } else if (offset < 0 && rightActions.length > 0) {
        rightActions[0].onClick();
      }
    }

    // Spring back
    setOffset(0);
  }, [offset, threshold, leftActions, rightActions]);

  const absOffset = Math.abs(offset);
  const actionProgress = Math.min(absOffset / threshold, 1);

  return (
    <div className="swipe-container">
      {/* Left action (swipe right to reveal) */}
      {leftActions.length > 0 && offset > 0 && (
        <div
          className={`swipe-action swipe-left ${actionProgress >= 1 ? 'ready' : ''}`}
          style={{
            width: absOffset,
            background: leftActions[0].color,
            opacity: actionProgress,
          }}
        >
          <div className="swipe-action-content" style={{ transform: `scale(${0.5 + actionProgress * 0.5})` }}>
            {leftActions[0].icon}
            {actionProgress >= 0.6 && <span>{leftActions[0].label}</span>}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        ref={contentRef}
        className={`swipe-content ${swiping ? '' : 'swipe-spring'}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>

      {/* Right action (swipe left to reveal) */}
      {rightActions.length > 0 && offset < 0 && (
        <div
          className={`swipe-action swipe-right ${actionProgress >= 1 ? 'ready' : ''}`}
          style={{
            width: absOffset,
            background: rightActions[0].color,
            opacity: actionProgress,
          }}
        >
          <div className="swipe-action-content" style={{ transform: `scale(${0.5 + actionProgress * 0.5})` }}>
            {rightActions[0].icon}
            {actionProgress >= 0.6 && <span>{rightActions[0].label}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
