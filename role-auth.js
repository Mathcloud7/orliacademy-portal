```javascript
// ================================================
// FINAL ROLE-AUTH.JS (COMPLETE & FULLY WORKING)
// ================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js";

// ================================================
// FIREBASE CONFIG (UNCHANGED)
// ================================================
const firebaseConfig = {
  apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrUQuV8",
  authDomain: "home-1e252.firebaseapp.com",
  projectId: "home-1e252",
  storageBucket: "home-1e252.firebasestorage.app",
  messagingSenderId: "702969034430",
  appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

// ================================================
// PAGE ROUTE ANALYSIS
// ================================================
const currentPage = window.location.pathname.split("/").pop().toLowerCase();

// Helper: extract year (1–6) from filename
function extractYear(page) {
  const match = page.match(/year([1-6])/);
  const altMatch = page.match(/y([1-6])-/);
  if (match) return parseInt(match[1]);
  if (altMatch) return parseInt(altMatch[1]);
  return null;
}

const pageYear = extractYear(currentPage);
const isTeacherPage = currentPage.includes("teacher");
const isStudentPage = currentPage.includes("student");
const isDashboardPage = currentPage.includes("dashboard");

// ================================================
// AUTH GUARD
// ================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    return (window.location.href = "login.html");
  }

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    alert("Account record missing.");
    return signOut(auth);
  }

  const userData = userSnap.data();
  const role = userData.role; // admin | teacher | student
  const year = userData.year ? parseInt(userData.year) : null;

  // ================================================
  // ADMIN → FULL ACCESS
  // ================================================
  if (role === "admin") return;

  // ================================================
  // YEAR CHECK REQUIRED FOR TEACHERS & STUDENTS
  // ================================================
  if (!pageYear) return;
  if (!year) return;

  // ================================================
  // ROLE RULES
  // ================================================

  // BLOCK TEACHER from student pages
  if (role === "teacher") {
    if (isStudentPage) {
      alert("Teachers cannot access student pages.");
      return (window.location.href = "login.html");
    }

    if (pageYear !== year) {
      alert("You cannot access another class's pages.");
      return (window.location.href = "login.html");
    }

    return;
  }

  // BLOCK STUDENT from teacher pages
  if (role === "student") {
    if (isTeacherPage) {
      alert("Students cannot access teacher pages.");
      return (window.location.href = "login.html");
    }

    if (pageYear !== year) {
      alert("You cannot access another class's pages.");
      return (window.location.href = "login.html");
    }

    return;
  }

  // Unknown role
  alert("Invalid role. Contact admin.");
  signOut(auth);
});

// ================================================
// OPTIONAL: LOGOUT HANDLER
// ================================================
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => signOut(auth));
}
```}]}

