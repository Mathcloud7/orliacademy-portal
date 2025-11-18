/* ============================================================
   SERVICE WORKER — FINAL VERSION (2025)
   - Auto-inject role-auth.js into every HTML page
   - Safe caching
   - Full offline support
   - No duplicates
============================================================ */

const CACHE_NAME = "orli-cache-v1";
const ASSETS = [
  "/offline.html"
];

/* ============================================================
   INSTALL — pre-cache minimal safe files
============================================================ */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => null);
    })
  );
});

/* ============================================================
   ACTIVATE — cleanup old caches
============================================================ */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ============================================================
   FETCH — inject role-auth.js + offline fallback + cache-first
============================================================ */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only tamper with HTML pages
  if (req.destination === "document") {
    event.respondWith(handleHtmlRequest(req));
    return;
  }

  // Non-HTML files — default cache-first strategy
  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            return res;
          })
          .catch(() => caches.match("/offline.html"))
      );
    })
  );
});

/* ============================================================
   FUNCTION: Handle HTML pages & inject role-auth.js
============================================================ */
async function handleHtmlRequest(req) {
  try {
    const networkResponse = await fetch(req);
    const contentType = networkResponse.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      return networkResponse;
    }

    let html = await networkResponse.clone().text();

    // Inject role-auth.js if NOT already present
    if (!html.includes("role-auth.js")) {
      html = html.replace(
        "</head>",
        `  <script src="/role-auth.js"></script>\n</head>`
      );
    }

    // Cache the patched HTML
    const responseToCache = new Response(html, {
      status: networkResponse.status,
      statusText: networkResponse.statusText,
      headers: networkResponse.headers
    });

    caches.open(CACHE_NAME).then((cache) => {
      cache.put(req, responseToCache.clone());
    });

    return responseToCache;
  } catch (err) {
    console.warn("HTML fetch failed, using cache/offline:", err);

    const cached = await caches.match(req);
    return cached || caches.match("/offline.html");
  }
}
