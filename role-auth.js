/* role-auth.module.js
   ES Module (Firebase v9 modular). Place at site root: /role-auth.module.js
   Pages will be injected with: <script type="module" src="/role-auth.module.js" defer></script>
   IMPORTANT: this is a client-side guard (UX). Always enforce server-side.
*/

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged, getIdTokenResult } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js";

/* ========================= CONFIG =========================
   Replace with your Firebase config if you prefer.
   If you already initialize Firebase elsewhere, this script will not re-init.
*/
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrUQuV8",
  authDomain: "home-1e252.firebaseapp.com",
  projectId: "home-1e252",
  storageBucket: "home-1e252.firebasestorage.app",
  messagingSenderId: "702969034430",
  appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
};
/* ======================================================== */

/* Rules & filename heuristics */
const YEAR_REGEX = /\b(?:year|y)[\-_]?([1-6])\b/i;
const TEACHER_KEYS = ["teacher", "teacher-dashboard", "lesson-teacher", "lesson-upload", "cbt-teacher", "-t", "y?-t"];
const STUDENT_KEYS = ["student", "student-dashboard", "lesson-view", "theory-view", "cbt-student", "-s", "y?-s"];
const ADMIN_KEYS   = ["admin", "admin-dashboard", "management"];
const PUBLIC_PAGES = ["login.html", "index.html", "offline.html", "about.html"];

/* ------------------- utility: filename & page infer ------------------- */
function getFilename() {
  try {
    const name = location.pathname.split("/").pop();
    return name || "index.html";
  } catch { return "index.html"; }
}
function inferPageInfo(filename) {
  const lower = filename.toLowerCase();
  let pageRole = "public";
  for (const k of TEACHER_KEYS) if (lower.includes(k)) pageRole = "teacher";
  for (const k of STUDENT_KEYS) if (lower.includes(k)) pageRole = "student";
  for (const k of ADMIN_KEYS)   if (lower.includes(k)) pageRole = "admin";

  let pageYear = null;
  const m = lower.match(YEAR_REGEX);
  if (m && m[1]) pageYear = Number(m[1]);

  return { pageRole, pageYear };
}

/* ------------------- localStorage fallback ------------------- */
function readLocalStoredUser() {
  try {
    const raw = localStorage.getItem("roleAuthUser") || localStorage.getItem("user") || localStorage.getItem("currentUser");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.role) return null;
    return { uid: obj.uid || null, role: String(obj.role).toLowerCase(), year: obj.year ? Number(obj.year) : null };
  } catch (e) { return null; }
}

/* ------------------- redirect helper ------------------- */
function redirectToLogin(reason) {
  try {
    const url = new URL("login.html", location.origin);
    if (reason) url.searchParams.set("reason", reason);
    url.searchParams.set("redirect", location.pathname + location.search + location.hash);
    location.replace(url.toString());
  } catch (e) {
    location.replace("login.html");
  }
}

/* ------------------- permission engine ------------------- */
function isAllowed(user, page) {
  if (!page) return true;
  if (!user || !user.role) return false;
  if (user.role === "admin") return true;
  if (page.pageRole === "public") return true;
  if (!page.pageYear) return false; // fail-safe: pages without year are denied (except public)

  if (user.role === "teacher") return page.pageRole === "teacher" && user.year === page.pageYear;
  if (user.role === "student") return page.pageRole === "student" && user.year === page.pageYear;
  return false;
}

/* ------------------- firebase helpers ------------------- */
function ensureFirebaseInitialized() {
  try {
    if (!getApps || typeof getApps !== "function") return null;
    if (!getApps().length) {
      initializeApp(FIREBASE_CONFIG);
    }
    return true;
  } catch (e) {
    console.warn("Firebase init skipped:", e);
    return false;
  }
}

async function getUserFromFirebase() {
  try {
    ensureFirebaseInitialized();
    const auth = getAuth();
    return await new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, async (fbUser) => {
        try { unsub(); } catch {}
        if (!fbUser) return resolve(null);
        // try id token claims
        try {
          const tokenResult = await getIdTokenResult(fbUser, /* forceRefresh= */ true).catch(() => null);
          if (tokenResult && tokenResult.claims) {
            const claims = tokenResult.claims;
            const role = claims.role || claims.user_role || claims.userRole || null;
            const year = claims.year || claims.user_year || claims.userYear || null;
            if (role) return resolve({ uid: fbUser.uid, role: String(role).toLowerCase(), year: year ? Number(year) : null });
          }
        } catch (e) { /* ignore */ }

        // Firestore fallback
        try {
          const db = getFirestore();
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("uid", "==", fbUser.uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            const role = data.role || data.userRole || data.roleType || null;
            const year = data.year || data.user_year || data.userYear || null;
            if (role) return resolve({ uid: fbUser.uid, role: String(role).toLowerCase(), year: year ? Number(year) : null });
          }
        } catch (e) { /* ignore */ }

        // providerData fallback
        try {
          const pd = fbUser.providerData && fbUser.providerData[0] ? fbUser.providerData[0] : {};
          if (pd && pd.role) return resolve({ uid: fbUser.uid, role: String(pd.role).toLowerCase(), year: pd.year ? Number(pd.year) : null });
        } catch (e) { /* ignore */ }

        // nothing else
        resolve({ uid: fbUser.uid, role: null, year: null });
      }, (err) => {
        console.error("Auth state error:", err);
        resolve(null);
      });
    });
  } catch (e) {
    console.warn("getUserFromFirebase failed:", e);
    return null;
  }
}

/* ------------------- main enforcement ------------------- */
(async function runGuard() {
  const filename = getFilename();
  const pageInfo = inferPageInfo(filename);

  // allow public pages
  if (PUBLIC_PAGES.includes(filename.toLowerCase())) return;

  // try to get user from firebase (if firebase available)
  let user = null;
  try {
    // initialize if not already
    ensureFirebaseInitialized();
    user = await getUserFromFirebase();
  } catch (e) {
    console.warn("Firebase path failed, will use local fallback", e);
  }

  // local fallback
  if (!user || !user.role) {
    const local = readLocalStoredUser();
    if (local) user = Object.assign({}, (user || {}), local);
  }

  // If still no role => deny for protected pages
  if (!user || !user.role) {
    if (pageInfo.pageRole === "public") return;
    return redirectToLogin("not_authenticated");
  }

  // normalize
  user.role = String(user.role).toLowerCase();
  user.year = user.year ? Number(user.year) : null;

  if (!isAllowed(user, pageInfo)) return redirectToLogin("unauthorized");

  // allowed: expose readonly debug info
  try {
    Object.defineProperty(window, "__ROLE_AUTH", {
      value: { user, pageInfo, filename, ts: new Date().toISOString() },
      writable: false,
      configurable: false
    });
    console.info("RoleAuth: allowed →", user.role, "year", user.year, filename);
  } catch (e) { /* ignore */ }
})();
