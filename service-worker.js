// =========================================================
//  service-worker.js
//  • Offline caching
//  • Prevent caching of restricted user pages
//  • Auto-inject /role-auth.js into every HTML page
// =========================================================

const CACHE_NAME = "site-static-v4";
const OFFLINE_PAGE = "/offline.html";

// -------------------------
// Restricted (NEVER cache)
// -------------------------
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

// -------------------------
// Safe assets to cache
// -------------------------
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/admin-dashboard.html",
  "/offline.html",
  "/css/main.css",
  "/js/main.js"
];

// Extract filename cleanly
function getFilename(url) {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/");
    return (segs.pop() || "index.html").toLowerCase();
  } catch (e) {
    return "";
  }
}

// =========================================================
// INSTALL EVENT
// =========================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      for (const url of STATIC_ASSETS) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            await cache.put(url, resp);
          }
        } catch (err) {
          console.warn("Skipping missing asset:", url);
        }
      }

      self.skipWaiting();
    })()
  );
});

// =========================================================
// ACTIVATE EVENT
// =========================================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
      self.clients.claim();
    })()
  );
});

// =========================================================
// FETCH EVENT
// =========================================================
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const filename = getFilename(req.url);

  // ---------------------------------------------
  // 1. HTML document? → inject role-auth.js
  // ---------------------------------------------
  if (req.destination === "document") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(req);
          let text = await networkResponse.text();

          if (!/src=["']\/role-auth\.js["']/.test(text)) {
            text = text.replace(
              /<\/body>/i,
              `<script type="module" src="/role-auth.js"></script></body>`
            );
          }

          return new Response(text, {
            status: networkResponse.status,
            statusText: networkResponse.statusText,
            headers: networkResponse.headers
          });
        } catch (err) {
          console.error("Document fetch failed:", err);

          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match(OFFLINE_PAGE);
          return fallback || new Response("<h1>Offline</h1>", { headers: { "Content-Type": "text/html" } });
        }
      })()
    );
    return;
  }

  // ---------------------------------------------
  // 2. Restricted pages → network first (NO CACHE)
  // ---------------------------------------------
  const isClassPage = /^year\d|^y\d/.test(filename);

  if (RESTRICTED_FILENAMES.has(filename) || isClassPage) {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (
          (await cache.match(OFFLINE_PAGE)) ||
          new Response("<h1>Offline: restricted page</h1>", {
            headers: { "Content-Type": "text/html" }
          })
        );
      })
    );
    return;
  }

  // ---------------------------------------------
  // 3. All other files → cache-first
  // ---------------------------------------------
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then(async (networkRes) => {
          const cache = await caches.open(CACHE_NAME);
          if (networkRes && networkRes.status === 200 && networkRes.type === "basic") {
            cache.put(req, networkRes.clone());
          }
          return networkRes;
        })
        .catch(async () => {
          if (req.mode === "navigate") {
            const cache = await caches.open(CACHE_NAME);
            return (
              (await cache.match(OFFLINE_PAGE)) ||
              new Response("<h1>Offline</h1>", { headers: { "Content-Type": "text/html" } })
            );
          }
          return new Response("", { status: 503 });
        });
    })
  );
});
