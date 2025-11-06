// ==========================================
// service-worker.js (Automatic Role-Based Auth Injection)
// ==========================================

self.addEventListener("install", (event) => {
  console.log("✅ Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activated");
  event.waitUntil(self.clients.claim());
});

// ==========================================
// PUBLIC / UNRESTRICTED PAGES
// ==========================================
const unrestrictedPages = [
  "teachersassessment","y6sb.html","E-Book.html","GENERAL.html","SOC admin.html","ST.html","STttt.html","T.html",
  "Tgggg.html","classof2025name confirmation.html","construction.html","enterance.html",
  "enteranceresults-teacher-theory.html","enteranceresults-teacher.html","enteranceresults-year1.html",
  "enteranceresults-year2.html","enteranceresults-year3.html","enteranceresults-year4.html",
  "enteranceresults-year5.html","enteranceresults-year6.html","enteranceupload.html","feedback-thanks.html",
  "fiesta.html","index.html","logo-footer.png","logo.png","orli-pic1.png","orli-video.mp4","orli-video222.mp4",
  "pezu.html","programme.html","reports.html","result.html","scoreboard.html","scoreboard2.html","sectionB.html",
  "sociology 310-55.html","sociology 310.html","sociology former-310.html","sports-admin.html","sports-admin2.html",
  "student-login.html","student.html","studentsassessment.html","studentsassessment1.html","studentsassessment2.html",
  "studentsassessment3.html","studentsassessment4.html","studentsassessment5.html","studentsassessment6.html",
  "take-theory.html","teacher-login.html","teacher.html","teacherassessment.html","teacherassessmentsectionB.html",
  "teachersenteranceupload.html","theory-year1.html","theory-year2.html","theory-year3.html","theory-year4.html",
  "theory-year5.html","theory-year6.html","try.html","week 6 reports.html",
];

// ==========================================
// FETCH HANDLER: Inject role-auth.js Automatically
// ==========================================
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only intercept HTML pages (not assets, APIs, etc.)
  if (request.destination === "document") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          let html = await response.text();

          const url = new URL(request.url);
          const page = url.pathname.split("/").pop();

          // Skip for unrestricted (public) pages
          if (unrestrictedPages.includes(page)) {
            return new Response(html, {
              headers: { "Content-Type": "text/html" },
              status: response.status,
              statusText: response.statusText,
            });
          }

          // ✅ Inject role-auth.js dynamically for protected pages
          if (html.includes("</body>")) {
            html = html.replace(
              "</body>",
              `<script type="module" src="/role-auth.js"></script></body>`
            );
          }

          return new Response(html, {
            headers: { "Content-Type": "text/html" },
            status: response.status,
            statusText: response.statusText,
          });
        } catch (error) {
          console.error("❌ SW Fetch Error:", error);
          return fetch(request); // fallback if error
        }
      })()
    );
  }
});
