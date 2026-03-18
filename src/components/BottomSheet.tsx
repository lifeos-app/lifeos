/**
 * BottomSheet — Reusable slide-up modal component.
 * 
 * Features:
 * - Slides up from bottom with spring animation
 * - Backdrop blur/dim
 * - Drag to dismiss
 * - Mobile-first (full width on mobile, centered card on desktop)
 * - Focus trapping for accessibility
 * - Escape to close
 */

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './BottomSheet.css';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  /** Max height as vh percentage (default 85) */
  maxHeight?: number;
  /** aria-label for the sheet if no title */
  ariaLabel?: string;
}

export function BottomSheet({ open, onClose, title, icon, children, maxHeight = 85, ariaLabel }: BottomSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);

  // Open animation
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      setAnimating(false);
      const timer = setTimeout(() => {
        setVisible(false);
        document.body.style.overflow = '';
        // Restore focus to previously focused element
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Focus the sheet when it opens
  useEffect(() => {
    if (open && animating && sheetRef.current) {
      // Focus the close button or the sheet itself
      const closeBtn = sheetRef.current.querySelector<HTMLElement>('.bs-close');
      if (closeBtn) {
        closeBtn.focus();
      } else {
        sheetRef.current.focus();
      }
    }
  }, [open, animating]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Focus trap
  useEffect(() => {
    if (!open || !sheetRef.current) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = sheetRef.current!.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Drag to dismiss
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) {
      dragCurrentY.current = dy;
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${dy}px)`;
        sheetRef.current.style.transition = 'none';
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragCurrentY.current > 100) {
      onClose();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = '';
      sheetRef.current.style.transition = '';
    }
    dragStartY.current = null;
    dragCurrentY.current = 0;
  }, [onClose]);

  if (!visible) return null;

  return (
    <div
      className={`bs-overlay ${animating ? 'bs-overlay-visible' : ''}`}
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        ref={sheetRef}
        className={`bs-sheet ${animating ? 'bs-sheet-visible' : ''}`}
        style={{ maxHeight: `${maxHeight}vh` }}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-label={title || ariaLabel || 'Bottom sheet'}
        tabIndex={-1}
      >
        <div className="bs-handle-area" aria-hidden="true">
          <div className="bs-handle" />
        </div>
        {title && (
          <div className="bs-header">
            <div className="bs-title">
              {icon && <span className="bs-title-icon" aria-hidden="true">{icon}</span>}
              <h3>{title}</h3>
            </div>
            <button className="bs-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
        )}
        <div className="bs-body">
          {children}
        </div>
      </div>
    </div>
  );
}
