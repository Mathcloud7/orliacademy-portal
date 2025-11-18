// ORLI ACADEMY — FINAL ERROR-FREE SERVICE WORKER

const CACHE_NAME = "orli-cache-v4";

const STATIC_FILES = [
  "/",
  "/index.html",
  "/offline.html",
  "/login.html",
  "/role-auth.js"
];

// ---------------- INSTALL ----------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const file of STATIC_FILES) {
        try {
          await cache.add(new Request(file, { cache: "reload" }));
        } catch (err) {
          console.warn("Skip caching:", file);
        }
      }
    })
  );
  self.skipWaiting();
});

// ---------------- ACTIVATE ----------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// ---------------- FETCH -------------------
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 1. Skip non-GET requests (fixes POST error)
  if (req.method !== "GET") return;

  const url = req.url;

  // 2. Skip chrome-extension URLs (fixes chrome extension error)
  if (url.startsWith("chrome-extension://")) return;

  // 3. Skip Firebase, auth, tokens
  if (
    url.includes("firebase") ||
    url.includes("googleapis") ||
    url.includes("gstatic") ||
    url.includes("auth") ||
    url.includes("token")
  ) {
    return;  // do not cache
  }

  // 4. Skip dynamic class pages (avoid caching student/teacher pages)
  if (
    url.includes("-s.html") ||
    url.includes("-t.html") ||
    url.includes("dashboard") ||
    url.includes("lesson") ||
    url.includes("theory") ||
    url.includes("cbt") ||
    url.includes("assessment")
  ) {
    return;   // always online, never cached
  }

  // ----- NORMAL GET REQUESTS -----
  event.respondWith(
    fetch(req)
      .then((response) => {
        // Only cache real normal responses
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, clone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback only for HTML
        if (req.destination === "document") {
          return caches.match(req).then((cached) => {
            return cached || caches.match("/offline.html");
          });
        }
      })
  );
});
