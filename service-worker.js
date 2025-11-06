// service-worker.js
self.addEventListener("install", (event) => {
  console.log("✅ Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activated");
  event.waitUntil(self.clients.claim());
});

// Intercept all fetch requests
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Intercept only HTML pages
  if (request.destination === "document") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          let html = await response.text();

          // ✅ Automatically inject role-auth.js into all pages
          if (html.includes("</body>")) {
            html = html.replace(
              "</body>",
              `<script type="module" src="/role-auth.js"></script></body>`
            );
          }

          // ✅ Block access for unauthorized users to protected pages
          const protectedPatterns = [
            /year1/i,
            /y1/i,
            /teacher/i,
            /student/i,
            /admin/i,
            /dashboard/i,
            /assessment/i,
            /lesson/i,
            /theory/i,
            /result/i,
            /cbt/i,
          ];

          // If a protected page is being requested, check auth before serving
          if (protectedPatterns.some((pattern) => pattern.test(request.url))) {
            // Inject pre-check script for auth before showing content
            const authCheckScript = `
              <script>
              (async () => {
                const user = sessionStorage.getItem('user');
                if (!user) {
                  console.warn('🚫 No user session found. Redirecting to login.');
                  window.location.href = '/login.html';
                }
              })();
              </script>
            `;

            html = html.replace("</head>", `${authCheckScript}</head>`);
          }

          return new Response(html, {
            headers: { "Content-Type": "text/html" },
            status: response.status,
            statusText: response.statusText,
          });
        } catch (error) {
          console.error("❌ SW Fetch Error:", error);
          return fetch(request); // fallback if anything fails
        }
      })()
    );
  }
});
