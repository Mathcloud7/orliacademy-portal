```javascript
// COMPLETE role-auth.js — FINAL VERSION

(function () {
  "use strict";

  /*
   ===============================================================
    ROLE-AUTH.JS — FINAL, COMPLETE, FULLY COMPATIBLE
   ===============================================================
   RULES ENFORCED:
   ---------------------------------------
   ⭐ Admin → Access ALL pages
   ⭐ Teachers → Only pages of their own class (year)
   ⭐ Students → Only pages of their own class (year)
   ⭐ No class can open another class pages
   ⭐ No student can open any teacher page
   ⭐ No teacher can open any student page
   ⭐ Automatically detects page role + page year from filename
   ⭐ Uses localStorage value from login page:
        localStorage.setItem("roleAuthUser", {
           uid, role, year
        })

   ---------------------------------------
   PAGE ROLE & YEAR DETECTION LOGIC
   ---------------------------------------
   e.g. "year5-first-term-lesson-teacher.html"
        → pageRole = "teacher"
        → pageYear = 5

   e.g. "y3-cbt-student.html"
        → pageRole = "student"
        → pageYear = 3

   ---------------------------------------
   AUTO-PROTECTS ALL CLASS PAGES YEAR 1–6
   ---------------------------------------
  */

  const YEAR_REGEX = /(year|y)([1-6])/i;

  // Keywords to classify page role
  const TEACHER_KEYS = ["teacher", "-t", "teacher-dashboard", "cbt-teacher", "lesson-teacher", "lesson-upload"];
  const STUDENT_KEYS = ["student", "-s", "cbt-student", "lesson-view", "theory-view"];
  const ADMIN_KEYS   = ["admin", "admin-dashboard"];

  /* ------------------------------------------------------
     1. Get current filename
  --------------------------------------------------------- */
  function getFilename() {
    try {
      const name = location.pathname.split("/").pop();
      return name || "index.html";
    } catch {
      return "index.html";
    }
  }

  /* ------------------------------------------------------
     2. Infer page role + page year
  --------------------------------------------------------- */
  function inferPageInfo(filename) {
    const lower = filename.toLowerCase();
    let pageRole = "public";

    // Teacher detection
    for (const key of TEACHER_KEYS) {
      if (lower.includes(key)) pageRole = "teacher";
    }

    // Student detection
    for (const key of STUDENT_KEYS) {
      if (lower.includes(key)) pageRole = "student";
    }

    // Admin detection
    for (const key of ADMIN_KEYS) {
      if (lower.includes(key)) pageRole = "admin";
    }

    // Year detection
    let pageYear = null;
    const match = lower.match(YEAR_REGEX);
    if (match && match[2]) pageYear = Number(match[2]);

    return { pageRole, pageYear };
  }

  /* ------------------------------------------------------
     3. Read stored login session from localStorage
  --------------------------------------------------------- */
  function readStoredUser() {
    try {
      const raw = localStorage.getItem("roleAuthUser");
      if (!raw) return null;
      const user = JSON.parse(raw);
      if (!user.role) return null;
      return {
        role: String(user.role).toLowerCase(),
        year: user.year ? Number(user.year) : null,
      };
    } catch {
      return null;
    }
  }

  /* ------------------------------------------------------
     4. Redirection helper
  --------------------------------------------------------- */
  function redirect(reason) {
    const url = new URL("login.html", location.origin);
    url.searchParams.set("reason", reason);
    url.searchParams.set("redirect", location.pathname);
    location.replace(url.toString());
  }

  /* ------------------------------------------------------
     5. Permission engine
  --------------------------------------------------------- */
  function isAllowed(user, page) {
    // Admin allowed everywhere
    if (user.role === "admin") return true;

    // Public pages allowed
    if (page.pageRole === "public") return true;

    // Page requires year
    if (!page.pageYear) return false;

    // Students
    if (user.role === "student") {
      return page.pageRole === "student" && user.year === page.pageYear;
    }

    // Teachers
    if (user.role === "teacher") {
      return page.pageRole === "teacher" && user.year === page.pageYear;
    }

    return false;
  }

  /* ------------------------------------------------------
     6. MAIN EXECUTION
  --------------------------------------------------------- */
  (function enforceRoleAccess() {
    const filename = getFilename();
    const page = inferPageInfo(filename);
    const user = readStoredUser();

    // Not logged in
    if (!user) {
      if (page.pageRole !== "public") redirect("not_logged_in");
      return;
    }

    // Unauthorized
    if (!isAllowed(user, page)) {
      redirect("unauthorized");
      return;
    }
  })();

})();
```
