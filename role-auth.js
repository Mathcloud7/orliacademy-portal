// ==========================================
// UNIVERSAL ROLE-BASED ACCESS CONTROL SYSTEM (CLASS VERSION)
// ==========================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
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
// FIREBASE CONFIG
// ==========================================
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
// ==========================================
class RoleAuth {
  constructor() {
    this.publicPages = [
      "teachersassessment", "y6sb.html", "E-Book.html", "GENERAL.html", "SOC admin.html",
      "ST.html", "STttt.html", "T.html", "Tgggg.html", "classof2025name confirmation.html",
      "construction.html", "enterance.html", "enteranceresults-teacher-theory.html",
      "enteranceresults-teacher.html", "enteranceresults-year1.html", "enteranceresults-year2.html",
      "enteranceresults-year3.html", "enteranceresults-year4.html", "enteranceresults-year5.html",
      "enteranceresults-year6.html", "enteranceupload.html", "feedback-thanks.html",
      "fiesta.html", "index.html", "logo-footer.png", "logo.png", "orli-pic1.png", "orli-video.mp4",
      "orli-video222.mp4", "pezu.html", "programme.html", "reports.html", "result.html",
      "scoreboard.html", "scoreboard2.html", "sectionB.html", "sociology 310-55.html",
      "sociology 310.html", "sociology former-310.html", "sports-admin.html", "sports-admin2.html",
      "student-login.html", "student.html", "studentsassessment.html", "studentsassessment1.html",
      "studentsassessment2.html", "studentsassessment3.html", "studentsassessment4.html",
      "studentsassessment5.html", "studentsassessment6.html", "take-theory.html", "teacher-login.html",
      "teacher.html", "teacherassessment.html", "teacherassessmentsectionB.html",
      "teachersenteranceupload.html", "theory-year1.html", "theory-year2.html", "theory-year3.html",
      "theory-year4.html", "theory-year5.html", "theory-year6.html", "try.html", "week 6 reports.html"
    ];

    this.accessMap = this.buildAccessMap();
    this.initAuthListener();
  }

  buildAccessMap() {
    const map = { admin: "ALL" };
    const years = [1, 2, 3, 4, 5, 6];

    years.forEach(y => {
      // Student access
      map[`student-year${y}`] = [
        `year${y}-first-term-assessment-student.html`,
        `year${y}-first-term-assessment.html`,
        `year${y}-first-term-lesson-view.html`,
        `year${y}-first-term-theory-view.html`,
        `year${y}-second-term-assessment-student.html`,
        `year${y}-second-term-assessment.html`,
        `year${y}-second-term-lesson-view.html`,
        `year${y}-second-term-theory-view.html`,
        `year${y}-third-term-assessment-student.html`,
        `year${y}-third-term-assessment.html`,
        `year${y}-third-term-lesson-view.html`,
        `year${y}-third-term-theory-view.html`,
        `year${y}-s.html`,
        `y${y}-cbt-student.html`,
        `student-dashboard.html` // ✅ explicitly allowed
      ];

      // Teacher access
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
        `year${y}-third-term-lesson-teacher.html`,
        `year${y}-third-term-lesson-upload.html`,
        `year${y}-third-term-results.html`,
        `year${y}-third-term-theory.html`,
        `year${y}-t.html`,
        `y${y}-cbt-teacher.html`,
        `y${y}-cbt-result.html`,
        `teacher-dashboard.html` // ✅ explicitly allowed
      ];
    });

    return map;
  }

  initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      const currentPage = window.location.pathname.split("/").pop();

      // Public page
      if (this.publicPages.includes(currentPage)) return;

      // No user
      if (!user) {
        this.redirectToLogin();
        return;
      }

      try {
        const cached = JSON.parse(localStorage.getItem("roleAuthUser"));
        if (cached && cached.uid === user.uid) {
          this.checkAccess(cached.role, cached.year, currentPage);
          return;
        }

        const q = query(collection(db, "users"), where("uid", "==", user.uid));
        const snap = await getDocs(q);

        if (snap.empty) {
          await signOut(auth);
          this.redirectToLogin();
          return;
        }

        const data = snap.docs[0].data();
        const { role, year } = data;

        localStorage.setItem("roleAuthUser", JSON.stringify({ uid: user.uid, role, year }));
        this.checkAccess(role, year, currentPage);
      } catch (err) {
        console.error("Auth error:", err);
        this.redirectToLogin();
      }
    });
  }

  checkAccess(role, year, page) {
    if (role === "admin" || this.publicPages.includes(page)) return;

    // ✅ Always allow dashboards for logged-in users
    if ((role === "student" && page === "student-dashboard.html") ||
        (role === "teacher" && page === "teacher-dashboard.html")) {
      return;
    }

    const key = `${role}-year${year}`;
    const allowed = this.accessMap[key] || [];

    // ✅ Also allow generic matching patterns
    const allowedByPattern =
      (role === "student" && page.startsWith("student")) ||
      (role === "teacher" && page.startsWith("teacher"));

    if (!allowed.includes(page) && !allowedByPattern) {
      this.showAccessDeniedModal(role);
    }
  }

  redirectToLogin() {
    localStorage.removeItem("roleAuthUser");
    window.location.href = "login.html";
  }

  showAccessDeniedModal(role) {
    const modal = document.createElement("div");
    modal.innerHTML = `
      <div style="
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center;
        z-index: 9999; animation: fadeIn 0.3s ease;">
        <div style="
          background: #fff; color: #333; padding: 30px; border-radius: 12px;
          width: 90%; max-width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          animation: scaleUp 0.4s ease;">
          <h2 style="color: #d32f2f;">Access Denied</h2>
          <p style="font-size: 1.1em; margin: 15px 0;">You are not authorized to view this page.</p>
          <p style="font-size: 0.95em; color: #666;">You are logged in as: <strong>${role.toUpperCase()}</strong></p>
          <button id="homeRedirect" style="
            background-color: #16E2F5; color: white; padding: 10px 18px; border: none; border-radius: 6px;
            cursor: pointer; font-weight: bold; transition: background 0.3s ease;">
            Go to Home Page
          </button>
        </div>
      </div>

      <style>
        @keyframes fadeIn { from {opacity:0;} to {opacity:1;} }
        @keyframes scaleUp { from {transform: scale(0.9);} to {transform: scale(1);} }
      </style>
    `;
    document.body.appendChild(modal);

    document.getElementById("homeRedirect").onclick = () => {
      modal.remove();
      window.location.href = "index.html";
    };
  }
}

// ==========================================
// INITIALIZE ROLE AUTH SYSTEM
// ==========================================
new RoleAuth();
