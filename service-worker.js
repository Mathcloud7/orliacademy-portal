// SERVICE WORKER – FINAL VERIFIED VERSION (2025)

// Cache version
const CACHE_NAME = "orli-static-v1";

// Static assets only – HTML is NOT cached
const STATIC_FILES = [
  "/index.html",
  "/offline.html",
  "/login.html",
  "/style.css",
  "/main.js"
];

// ---------------------- INSTALL ----------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

// ---------------------- ACTIVATE ----------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// ---------------------- FETCH ----------------------
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // ❌ Do NOT intercept chrome-extension://
  if (req.url.startsWith("chrome-extension://")) return;

  // ❌ Do NOT cache role-auth or Firebase
  if (
    req.url.includes("role-auth.js") ||
    req.url.includes("firebase") ||
    req.url.includes("auth") ||
    req.url.includes("firestore")
  ) {
    return; // let network handle normally
  }

  // Only GET may be cached
  if (req.method !== "GET") return;

  // Static cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((networkResp) => {
          // Only cache clean static responses
          if (
            networkResp &&
            networkResp.status === 200 &&
            networkResp.type === "basic" &&
            req.url.startsWith("https")
          ) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, networkResp.clone()).catch(() => {});
            });
          }
          return networkResp;
        })
        .catch(() => {
          // Offline fallback ONLY for documents
          if (req.destination === "document") {
            return caches.match("/offline.html");
          }
        });
    })
  );
});
