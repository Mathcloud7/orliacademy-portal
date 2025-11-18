// ORLI ACADEMY — STABLE SERVICE WORKER (final fix)

// Cache name and minimal static files (only files that definitely exist)
const CACHE_NAME = "orli-cache-v4";
const STATIC_FILES = [
  "/",
  "/index.html",
  "/offline.html",
  "/login.html"
];

// INSTALL - cache only the files that exist, skip missing ones
self.addEventListener("install", (evt) => {
  evt.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const f of STATIC_FILES) {
      try {
        await cache.add(new Request(f, { cache: "reload" }));
      } catch (e) {
        console.warn("SW install: skip missing file:", f);
      }
    }
    await self.skipWaiting();
  })());
});

// ACTIVATE - clean up old caches
self.addEventListener("activate", (evt) => {
  evt.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// UTIL: same-origin check
function isSameOrigin(requestUrl) {
  try {
    const reqOrigin = new URL(requestUrl).origin;
    return reqOrigin === self.location.origin;
  } catch {
    return false;
  }
}

// UTIL: determine if a url is protected (don't cache)
function isProtectedUrl(url) {
  const p = url.toLowerCase();
  const protectedKeywords = ['teacher', 'student', 'cbt', 'admin', 'year', 'dashboard', 'lesson', 'theory', 'assessment'];
  return protectedKeywords.some(k => p.includes(k));
}

// FETCH handler - network-first for documents, cache-first for static assets,
// but do not touch cross-origin / dynamic / auth / firebase requests.
self.addEventListener("fetch", (evt) => {
  const req = evt.request;

  // Only handle GET
  if (req.method !== "GET") return;

  // If request is for browser-extension or non-http(s), don't touch it
  if (req.url.startsWith("chrome-extension://") || req.url.startsWith("moz-extension://") || req.url.startsWith("file://") || req.url.startsWith("about:")) {
    return;
  }

  // Never intercept caching/handling for Firebase/auth/role-auth endpoints or obvious dynamic endpoints
  const blocklist = ["firebase", "firestore", "gstatic", "googleapis", "role-auth", "role-auth.module", "/auth", "/token"];
  for (const b of blocklist) {
    if (req.url.includes(b)) return;
  }

  // If cross-origin: don't intercept (let browser do network). Important for vercel.live and other third-party scripts.
  if (!isSameOrigin(req.url)) {
    return;
  }

  // Don't touch protected pages (always network)
  if (isProtectedUrl(req.url)) {
    // For navigation documents, we still want to try network-first and fallback to offline if network fails.
    if (req.mode === "navigate" || req.destination === "document") {
      evt.respondWith((async () => {
        try {
          return await fetch(req);
        } catch {
          return (await caches.match("/offline.html")) || new Response("<h1>Offline</h1>", { headers: { "Content-Type": "text/html" }});
        }
      })());
    }
    return;
  }

  // Static asset detection (same-origin). Basic cache-first for static assets.
  const staticPattern = /\.(?:js|css|png|jpg|jpeg|svg|webp|gif|woff2?|ttf|eot|map)$/i;
  const isStaticAsset = (req.destination && ['script','style','image','font'].includes(req.destination)) || staticPattern.test(new URL(req.url).pathname);

  if (isStaticAsset) {
    evt.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const netResp = await fetch(req);
        // Only cache same-origin, successful, basic responses
        if (netResp && netResp.ok && netResp.type === "basic") {
          // Guard the clone in try/catch to avoid any stream issues
          try {
            await cache.put(req, netResp.clone());
          } catch (e) {
            // If clone fails, skip caching for this resource
            console.warn("SW: cache.put skipped (clone failed)", req.url, e);
          }
        }
        return netResp;
      } catch (e) {
        // fallback to cache or 503
        return cached || new Response(null, { status: 503 });
      }
    })());
    return;
  }

  // For navigation (HTML) requests that are same-origin and not protected: network-first with cache fallback.
  const accepts = req.headers.get("accept") || "";
  const isNavigation = req.mode === "navigate" || accepts.includes("text/html");

  if (isNavigation) {
    evt.respondWith((async () => {
      try {
        const networkResp = await fetch(req);
        // If network returned a valid HTML, optionally cache public HTML (conservative)
        if (networkResp && networkResp.ok && networkResp.type === "basic") {
          // cache it (but only for public pages)
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(req, networkResp.clone()).catch(()=>{});
          } catch (e) {
            // ignore caching errors
          }
        }
        return networkResp;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        const offline = await caches.match("/offline.html");
        if (offline) return offline;
        return new Response("<!doctype html><meta charset='utf-8'><title>Offline</title><h1>Offline</h1>", { headers: { "Content-Type": "text/html" }, status: 503 });
      }
    })());
    return;
  }

  // Default: try network, fall back to cache
  evt.respondWith((async () => {
    try {
      const net = await fetch(req);
      return net;
    } catch {
      return (await caches.match(req)) || new Response(null, { status: 503 });
    }
  })());
});
