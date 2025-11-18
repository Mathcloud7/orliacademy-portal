/*!
  role-auth.js — FINAL — Firestore-authoritative, hardened (2025)
  - Always enforces role/year from Firestore users collection
  - Hides page until checks complete
  - No localStorage or providerData trust for protection
*/

(function () {
  'use strict';

  /* -------------- CONFIG (copy your firebase config) -------------- */
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrQQuV8",
    authDomain: "home-1e252.firebaseapp.com",
    projectId: "home-1e252",
    storageBucket: "home-1e252.firebasestorage.app",
    messagingSenderId: "702969034430",
    appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
  };

  /* -------------- PUBLIC PAGES (no guard) -------------- */
  const PUBLIC_PAGES = new Set([
    "index.html",
    "login.html",
    "offline.html",
    "about.html"
  ]);

  /* -------------- PAGE ACCESS MAP (your exact list) --------------
     Generates a map for year1..year6 for teacher & student pages.
     You already had this; we build the same map programmatically.
  --------------------------------------------------------- */
  const PAGE_ACCESS = {};

  function addTeacherPages(year) {
    const y = String(year);
    PAGE_ACCESS[`year${y}-t.html`] = { role: "teacher", year };
    PAGE_ACCESS[`teacher-dashboard.html`] = { role: "teacher", year: null };

    PAGE_ACCESS[`year${y}-first-term-teacher-dashboard.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-second-term-teacher-dashboard.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-third-term-teacher-dashboard.html`] = { role: "teacher", year };

    PAGE_ACCESS[`year${y}-first-term-assessment.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-first-term-lesson-teacher.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-first-term-lesson-upload.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-first-term-lesson-view.html`] = { role: "teacher", year };

    PAGE_ACCESS[`year${y}-second-term-assessment.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-second-term-lesson-teacher.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-second-term-lesson-upload.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-second-term-lesson-view.html`] = { role: "teacher", year };

    PAGE_ACCESS[`year${y}-third-term-assessment.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-third-term-lesson-teacher.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-third-term-lesson-upload.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-third-term-lesson-view.html`] = { role: "teacher", year };

    PAGE_ACCESS[`y${y}-cbt-teacher.html`] = { role: "teacher", year };

    PAGE_ACCESS[`year${y}-first-term-theory.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-second-term-theory.html`] = { role: "teacher", year };
    PAGE_ACCESS[`year${y}-third-term-theory.html`] = { role: "teacher", year };

    PAGE_ACCESS[`y${y}-cbt-result.html`] = { role: "teacher", year };
  }

  function addStudentPages(year) {
    const y = String(year);

    PAGE_ACCESS[`student-dashboard.html`] = { role: "student", year: null };
    PAGE_ACCESS[`year${y}-s.html`] = { role: "student", year };

    PAGE_ACCESS[`year${y}-first-term-student-dashboard.html`] = { role: "student", year };
    PAGE_ACCESS[`year${y}-second-term-student-dashboard.html`] = { role: "student", year };
    PAGE_ACCESS[`year${y}-third-term-student-dashboard.html`] = { role: "student", year };

    PAGE_ACCESS[`y${y}-cbt-student.html`] = { role: "student", year };

    PAGE_ACCESS[`year${y}-first-term-theory-view.html`] = { role: "student", year };
    PAGE_ACCESS[`year${y}-first-term-lesson-view.html`] = { role: "student", year };

    PAGE_ACCESS[`year${y}-second-term-theory-view.html`] = { role: "student", year };
    PAGE_ACCESS[`year${y}-second-term-lesson-view.html`] = { role: "student", year };

    PAGE_ACCESS[`year${y}-third-term-theory-view.html`] = { role: "student", year };
    PAGE_ACCESS[`year${y}-third-term-lesson-view.html`] = { role: "student", year };
  }

  for (let y = 1; y <= 6; y++) {
    addTeacherPages(y);
    addStudentPages(y);
  }

  /* -------------- QUICK HIDE (prevents flash) -------------- */
  (function hideUntilReady() {
    try {
      const styleId = "__role_auth_hide_style";
      if (!document.getElementById(styleId)) {
        const s = document.createElement("style");
        s.id = styleId;
        s.appendChild(document.createTextNode("html[data-role-auth-pending='1'] > body { visibility: hidden !important; }"));
        (document.head || document.documentElement).appendChild(s);
      }
      document.documentElement.setAttribute("data-role-auth-pending", "1");
    } catch (e) {
      // if DOM not accessible, ignore — we'll attempt later
    }
  })();

  /* -------------- FIREBASE COMPAT LOADER -------------- */
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

  /* -------------- Authoritative user fetch (Firestore-first) --------------
     - Must return object: { uid, role, year } or null
     - We always read Firestore 'users' entry for uid and parse userClass -> numeric year
     - Token claims are optional; Firestore is source-of-truth because your admin createUser() writes there
  ------------------------------------------------------------------------ */
  async function fetchUserFromFirestore(firebase, fbUser) {
    try {
      if (!firebase.firestore) return null;
      const db = firebase.firestore();
      const q = await db.collection("users").where("uid", "==", fbUser.uid).limit(1).get();
      if (q.empty) return null;
      const d = q.docs[0].data();

      // Determine role
      const roleRaw = d.role || d.userRole || d.roleType || null;
      if (!roleRaw) return null; // no role in DB — can't trust

      // Determine year from userClass/year fields
      // Accept "Year 1", "year1", "1", "Year 01", etc.
      let year = null;
      const classRaw = d.userClass || d.class || d.user_class || d.year || d.user_year || null;
      if (classRaw) {
        const s = String(classRaw).toLowerCase();
        const m = s.match(/([1-6])/); // first digit 1-6
        if (m && m[1]) year = Number(m[1]);
      }

      return { uid: fbUser.uid, role: String(roleRaw).toLowerCase(), year: year === null ? null : Number(year), source: "firestore" };
    } catch (e) {
      console.error("fetchUserFromFirestore error:", e);
      return null;
    }
  }

  /* -------------- get authenticated Firebase user and authoritative profile -------------- */
  async function getAuthenticatedProfile() {
    try {
      const firebase = await ensureFirebaseCompat();
      initFirebase(firebase);
      return await new Promise((resolve) => {
        firebase.auth().onAuthStateChanged(async (fbUser) => {
          if (!fbUser) return resolve(null);

          // Try token claims first (fast), but still verify Firestore record for authoritative data
          let role = null, year = null;

          try {
            const t = await fbUser.getIdTokenResult(true);
            if (t && t.claims) {
              role = t.claims.role || t.claims.user_role || t.claims.userRole || null;
              year = t.claims.year || t.claims.user_year || t.claims.userYear || null;
              if (role) {
                // normalize year if present (may be number or string)
                if (year !== undefined && year !== null) {
                  year = Number(year) || null;
                }
              } else {
                role = null;
                year = null;
              }
            }
          } catch (e) {
            // ignore token claim read errors
          }

          // If claims already provide both role+year, we'll still cross-check Firestore to be safe.
          // But we prefer Firestore as authoritative if present.
          const fs = await fetchUserFromFirestore(firebase, fbUser);
          if (fs && fs.role) {
            return resolve(fs); // authoritative record from Firestore
          }

          // If no Firestore record, but claims present, use claims (less ideal)
          if (role) {
            return resolve({ uid: fbUser.uid, role: String(role).toLowerCase(), year: year ? Number(year) : null, source: "claims" });
          }

          // otherwise, no usable identity
          return resolve(null);
        }, (err) => {
          console.error("Auth state error:", err);
          resolve(null);
        });
      });
    } catch (e) {
      console.error("getAuthenticatedProfile error:", e);
      return null;
    }
  }

  /* -------------- Helper: reveal page (remove hide) -------------- */
  function revealPage() {
    try {
      document.documentElement.removeAttribute("data-role-auth-pending");
    } catch (e) {}
  }

  /* -------------- Redirect helper -------------- */
  function redirectToLogin(reason) {
    try { revealPage(); } catch (e) {}
    const url = new URL("login.html", location.origin);
    url.searchParams.set("reason", reason);
    url.searchParams.set("redirect", location.pathname + location.search + location.hash);
    location.replace(url.toString());
  }

  /* -------------- MAIN flow -------------- */
  (async function main() {
    // Filename (exact)
    const filename = (location.pathname.split("/").pop() || "").toLowerCase();

    // Public pages allowed
    if (PUBLIC_PAGES.has(filename)) {
      revealPage();
      return;
    }

    const pageAccess = PAGE_ACCESS[filename];
    if (!pageAccess) {
      // unknown page — block by default
      console.warn("No access rule for page:", filename);
      return redirectToLogin("unknown_page");
    }

    // Get authoritative authenticated profile (Firestore primary)
    const profile = await getAuthenticatedProfile();

    if (!profile) {
      // No valid authenticated profile — redirect
      return redirectToLogin("not_authenticated");
    }

    // Admin bypass
    if (profile.role === "admin") {
      window.__ROLE_AUTH = { user: profile, allowed: true, pageAccess, filename };
      revealPage();
      return;
    }

    // Role mismatch
    if (profile.role !== pageAccess.role) {
      return redirectToLogin("role_mismatch");
    }

    // Year mismatch: If page expects a specific year, profile.year must match exactly
    if (pageAccess.year !== null) {
      if (profile.year === null || Number(profile.year) !== Number(pageAccess.year)) {
        return redirectToLogin("year_mismatch");
      }
    }

    // All checks passed
    window.__ROLE_AUTH = { user: profile, allowed: true, pageAccess, filename };
    revealPage();
    console.info("ROLE AUTH OK →", window.__ROLE_AUTH);
  })();
})();
