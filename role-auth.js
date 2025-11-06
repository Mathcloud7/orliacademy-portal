// role-auth.js
// Usage: include as <script type="module" src="/role-auth.js"></script>
// Enforces role + class-based access. Relies on localStorage.roleAuthUser (set by your login script).
// Falls back to Firebase Auth + Firestore lookup if needed.

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrUQuV8",
  authDomain: "home-1e252.firebaseapp.com",
  projectId: "home-1e252",
  storageBucket: "home-1e252.firebasestorage.app",
  messagingSenderId: "702969034430",
  appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
};

// ---------- Lists from your spec ----------
const teacherPages = new Set([
  "teacher-dashboard.html",
  "year5-t.html",
  "year5-first-term-teacher-dashboard.html",
  "year5-second-term-teacher-dashboard.html",
  "year5-third-term-teacher-dashboard.html",
  "ear5-first-term-assessment.html",
  "year5-first-term-lesson-teacher.html",
  "year5-first-term-lesson-upload.html",
  "year5-first-term-lesson-view.html",
  "ear5-second-term-assessment.html",
  "year5-second-term-lesson-teacher.html",
  "year5-second-term-lesson-upload.html",
  "year5-second-term-lesson-view.html",
  "ear5-third-term-assessment.html",
  "year5-third-term-lesson-teacher.html",
  "year5-third-term-lesson-upload.html",
  "year5-third-term-lesson-view.html",
  "y5-cbt-teacher.html",
  "year5-first-term-theory.html",
  "year5-second-term-theory.html",
  "year5-third-term-theory.html",
  "y5-cbt-result.html"
  // note: you said same for year1..year6 — this script detects "yearN" automatically
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

// ---------- Helpers ----------
function normalizeClassString(s) {
  if (!s) return '';
  const str = String(s).toLowerCase().replace(/\s+/g, '');

  // match numeric year like 1-6
  const match = str.match(/(?:year|y|primary)?(\d)/i);
  if (match) return `year${match[1]}`;

  return str;
}

// Extract class requirement from filename (like year5-s.html => year5)
function getRequiredClassFromPath(pathname) {
  const m = pathname.match(/(?:year|y)(\d)/i);
  return m ? `year${m[1]}` : null;
}


function getFilenameFromPath(pathname) {
  const segs = pathname.split('/');
  let last = segs.pop() || segs.pop(); // handle trailing slash
  // If no filename (like "/"), treat as index.html
  if (!last) last = 'index.html';
  return last.toLowerCase();
}

function redirectToLogin() {
  window.location.href = '/login.html';
}

// If role mismatch, redirect to their dashboard (if known)
function redirectToDashboardForRole(role) {
  if (role === 'admin') window.location.href = '/admin-dashboard.html';
  if (role === 'teacher') window.location.href = '/teacher-dashboard.html';
  if (role === 'student') window.location.href = '/student-dashboard.html';
  // otherwise fallback to login
  window.location.href = '/login.html';
}

// ---------- Main enforcement ----------
document.addEventListener('DOMContentLoaded', async () => {
  const pathname = window.location.pathname;
  const filename = getFilenameFromPath(pathname);

  // If this filename is not in either lists and doesn't match 'yearN' pattern,
  // treat as PUBLIC and allow.
  const isTeacherPage = teacherPages.has(filename) || /year\d/i.test(filename) && /-t|teacher|lesson-teacher|cbt-teacher|result/i.test(filename);
  const isStudentPage = studentPages.has(filename) || /year\d/i.test(filename) && /-s|student|lesson-view|theory-view|cbt-student/i.test(filename);

  // but we will use explicit detection: page is restricted if it appears in either list OR has 'yearN' in name matching "yearX-" prefix
  const requiredClass = getRequiredClassFromPath(filename);
  const isRestrictedByClass = Boolean(requiredClass); // e.g. Year 5 pages
  const isExplicitRestricted = teacherPages.has(filename) || studentPages.has(filename) || isRestrictedByClass;

  if (!isExplicitRestricted) {
    // Not restricted — public page: allow
    return;
  }

  // Try localStorage first
  let roleAuthUser = null;
  try {
    const raw = localStorage.getItem('roleAuthUser');
    if (raw) roleAuthUser = JSON.parse(raw);
  } catch (e) {
    console.warn('role-auth: failed to parse localStorage.roleAuthUser', e);
  }

  // normalize fields
  let userRole = roleAuthUser && roleAuthUser.role ? String(roleAuthUser.role).toLowerCase() : null;
  let userClassRaw = roleAuthUser && (roleAuthUser.year || roleAuthUser.userClass || roleAuthUser.userclass || roleAuthUser.class) ? (roleAuthUser.year || roleAuthUser.userClass || roleAuthUser.userclass || roleAuthUser.class) : null;

  // normalize strings
  let userClassNorm = normalizeClassString(userClassRaw); // e.g. "year5" or "year1"
  let requiredClassNorm = requiredClass ? normalizeClassString(requiredClass) : null;

  // If localStorage is missing role or class info, try to fetch from Firebase (fallback)
  if (!userRole || (isRestrictedByClass && !userClassNorm)) {
    try {
      // dynamic import of Firebase (same version you already use)
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

      // Wrap onAuthStateChanged into a promise
      const currentUser = await new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (u) => {
          unsub();
          resolve(u);
        });
      });

      if (!currentUser) {
        console.warn('role-auth: no logged-in user found (Firebase). Redirecting to login.');
        redirectToLogin();
        return;
      }

      // Query users collection where uid == currentUser.uid
      try {
        const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docData = snap.docs[0].data();
          userRole = (docData.role || userRole || '').toLowerCase();
          // accept either 'year' or 'userClass' stored in Firestore
          userClassRaw = docData.year || docData.userClass || docData.userclass || docData.class || userClassRaw;
          userClassNorm = normalizeClassString(userClassRaw);

          // update localStorage for faster subsequent checks
          try {
            localStorage.setItem('roleAuthUser', JSON.stringify({
              uid: currentUser.uid,
              role: userRole,
              year: docData.year || docData.userClass || docData.userclass || docData.class || userClassRaw
            }));
          } catch (e) {
            // ignore
          }
        } else {
          console.warn('role-auth: no user record in Firestore for uid:', currentUser.uid);
        }
      } catch (err) {
        console.error('role-auth: Firestore lookup error', err);
      }

    } catch (err) {
      console.warn('role-auth: Firebase dynamic import failed, continuing with localStorage only.', err);
    }
  }

  // At this point, userRole may be null if not logged in
  if (!userRole) {
    // User not logged in - redirect to login page for restricted pages
    console.warn('role-auth: userRole missing, redirecting to login for restricted page:', filename);
    redirectToLogin();
    return;
  }

  // Admin can access everything
  if (userRole === 'admin') {
    return;
  }

  // Check teacher pages
  if (teacherPages.has(filename) || (/teacher|lesson-teacher|cbt-teacher|result/i.test(filename) && /year\d|^y\d/i.test(filename))) {
    if (userRole === 'teacher') {
      // if page is class-specific, check class match
      if (isRestrictedByClass && requiredClassNorm && userClassNorm && userClassNorm !== requiredClassNorm) {
        console.warn('role-auth: teacher class mismatch — required:', requiredClassNorm, 'user:', userClassNorm);
        // redirect teacher to their dashboard
        redirectToDashboardForRole(userRole);
        return;
      }
      return; // allowed
    } else {
      console.warn('role-auth: page requires teacher but role is', userRole);
      redirectToDashboardForRole(userRole);
      return;
    }
  }

  // Check student pages
  if (studentPages.has(filename) || (/student|lesson-view|theory-view|cbt-student/i.test(filename) && /year\d|^y\d/i.test(filename))) {
    if (userRole === 'student') {
      if (isRestrictedByClass && requiredClassNorm && userClassNorm && userClassNorm !== requiredClassNorm) {
        console.warn('role-auth: student class mismatch — required:', requiredClassNorm, 'user:', userClassNorm);
        redirectToDashboardForRole(userRole);
        return;
      }
      return; // allowed
    } else {
      console.warn('role-auth: page requires student but role is', userRole);
      redirectToDashboardForRole(userRole);
      return;
    }
  }

  // Fallback: if page matched class-based restriction but we couldn't clearly decide, deny
  if (isExplicitRestricted) {
    console.warn('role-auth: access decision unclear; redirecting to login.');
    redirectToLogin();
  }
});

