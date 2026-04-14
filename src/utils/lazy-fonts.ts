/**
 * lazy-fonts.ts — Deferred font loading for performance
 *
 * Poppins (5 weights) and Orbitron (3 weights) are ~80KB of CSS + font files.
 * Loading them eagerly blocks initial render. Instead, we inject them
 * after the critical path renders, using link[rel=preload] for the
 * primary weight and dynamic import for the rest.
 */

let _fontsLoaded = false;

/**
 * Load non-critical fonts after initial render.
 * Uses requestIdleCallback (or setTimeout fallback) to avoid
 * competing with the main thread during hydration.
 */
export function loadDeferredFonts() {
  if (_fontsLoaded) return;
  _fontsLoaded = true;

  const schedule = typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 200);

  schedule(() => {
    // Dynamic import all font CSS — Vite will code-split these
    import('@fontsource/poppins/latin-300.css');
    import('@fontsource/poppins/latin-400.css');
    import('@fontsource/poppins/latin-500.css');
    import('@fontsource/poppins/latin-600.css');
    import('@fontsource/poppins/latin-700.css');
    import('@fontsource/orbitron/latin-400.css');
    import('@fontsource/orbitron/latin-700.css');
    import('@fontsource/orbitron/latin-900.css');
  });
}

/**
 * Preload just the critical font (Poppins 400) for FCP.
 * Call this in index.html or early in the app lifecycle.
 */
export function preloadCriticalFont() {
  // Poppins 400 is the primary body font — preload it
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'style';
  link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400&display=swap';
  link.onload = function() {
    (link as HTMLLinkElement).rel = 'stylesheet';
  };
  document.head.appendChild(link);
}