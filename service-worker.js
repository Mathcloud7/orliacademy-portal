/* ============================================================
   service-worker.js — Rewritten (2025) — injects /role-auth.js
   - Safe caching (ignores non-http schemes)
   - Injects module script into HTML responses only once (now uses role-auth.js)
   - Cache-first for static assets; network-first for navigations
   - Does not cache protected pages (teacher/student/admin/cbt/year)
   - Place at site root so it can control the whole site
   ============================================================ */

const CACHE_VERSION = 'v2.1.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const OFFLINE_HTML = '/offline.html';
const INJECT_SCRIPT_PATH = '/role-auth.js'; // <- CHANGED: point to your real file

/* ---------------- INSTALL ---------------- */
self.addEventListener('install', (evt) => {
  evt.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.add(OFFLINE_HTML).catch(() => {});
    await self.skipWaiting();
  })());
});

/* ---------------- ACTIVATE ---------------- */
self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* ----------------- Utilities ----------------- */
function isHttpUrl(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}
function isHtmlResponse(resp) {
  try {
    const ct = resp.headers.get('content-type') || '';
    return ct.toLowerCase().includes('text/html');
  } catch { return false; }
}
function injectScriptIntoHtml(htmlText) {
  const injectTag = `<script src="${INJECT_SCRIPT_PATH}" defer></script>`;
  if (!htmlText || typeof htmlText !== 'string') return htmlText;
  if (htmlText.includes(INJECT_SCRIPT_PATH) || htmlText.includes('window.__ROLE_AUTH')) return htmlText;
  if (htmlText.includes('</head>')) return htmlText.replace('</head>', injectTag + '\n</head>');
  if (htmlText.includes('</body>')) return htmlText.replace('</body>', injectTag + '\n</body>');
  return injectTag + '\n' + htmlText;
}
function isProtectedPath(pathname) {
  const protectedKeywords = ['teacher', 'student', 'cbt', 'admin', 'year'];
  const p = pathname.toLowerCase();
  return protectedKeywords.some(k => p.includes(k));
}

/* ----------------- FETCH ----------------- */
self.addEventListener('fetch', (evt) => {
  const req = evt.request;

  // Only handle GET
  if (req.method !== 'GET') {
    evt.respondWith((async () => {
      try { return await fetch(req); }
      catch { return await caches.match(req) || new Response(null, { status: 503 }); }
    })());
    return;
  }

  // Parse URL (safe)
  let url;
  try { url = new URL(req.url); } catch {
    evt.respondWith(fetch(req).catch(() => caches.match(OFFLINE_HTML)));
    return;
  }

  // Ignore non-http(s) schemes to avoid cache.put errors
  const invalidProtocols = ['chrome-extension:', 'moz-extension:', 'file:', 'data:', 'about:', 'chrome:'];
  if (!isHttpUrl(url) || invalidProtocols.includes(url.protocol)) {
    evt.respondWith((async () => {
      try { return await fetch(req); }
      catch { return await caches.match(req) || new Response(null, { status: 503 }); }
    })());
    return;
  }

  const pathname = url.pathname;
  const staticAssetPattern = /\.(?:js|css|png|jpg|jpeg|svg|webp|gif|woff2?|ttf|eot|map)$/i;
  const isStaticAsset = (req.destination && ['script', 'style', 'image', 'font'].includes(req.destination)) || staticAssetPattern.test(pathname);

  if (isStaticAsset) {
    evt.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fetched = await fetch(req);
        if (fetched && fetched.status === 200 && isHttpUrl(new URL(fetched.url))) {
          try { await cache.put(req, fetched.clone()); } catch (e) { /* ignore caching errors */ }
        }
        return fetched;
      } catch {
        return cached || new Response(null, { status: 503 });
      }
    })());
    return;
  }

  const accepts = req.headers.get('accept') || '';
  const isNavigation = req.mode === 'navigate' || accepts.includes('text/html');

  if (isNavigation && url.origin === location.origin) {
    evt.respondWith((async () => {
      try {
        const networkResp = await fetch(req);

        if (networkResp && networkResp.ok && isHtmlResponse(networkResp)) {
          const text = await networkResp.text();
          const injectedText = injectScriptIntoHtml(text);

          const headers = new Headers(networkResp.headers);
          headers.set('Content-Type', 'text/html; charset=UTF-8');

          const newResp = new Response(injectedText, {
            status: networkResp.status,
            statusText: networkResp.statusText,
            headers
          });

          if (!isProtectedPath(pathname)) {
            try {
              const cache = await caches.open(STATIC_CACHE);
              await cache.put(req, newResp.clone()).catch(() => {});
            } catch {}
          }

          return newResp;
        }

        return networkResp;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        const offline = await caches.match(OFFLINE_HTML);
        if (offline) return offline;
        return new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><h1>Offline</h1>', {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' }
        });
      }
    })());
    return;
  }

  evt.respondWith((async () => {
    try { return await fetch(req); }
    catch { return await caches.match(req) || new Response(null, { status: 503 }); }
  })());
});
