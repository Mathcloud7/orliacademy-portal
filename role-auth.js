/*!
  role-auth.js — HIGHEST-STRICTNESS (2025)
  - Full-screen overlay blocks all rendering immediately
  - Always verifies Firestore users doc for uid -> role + numeric year
  - No localStorage / providerData trust
  - Detailed console debug for failures
*/

(function () {
  'use strict';

  /******************** CONFIG ********************/
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrQQuV8",
    authDomain: "home-1e252.firebaseapp.com",
    projectId: "home-1e252",
    storageBucket: "home-1e252.firebasestorage.app",
    messagingSenderId: "702969034430",
    appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
  };

  const PUBLIC_PAGES = new Set(["index.html","login.html","offline.html","about.html"]);

  /******************** PAGE ACCESS MAP (years 1..6) ********************/
  const PAGE_ACCESS = {};
  (function buildMap(){
    function addTeacher(year){
      const y=String(year);
      PAGE_ACCESS[`year${y}-t.html`] = {role:'teacher', year};
      PAGE_ACCESS[`teacher-dashboard.html`] = {role:'teacher', year:null};
      PAGE_ACCESS[`year${y}-first-term-teacher-dashboard.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-second-term-teacher-dashboard.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-third-term-teacher-dashboard.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-first-term-assessment.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-first-term-lesson-teacher.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-first-term-lesson-upload.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-first-term-lesson-view.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-second-term-assessment.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-second-term-lesson-teacher.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-second-term-lesson-upload.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-second-term-lesson-view.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-third-term-assessment.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-third-term-lesson-teacher.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-third-term-lesson-upload.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-third-term-lesson-view.html`] = {role:'teacher', year};
      PAGE_ACCESS[`y${y}-cbt-teacher.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-first-term-theory.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-second-term-theory.html`] = {role:'teacher', year};
      PAGE_ACCESS[`year${y}-third-term-theory.html`] = {role:'teacher', year};
      PAGE_ACCESS[`y${y}-cbt-result.html`] = {role:'teacher', year};
    }
    function addStudent(year){
      const y=String(year);
      PAGE_ACCESS[`student-dashboard.html`] = {role:'student', year:null};
      PAGE_ACCESS[`year${y}-s.html`] = {role:'student', year};
      PAGE_ACCESS[`year${y}-first-term-student-dashboard.html`] = {role:'student', year};
      PAGE_ACCESS[`year${y}-second-term-student-dashboard.html`] = {role:'student', year};
      PAGE_ACCESS[`year${y}-third-term-student-dashboard.html`] = {role:'student', year};
      PAGE_ACCESS[`y${y}-cbt-student.html`] = {role:'student', year};
      PAGE_ACCESS[`year${y}-first-term-theory-view.html`] = {role:'student', year};
      PAGE_ACCESS[`year${y}-first-term-lesson-view.html`] = {role:'student', year};
      PAGE_ACCESS[`year${y}-second-term-theory-view.html`] = {role:'student', year};
      PAGE_ACCESS[`year${y}-second-term-lesson-view.html`] = {role:'student', year};
      PAGE_ACCESS[`year${y}-third-term-theory-view.html`] = {role:'student', year};
      PAGE_ACCESS[`year${y}-third-term-lesson-view.html`] = {role:'student', year};
    }
    for(let y=1;y<=6;y++){ addTeacher(y); addStudent(y); }
  })();

  /******************** IMMEDIATE BLOCK UI ********************/
  // Create overlay to block UI until check finishes
  const OVERLAY_ID = "__role_auth_block_overlay_v1";
  (function createOverlay(){
    try {
      if (!document.getElementById(OVERLAY_ID)) {
        const overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        const style = overlay.style;
        style.position = "fixed";
        style.inset = "0";
        style.zIndex = "999999999";
        style.background = "rgba(255,255,255,0.98)";
        style.display = "flex";
        style.alignItems = "center";
        style.justifyContent = "center";
        style.fontFamily = "system-ui, Arial, sans-serif";
        style.color = "#111";
        style.padding = "20px";
        style.textAlign = "center";
        overlay.innerHTML = `<div style="max-width:600px">
          <strong>Checking access…</strong>
          <div style="margin-top:8px;font-size:13px;color:#444">If this message remains, login may be required.</div>
        </div>`;
        // insert as early as possible
        if (document.documentElement) {
          document.documentElement.appendChild(overlay);
        } else {
          document.addEventListener('DOMContentLoaded', () => document.documentElement.appendChild(overlay));
        }
      }
    } catch (e) {
      console.warn("overlay creation failed", e);
    }
  })();

  function removeOverlay() {
    try {
      const el = document.getElementById(OVERLAY_ID);
      if (el) el.remove();
    } catch (e) {}
  }

  /******************** FIREBASE HELPERS ********************/
  function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=rej; (document.head||document.documentElement).appendChild(s); }); }
  async function ensureFirebase(){ if (window.firebase && window.firebase.apps) return window.firebase; const base="https://www.gstatic.com/firebasejs/9.16.0/"; await loadScript(base+"firebase-app-compat.js"); await loadScript(base+"firebase-auth-compat.js"); await loadScript(base+"firebase-firestore-compat.js"); return window.firebase; }
  function initFirebase(firebase){ if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG); return firebase; }

  async function fetchFirestoreProfile(firebase, fbUser) {
    try {
      if (!firebase.firestore) return null;
      const db = firebase.firestore();
      const snap = await db.collection("users").where("uid","==",fbUser.uid).limit(1).get();
      if (!snap || snap.empty) return null;
      const d = snap.docs[0].data();
      if (!d) return null;
      const roleRaw = d.role || d.userRole || d.roleType || null;
      if (!roleRaw) return null;
      // derive numeric year
      let year = null;
      const classRaw = d.userClass || d.class || d.user_class || d.year || d.user_year || null;
      if (classRaw !== undefined && classRaw !== null) {
        const s = String(classRaw).toLowerCase();
        const m = s.match(/([1-6])/);
        if (m && m[1]) year = Number(m[1]);
      }
      return { uid: fbUser.uid, role: String(roleRaw).toLowerCase(), year: year===null?null:Number(year), raw:d };
    } catch (e) {
      console.error("fetchFirestoreProfile error", e);
      return null;
    }
  }

  async function getProfile() {
    try {
      const firebase = await ensureFirebase();
      initFirebase(firebase);
      return await new Promise((resolve) => {
        firebase.auth().onAuthStateChanged(async (fbUser) => {
          if (!fbUser) return resolve(null);
          // fetch authoritative Firestore record
          const fs = await fetchFirestoreProfile(firebase, fbUser);
          if (fs) return resolve(fs);
          // If no Firestore record, do NOT fallback to local; return null
          return resolve(null);
        }, (err) => { console.error("auth error", err); resolve(null); });
      });
    } catch (e) {
      console.error("getProfile error", e);
      return null;
    }
  }

  /******************** UTIL: filename normalization ********************/
  function getFilename() {
    try {
      const fn = (location.pathname.split("/").pop()||"").toLowerCase();
      return fn;
    } catch (e) { return ""; }
  }

  /******************** ACCESS CHECK + RESPONSES ********************/
  (async function runCheck(){
    const filename = getFilename();
    console.debug("role-auth: checking", { filename });

    // allow public pages
    if (PUBLIC_PAGES.has(filename)) {
      console.debug("role-auth: public page — allow");
      removeOverlay();
      return;
    }

    const pageAccess = PAGE_ACCESS[filename];
    if (!pageAccess) {
      console.warn("role-auth: no rule for page:", filename);
      // block unknown pages by redirecting
      alert("Access blocked: unknown page.");
      return window.location.replace("/login.html?reason=unknown_page");
    }

    // fetch authoritative profile
    const profile = await getProfile();

    // debug dump to console for troubleshooting
    console.info("role-auth: profile:", profile, "pageAccess:", pageAccess);

    // if no authoritative profile -> block
    if (!profile) {
      console.warn("role-auth: no profile (not authenticated or no Firestore record)");
      alert("Please login to access this page.");
      return window.location.replace("/login.html?reason=not_authenticated");
    }

    // admin bypass
    if (profile.role === "admin") {
      console.info("role-auth: admin allowed");
      removeOverlay();
      window.__ROLE_AUTH = { user: profile, allowed: true, pageAccess, filename };
      return;
    }

    // role mismatch
    if (profile.role !== pageAccess.role) {
      console.warn("role mismatch", profile.role, pageAccess.role);
      alert("Access denied (role).");
      return window.location.replace("/login.html?reason=role_mismatch");
    }

    // if page requires a year, profile.year must be valid and equal
    if (pageAccess.year !== null) {
      if (profile.year === null || Number(profile.year) !== Number(pageAccess.year)) {
        console.warn("year mismatch", profile.year, pageAccess.year);
        alert("Access denied (year mismatch).");
        return window.location.replace("/login.html?reason=year_mismatch");
      }
    }

    // passed all checks — reveal page
    console.info("role-auth: ALLOWED", { profile, pageAccess });
    window.__ROLE_AUTH = { user: profile, allowed: true, pageAccess, filename };
    removeOverlay();
  })();

})();
