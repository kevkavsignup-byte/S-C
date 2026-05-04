// ═══════════════════════════════════════════════════════
// 6M STRENGTH — SERVICE WORKER (lean version)
// ═══════════════════════════════════════════════════════

const CACHE_NAME = '6m-strength-v10';

// Only cache the two files the app needs to run offline
const CORE_FILES = [
  './index.html',
  './manifest.json'
];

// ── INSTALL ─────────────────────────────────────────────
// Cache only core files — nothing else
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────
// Delete EVERY cache that is not the current one.
// This is what stops cache accumulation — old versions are always purged.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────
// Network first — always try to get the latest version.
// Fall back to cache only when genuinely offline.
// External requests (fonts, etc.) are not intercepted at all.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin requests entirely
  if(event.request.method !== 'GET') return;
  if(url.origin !== self.location.origin) return;

  // Only handle index.html and manifest.json
  const isCoreFile = url.pathname === '/'
    || url.pathname === ''
    || url.pathname.endsWith('/index.html')
    || url.pathname.endsWith('/manifest.json');

  if(!isCoreFile) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if(response && response.status === 200){
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request)
          .then(cached => cached || caches.match('./index.html'))
      )
  );
});

// ── MESSAGES ─────────────────────────────────────────────
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
