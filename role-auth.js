// role-auth.js
// Automatically injected by service-worker.js
// Handles login enforcement + role authorization + class locking

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

// Public student landing pages
const explicitlyPublicPages = new Set([
  "year1-s.html",
  "year2-s.html",
  "year3-s.html",
  "year4-s.html",
  "year5-s.html",
  "year6-s.html"
]);

// ------------------ BYPASS FIX (IMPORTANT) ------------------
// These pages LOOK like dashboards but are not real dashboards.
// They must NOT trigger redirects.
const bypassAuthPages = new Set([
  "year5-first-term-student-dashboard.html",
  "year5-second-term-student-dashboard.html",
  "year5-third-term-student-dashboard.html",
  "year5-first-term-teacher-dashboard.html",
  "year5-second-term-teacher-dashboard.html",
  "year5-third-term-teacher-dashboard.html"
]);

// ------------------ HELPERS ------------------
function getFilename(path) {
  const parts = path.split("/");
  return (parts.pop() || "index.html").toLowerCase();
}

function normalizeClass(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/primary/, "year")
    .replace(/^p(\d)/, "year$1")
    .replace(/^class(\d)/, "year$1")
    .replace(/^basic(\d)/, "year$1")
    .replace(/[^a-z0-9]/g, "");
}

function detectClassFromPage(filename) {
  const m = filename.match(/(?:year|y|primary|class|basic)(\d)/i);
  return m ? `year${m[1]}` : null;
}

function redirectLogin() {
  window.location.href = "/login.html";
}

function redirectRole(role) {
  switch (role) {
    case "admin":
      window.location.href = "/admin-dashboard.html";
      break;
    case "teacher":
      window.location.href = "/teacher-dashboard.html";
      break;
    case "student":
      window.location.href = "/student-dashboard.html";
      break;
    default:
      redirectLogin();
  }
}

// ------------------ MAIN LOGIC ------------------
document.addEventListener("DOMContentLoaded", async () => {
  const filename = getFilename(window.location.pathname);

  // 1️⃣ Bypass pages (fix for your issue)
  if (bypassAuthPages.has(filename)) {
    console.log("Bypassed auth for:", filename);
    return;
  }

  // 2️⃣ Public landing pages
  if (explicitlyPublicPages.has(filename)) {
    console.log("Public page:", filename);
    return;
  }

  // 3️⃣ Determine type
  const impliedClass = detectClassFromPage(filename);

  const isTeacherPage =
    teacherPages.has(filename) ||
    /(?:-t|cbt-teacher|lesson-teacher|result)(?:\.html)?$/i.test(filename);

  const isStudentPage =
    studentPages.has(filename) ||
    /(?:-s|lesson-view|theory-view|cbt-student)(?:\.html)?$/i.test(filename);

  const restricted = isTeacherPage || isStudentPage || Boolean(impliedClass);

  if (!restricted) return;

  // ------------------ LOCAL STORAGE FIRST ------------------
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("roleAuthUser"));
  } catch {}

  let role = user?.role?.toLowerCase() || null;
  let userClass = normalizeClass(user?.year || user?.userClass || user?.class);

  // ------------------ FIREBASE FALLBACK ------------------
  if (!role || (impliedClass && !userClass)) {
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

      role = (data.role || "").toLowerCase();
      userClass = normalizeClass(data.year || data.userClass || data.class);

      localStorage.setItem(
        "roleAuthUser",
        JSON.stringify({
          uid: currentUser.uid,
          role,
          year: data.year || data.userClass || data.class
        })
      );
    } catch (err) {
      console.error("role-auth Firebase error:", err);
      return redirectLogin();
    }
  }

  // ------------------ FINAL AUTH CHECKS ------------------
  if (!role) return redirectLogin();

  if (role === "admin") return;

  const pageRequiredClass = normalizeClass(impliedClass);

  // Teacher pages
  if (isTeacherPage) {
    if (role !== "teacher") return redirectRole(role);
    if (pageRequiredClass && userClass !== pageRequiredClass)
      return redirectRole(role);
    return;
  }

  // Student pages
  if (isStudentPage) {
    if (role !== "student") return redirectRole(role);
    if (pageRequiredClass && userClass !== pageRequiredClass)
      return redirectRole(role);
    return;
  }

  return redirectLogin();
});
