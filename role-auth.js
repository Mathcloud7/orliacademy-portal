/*!
  role-auth.js  — Drop-in, complete client-side guard (Firebase compat)
  Place at: /role-auth.js
  NOTE: This is a UX guard. Must NOT replace server-side authorization.
*/

(function () {
  'use strict';

  /* ===========================
     CONFIG — replace if you want
     (currently set to the values you supplied)
     =========================== */
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrUQuV8",
    authDomain: "home-1e252.firebaseapp.com",
    projectId: "home-1e252",
    storageBucket: "home-1e252.firebasestorage.app",
    messagingSenderId: "702969034430",
    appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
  };
  /* =========================== */

  // Filenames considered public (no auth required)
  const PUBLIC_PAGES = ["login.html", "index.html", "offline.html", "about.html"];

  // Heuristics for role detection from filename
  const YEAR_REGEX = /\b(?:year|y)[\-_]?([1-6])\b/i;
  const TEACHER_KEYS = ["teacher", "teacher-dashboard", "lesson-teacher", "lesson-upload", "cbt-teacher", "-t", "y?-t"];
  const STUDENT_KEYS = ["student", "student-dashboard", "lesson-view", "theory-view", "cbt-student", "-s", "y?-s"];
  const ADMIN_KEYS   = ["admin", "admin-dashboard", "management"];

  /* ---------------- helper: dynamic script loader ---------------- */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Avoid loading duplicates
      const existing = Array.from(document.scripts).find(s => s.src && s.src.indexOf(src) !== -1);
      if (existing) {
        if (existing.async === false || existing.readyState === 'complete' || existing.readyState === 'loaded') return resolve();
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e));
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }

  /* --------------- Ensure firebase compat SDK is available --------------- */
  async function ensureFirebaseCompat() {
    if (window.firebase && window.firebase.apps) return window.firebase;
    // load compat SDKs (app + auth + firestore)
    const base = "https://www.gstatic.com/firebasejs/9.16.0/";
    try {
      await loadScript(base + "firebase-app-compat.js");
      await loadScript(base + "firebase-auth-compat.js");
      await loadScript(base + "firebase-firestore-compat.js");
      return window.firebase;
    } catch (e) {
      console.warn("Could not load Firebase compat SDKs dynamically:", e);
      return null;
    }
  }

  /* --------------- Initialize firebase app if not initialized --------------- */
  function initFirebase(firebase) {
    try {
      if (!firebase) return null;
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      return firebase;
    } catch (e) {
      console.warn("Firebase initialization failed:", e);
      return null;
    }
  }

  /* --------------- Infer page info (role, year) from filename --------------- */
  function getFilename() {
    try {
      const fn = location.pathname.split('/').pop();
      return fn || 'index.html';
    } catch {
      return 'index.html';
    }
  }
  function inferPageInfo(filename) {
    const lower = (filename || '').toLowerCase();
    let pageRole = 'public';
    for (const k of TEACHER_KEYS) if (lower.includes(k)) pageRole = 'teacher';
    for (const k of STUDENT_KEYS) if (lower.includes(k)) pageRole = 'student';
    for (const k of ADMIN_KEYS)   if (lower.includes(k)) pageRole = 'admin';

    let pageYear = null;
    const m = lower.match(YEAR_REGEX);
    if (m && m[1]) pageYear = Number(m[1]);

    return { pageRole, pageYear };
  }

  /* --------------- Read fallback user from localStorage --------------- */
  function readLocalStoredUser() {
    try {
      const raw = localStorage.getItem('roleAuthUser') || localStorage.getItem('user') || localStorage.getItem('currentUser');
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.role) return null;
      return { uid: obj.uid || null, role: String(obj.role).toLowerCase(), year: obj.year ? Number(obj.year) : null };
    } catch (e) {
      return null;
    }
  }

  /* --------------- Redirect helper --------------- */
  function redirectToLogin(reason) {
    try {
      const u = new URL('login.html', location.origin);
      if (reason) u.searchParams.set('reason', reason);
      u.searchParams.set('redirect', location.pathname + location.search + location.hash);
      location.replace(u.toString());
    } catch (e) {
      location.replace('login.html');
    }
  }

  /* --------------- Permission engine --------------- */
  function isAllowed(user, pageInfo) {
    if (!pageInfo) return true;
    if (!user || !user.role) return false;
    if (user.role === 'admin') return true;
    if (pageInfo.pageRole === 'public') return true;
    if (!pageInfo.pageYear) return false; // fail-safe deny

    if (user.role === 'teacher') return pageInfo.pageRole === 'teacher' && user.year === pageInfo.pageYear;
    if (user.role === 'student') return pageInfo.pageRole === 'student' && user.year === pageInfo.pageYear;
    return false;
  }

  /* --------------- Get user info from Firebase (claims -> Firestore fallback) --------------- */
  async function getUserFromFirebase(firebase) {
    if (!firebase || !firebase.auth) return null;
    try {
      const auth = firebase.auth();
      return await new Promise((resolve) => {
        const unsub = auth.onAuthStateChanged(async (fbUser) => {
          try { unsub && unsub(); } catch (e) {}
          if (!fbUser) return resolve(null);

          // try custom claims
          try {
            const tokenRes = await fbUser.getIdTokenResult(true).catch(() => null);
            if (tokenRes && tokenRes.claims) {
              const c = tokenRes.claims;
              const role = c.role || c.user_role || c.userRole || null;
              const year = c.year || c.user_year || c.userYear || null;
              if (role) return resolve({ uid: fbUser.uid, role: String(role).toLowerCase(), year: year ? Number(year) : null });
            }
          } catch (e) {
            /* ignore and continue to Firestore fallback */
          }

          // Firestore fallback: users collection lookup by uid
          try {
            if (firebase.firestore) {
              const db = firebase.firestore();
              // Query users where uid == fbUser.uid
              const snap = await db.collection('users').where('uid', '==', fbUser.uid).limit(1).get();
              if (!snap.empty) {
                const data = snap.docs[0].data();
                const role = data.role || data.userRole || data.roleType || null;
                const year = data.year || data.user_year || data.userYear || null;
                if (role) return resolve({ uid: fbUser.uid, role: String(role).toLowerCase(), year: year ? Number(year) : null });
              }
            }
          } catch (e) {
            /* ignore */
          }

          // providerData fallback
          try {
            const pd = fbUser.providerData && fbUser.providerData[0] ? fbUser.providerData[0] : {};
            if (pd && pd.role) return resolve({ uid: fbUser.uid, role: String(pd.role).toLowerCase(), year: pd.year ? Number(pd.year) : null });
          } catch (e) {}

          // nothing found
          resolve({ uid: fbUser.uid, role: null, year: null });
        }, (err) => {
          console.error('Auth state error:', err);
          resolve(null);
        });
      });
    } catch (e) {
      console.warn('getUserFromFirebase failed:', e);
      return null;
    }
  }

  /* -------------------- MAIN enforcement flow -------------------- */
  (async function main() {
    const filename = getFilename();
    const pageInfo = inferPageInfo(filename);

    // allow public pages immediately
    if (PUBLIC_PAGES.includes(filename.toLowerCase())) return;

    // Attempt firebase path
    let firebase = null, user = null;
    try {
      firebase = await ensureFirebaseCompat();
      firebase = initFirebase(firebase);
      if (firebase && firebase.auth) {
        user = await getUserFromFirebase(firebase);
      }
    } catch (e) {
      console.warn('Firebase path failed — will fallback to localStorage', e);
    }

    // local fallback if no user.role found
    if ((!user || !user.role) && typeof window !== 'undefined') {
      const local = readLocalStoredUser();
      if (local) {
        user = Object.assign({}, (user || {}), local);
      }
    }

    // no user/role -> redirect for protected pages
    if (!user || !user.role) {
      if (pageInfo.pageRole === 'public') return;
      return redirectToLogin('not_authenticated');
    }

    // normalize
    user.role = String(user.role).toLowerCase();
    user.year = user.year ? Number(user.year) : null;

    // final permission check
    if (!isAllowed(user, pageInfo)) {
      return redirectToLogin('unauthorized');
    }

    // allowed -> expose readonly debug helper
    try {
      Object.defineProperty(window, '__ROLE_AUTH', {
        value: { user, pageInfo, filename, ts: (new Date()).toISOString() },
        writable: false,
        configurable: false
      });
      // small console message
      console.info('role-auth: allowed ->', user.role, 'year', user.year, filename);
    } catch (e) {}
  })();

})();
