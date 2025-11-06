// role-auth.js
// Enforces role + class-based access, but makes year1-s ... year6-s public
// This file is injected automatically by your service worker.

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

// ✅ Allow all "yearX-s.html" pages to load freely (public access)
(function() {
  const publicStudentPages = [
    'year1-s.html',
    'year2-s.html',
    'year3-s.html',
    'year4-s.html',
    'year5-s.html',
    'year6-s.html'
  ];

  const currentPage = window.location.pathname.split('/').pop().toLowerCase();
  if (publicStudentPages.includes(currentPage)) {
    console.log('✅ Public student page — bypassing role check for:', currentPage);
    return; // stop here — don't run role checks below
  }
})();


// ---------- HELPERS ----------
function normalizeClassString(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/\s+/g, '')        // remove spaces
    .replace(/primary/, 'year') // "primary5" -> "year5"
    .replace(/^p(\d)/, 'year$1')// "p5" -> "year5"
    .replace(/^class(\d)/, 'year$1')
    .replace(/^basic(\d)/, 'year$1')
    .replace(/[^a-z0-9]/g, ''); // remove anything else
}

function getRequiredClassFromPath(pathname) {
  const m = pathname.match(/(?:year|y|primary|class|basic)(\d)/i);
  return m ? `year${m[1]}` : null;
}

function getFilenameFromPath(pathname) {
  const segs = pathname.split('/');
  let last = segs.pop() || segs.pop(); // handle trailing slash
  if (!last) last = 'index.html';
  return last.toLowerCase();
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

  // If page is explicitly public, allow immediately
  if (explicitlyPublicPages.has(filename)) {
    return; // public: no auth required
  }

  // Determine if page is restricted (teacher/student/class-specific)
  const requiredClass = getRequiredClassFromPath(filename);
  const isTeacherPage = teacherPages.has(filename) || /-t|teacher|cbt-teacher|lesson-teacher|result/i.test(filename);
  const isStudentPage = studentPages.has(filename) || /-s|student|lesson-view|theory-view|cbt-student/i.test(filename);
  const isRestricted = isTeacherPage || isStudentPage || Boolean(requiredClass);

  if (!isRestricted) {
    // Not a restricted page — public
    return;
  }

  // Try localStorage first
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('roleAuthUser'));
  } catch (e) { /* ignore parse errors */ }

  let userRole = user?.role?.toLowerCase() || null;
  let userClass = normalizeClassString(user?.year || user?.userClass || user?.class);

  // If missing info, fallback to Firebase
  if (!userRole || (requiredClass && !userClass)) {
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

      if (!currentUser) {
        // Not authenticated
        redirectToLogin();
        return;
      }

      const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const data = snap.docs[0].data();
        userRole = (data.role || '').toLowerCase();
        userClass = normalizeClassString(data.year || data.userClass || data.class);

        // Update localStorage for faster checks next time
        try {
          localStorage.setItem('roleAuthUser', JSON.stringify({
            uid: currentUser.uid,
            role: userRole,
            year: data.year || data.userClass || data.class
          }));
        } catch (e) { /* ignore storage errors */ }
      } else {
        redirectToLogin();
        return;
      }
    } catch (err) {
      console.error('role-auth: Firebase fetch failed', err);
      redirectToLogin();
      return;
    }
  }

  if (!userRole) {
    redirectToLogin();
    return;
  }

  // Admin has full access
  if (userRole === 'admin') return;

  const requiredClassNorm = normalizeClassString(requiredClass || '');

  // Teacher pages enforcement
  if (isTeacherPage) {
    if (userRole !== 'teacher') {
      redirectToDashboardForRole(userRole);
      return;
    }
    if (requiredClassNorm && userClass && userClass !== requiredClassNorm) {
      redirectToDashboardForRole(userRole);
      return;
    }
    return; // allowed
  }

  // Student pages enforcement
  if (isStudentPage) {
    if (userRole !== 'student') {
      redirectToDashboardForRole(userRole);
      return;
    }
    if (requiredClassNorm && userClass && userClass !== requiredClassNorm) {
      redirectToDashboardForRole(userRole);
      return;
    }
    return; // allowed
  }

  // Default deny
  redirectToLogin();
});

