/**
 * Preload utilities for lazy-loaded pages.
 *
 * When the user hovers over a sidebar nav link, we trigger the dynamic
 * import early so the chunk is already cached when they click. This
 * gives instant navigation while keeping the initial bundle small.
 *
 * Usage:
 *   import { preloadPage } from '../utils/preload';
 *   <NavLink onMouseEnter={() => preloadPage('/goals')} ...>
 */

// Map of route paths to their import factories.
// Each factory returns the same Promise that React.lazy() would use internally.
// Calling the factory pre-loads the chunk into the browser's module cache.
const preloadFactories: Record<string, () => Promise<any>> = {};

// Track which routes have been preloaded to avoid duplicate imports
const preloaded = new Set<string>();

/**
 * Register a preload factory for a route.
 * Called from App.tsx when setting up lazy imports.
 */
export function registerPreload(route: string, factory: () => Promise<any>) {
  preloadFactories[route] = factory;
}

/**
 * Preload a page's chunk by route path.
 * Safe to call multiple times — duplicate calls are no-ops.
 * Returns the import promise, or undefined if no factory is registered.
 */
export function preloadPage(route: string): Promise<any> | undefined {
  if (preloaded.has(route)) return undefined;
  preloaded.add(route);

  const factory = preloadFactories[route];
  if (factory) {
    return factory().catch(() => {
      // Preload failures are non-critical — the actual navigation
      // will retry via React.lazy's own import
      preloaded.delete(route);
    });
  }
  return undefined;
}

/**
 * Preload all registered pages. Useful for warming the cache
 * after initial load on idle.
 */
export function preloadAllPages() {
  for (const route of Object.keys(preloadFactories)) {
    preloadPage(route);
  }
}