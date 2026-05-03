// ═══════════════════════════════════════════════════════
// 6M STRENGTH — SERVICE WORKER
// Caches the app for full offline use after first load
// ═══════════════════════════════════════════════════════

const CACHE_NAME = '6m-strength-v4';
const CACHE_VERSION = 4;

// Files to cache on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap'
];

// ── INSTALL ─────────────────────────────────────────────
// Cache all static assets when the SW is first installed
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache core files - fonts may fail in some environments, that's fine
      return cache.addAll(['./index.html', './manifest.json'])
        .then(() => {
          // Try to cache fonts separately (non-fatal if blocked)
          return cache.add('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap')
            .catch(() => {/* fonts unavailable offline — acceptable */});
        });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────
// Clean up old caches from previous versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────
// Strategy: Cache First for static assets, Network First for everything else
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) return;

  // For HTML and app files: Network First, cache as fallback
  if (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.json') ||
    url.pathname === '/' ||
    url.origin === self.location.origin
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback — serve from cache
          return caches.match(event.request).then(cached => cached || caches.match('./index.html'));
        })
    );
    return;
  }

  // For fonts and external resources: Cache First, no fallback
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (!response || response.status !== 200) return response;
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        }).catch(() => new Response('', {status: 408}));
      })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ── MESSAGES ─────────────────────────────────────────────
// Handle skip waiting message from the app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION, cacheName: CACHE_NAME });
  }
});

// ── BACKGROUND SYNC ──────────────────────────────────────
// Placeholder for future background sync if needed
self.addEventListener('sync', event => {
  if (event.tag === 'sync-workouts') {
    // Future: sync workout data to a backend
    console.log('[SW] Background sync triggered');
  }
});
