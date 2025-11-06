// ==========================================
// UNIVERSAL ROLE-BASED ACCESS CONTROL SYSTEM
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js";

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
// PUBLIC PAGES — NO AUTH REQUIRED
// ==========================================
const publicPages = [
  "teachersassessment",
  "y6sb.html",
  "E-Book.html",
  "GENERAL.html",
  "SOC admin.html",
  "ST.html",
  "STttt.html",
  "T.html",
  "Tgggg.html",
  "classof2025name confirmation.html",
  "construction.html",
  "enterance.html",
  "enteranceresults-teacher-theory.html",
  "enteranceresults-teacher.html",
  "enteranceresults-year1.html",
  "enteranceresults-year2.html",
  "enteranceresults-year3.html",
  "enteranceresults-year4.html",
  "enteranceresults-year5.html",
  "enteranceresults-year6.html",
  "enteranceupload.html",
  "feedback-thanks.html",
  "fiesta.html",
  "index.html",
  "logo-footer.png",
  "logo.png",
  "orli-pic1.png",
  "orli-video.mp4",
  "orli-video222.mp4",
  "pezu.html",
  "programme.html",
  "reports.html",
  "result.html",
  "scoreboard.html",
  "scoreboard2.html",
  "sectionB.html",
  "sociology 310-55.html",
  "sociology 310.html",
  "sociology former-310.html",
  "sports-admin.html",
  "sports-admin2.html",
  "student-login.html",
  "student.html",
  "studentsassessment.html",
  "studentsassessment1.html",
  "studentsassessment2.html",
  "studentsassessment3.html",
  "studentsassessment4.html",
  "studentsassessment5.html",
  "studentsassessment6.html",
  "take-theory.html",
  "teacher-login.html",
  "teacher.html",
  "teacherassessment.html",
  "teacherassessmentsectionB.html",
  "teachersenteranceupload.html",
  "theory-year1.html",
  "theory-year2.html",
  "theory-year3.html",
  "theory-year4.html",
  "theory-year5.html",
  "theory-year6.html",
  "try.html",
  "week 6 reports.html",
];

// ==========================================
// ACCESS MAP (ADMIN, TEACHER, STUDENT)
// ==========================================
const accessMap = {
  admin: "ALL",
};

const years = [1, 2, 3, 4, 5, 6];
years.forEach((y) => {
  // ===============================
  // STUDENT PAGES
  // ===============================
  accessMap[`student-year${y}`] = [
    // First Term
    `year${y}-first-term-assessment-student.html`,
    `year${y}-first-term-assessment.html`,
    `year${y}-first-term-lesson-view.html`,
    `year${y}-first-term-theory-view.html`,

    // Second Term
    `year${y}-second-term-assessment-student.html`,
    `year${y}-second-term-assessment.html`,
    `year${y}-second-term-lesson-view.html`,
    `year${y}-second-term-theory-view.html`,

    // Third Term
    `year${y}-third-term-assessment-student.html`,
    `year${y}-third-term-assessment.html`,
    `year${y}-third-term-lesson-view.html`,
    `year${y}-third-term-theory-view.html`,

    // Other related student pages
    `y${y}-cbt-student.html`,
    `student-dashboard.html`,
  ];

  // ===============================
  // TEACHER PAGES
  // ===============================
  accessMap[`teacher-year${y}`] = [
    // First Term
    `year${y}-first-term-cbt.html`,
    `year${y}-first-term-lesson-teacher.html`,
    `year${y}-first-term-lesson-upload.html`,
    `year${y}-first-term-results.html`,
    `year${y}-first-term-theory.html`,

    // Second Term
    `year${y}-second-term-cbt.html`,
    `year${y}-second-term-lesson-teacher.html`,
    `year${y}-second-term-lesson-upload.html`,
    `year${y}-second-term-results.html`,
    `year${y}-second-term-theory.html`,

    // Third Term
    `year${y}-third-term-cbt.html`,
    `year${y}-third-term-lesson-teacher.html`,
    `year${y}-third-term-lesson-upload.html`,
    `year${y}-third-term-results.html`,
    `year${y}-third-term-theory.html`,

    // Extra teacher files (non-year-prefixed)
    `y${y}-cbt-teacher.html`,
    `y${y}-cbt-result.html`,
    `teacher-dashboard.html`,
  ];
});


// ==========================================
// AUTH STATE HANDLER
// ==========================================
onAuthStateChanged(auth, async (user) => {
  const currentPage = window.location.pathname.split("/").pop();

  // Skip guard if page is public
  if (publicPages.includes(currentPage)) {
    return;
  }

  if (!user) {
    redirectToLogin();
    return;
  }

  try {
    const cached = JSON.parse(localStorage.getItem("roleAuthUser"));
    if (cached && cached.uid === user.uid) {
      checkAccess(cached.role, cached.year, currentPage);
      return;
    }

    const q = query(collection(db, "users"), where("uid", "==", user.uid));
    const snap = await getDocs(q);

    if (snap.empty) {
      alert("User not found in database.");
      await signOut(auth);
      redirectToLogin();
      return;
    }

    const data = snap.docs[0].data();
    const { role, year } = data;
    localStorage.setItem("roleAuthUser", JSON.stringify({ uid: user.uid, role, year }));

    checkAccess(role, year, currentPage);
  } catch (err) {
    console.error("Auth error:", err);
    redirectToLogin();
  }
});

// ==========================================
// ACCESS VALIDATION
// ==========================================
function checkAccess(role, year, page) {
  if (role === "admin") return; // unrestricted
  if (publicPages.includes(page)) return; // always allowed

  const key = `${role}-${year}`;
  const allowed = accessMap[key] || [];

  if (!allowed.includes(page)) {
    alert("Access denied. You are not allowed to open this page.");
    window.location.href = `${role}-dashboard.html`;
  }
}

function redirectToLogin() {
  localStorage.removeItem("roleAuthUser");
  window.location.href = "login.html";
}
