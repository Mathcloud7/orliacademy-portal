/* ============================================================
   FIXED service-worker.js (2025)
   Injects: <script type="module" src="/role-auth.module.js" defer></script>
   Provides:
     - strict injection
     - safe cache behavior
     - offline fallback
     - protected page handling
============================================================ */

const CACHE_VERSION = 'v2.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const OFFLINE_HTML = '/offline.html';
const MODULE_SCRIPT_PATH = '/role-auth.module.js';

/* ============================================================
   INSTALL
============================================================ */
self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.add(OFFLINE_HTML).catch(() => {});
    self.skipWaiting();
  })());
});

/* ============================================================
   ACTIVATE — remove old caches
============================================================ */
self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k))
    );
    self.clients.claim();
  })());
});

/* ============================================================
   Inject <script type="module"> into HTML
============================================================ */
function injectModule(html) {
  const tag = `<script type="module" src="${MODULE_SCRIPT_PATH}" defer></script>`;

  // Avoid duplicate injection
  if (html.includes(MODULE_SCRIPT_PATH)) return html;

  // Prefer head insertion
  if (html.includes("</head>"))
    return html.replace("</head>", tag + "\n</head>");

  // Otherwise inject before body close
  if (html.includes("</body>"))
    return html.replace("</body>", tag + "\n</body>");

  // Fallback (minimal)
  return tag + "\n" + html;
}

/* ============================================================
   MAIN FETCH HANDLER
============================================================ */
self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  const url = new URL(req.url);

  /* ------------------------------------------------------------
     1. Handle static assets (cache-first)
  ------------------------------------------------------------ */
  const isStaticAsset =
    (req.destination && ['script', 'style', 'image', 'font'].includes(req.destination)) ||
    /\.(?:js|css|png|jpg|jpeg|svg|webp|gif|woff2?|ttf|eot)$/.test(url.pathname);

  if (isStaticAsset) {
    ev.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const net = await fetch(req);
        if (net && net.status === 200) cache.put(req, net.clone());
        return net;
      } catch {
        return cached || new Response(null, { status: 503 });
      }
    })());
    return;
  }

  /* ------------------------------------------------------------
     2. Handle HTML navigations (Network-first + injection)
  ------------------------------------------------------------ */
  const acceptsHtml = req.headers.get("accept")?.includes("text/html");
  const isNav = req.mode === "navigate" || acceptsHtml;

  if (isNav && url.origin === location.origin) {
    ev.respondWith((async () => {
      try {
        const networkResp = await fetch(req);

        // If the network fails
        if (!networkResp || networkResp.status !== 200) {
          const cached = await caches.match(req);
          return cached || await caches.match(OFFLINE_HTML);
        }

        const text = await networkResp.text();
        const injected = injectModule(text);

        const newResp = new Response(injected, {
          status: networkResp.status,
          statusText: networkResp.statusText,
          headers: { "Content-Type": "text/html" }
        });

        // Determine if this HTML is safe to cache
        const protectedKeywords = ['teacher', 'student', 'cbt', 'admin', 'year'];
        const isProtected = protectedKeywords.some(k =>
          url.pathname.toLowerCase().includes(k)
        );

        if (!isProtected) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(req, newResp.clone()).catch(() => {});
        }

        return newResp;

      } catch (err) {
        // Offline fallback
        const cached = await caches.match(req);
        if (cached) return cached;
        return await caches.match(OFFLINE_HTML);
      }
    })());
    return;
  }

  /* ------------------------------------------------------------
     3. Default fetch (network-first)
  ------------------------------------------------------------ */
  ev.respondWith((async () => {
    try {
      return await fetch(req);
    } catch {
      return await caches.match(req) || new Response(null, { status: 503 });
    }
  })());
});
