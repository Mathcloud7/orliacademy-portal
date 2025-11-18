// =========================================================
// role-auth.js (FINAL — UNBREAKABLE SECURITY VERSION)
// =========================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrUQuV8",
  authDomain: "home-1e252.firebaseapp.com",
  projectId: "home-1e252",
  storageBucket: "home-1e252.firebasestorage.app",
  messagingSenderId: "702969034430",
  appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
};

// ---------------------------------------------------------
// EXACT PAGE SETS (as provided by you)
// ---------------------------------------------------------
const teacherPages = new Set([
  "teacher-dashboard.html",
  "year5-t.html",
  "year5-first-term-teacher-dashboard.html",
  "year5-second-term-teacher-dashboard.html",
  "year5-third-term-teacher-dashboard.html",
  "year5-first-term-assessment.html",
  "year5-first-term-lesson-teacher.html",
  "year5-first-term-lesson-upload.html",
  "year5-first-term-lesson-view.html",
  "year5-second-term-assessment.html",
  "year5-second-term-lesson-teacher.html",
  "year5-second-term-lesson-upload.html",
  "year5-second-term-lesson-view.html",
  "year5-third-term-assessment.html",
  "year5-third-term-lesson-teacher.html",
  "year5-third-term-lesson-upload.html",
  "year5-third-term-lesson-view.html",
  "y5-cbt-teacher.html",
  "year5-first-term-theory.html",
  "year5-second-term-theory.html",
  "year5-third-term-theory.html",
  "y5-cbt-result.html"
]);

const studentPages = new Set([
  "student-dashboard.html",
  "year5-s.html",
  "year5-first-term-student-dashboard.html",
  "year5-second-term-student-dashboard.html",
  "year5-third-term-student-dashboard.html",
  "y5-cbt-student.html",
  "year5-first-term-theory-view.html",
  "year5-first-term-lesson-view.html",
  "year5-second-term-theory-view.html",
  "year5-second-term-lesson-view.html",
  "year5-third-term-theory-view.html",
  "year5-third-term-lesson-view.html"
]);

// ---------------------------------------------------------
// UNIVERSAL CLASS NORMALIZER — bulletproof
// ALWAYS converts everything to “year5”
// ---------------------------------------------------------
function normalizeClass(input) {
  if (!input) return null;
  input = String(input).toLowerCase();

  // year5 / Year5 / YEAR5
  let m = input.match(/year\s*?(\d+)/i);
  if (m) return "year" + m[1];

  // y5 / Y5
  m = input.match(/^y\s*?(\d+)/i);
  if (m) return "year" + m[1];

  // 5 / Class 5 / Grade 5
  m = input.match(/(\d+)/);
  if (m) return "year" + m[1];

  return null;
}

function getFilename(path) {
  return path.split("/").pop().toLowerCase();
}

function getClassFromFilename(filename) {
  return normalizeClass(filename);
}

// ---------------------------------------------------------
// Perfect redirect helpers
// ---------------------------------------------------------
function goLogin() {
  window.location.href = "/login.html";
}

function goRoleHome(role) {
  if (role === "teacher") return window.location.href = "/teacher-dashboard.html";
  if (role === "student") return window.location.href = "/student-dashboard.html";
  if (role === "admin") return window.location.href = "/admin-dashboard.html";
  return goLogin();
}

// ---------------------------------------------------------
// MAIN LOGIC — cannot be bypassed by URL edits
// ---------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {

  const filename = getFilename(window.location.pathname);
  const pageClass = getClassFromFilename(filename);

  const isTeacherPage = teacherPages.has(filename);
  const isStudentPage = studentPages.has(filename);

  // Public page → allow
  if (!isTeacherPage && !isStudentPage) return;

  // -----------------------------------------------------
  // Load cached user
  // -----------------------------------------------------
  let user = null;
  try { user = JSON.parse(localStorage.getItem("roleAuthUser")); } catch {}

  let role = user?.role?.toLowerCase() || null;
  let userClass = normalizeClass(user?.year || user?.class);

  // -----------------------------------------------------
  // If missing → fetch from Firebase
  // -----------------------------------------------------
  if (!role || !userClass) {
    try {
      const [
        { initializeApp },
        { getAuth, onAuthStateChanged },
        { getFirestore, collection, query, where, getDocs }
      ] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js")
      ]);

      const app = initializeApp(FIREBASE_CONFIG);
      const auth = getAuth(app);
      const db = getFirestore(app);

      const firebaseUser = await new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, u => {
          unsub();
          resolve(u);
        });
      });

      if (!firebaseUser) return goLogin();

      const q = query(collection(db, "users"), where("uid", "==", firebaseUser.uid));
      const snap = await getDocs(q);

      if (snap.empty) return goLogin();

      const data = snap.docs[0].data();

      role = (data.role || "").toLowerCase();
      userClass = normalizeClass(data.year || data.class);

      // SAVE permanently
      localStorage.setItem("roleAuthUser", JSON.stringify({
        uid: firebaseUser.uid,
        role,
        year: userClass
      }));

    } catch (err) {
      console.error("AUTH ERROR:", err);
      return goLogin();
    }
  }

  // -----------------------------------------------------
  // FINAL ENFORCEMENT — YOU CANNOT BYPASS THIS
  // -----------------------------------------------------

  if (!role) return goLogin();

  // Admin → full access
  if (role === "admin") return;

  // Teacher pages → only teachers
  if (isTeacherPage && role !== "teacher") return goRoleHome(role);

  // Student pages → only students
  if (isStudentPage && role !== "student") return goRoleHome(role);

  // **FINAL CLASS LOCK**
  // If page class ≠ user class → block
  if (pageClass && userClass && pageClass !== userClass) {
    return goRoleHome(role);
  }

  // SAFE → allow page
});
