// =========================================================
// service-worker.js (FINAL, no DOM usage)
// - Safe HTML injection of /role-auth.js (network responses only)
// - Ignores non-http schemes (chrome-extension etc.)
// - Network-first for restricted pages
// - Cache-first for safe assets
// =========================================================

const CACHE_NAME = "site-static-v5";
const OFFLINE_PAGE = "/offline.html";

// Files that should never be cached (restricted dashboards / sensitive pages)
const RESTRICTED_FILENAMES = new Set([
  "teacher-dashboard.html",
  "year5-t.html",
  "year5-first-term-teacher-dashboard.html",
  "year5-second-term-teacher-dashboard.html",
  "year5-third-term-teacher-dashboard.html",
  "year5-first-term-assessment.html",
  "year5-first-term-lesson-teacher.html",
  "year5-first-term-lesson-upload.html",
  "year5-first-term-lesson-view.html",
  "year5-second-term-assessment.html",
  "year5-second-term-lesson-teacher.html",
  "year5-second-term-lesson-upload.html",
  "year5-second-term-lesson-view.html",
  "year5-third-term-assessment.html",
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
]);

// Safe assets to cache
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/admin-dashboard.html",
  "/offline.html",
  "/css/main.css",
  "/js/main.js",
  "/role-auth.js"
];

// Get filename from URL (fallback to index.html)
function getFilename(url) {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/");
    return (segs.pop() || "index.html").toLowerCase();
  } catch {
    return "";
  }
}

// Install: pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const url of STATIC_ASSETS) {
        try {
          // use no-store to ensure latest copy on first install, but still cache result
          const res = await fetch(url, { cache: "no-store" });
          if (res && res.ok) await cache.put(url, res.clone());
        } catch (err) {
          // ignore missing assets
          console.warn("SW install: skip", url, err && err.message);
        }
      }
      self.skipWaiting();
    })()
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)));
      self.clients.claim();
    })()
  );
});

// Fetch handler
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Ignore non-http(s) requests early (fixes chrome-extension crash)
  if (!/^https?:/.test(req.url)) {
    return; // do not handle requests from extensions or other schemes
  }

  // Only handle GET requests
  if (req.method !== "GET") return;

  const filename = getFilename(req.url);

  // 1) HTML documents: try network, inject role-auth.js into HTML body if missing
  if (req.destination === "document") {
    event.respondWith(
      (async () => {
        try {
          const netRes = await fetch(req);
          // If not an HTML response, return network response directly
          const contentType = netRes.headers.get("Content-Type") || "";
          if (!contentType.includes("text/html")) return netRes;

          let text = await netRes.text();

          // Only inject if the page does not already include role-auth
          if (!/src=["']\/role-auth\.js["']/.test(text)) {
            text = text.replace(/<\/body>/i, `<script type="module" src="/role-auth.js"></script></body>`);
          }

          // Build response with the original headers except we must create new Headers
          const headers = new Headers(netRes.headers);
          // Ensure content-type is HTML
          if (!headers.has("Content-Type")) headers.set("Content-Type", "text/html");

          return new Response(text, {
            status: netRes.status,
            statusText: netRes.statusText,
            headers
          });
        } catch (err) {
          // Network failed — serve offline fallback if available
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match(OFFLINE_PAGE);
          return fallback || new Response("<h1>Offline</h1>", { headers: { "Content-Type": "text/html" } });
        }
      })()
    );
    return;
  }

  // 2) Restricted pages (network-first, do NOT cache)
  // Use an explicit check for restricted filenames; don't rely on broad regex that misclassifies.
  if (RESTRICTED_FILENAMES.has(filename)) {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const fallback = await cache.match(OFFLINE_PAGE);
        return fallback || new Response("<h1>Offline — restricted</h1>", { headers: { "Content-Type": "text/html" } });
      })
    );
    return;
  }

  // 3) All other assets: cache-first strategy
  event.respondWith(
    caches.match(req).then(async (cached) => {
      if (cached) return cached;

      try {
        const networkRes = await fetch(req);
        // Only cache same-origin basic responses (avoid opaque/cross-origin caching)
        if (networkRes && networkRes.ok && networkRes.type === "basic") {
          const cache = await caches.open(CACHE_NAME);
          try {
            await cache.put(req, networkRes.clone());
          } catch (e) {
            // If caching fails for some requests (extension, opaque), ignore
            console.warn("SW: cache.put failed for", req.url, e && e.message);
          }
        }
        return networkRes;
      } catch (err) {
        // If network fails and navigation, serve offline page
        if (req.mode === "navigate") {
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match(OFFLINE_PAGE);
          return fallback || new Response("<h1>Offline</h1>", { headers: { "Content-Type": "text/html" } });
        }
        return new Response("", { status: 503, statusText: "Service Unavailable" });
      }
    })
  );
});
