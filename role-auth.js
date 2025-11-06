// role-auth.js
// Enforces role + class-based access automatically
// This script is injected automatically by your service worker

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrUQuV8",
  authDomain: "home-1e252.firebaseapp.com",
  projectId: "home-1e252",
  storageBucket: "home-1e252.firebasestorage.app",
  messagingSenderId: "702969034430",
  appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
};

// ---------- PAGE LISTS ----------
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

// ---------- HELPERS ----------
function normalizeClassString(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/\s+/g, '')       // remove spaces
    .replace(/primary/, 'year') // convert "primary" -> "year"
    .replace(/^p(\d)/, 'year$1') // convert "p5" -> "year5"
    .replace(/^class(\d)/, 'year$1') // convert "class5" -> "year5"
    .replace(/^basic(\d)/, 'year$1') // convert "basic5" -> "year5"
    .replace(/[^a-z0-9]/g, '');     // remove any other characters
}

function getRequiredClassFromPath(pathname) {
  const m = pathname.match(/(?:year|y|primary|class|basic)(\d)/i);
  return m ? `year${m[1]}` : null;
}

function getFilenameFromPath(pathname) {
  const segs = pathname.split('/');
  let last = segs.pop() || segs.pop();
  return (last || 'index.html').toLowerCase();
}

function redirectToLogin() {
  window.location.href = '/login.html';
}

function redirectToDashboardForRole(role) {
  if (role === 'admin') return window.location.href = '/admin-dashboard.html';
  if (role === 'teacher') return window.location.href = '/teacher-dashboard.html';
  if (role === 'student') return window.location.href = '/student-dashboard.html';
  return window.location.href = '/login.html';
}

// ---------- MAIN ENFORCEMENT ----------
document.addEventListener('DOMContentLoaded', async () => {
  const pathname = window.location.pathname;
  const filename = getFilenameFromPath(pathname);

  const requiredClass = getRequiredClassFromPath(filename);
  const isTeacherPage = teacherPages.has(filename) || /-t|teacher|cbt-teacher|lesson-teacher|result/i.test(filename);
  const isStudentPage = studentPages.has(filename) || /-s|student|lesson-view|theory-view|cbt-student/i.test(filename);
  const isRestricted = isTeacherPage || isStudentPage || requiredClass;

  if (!isRestricted) return; // public page

  // Try localStorage first
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('roleAuthUser'));
  } catch (e) {}

  let userRole = user?.role?.toLowerCase() || null;
  let userClass = normalizeClassString(user?.year || user?.userClass || user?.class);

  if (!userRole || !userClass) {
    // Fallback to Firebase Auth
    try {
      const [
        { initializeApp },
        { getAuth, onAuthStateChanged },
        { getFirestore, collection, query, where, getDocs }
      ] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js')
      ]);

      const app = initializeApp(FIREBASE_CONFIG);
      const auth = getAuth(app);
      const db = getFirestore(app);

      const currentUser = await new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (u) => {
          unsub();
          resolve(u);
        });
      });

      if (!currentUser) return redirectToLogin();

      const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const data = snap.docs[0].data();
        userRole = (data.role || '').toLowerCase();
        userClass = normalizeClassString(data.year || data.userClass || data.class);

        localStorage.setItem('roleAuthUser', JSON.stringify({
          uid: currentUser.uid,
          role: userRole,
          year: data.year || data.userClass || data.class
        }));
      } else {
        return redirectToLogin();
      }
    } catch (err) {
      console.error('role-auth: Firebase fetch failed', err);
      return redirectToLogin();
    }
  }

  if (!userRole) return redirectToLogin();

  if (userRole === 'admin') return; // full access

  const requiredClassNorm = normalizeClassString(requiredClass);

  // --- Teacher Pages ---
  if (isTeacherPage) {
    if (userRole !== 'teacher') return redirectToDashboardForRole(userRole);
    if (requiredClassNorm && userClass && userClass !== requiredClassNorm)
      return redirectToDashboardForRole(userRole);
    return;
  }

  // --- Student Pages ---
  if (isStudentPage) {
    if (userRole !== 'student') return redirectToDashboardForRole(userRole);
    if (requiredClassNorm && userClass && userClass !== requiredClassNorm)
      return redirectToDashboardForRole(userRole);
    return;
  }

  // Default deny
  return redirectToLogin();
});
