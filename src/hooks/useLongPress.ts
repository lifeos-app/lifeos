import { useRef, useCallback } from 'react';

interface LongPressResult {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * Reusable long-press hook.
 * @param callback  — receives { x, y } position of the press point
 * @param ms        — long-press duration threshold (default 500ms)
 */
export function useLongPress(
  callback: (pos?: { x: number; y: number }) => void,
  ms = 500,
): LongPressResult {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const start = useCallback(
    (x: number, y: number) => {
      startPos.current = { x, y };
      fired.current = false;
      timer.current = setTimeout(() => {
        fired.current = true;
        callback({ x, y });
        timer.current = null;
      }, ms);
    },
    [callback, ms],
  );

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    startPos.current = null;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      start(t.clientX, t.clientY);
    },
    [start],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startPos.current || !timer.current) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - startPos.current.x);
      const dy = Math.abs(t.clientY - startPos.current.y);
      if (dx > 10 || dy > 10) cancel();
    },
    [cancel],
  );

  const onTouchEnd = useCallback(() => cancel(), [cancel]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      start(e.clientX, e.clientY);
    },
    [start],
  );

  const onMouseUp = useCallback(() => cancel(), [cancel]);
  const onMouseLeave = useCallback(() => cancel(), [cancel]);

  // Right-click triggers immediately (desktop)
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      cancel();
      callback({ x: e.clientX, y: e.clientY });
    },
    [callback, cancel],
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onContextMenu,
  };
}
