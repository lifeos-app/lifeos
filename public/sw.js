// =================================================================
// LifeOS Service Worker
// Strategies:
//   - Stale-while-revalidate for static assets (JS, CSS, images, fonts)
//   - Network-first for API calls
//   - Offline fallback page for navigation requests
// =================================================================

const CACHE_VERSION = 'lifeos-v4';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const OFFLINE_PAGE = '/offline.html';

// -- Static asset patterns -----------------------------------------
const STATIC_EXTENSIONS = /\.(js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|webp|svg|ico|avif)(\?.*)?$/i;

// -- API patterns ---------------------------------------------------
const API_PATTERNS = [
  /\/rest\/v1\//,     // Supabase PostgREST
  /\/api\//,          // Local API
  /\/auth\//,         // Auth endpoints
  /\/realtime\//,     // Realtime (skip caching)
  /\/functions\//,    // Edge functions
];

function isApiRequest(url) {
  return API_PATTERNS.some(p => p.test(url.pathname));
}

function isRealtimeRequest(url) {
  return /\/realtime\//.test(url.pathname) || url.protocol === 'wss:';
}

function isStaticAsset(url) {
  return STATIC_EXTENSIONS.test(url.pathname);
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

// -- Install --------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Pre-cache the offline fallback page and app shell
      return cache.addAll([OFFLINE_PAGE, '/']).catch(() => {
        console.log('[SW] App shell pre-cache failed (may not exist in dev)');
      });
    })
  );
  // Activate immediately -- don't wait for old SW to stop
  self.skipWaiting();
});

// -- Activate -------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// -- Fetch -----------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip realtime/websocket requests
  if (isRealtimeRequest(url)) return;

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) return;

  // Strategy 1: Network-first for API calls
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  // Strategy 2: Stale-while-revalidate for static assets
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE));
    return;
  }

  // Strategy 3: Network-first with offline fallback for navigation
  if (isNavigationRequest(event.request)) {
    event.respondWith(navigationWithFallback(event.request));
    return;
  }

  // Everything else: network only (don't cache)
});

// -- Strategies ------------------------------------------------------

/**
 * Stale-while-revalidate: return cached version immediately,
 * then fetch fresh copy in background and update cache.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => {
      return cachedResponse;
    });

  return cachedResponse || fetchPromise;
}

/**
 * Network-first: try network, fall back to cache.
 * Caches successful API responses for offline use.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Cache successful API responses (but not auth tokens)
      const url = new URL(request.url);
      if (!url.pathname.includes('/auth/')) {
        cache.put(request, networkResponse.clone());
      }
    }

    return networkResponse;
  } catch (error) {
    // Network failed -- try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    // Nothing in cache either -- return error response
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'No cached data available' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Navigation with offline fallback: try network,
 * fall back to offline page.
 */
async function navigationWithFallback(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Try to serve offline page
    const cache = await caches.open(STATIC_CACHE);
    const offlinePage = await cache.match(OFFLINE_PAGE);
    if (offlinePage) return offlinePage;

    // Last resort: simple offline message (no emoji per design rules)
    return new Response(
      '<html><body style="background:#0a1628;color:#8BA4BE;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui"><div style="text-align:center"><h1 style="color:#E2E8F0">LifeOS</h1><p>You\'re offline. Check your connection and try again.</p></div></body></html>',
      {
        status: 503,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}

// -- Message handling ------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }

  if (event.data === 'REGISTER_SYNC') {
    // Background sync registration -- best effort
    if ('sync' in self.registration) {
      self.registration.sync.register('lifeos-data-sync').catch(() => {
        console.log('[SW] Background sync not supported');
      });
    }
  }
});

// -- Background Sync -------------------------------------------------
self.addEventListener('sync', (event) => {
  if (event.tag === 'lifeos-data-sync') {
    event.waitUntil(
      // Notify all clients that they should sync
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage('SYNC_NOW');
        });
      })
    );
  }
});