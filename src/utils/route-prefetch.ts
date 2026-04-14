/**
 * route-prefetch.ts — Prefetch route chunks on link hover
 *
 * When a user hovers over a navigation link, we prefetch the
 * corresponding JS chunk so it's ready when they click.
 * This uses link[rel="modulepreload"] for modern browsers.
 */

// Map of route paths to their lazy chunk names (for prefetching)
const ROUTE_CHUNKS: Record<string, string[]> = {
  '/': ['Dashboard'],
  '/schedule': ['Schedule'],
  '/goals': ['Goals'],
  '/habits': ['Habits'],
  '/finances': ['Finances'],
  '/health': ['Health'],
  '/character': ['CharacterHub'],
  '/reflect': ['ReflectHub'],
  '/academy': ['Academy'],
  '/replicator': ['Replicator'],
  '/settings': ['Settings'],
  '/work': ['WorkPage'],
  '/social': ['SocialPage'],
};

const prefetched = new Set<string>();

/**
 * Prefetch a route's JS chunks. Call on link hover or focus.
 * Safe to call multiple times — only fetches once per route.
 */
export function prefetchRoute(path: string) {
  const chunks = ROUTE_CHUNKS[path];
  if (!chunks || prefetched.has(path)) return;
  prefetched.add(path);

  // Use requestIdleCallback to avoid competing with user interactions
  const schedule = typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 50);

  schedule(() => {
    // Find script tags in the document that match the chunk names
    // and add link[rel="modulepreload"] hints
    const scripts = document.querySelectorAll('script[type="module"]');
    scripts.forEach((script) => {
      const src = script.getAttribute('src') || '';
      // Check if this script's filename contains any of the chunk names
      for (const chunk of chunks) {
        if (src.includes(chunk)) {
          const link = document.createElement('link');
          link.rel = 'modulepreload';
          link.href = src;
          document.head.appendChild(link);
          break;
        }
      }
    });
  });
}

/**
 * Set up prefetching on all navigation links in the app.
 * Call once after app mounts.
 */
export function setupRoutePrefetching() {
  // Use event delegation on document body — works with SPA navigation
  document.body.addEventListener('mouseover', (e) => {
    const target = (e.target as HTMLElement).closest('a[href]');
    if (target) {
      const href = target.getAttribute('href');
      if (href && href.startsWith('/')) {
        prefetchRoute(href);
      }
    }
  }, { passive: true });

  // Also prefetch on focus (keyboard navigation)
  document.body.addEventListener('focusin', (e) => {
    const target = (e.target as HTMLElement).closest('a[href]');
    if (target) {
      const href = target.getAttribute('href');
      if (href && href.startsWith('/')) {
        prefetchRoute(href);
      }
    }
  }, { passive: true });
}