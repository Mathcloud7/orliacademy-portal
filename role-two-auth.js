// role-auth.js
// UNIVERSAL ROLE-BASED ACCESS CONTROL SYSTEM (CLASS VERSION)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js";

// ==========================================
// FIREBASE CONFIG (same as yours)
const firebaseConfig = {
  apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrUQuV8",
  authDomain: "home-1e252.firebaseapp.com",
  projectId: "home-1e252",
  storageBucket: "home-1e252.firebasestorage.app",
  messagingSenderId: "702969034430",
  appId: "1:702969034430:web:47ff6e815f2017fc8f10ef",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// ROLE AUTH CLASS
class RoleAuth {
  constructor() {
    // normalize to lowercase filenames (helps comparisons)
    this.publicPages = [
      "teachersassessment.html","y6sb.html","e-book.html","general.html","soc admin.html",
      "st.html","stttt.html","t.html","tgggg.html","classof2025name confirmation.html",
      "construction.html","enterance.html","enteranceresults-teacher-theory.html",
      "enteranceresults-teacher.html","enteranceresults-year1.html","enteranceresults-year2.html",
      "enteranceresults-year3.html","enteranceresults-year4.html","enteranceresults-year5.html",
      "enteranceresults-year6.html","enteranceupload.html","feedback-thanks.html",
      "fiesta.html","index.html","logo-footer.png","logo.png","orli-pic1.png","orli-video.mp4",
      "orli-video222.mp4","pezu.html","programme.html","reports.html","result.html",
      "scoreboard.html","scoreboard2.html","sectionb.html","sociology 310-55.html",
      "sociology 310.html","sociology former-310.html","sports-admin.html","sports-admin2.html",
      "student-login.html","student.html","studentsassessment.html","studentsassessment1.html",
      "studentsassessment2.html","studentsassessment3.html","studentsassessment4.html",
      "studentsassessment5.html","studentsassessment6.html","take-theory.html","teacher-login.html",
      "teacher.html","teacherassessment.html","teacherassessmentsectionb.html",
      "teachersenteranceupload.html","theory-year1.html","theory-year2.html","theory-year3.html",
      "theory-year4.html","theory-year5.html","theory-year6.html","try.html","week 6 reports.html"
    ].map(s => s.toLowerCase().trim());

    this.accessMap = this.buildAccessMap();
    this.initAuthListener();
  }

  // Build access map for students & teachers by year (keys like student-year1, teacher-year2)
  buildAccessMap() {
    const map = { admin: "ALL" };
    const years = [1, 2, 3, 4, 5, 6];

    years.forEach(y => {
      map[`student-year${y}`] = [
        `year${y}-first-term-assessment-student.html`,
        `year${y}-first-term-assessment.html`,
        `year${y}-first-term-lesson-view.html`,
        `year${y}-first-term-theory-view.html`,
        `year${y}-second-term-assessment-student.html`,
        `year${y}-second-term-assessment.html`,
        `year${y}-second-term-lesson-view.html`,
        `year${y}-second-term-theory-view.html`,
        `year${y}-first-term-student-dashboard.html`,
        `year${y}-second-term-student-dashboard.html`,
        `year${y}-third-term-student-dashboard.html`,
        `year${y}-third-term-assessment-student.html`,
        `year${y}-third-term-assessment.html`,
        `year${y}-third-term-lesson-view.html`,
        `year${y}-third-term-theory-view.html`,
        `year${y}-s.html`,
        `y${y}-cbt-student.html`,
        `student-dashboard.html`
      ].map(s => s.toLowerCase());

      map[`teacher-year${y}`] = [
        `year${y}-first-term-cbt.html`,
        `year${y}-first-term-lesson-teacher.html`,
        `year${y}-first-term-lesson-upload.html`,
        `year${y}-first-term-results.html`,
        `year${y}-first-term-theory.html`,
        `year${y}-second-term-cbt.html`,
        `year${y}-second-term-lesson-teacher.html`,
        `year${y}-second-term-lesson-upload.html`,
        `year${y}-second-term-results.html`,
        `year${y}-second-term-theory.html`,
        `year${y}-third-term-cbt.html`,
        `year${y}-first-term-teacher-dashboard.html`,
        `year${y}-second-term-teacher-dashboard.html`,
        `year${y}-third-term-teacher-dashboard.html`,
        `year${y}-third-term-lesson-teacher.html`,
        `year${y}-third-term-lesson-upload.html`,
        `year${y}-third-term-results.html`,
        `year${y}-third-term-theory.html`,
        `year${y}-t.html`,
        `y${y}-cbt-teacher.html`,
        `y${y}-cbt-result.html`,
        `teacher-dashboard.html`
      ].map(s => s.toLowerCase());
    });

    return map;
  }

  // Normalize current page: strip query/hash, default to index.html
  getCurrentPage() {
    let path = window.location.pathname || "/";
    let page = path.split("/").pop() || "";
    // if path ends with '/', page will be empty -> treat as index.html
    if (!page) page = "index.html";
    // strip search and hash if they somehow remain
    page = page.split("?")[0].split("#")[0].toLowerCase().trim();
    return page;
  }

  // Initialize auth listener
  initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      const currentPage = this.getCurrentPage();

      // Public page -> allow
      if (this.publicPages.includes(currentPage)) return;

      // No user -> redirect to login
      if (!user) {
        this.redirectToLogin();
        return;
      }

      try {
        // If we have cached role data for this user, use it (sanity-check uid)
        const cachedRaw = localStorage.getItem("roleAuthUser");
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw);
            if (cached && cached.uid === user.uid && cached.role) {
              // ensure we also have normalized year/class
              const role = cached.role;
              const year = cached.year || cached.userClass || cached.class;
              this.checkAccess(role, year, currentPage);
              return;
            }
          } catch (e) {
            // ignore parse errors and fetch fresh info
            console.warn("roleAuthUser parse error, fetching fresh:", e);
          }
        }

        // Query Firestore for this user
        const q = query(collection(db, "users"), where("uid", "==", user.uid));
        const snap = await getDocs(q);
        if (snap.empty) {
          // No record: sign out and redirect
          await signOut(auth);
          this.redirectToLogin();
          return;
        }

        const data = snap.docs[0].data();
        // Accept multiple possible field names for "year"
        const role = (data.role || "").toString().toLowerCase();
        const yearVal = data.year || data.userClass || data.class || data.user_class || null;
        // Normalize year: e.g. "Year 3" or "year3" -> 3
        let year = null;
        if (yearVal != null) {
          const m = String(yearVal).match(/(\d+)/);
          if (m) year = parseInt(m[1], 10);
        }

        // Cache for quick checks
        localStorage.setItem("roleAuthUser", JSON.stringify({ uid: user.uid, role, year, userClass: data.userClass || null }));

        this.checkAccess(role, year, currentPage);
      } catch (err) {
        console.error("Auth check failed:", err);
        // If anything goes wrong, be conservative and redirect to login
        this.redirectToLogin();
      }
    });
  }

  // Check access for role/year/page
  checkAccess(role, year, page) {
    page = (page || "").toLowerCase();

    // Admin always allowed
    if ((role || "").toLowerCase() === "admin") return;

    // Public pages allowed
    if (this.publicPages.includes(page)) return;

    // Dashboards allowed for their roles
    if ((role === "student" && page === "student-dashboard.html") ||
        (role === "teacher" && page === "teacher-dashboard.html")) {
      return;
    }

    // Build key (if year present)
    const normalizedYear = Number.isInteger(year) ? year : null;
    const key = normalizedYear ? `${role}-year${normalizedYear}` : null;
    const allowed = key ? (this.accessMap[key] || []) : [];

    // If page explicitly listed in allowed pages -> allow
    if (allowed.includes(page)) return;

    // Additional pattern-based check:
    // allow files that include "year{n}" or "y{n}-" (e.g. year1-first-term..., y1-cbt-...)
    if (normalizedYear) {
      const yearPattern = new RegExp(`(^|[^0-9])year\\s*${normalizedYear}([^0-9]|$)|(^|[^0-9])y${normalizedYear}[-_]`, "i");
      if (yearPattern.test(page)) return;
    }

    // As a last attempt: if the page filename includes the role (t/student/teacher) and year is missing,
    // be conservative and deny (you could customize to allow some).
    this.showAccessDeniedModal(`${role}${normalizedYear ? " (Year " + normalizedYear + ")" : ""}`);
  }

  // Redirect to login (clear cached role)
  redirectToLogin() {
    try { localStorage.removeItem("roleAuthUser"); } catch (e) { /* ignore */ }
    window.location.href = "login.html";
  }

  // Show access denied modal (non-destructive)
  showAccessDeniedModal(role) {
    const modal = document.createElement("div");
    modal.innerHTML = `
      <div style="
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center;
        z-index: 9999;">
        <div style="
          background: #fff; color: #333; padding: 28px; border-radius: 12px;
          width: 92%; max-width: 420px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
          <h2 style="color: #d32f2f; margin: 0 0 8px;">Access Denied</h2>
          <p style="font-size: 1.05em; margin: 10px 0 6px;">You are not authorized to view this page.</p>
          <p style="font-size: 0.95em; color: #666; margin: 0 0 16px;">You are logged in as: <strong>${(role||"UNKNOWN").toUpperCase()}</strong></p>
          <div style="display:flex;gap:8px; justify-content:center;">
            <button id="homeRedirect" style="
              background-color: #16E2F5; color: white; padding: 10px 14px; border: none; border-radius: 6px;
              cursor: pointer; font-weight: bold;">Go to Home</button>
            <button id="signOutBtn" style="
              background-color: transparent; border: 1px solid #ddd; padding: 10px 14px; border-radius:6px;
              cursor:pointer;">Sign out</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("homeRedirect").onclick = () => {
      modal.remove();
      window.location.href = "index.html";
    };

    document.getElementById("signOutBtn").onclick = async () => {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn("Error signing out:", e);
      } finally {
        try { localStorage.removeItem("roleAuthUser"); } catch (e) {}
        modal.remove();
        window.location.href = "login.html";
      }
    };
  }
}

// Initialize
new RoleAuth();


