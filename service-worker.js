// ORLI ACADEMY — FINAL STABLE SERVICE WORKER (NO ERRORS)

// Cache name
const CACHE_NAME = "orli-cache-v3";

// Only cache essential public files
const STATIC_FILES = [
  "/",               
  "/index.html",
  "/offline.html",
  "/login.html"
];

// --------------------- INSTALL ---------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const file of STATIC_FILES) {
        try {
          await cache.add(new Request(file, { cache: "reload" }));
        } catch (e) {
          console.warn("SW: skipping missing file:", file);
        }
      }
    })
  );
  self.skipWaiting();
});

// --------------------- ACTIVATE ---------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ---------------------- FETCH -----------------------

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Ignore non-GET
  if (req.method !== "GET") return;

  const url = req.url;

  // DO NOT cache Firebase or dynamic scripts
  if (
    url.includes("firebase") ||
    url.includes("firestore") ||
    url.includes("googleapis") ||
    url.includes("role-auth") ||
    url.includes("auth") ||
    url.includes("token")
  ) {
    return; // Go straight to network
  }

  // Never cache teacher/student protected pages
  if (
    url.includes("dashboard") ||
    url.includes("-t.html") ||
    url.includes("-s.html") ||
    url.includes("lesson") ||
    url.includes("theory") ||
    url.includes("assessment") ||
    url.includes("cbt")
  ) {
    return; // Always network
  }

  // Use fallback caching ONLY for public pages
  event.respondWith(
    fetch(req)
      .then((response) => {
        // Only cache successful basic responses
        if (
          response &&
          response.status === 200 &&
          response.type === "basic"
        ) {
          const resClone = response.clone(); // SAFE CLONE
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback for public pages
        if (req.destination === "document") {
          return caches.match(req).then((cached) => {
            return cached || caches.match("/offline.html");
          });
        }
      })
  );
});
