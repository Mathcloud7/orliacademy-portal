// role-auth.js
// FINAL — Role based access control ONLY

// ------------------ FIREBASE CONFIG ------------------
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrUQuV8",
  authDomain: "home-1e252.firebaseapp.com",
  projectId: "home-1e252",
  storageBucket: "home-1e252.firebasestorage.app",
  messagingSenderId: "702969034430",
  appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
};

// ------------------ PAGE GROUPS ------------------

// Teacher pages only
const teacherPages = new Set([
  "teacher-dashboard.html",
  "year5-first-term-teacher-dashboard.html",
  "year5-second-term-teacher-dashboard.html",
  "year5-third-term-teacher-dashboard.html",
  "year5-first-term-assessment.html",
  "year5-second-term-assessment.html",
  "year5-third-term-assessment.html",
  "year5-first-term-lesson-upload.html",
  "year5-second-term-lesson-upload.html",
  "year5-third-term-lesson-upload.html",
  "year5-first-term-lesson-teacher.html",
  "year5-second-term-lesson-teacher.html",
  "year5-third-term-lesson-teacher.html",
  "year5-first-term-lesson-view.html",
  "year5-second-term-lesson-view.html",
  "year5-third-term-lesson-view.html",
  "y5-cbt-teacher.html",
  "y5-cbt-result.html"
]);

// Student pages only
const studentPages = new Set([
  "student-dashboard.html",
  "year5-first-term-student-dashboard.html",
  "year5-second-term-student-dashboard.html",
  "year5-third-term-student-dashboard.html",
  "year5-first-term-lesson-view.html",
  "year5-second-term-lesson-view.html",
  "year5-third-term-lesson-view.html",
  "y5-cbt-student.html",
  "year5-first-term-theory-view.html",
  "year5-second-term-theory-view.html",
  "year5-third-term-theory-view.html"
]);

// Public pages (no login needed)
const publicPages = new Set([
  "index.html",
  "login.html"
]);

function getFilename(path) {
  const p = path.split("/");
  return (p.pop() || "index.html").toLowerCase();
}

function redirectLogin() {
  window.location.href = "/login.html";
}

function redirectRole(role) {
  switch (role) {
    case "teacher":
      window.location.href = "/teacher-dashboard.html";
      break;
    case "student":
      window.location.href = "/student-dashboard.html";
      break;
    case "admin":
      window.location.href = "/admin-dashboard.html";
      break;
    default:
      redirectLogin();
  }
}

// ------------------ MAIN AUTH CONTROLLER ------------------
document.addEventListener("DOMContentLoaded", async () => {
  const filename = getFilename(window.location.pathname);

  // Public → allow
  if (publicPages.has(filename)) return;

  // Try LocalStorage first
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("roleAuthUser"));
  } catch {}

  let role = user?.role || null;

  // If missing → Firebase lookup
  if (!role) {
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

      const currentUser = await new Promise(resolve => {
        const unsub = onAuthStateChanged(auth, u => {
          unsub();
          resolve(u);
        });
      });

      if (!currentUser) return redirectLogin();

      const q = query(collection(db, "users"), where("uid", "==", currentUser.uid));
      const snap = await getDocs(q);
      if (snap.empty) return redirectLogin();

      const data = snap.docs[0].data();
      role = data.role;

      localStorage.setItem("roleAuthUser", JSON.stringify({ uid: currentUser.uid, role }));
    } catch {
      return redirectLogin();
    }
  }

  // ADMIN → access all pages
  if (role === "admin") return;

  // Teacher page but user not teacher
  if (teacherPages.has(filename) && role !== "teacher") {
    return redirectRole(role);
  }

  // Student page but user not student
  if (studentPages.has(filename) && role !== "student") {
    return redirectRole(role);
  }

  // All good → allow page
});
