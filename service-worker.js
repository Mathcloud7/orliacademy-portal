// service-worker.js
// Combines: (1) caching/offline logic AND (2) auto-injection of /role-auth.js
// Place this file in your Firebase hosting root (/public/service-worker.js)

const CACHE_NAME = 'site-static-v3';
const OFFLINE_PAGE = '/offline.html';

// Restricted filenames (avoid caching them)
const RESTRICTED_FILENAMES = [
  "teacher-dashboard.html",
  "year5-t.html",
  "year5-first-term-teacher-dashboard.html",
  "year5-second-term-teacher-dashboard.html",
  "year5-third-term-teacher-dashboard.html",
  "ear5-first-term-assessment.html",
  "year5-first-term-lesson-teacher.html",
  "year5-first-term-lesson-upload.html",
  "year5-first-term-lesson-view.html",
  "ear5-second-term-assessment.html",
  "year5-second-term-lesson-teacher.html",
  "year5-second-term-lesson-upload.html",
  "year5-second-term-lesson-view.html",
  "ear5-third-term-assessment.html",
  "year5-third-term-lesson-teacher.html",
  "year5-third-term-lesson-upload.html",
  "year5-third-term-lesson-view.html",
  "y5-cbt-teacher.html",
  "year5-first-term-theory.html",
  "year5-second-term-theory.html",
  "year5-third-term-theory.html",
  "y5-cbt-result.html",
  "student-dashboard.html",
  "year5-s.html",
  "year5-first-term-student-dashboard.html",
  "year5-second-term-student-dashboard.html",
  "year5-third-term-student-dashboard.html",
  "y5-cbt-student.html",
  "year5-first-term-theory-view.html",
  "year5-first-term-lesson-view.html",
  "year5-second-term-theory-view.html",
  "year5-second-term-lesson-view.html",
  "year5-third-term-theory-view.html",
  "year5-third-term-lesson-view.html"
];

// Public assets to cache safely
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/admin-dashboard.html',
  '/offline.html',
  '/css/main.css',
  '/js/main.js'
];

// Helper function to get filename from URL
function getFilename(url) {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/');
    let last = segs.pop() || segs.pop();
    return (last || 'index.html').toLowerCase();
  } catch {
    return '';
  }
}

// --- INSTALL EVENT (safe caching) ---
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const toCache = STATIC_ASSETS.filter(u => {
      const fname = getFilename(u);
      return !RESTRICTED_FILENAMES.includes(fname);
    });

    for (const url of toCache) {
      try {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch (err) {
        console.warn('⚠️ SW: Skipping missing asset', url);
      }
    }

    self.skipWaiting();
  })());
});

// --- ACTIVATE EVENT (clean old caches) ---
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)));
    self.clients.claim();
  })());
});

// --- FETCH EVENT (main logic) ---
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const filename = getFilename(req.url);

  // Handle HTML pages (inject role-auth.js automatically)
  if (req.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(req);
          let text = await response.text();

          // Inject /role-auth.js if not already present
          if (!/\/role-auth\.js/i.test(text)) {
            text = text.replace(/<\/body>/i, `<script type="module" src="/role-auth.js"></script></body>`);
          }

          return new Response(text, {
            headers: response.headers,
            status: response.status,
            statusText: response.statusText,
          });
        } catch (err) {
          console.error("SW injection fetch error:", err);
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match(OFFLINE_PAGE);
          return fallback || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
        }
      })()
    );
    return;
  }

  // Restricted pages: network-first, no caching
  if (RESTRICTED_FILENAMES.includes(filename) || /year\d|^y\d/i.test(filename)) {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const fallback = await cache.match(OFFLINE_PAGE);
        return fallback || new Response('<h1>Offline</h1><p>Please reconnect.</p>', {
          headers: { 'Content-Type': 'text/html' }
        });
      })
    );
    return;
  }

  // All other assets: cache-first strategy
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(async (networkRes) => {
        const cache = await caches.open(CACHE_NAME);
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          cache.put(req, networkRes.clone());
        }
        return networkRes;
      }).catch(async () => {
        if (req.mode === 'navigate') {
          const cache = await caches.open(CACHE_NAME);
          const offline = await cache.match(OFFLINE_PAGE);
          return offline || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
        }
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
