// LifeOS SW v100 — passthrough (caching disabled for stability)
// Immediately takes over from any old service worker, clears stale caches,
// and passes all requests straight to the network.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// No fetch handler = browser handles all requests normally.
// DO NOT add an empty fetch listener — Safari hangs on it.
