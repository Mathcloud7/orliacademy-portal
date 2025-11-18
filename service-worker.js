/* service-worker.js
   Place at site root so it can control the whole site.
   It injects: <script type="module" src="/role-auth.module.js" defer></script>
*/

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const OFFLINE_HTML = '/offline.html';
const MODULE_SCRIPT_PATH = '/role-auth.module.js';

self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // cache offline fallback; if it doesn't exist on server, ignore error
    await cache.addAll([OFFLINE_HTML]).catch(() => {});
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    // remove old caches (keep current)
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// helper to inject module script tag into HTML string
function injectModuleIntoHtml(htmlText) {
  const injectTag = `<script type="module" src="${MODULE_SCRIPT_PATH}" defer></script>`;
  if (htmlText.includes(MODULE_SCRIPT_PATH) || htmlText.includes('window.__ROLE_AUTH')) return htmlText;
  if (htmlText.includes('</head>')) return htmlText.replace('</head>', injectTag + '\n</head>');
  if (htmlText.includes('</body>')) return htmlText.replace('</body>', injectTag + '\n</body>');
  return injectTag + '\n' + htmlText;
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  // only handle same-origin navigations for injection
  const url = new URL(req.url);

  // asset (cache-first) logic for static resources
  if (req.destination && ['script', 'style', 'image', 'font'].includes(req.destination) ||
      /\.(?:js|css|png|jpg|jpeg|svg|webp|gif|woff2?|ttf|eot)$/.test(url.pathname)) {
    ev.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fetched = await fetch(req);
        if (fetched && fetched.status === 200) cache.put(req, fetched.clone());
        return fetched;
      } catch (e) {
        return cached || fetch(req).catch(() => new Response(null, {status: 503}));
      }
    })());
    return;
  }

  // HTML navigation fetch -> network-first then inject module
  const accept = req.headers.get('accept') || '';
  const isNavigation = accept.includes('text/html');

  if (isNavigation && url.origin === location.origin) {
    ev.respondWith((async () => {
      try {
        const networkResp = await fetch(req);
        if (!networkResp || networkResp.status !== 200) {
          const cacheResp = await caches.match(req);
          if (cacheResp) return cacheResp;
          const fallback = await caches.match(OFFLINE_HTML);
          return fallback || networkResp;
        }

        const text = await networkResp.text();
        const injected = injectModuleIntoHtml(text);
        const headers = new Headers(networkResp.headers);
        // create response with injected body
        const newResp = new Response(injected, {
          status: networkResp.status,
          statusText: networkResp.statusText,
          headers
        });

        // Cache public HTML (non-protected pages) conservatively:
        // heuristic: do not cache pages whose path contains 'teacher' or 'student' or 'cbt' or 'admin' or 'year'
        const path = url.pathname.toLowerCase();
        const protectedKeywords = ['teacher', 'student', 'cbt', 'admin', 'year'];
        const isProtected = protectedKeywords.some(k => path.includes(k));
        if (!isProtected) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(req, newResp.clone()).catch(() => {});
        }

        return newResp;
      } catch (err) {
        // offline fallback
        const cached = await caches.match(req);
        if (cached) return cached;
        const fallback = await caches.match(OFFLINE_HTML);
        return fallback || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
      }
    })());
    return;
  }

  // default: network with cache fallback
  ev.respondWith((async () => {
    try {
      return await fetch(req);
    } catch (e) {
      return await caches.match(req) || new Response(null, {status: 503});
    }
  })());
});
