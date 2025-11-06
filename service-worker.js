// service-worker.js
// Combines: (1) your caching/offline logic AND (2) auto-injection of /role-auth.js
// Place this file in your Firebase hosting root (/public/service-worker.js)

const CACHE_NAME = 'site-static-v2';
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

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/admin-dashboard.html',
  '/offline.html',
  '/css/main.css',
  '/js/main.js'
];

// Helper functions
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

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const toCache = STATIC_ASSETS.filter(u => {
      const fname = getFilename(u);
      return !RESTRICTED_FILENAMES.includes(fname);
    });
    await cache.addAll(toCache);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const filename = getFilename(req.url);

  // Handle HTML pages (inject role-auth.js)
  if (req.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(req);
          let text = await response.text();
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
          // offline fallback
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match(OFFLINE_PAGE);
          return fallback || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
        }
      })()
    );
    return;
  }

  // Restricted pages: network-first (no caching)
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

  // Other assets: cache-first
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
