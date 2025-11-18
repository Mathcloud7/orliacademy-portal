/* ============================================================
   service-worker.js — Rewritten (2025)
   - Safe caching (ignores non-http schemes)
   - Injects module script into HTML responses only once
   - Cache-first for static assets; network-first for navigations
   - Does not cache protected pages (teacher/student/admin/cbt/year)
   - Place at site root so it can control the whole site
   ============================================================ */

const CACHE_VERSION = 'v2.1.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const OFFLINE_HTML = '/offline.html';
const MODULE_SCRIPT_PATH = '/role-auth.module.js'; // ensure this file exists at site root

/* ---------------- INSTALL ---------------- */
self.addEventListener('install', (evt) => {
  evt.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // attempt to cache offline fallback (ignore if unavailable)
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

// Only consider HTTP and HTTPS requests for caching & injection
function isHttpUrl(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

// Check if a response is HTML (content-type header)
function isHtmlResponse(resp) {
  try {
    const ct = resp.headers.get('content-type') || '';
    return ct.toLowerCase().includes('text/html');
  } catch {
    return false;
  }
}

// Inject the module script tag into an HTML string once (idempotent)
function injectModuleIntoHtml(htmlText) {
  const injectTag = `<script type="module" src="${MODULE_SCRIPT_PATH}" defer></script>`;
  if (!htmlText || typeof htmlText !== 'string') return htmlText;
  // don't inject if module already present or role auth already present in page
  if (htmlText.includes(MODULE_SCRIPT_PATH) || htmlText.includes('window.__ROLE_AUTH')) return htmlText;

  if (htmlText.includes('</head>')) {
    return htmlText.replace('</head>', injectTag + '\n</head>');
  }
  if (htmlText.includes('</body>')) {
    return htmlText.replace('</body>', injectTag + '\n</body>');
  }
  // fallback: prepend
  return injectTag + '\n' + htmlText;
}

// Determine if a path should be considered "protected" (do not cache)
function isProtectedPath(pathname) {
  const protectedKeywords = ['teacher', 'student', 'cbt', 'admin', 'year'];
  const p = pathname.toLowerCase();
  return protectedKeywords.some(k => p.includes(k));
}

/* ----------------- FETCH ----------------- */
self.addEventListener('fetch', (evt) => {
  const req = evt.request;

  // Quick ignore: non-GET requests we usually don't want to serve from cache
  if (req.method !== 'GET') {
    // Let non-GET pass through network (but still catch failures)
    evt.respondWith((async () => {
      try { return await fetch(req); }
      catch { return await caches.match(req) || new Response(null, { status: 503 }); }
    })());
    return;
  }

  // Ignore requests from non-http(s) schemes early to avoid cache.put errors
  let url;
  try {
    url = new URL(req.url);
  } catch {
    // If URL parsing fails, fall back to network
    evt.respondWith(fetch(req).catch(() => caches.match(OFFLINE_HTML)));
    return;
  }

  // ignore extension, browser, data, file, about protocols entirely
  const invalidProtocols = ['chrome-extension:', 'moz-extension:', 'file:', 'data:', 'about:', 'chrome:'];
  if (!isHttpUrl(url) || invalidProtocols.includes(url.protocol)) {
    // Pass-through (network) — do not attempt to cache or modify
    evt.respondWith((async () => {
      try { return await fetch(req); }
      catch { return await caches.match(req) || new Response(null, { status: 503 }); }
    })());
    return;
  }

  const pathname = url.pathname;

  /* ---------------- Static asset: cache-first strategy ---------------- */
  const staticAssetPattern = /\.(?:js|css|png|jpg|jpeg|svg|webp|gif|woff2?|ttf|eot|map)$/i;
  const isStaticAsset = (req.destination && ['script', 'style', 'image', 'font'].includes(req.destination)) || staticAssetPattern.test(pathname);

  if (isStaticAsset) {
    evt.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fetched = await fetch(req);
        // Only cache successful (200) and same-origin/valid responses
        if (fetched && fetched.status === 200 && isHttpUrl(new URL(fetched.url))) {
          // Some responses are opaque (no-cors) — caching them is allowed, but be defensive
          try { await cache.put(req, fetched.clone()); } catch (err) { /* ignore caching errors */ }
        }
        return fetched;
      } catch (err) {
        // network failed -> return cached if present, otherwise 503
        return cached || new Response(null, { status: 503 });
      }
    })());
    return;
  }

  /* ---------------- Navigation/HTML: network-first + inject module ---------------- */
  const accepts = req.headers.get('accept') || '';
  const isNavigation = req.mode === 'navigate' || accepts.includes('text/html');

  if (isNavigation && url.origin === location.origin) {
    evt.respondWith((async () => {
      // Try network first
      try {
        const networkResp = await fetch(req);

        // If network returned an HTML response, inject the module
        if (networkResp && networkResp.ok && isHtmlResponse(networkResp)) {
          // Read as text (works because it's HTML)
          const text = await networkResp.text();
          const injectedText = injectModuleIntoHtml(text);

          // Build new Response preserving status and minimal headers
          const headers = new Headers(networkResp.headers);
          // Ensure content-type is set to HTML
          headers.set('Content-Type', 'text/html; charset=UTF-8');

          const newResp = new Response(injectedText, {
            status: networkResp.status,
            statusText: networkResp.statusText,
            headers
          });

          // Cache the public HTML pages conservatively (do not cache protected paths)
          if (!isProtectedPath(pathname)) {
            try {
              const cache = await caches.open(STATIC_CACHE);
              // Only cache same-origin, successful HTML responses
              await cache.put(req, newResp.clone()).catch(() => {});
            } catch (err) {
              // ignore cache errors
            }
          }

          return newResp;
        }

        // If response is not HTML (or not ok) just return original response
        return networkResp;
      } catch (err) {
        // Network failed — try cache, then offline fallback
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

  /* ---------------- Default fetch: network-first with cache fallback ---------------- */
  evt.respondWith((async () => {
    try {
      return await fetch(req);
    } catch (err) {
      return await caches.match(req) || new Response(null, { status: 503 });
    }
  })());
});
