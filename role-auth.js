/* role-auth.js — Complete drop-in file with Firebase support
   - Place at site root: /role-auth.js
   - Purpose: Enforce role/year access rules client-side (UX guard)
   - IMPORTANT: This is a client-side guard. Always enforce authorization server-side too.
*/

/* ======================= CONFIG — replace values with your Firebase project if different ======================= */
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrUQuV8",
  authDomain: "home-1e252.firebaseapp.com",
  projectId: "home-1e252",
  storageBucket: "home-1e252.firebasestorage.app",
  messagingSenderId: "702969034430",
  appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
};
/* ============================================================================================================= */

/* Keywords/Regex configuration (tweak if your filenames differ slightly) */
const YEAR_REGEX = /\b(?:year|y)[\-_]?([1-6])\b/i;
const TEACHER_KEYS = ["teacher", "t-", "-t", "teacher-dashboard", "lesson-teacher", "lesson-upload", "cbt-teacher", "y?-t"];
const STUDENT_KEYS = ["student", "s-", "-s", "student-dashboard", "lesson-view", "theory-view", "cbt-student", "y?-s"];
const ADMIN_KEYS   = ["admin", "admin-dashboard", "management"];

/* ---------------------- Helper: dynamically load script ---------------------- */
function loadScript(src, attrs = {}) {
  return new Promise((resolve, reject) => {
    // Avoid double-loading
    const existing = Array.from(document.getElementsByTagName("script")).find(s => s.src && s.src.includes(src));
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("failed to load " + src)));
      if (existing.readyState === "complete" || existing.readyState === "loaded") resolve();
      return;
    }

    const s = document.createElement("script");
    s.src = src;
    Object.keys(attrs).forEach(k => s.setAttribute(k, attrs[k]));
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

/* ---------------------- Ensure Firebase (compat) is available ---------------------- */
async function ensureFirebase() {
  // If firebase (namespace) already exists, assume initialized or set later
  if (window.firebase && window.firebase.apps) return window.firebase;

  // Load compat SDKs so we can use firebase.auth(), firebase.firestore() easily.
  // Using a reasonably recent compat version (keeps same global api pattern).
  const base = "https://www.gstatic.com/firebasejs/9.16.0/";
  await loadScript(base + "firebase-app-compat.js");
  await loadScript(base + "firebase-auth-compat.js");
  await loadScript(base + "firebase-firestore-compat.js");
  return window.firebase;
}

/* ---------------------- Initialize Firebase app if needed ---------------------- */
function initFirebaseIfNeeded(config = DEFAULT_FIREBASE_CONFIG) {
  try {
    if (!window.firebase) return null;
    if (!(window.firebase.apps && window.firebase.apps.length)) {
      window.firebase.initializeApp(config);
    }
    return window.firebase;
  } catch (e) {
    console.error("Failed to initialize firebase:", e);
    return null;
  }
}

/* ---------------------- Read stored local token (development fallback) ---- */
function readLocalStoredUser() {
  try {
    const raw = localStorage.getItem("roleAuthUser") || localStorage.getItem("user") || localStorage.getItem("currentUser");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.role) return null;
    return { role: String(obj.role).toLowerCase(), year: obj.year ? Number(obj.year) : null, uid: obj.uid || null };
  } catch (e) {
    return null;
  }
}

/* ---------------------- Infer page role and year from filename/path --------- */
function getFilename() {
  try {
    const p = location.pathname.split("/").pop();
    return p || "index.html";
  } catch (e) {
    return "index.html";
  }
}
function inferPageInfo(filename) {
  const lower = filename.toLowerCase();
  let pageRole = "public";
  // check teacher
  for (const k of TEACHER_KEYS) if (lower.includes(k)) pageRole = "teacher";
  // check student (allow it to override teacher if ambiguous)
  for (const k of STUDENT_KEYS) if (lower.includes(k)) pageRole = "student";
  // admin
  for (const k of ADMIN_KEYS) if (lower.includes(k)) pageRole = "admin";

  // try year patterns like year5, y5, year-5, y_5
  let pageYear = null;
  const m = lower.match(YEAR_REGEX);
  if (m && m[1]) pageYear = Number(m[1]);

  // Extra heuristics: filenames like 'y5-cbt-teacher.html' or 'year5-first-term-lesson-teacher.html'
  // already matched above by presence of 'y5' or 'year5' via YEAR_REGEX

  return { pageRole, pageYear };
}

/* ---------------------- Authorization logic ------------------------------ */
function isAllowed(user, pageInfo) {
  if (!pageInfo) return true;
  if (!user || !user.role) return false;
  if (user.role === "admin") return true;
  if (pageInfo.pageRole === "public") return true;
  // If page lacks year we deny (fail-safe)
  if (!pageInfo.pageYear) return false;

  if (user.role === "teacher") {
    return pageInfo.pageRole === "teacher" && user.year === pageInfo.pageYear;
  }
  if (user.role === "student") {
    return pageInfo.pageRole === "student" && user.year === pageInfo.pageYear;
  }
  // otherwise deny
  return false;
}

/* ---------------------- Redirect helper --------------------------------- */
function redirectToLogin(reason) {
  try {
    const url = new URL("login.html", location.origin);
    if (reason) url.searchParams.set("reason", reason);
    // include current page so login can redirect back
    url.searchParams.set("redirect", location.pathname + location.search + location.hash);
    location.replace(url.toString());
  } catch (e) {
    location.replace("login.html");
  }
}

/* ---------------------- Primary flow: read Firebase, claims, Firestore ---- */
async function getUserFromFirebase(firebase) {
  if (!firebase || !firebase.auth) return null;
  const auth = firebase.auth();
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged(async (fbUser) => {
      try { unsub && unsub(); } catch (e) {}
      if (!fbUser) return resolve(null);
      // Try to read custom claims (role, year)
      try {
        const tokenRes = await fbUser.getIdTokenResult(true).catch(() => null);
        if (tokenRes && tokenRes.claims) {
          const claims = tokenRes.claims;
          const role = (claims.role || claims.user_role || claims.userRole || claims.roleType || null);
          const year = (claims.year || claims.user_year || claims.userYear || null);
          if (role) return resolve({ uid: fbUser.uid, role: String(role).toLowerCase(), year: year ? Number(year) : null });
        }
      } catch (e) {
        // ignore and try Firestore fallback
      }

      // Firestore fallback: look up users collection by uid
      try {
        if (firebase.firestore) {
          const db = firebase.firestore();
          const usersRef = db.collection("users").where("uid", "==", fbUser.uid).limit(1);
          const snap = await usersRef.get();
          if (!snap.empty) {
            const data = snap.docs[0].data();
            const role = data.role || data.userRole || data.roleType;
            const year = data.year || data.user_year || data.userYear;
            if (role) return resolve({ uid: fbUser.uid, role: String(role).toLowerCase(), year: year ? Number(year) : null });
          }
        }
      } catch (e) {
        // ignore
      }

      // last fallback: check profile fields on fbUser.providerData
      try {
        const pd = fbUser.providerData && fbUser.providerData[0] ? fbUser.providerData[0] : {};
        if (pd && pd.role) return resolve({ uid: fbUser.uid, role: String(pd.role).toLowerCase(), year: pd.year ? Number(pd.year) : null });
      } catch (e) {
        // ignore
      }

      // nothing found
      resolve({ uid: fbUser.uid, role: null, year: null });
    }, (err) => {
      console.error("Auth state change error:", err);
      resolve(null);
    });
  });
}

/* ---------------------- Execute enforcement flow ------------------------- */
(async function enforce() {
  // Step 1: determine page info
  const filename = getFilename();
  const pageInfo = inferPageInfo(filename);

  // If page is clearly public (like login.html or public assets), we allow it early
  // Consider login.html and offline.html to be public
  const PUBLIC_PAGES = ["login.html", "index.html", "offline.html"];
  if (PUBLIC_PAGES.includes(filename.toLowerCase())) return;

  // Step 2: Try to obtain user via firebase
  let firebase;
  try {
    firebase = await ensureFirebase();
    initFirebaseIfNeeded(DEFAULT_FIREBASE_CONFIG);
  } catch (e) {
    console.warn("Could not load firebase dynamically; continuing with local fallback.", e);
  }

  let user = null;

  if (window.firebase && window.firebase.auth) {
    try {
      user = await getUserFromFirebase(window.firebase);
      // If user returned with no role but uid present, we will fall back to localStorage or deny later
    } catch (e) {
      console.error("Error reading firebase user:", e);
    }
  }

  // Step 3: fallback to locally stored user
  if (!user || !user.role) {
    const local = readLocalStoredUser();
    if (local) {
      user = Object.assign({}, (user || {}), local);
    }
  }

  // Step 4: If still no user or no role, deny access for protected pages
  if (!user || !user.role) {
    // If page is public allow; otherwise redirect
    if (pageInfo.pageRole === "public") return;
    return redirectToLogin("not_authenticated");
  }

  // Normalize
  user.role = String(user.role).toLowerCase();
  user.year = user.year ? Number(user.year) : null;

  // Step 5: final permission check
  if (!isAllowed(user, pageInfo)) {
    return redirectToLogin("unauthorized");
  }

  // Step 6: allowed — expose debug helper (read-only)
  try {
    Object.defineProperty(window, "__ROLE_AUTH", {
      value: { user, pageInfo, filename, ts: new Date().toISOString() },
      writable: false,
      configurable: false
    });
    // small console hint
    console.info("Role auth: access allowed for", user.role, "year", user.year, "->", filename);
  } catch (e) {}
})();
