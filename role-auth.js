// =========================================================
// role-auth.js (FINAL STRICT VERSION)
// Enforces class + role security (cannot bypass with URL)
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
// PAGE LISTS YOU PROVIDED (STRICT ENFORCEMENT)
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
// UNIVERSAL CLASS NORMALIZER — WORKS WITH ANY FORMAT
// ---------------------------------------------------------
function normalizeClass(value) {
  if (!value) return null;
  value = String(value).toLowerCase();

  // match year5, year 5
  let m = value.match(/year\s*?(\d)/);
  if (m) return "year" + m[1];

  // match y5
  let m2 = value.match(/y\s*?(\d)/);
  if (m2) return "year" + m2[1];

  // match any number 1-9 inside filename
  let m3 = value.match(/(\d)/);
  if (m3) return "year" + m3[1];

  return null;
}

// Extract filename
function getFilename(path) {
  return path.split("/").pop().toLowerCase();
}

// Extract class from filename
function getClassFromFilename(filename) {
  return normalizeClass(filename);
}

// Redirects
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
// MAIN STRICT SECURITY
// ---------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {

  const filename = getFilename(window.location.pathname);
  const pageClass = getClassFromFilename(filename);

  const isTeacherPage = teacherPages.has(filename);
  const isStudentPage = studentPages.has(filename);

  if (!isTeacherPage && !isStudentPage) {
    return; // public or non-secure page
  }

  // --- Load saved user ---
  let user = JSON.parse(localStorage.getItem("roleAuthUser") || "null");
  let role = user?.role || null;
  let userClass = normalizeClass(user?.year || user?.class);

  // --- If missing info, load from Firebase ---
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

      localStorage.setItem("roleAuthUser", JSON.stringify({
        uid: firebaseUser.uid,
        role,
        year: userClass
      }));

    } catch (err) {
      return goLogin();
    }
  }

  if (!role) return goLogin();

  // Admin can open everything
  if (role === "admin") return;

  // Teacher restrictions
  if (isTeacherPage && role !== "teacher") {
    return goRoleHome(role);
  }

  // Student restrictions
  if (isStudentPage && role !== "student") {
    return goRoleHome(role);
  }

  // Class enforcement — cannot bypass with URL
  if (pageClass && userClass && pageClass !== userClass) {
    return goRoleHome(role);
  }

  // Page allowed
  return;
});
