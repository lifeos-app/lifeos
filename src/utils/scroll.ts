/**
 * Cross-browser scroll utilities with Safari compatibility
 */

/**
 * Safely scroll element into view with smooth behavior fallback.
 * Safari < 15.4 doesn't support smooth scrollIntoView options.
 */
export function safeScrollIntoView(
  element: HTMLElement | null,
  options?: ScrollIntoViewOptions
): void {
  if (!element) return;
  
  try {
    // Check if smooth scroll is supported
    if (options?.behavior === 'smooth' && !('scrollBehavior' in document.documentElement.style)) {
      // Fallback for older Safari — use instant scroll with block/inline position
      element.scrollIntoView({
        ...options,
        behavior: 'auto',
      });
    } else {
      element.scrollIntoView(options);
    }
  } catch {
    // Last resort — basic scrollIntoView (boolean variant is universally supported)
    try {
      element.scrollIntoView(options?.block === 'end' ? false : true);
    } catch {
      // Some edge cases with detached elements
    }
  }
}

/**
 * Safely scroll a container to a position with smooth behavior fallback.
 */
export function safeScrollTo(
  element: HTMLElement | Window | null,
  options: ScrollToOptions
): void {
  if (!element) return;
  
  try {
    if (options.behavior === 'smooth' && !('scrollBehavior' in document.documentElement.style)) {
      // Fallback: instant scroll
      if (element === window) {
        window.scrollTo(options.left ?? 0, options.top ?? 0);
      } else {
        (element as HTMLElement).scrollTop = options.top ?? 0;
        (element as HTMLElement).scrollLeft = options.left ?? 0;
      }
    } else {
      element.scrollTo(options);
    }
  } catch {
    // Fallback
    if (element !== window) {
      (element as HTMLElement).scrollTop = options.top ?? 0;
    }
  }
}
