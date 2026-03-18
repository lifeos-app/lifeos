/**
 * PageTransition — Applies a subtle fade-in animation on route changes.
 * Uses CSS animations with prefers-reduced-motion support.
 */

import { useLocation } from 'react-router-dom';
import { useRef, useEffect, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function PageTransition({ children }: Props) {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPath.current && ref.current) {
      prevPath.current = location.pathname;

      // Use View Transitions API if available
      if ('startViewTransition' in document && typeof (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition === 'function') {
        (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
          ref.current?.classList.remove('page-transition-enter-active');
          void ref.current?.offsetHeight; // force reflow
          ref.current?.classList.add('page-transition-enter-active');
        });
      } else {
        // Fallback: CSS animation
        ref.current.classList.remove('page-transition-enter-active');
        void ref.current.offsetHeight; // force reflow
        ref.current.classList.add('page-transition-enter-active');
      }
    }
  }, [location.pathname]);

  return (
    <div ref={ref} className="page-transition-enter-active">
      {children}
    </div>
  );
}
