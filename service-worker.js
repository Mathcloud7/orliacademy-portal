// ORLI ACADEMY – SERVICE WORKER (ERROR-PROOF VERSION)

// Cache version
const CACHE_NAME = "orli-v1";

// These files MUST exist — use ONLY the files that are real
const STATIC_FILES = [
  "/",               // your homepage root always exists
  "/index.html",
  "/offline.html",
  "/login.html"
];

// ---------------- INSTALL ----------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const file of STATIC_FILES) {
        try {
          await cache.add(file);
        } catch (err) {
          // skip missing files instead of breaking
          console.warn("SW: Skip missing file:", file);
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
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ---------------- FETCH ----------------
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // IGNORE chrome extension URLs
  if (req.url.startsWith("chrome-extension://")) return;

  // IGNORE Firebase + role-auth
  if (
    req.url.includes("firebase") ||
    req.url.includes("role-auth.js")
  ) {
    return;
  }

  // Only GET allowed
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            response.type === "basic"
          ) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, response.clone()).catch(() => {});
            });
          }
          return response;
        })
        .catch(() => {
          if (req.destination === "document") {
            return caches.match("/offline.html");
          }
        });
    })
  );
});
