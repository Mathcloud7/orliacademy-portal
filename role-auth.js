// ==========================================
// UNIVERSAL ROLE-BASED ACCESS CONTROL SYSTEM
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js";

// Firebase Config
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
// ACCESS MAP (ADMIN, TEACHER, STUDENT)
// ==========================================
const accessMap = {
  admin: "ALL",
};

// Include both `year` and `y` versions
const years = [1, 2, 3, 4, 5, 6];
years.forEach((y) => {
  // STUDENT PAGES
  accessMap[`student-year${y}`] = [
    `year${y}-first-term-assessment-student.html`,
    `year${y}-first-term-assessment.html`,
    `year${y}-first-term-lesson-view.html`,
    `year${y}-first-term-student-dashboard.html`,
    `year${y}-first-term-theory-view.html`,

    `year${y}-second-term-assessment-student.html`,
    `year${y}-second-term-assessment.html`,
    `year${y}-second-term-lesson-view.html`,
    `year${y}-second-term-student-dashboard.html`,
    `year${y}-second-term-theory-view.html`,

    `year${y}-third-term-assessment-student.html`,
    `year${y}-third-term-assessment.html`,
    `year${y}-third-term-lesson-view.html`,
    `year${y}-third-term-student-dashboard.html`,
    `year${y}-third-term-theory-view.html`,

    // Support y1... naming too
    `y${y}-first-term-assessment-student.html`,
    `y${y}-first-term-assessment.html`,
    `y${y}-first-term-lesson-view.html`,
    `y${y}-first-term-student-dashboard.html`,
    `y${y}-first-term-theory-view.html`,
    `y${y}-second-term-assessment-student.html`,
    `y${y}-second-term-assessment.html`,
    `y${y}-second-term-lesson-view.html`,
    `y${y}-second-term-student-dashboard.html`,
    `y${y}-second-term-theory-view.html`,
    `y${y}-third-term-assessment-student.html`,
    `y${y}-third-term-assessment.html`,
    `y${y}-third-term-lesson-view.html`,
    `y${y}-third-term-student-dashboard.html`,
    `y${y}-third-term-theory-view.html`,
  ];

  // TEACHER PAGES
  accessMap[`teacher-year${y}`] = [
    `y${y}-cbt-result.html`,
    `y${y}-cbt-student.html`,
    `y${y}-cbt-teacher.html`,
    `year${y}-first-term-cbt.html`,
    `year${y}-first-term-lesson-teacher.html`,
    `year${y}-first-term-lesson-upload.html`,
    `year${y}-first-term-results.html`,
    `year${y}-first-term-teacher-dashboard.html`,
    `year${y}-first-term-theory.html`,
    `year${y}-second-term-cbt.html`,
    `year${y}-second-term-lesson-teacher.html`,
    `year${y}-second-term-lesson-upload.html`,
    `year${y}-second-term-results.html`,
    `year${y}-second-term-teacher-dashboard.html`,
    `year${y}-second-term-theory.html`,
    `year${y}-third-term-cbt.html`,
    `year${y}-third-term-lesson-teacher.html`,
    `year${y}-third-term-lesson-upload.html`,
    `year${y}-third-term-results.html`,
    `year${y}-third-term-teacher-dashboard.html`,
    `year${y}-third-term-theory.html`,
    `year${y}.html`,
    `year${y}enteranceupload.html`,

    // support y1... pattern duplicates
    `y${y}-first-term-cbt.html`,
    `y${y}-first-term-lesson-teacher.html`,
    `y${y}-first-term-lesson-upload.html`,
    `y${y}-first-term-results.html`,
    `y${y}-first-term-teacher-dashboard.html`,
    `y${y}-first-term-theory.html`,
    `y${y}-second-term-cbt.html`,
    `y${y}-second-term-lesson-teacher.html`,
    `y${y}-second-term-lesson-upload.html`,
    `y${y}-second-term-results.html`,
    `y${y}-second-term-teacher-dashboard.html`,
    `y${y}-second-term-theory.html`,
    `y${y}-third-term-cbt.html`,
    `y${y}-third-term-lesson-teacher.html`,
    `y${y}-third-term-lesson-upload.html`,
    `y${y}-third-term-results.html`,
    `y${y}-third-term-teacher-dashboard.html`,
    `y${y}-third-term-theory.html`,
    `y${y}.html`,
    `y${y}enteranceupload.html`,
  ];
});

// ==========================================
// AUTH STATE HANDLER
// ==========================================
onAuthStateChanged(auth, async (user) => {
  const currentPage = window.location.pathname.split("/").pop();

  if (currentPage === "login.html") return;

  if (!user) {
    redirectToLogin();
    return;
  }

  try {
    // Cached user data
    const cached = JSON.parse(localStorage.getItem("roleAuthUser"));
    if (cached && cached.uid === user.uid) {
      checkAccess(cached.role, cached.year, currentPage);
      return;
    }

    // Fetch from Firestore
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

    // Cache for reuse
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
