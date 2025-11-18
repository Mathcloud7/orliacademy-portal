/*!
  role-auth.js — FIXED VERSION (2025)
  STRICT year-role access guard (Firebase Compat)
  Works for ALL pages: year1 … year6
*/

(function () {
  'use strict';

  /* ================= FIREBASE CONFIG ================= */
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrQQuV8",
    authDomain: "home-1e252.firebaseapp.com",
    projectId: "home-1e252",
    storageBucket: "home-1e252.firebasestorage.app",
    messagingSenderId: "702969034430",
    appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
  };
  /* ==================================================== */

  // Public pages (no auth)
  const PUBLIC_PAGES = [
    "index.html",
    "login.html",
    "offline.html",
    "about.html"
  ];

  /* =======================================================
     FIXED YEAR DETECTION
     Matches ANY: year5 … year1 … y5 … y1 … year5-first-term
  ======================================================= */
  const YEAR_REGEX = /(year|y)([1-6])/i;

  /* =======================================================
     FIXED ROLE DETECTION
     100% accurate, no collisions
     Teacher pages MUST contain:
       - "-t"       (suffix)
       - "teacher"  (full word)
       - "lesson-teacher"
       - "lesson-upload"
       - "cbt-teacher"
     
     Student pages MUST contain:
       - "-s"
       - "student"
       - "lesson-view"
       - "theory-view"
       - "cbt-student"
  ======================================================= */

  function detectPageRole(filenameLower) {
    // Teacher pages
    const teacherKeys = [
      "-t.", "teacher", "lesson-teacher", "lesson-upload",
      "cbt-teacher"
    ];
    for (const k of teacherKeys) {
      if (filenameLower.includes(k)) return "teacher";
    }

    // Student pages
    const studentKeys = [
      "-s.", "student", "lesson-view", "theory-view",
      "cbt-student"
    ];
    for (const k of studentKeys) {
      if (filenameLower.includes(k)) return "student";
    }

    return "public";
  }

  function detectPageYear(filenameLower) {
    const m = filenameLower.match(YEAR_REGEX);
    return m ? Number(m[2]) : null;
  }

  /* ================= HELPER: load firebase compat ================= */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureFirebaseCompat() {
    if (window.firebase && window.firebase.apps) return window.firebase;

    const base = "https://www.gstatic.com/firebasejs/9.16.0/";
    await loadScript(base + "firebase-app-compat.js");
    await loadScript(base + "firebase-auth-compat.js");
    await loadScript(base + "firebase-firestore-compat.js");
    return window.firebase;
  }

  function initFirebase(firebase) {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    return firebase;
  }

  /* ================= Get user role/year from Firebase or LS ================= */
  async function getUserFromFirebase(firebase) {
    return new Promise((resolve) => {
      firebase.auth().onAuthStateChanged(async (fbUser) => {
        if (!fbUser) return resolve(null);

        // 1. Try JWT custom claims
        try {
          const token = await fbUser.getIdTokenResult(true);
          if (token.claims.role) {
            return resolve({
              uid: fbUser.uid,
              role: String(token.claims.role).toLowerCase(),
              year: token.claims.year ? Number(token.claims.year) : null
            });
          }
        } catch { }

        // 2. Firestore fallback
        try {
          const db = firebase.firestore();
          const snap = await db.collection("users")
            .where("uid", "==", fbUser.uid)
            .limit(1)
            .get();

          if (!snap.empty) {
            const d = snap.docs[0].data();
            if (d.role) {
              return resolve({
                uid: fbUser.uid,
                role: d.role.toLowerCase(),
                year: d.year ? Number(d.year) : null
              });
            }
          }
        } catch { }

        resolve({ uid: fbUser.uid, role: null, year: null });
      });
    });
  }

  function readLocalUser() {
    try {
      const raw = localStorage.getItem("roleAuthUser");
      if (!raw) return null;
      const u = JSON.parse(raw);
      if (!u.role) return null;
      return {
        uid: u.uid || null,
        role: u.role.toLowerCase(),
        year: u.year ? Number(u.year) : null
      };
    } catch {
      return null;
    }
  }

  function redirect(reason) {
    const url = new URL("login.html", location.origin);
    url.searchParams.set("reason", reason);
    url.searchParams.set("redirect", location.pathname);
    location.replace(url.toString());
  }

  /* ================= PERMISSION CHECK ================= */
  function isAllowed(user, pageRole, pageYear) {
    if (!user || !user.role) return false;

    if (user.role === "admin") return true;

    if (pageRole === "public") return true;

    if (!pageYear) return false;

    if (user.role !== pageRole) return false;

    return user.year === pageYear;
  }

  /* ================= MAIN ================= */
  (async function main() {
    const filename = location.pathname.split("/").pop().toLowerCase();

    if (PUBLIC_PAGES.includes(filename)) return;

    const pageRole = detectPageRole(filename);
    const pageYear = detectPageYear(filename);

    let firebase = null;
    let user = null;

    try {
      firebase = await ensureFirebaseCompat();
      firebase = initFirebase(firebase);
      user = await getUserFromFirebase(firebase);
    } catch { }

    if (!user) {
      const local = readLocalUser();
      if (local) user = local;
    }

    if (!isAllowed(user, pageRole, pageYear)) {
      return redirect(user && user.role ? "unauthorized" : "not_authenticated");
    }

    // expose for debugging
    window.__ROLE_AUTH = { user, pageRole, pageYear, filename };
    console.info("role-auth OK:", window.__ROLE_AUTH);
  })();
})();
