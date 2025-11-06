// service-worker.js
const CACHE_NAME = 'site-static-v1';
const ASSETS_TO_CACHE = [
  '/', // fallback
  '/index.html',
  '/login.html',
  '/css/main.css',   // add your real CSS/JS paths here
  '/js/main.js'
  // Add other static assets you want to precache
];

// Install - pre-cache assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Activate - cleanup old caches
self.addEventListener('activate', event => {
  clients.claim();
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
});

// Helper: is navigation request (HTML page)
function isNavigationRequest(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'));
}

// Fetch handler
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET
  if (req.method !== 'GET') return;

  // Navigation requests (HTML pages) -> network-first
  if (isNavigationRequest(req)) {
    event.respondWith(
      fetch(req)
        .then(networkResponse => {
          // Optionally cache network HTML responses to serve when offline
          // but we keep this conservative (cache small number if you like)
          return caches.open(CACHE_NAME).then(cache => {
            try { cache.put(req, networkResponse.clone()); } catch(e) {}
            return networkResponse;
          });
        })
        .catch(() => {
          // If offline, try to return cached page
          return caches.match(req).then(cached => {
            if (cached) return cached;
            // fallback to index.html or root
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Static assets -> cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkResp => {
        // cache the asset for future (safe for images/css/js)
        return caches.open(CACHE_NAME).then(cache => {
          try { cache.put(req, networkResp.clone()); } catch (e) {}
          return networkResp;
        });
      }).catch(() => {
        // If nothing found and request is for an image, return a lightweight fallback
        if (req.destination === 'image') {
          return new Response('', { status: 404, statusText: 'offline' });
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
