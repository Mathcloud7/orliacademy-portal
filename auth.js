
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js";

// -------------------- FIREBASE CONFIG --------------------
const firebaseConfig = {
  apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrUQuV8",
  authDomain: "home-1e252.firebaseapp.com",
  projectId: "home-1e252",
  storageBucket: "home-1e252.firebasestorage.app",
  messagingSenderId: "702969034430",
  appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
};

// -------------------- INITIALIZE FIREBASE --------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// -------------------- LOCAL SESSION HELPERS --------------------
const AUTH_KEY = "authStatus";
const TIME_KEY = "authTime";
const AUTH_DURATION = 30 * 60 * 1000; // 30 minutes

function saveSession(uid) {
  localStorage.setItem(AUTH_KEY, uid);
  localStorage.setItem(TIME_KEY, Date.now().toString());
}

// -------------------- LOGIN FUNCTION --------------------
window.loginUser = async function loginUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }

  try {
    // Firebase sign in
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Fetch role from Firestore
    const usersCollection = collection(db, "users");
    const q = query(usersCollection, where("uid", "==", user.uid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("User not found in the database!");
      return;
    }

    const userDoc = querySnapshot.docs[0].data();
    const role = userDoc.role;

    // Save session for offline access
    saveSession(user.uid);

    // Redirect based on role
    switch (role) {
      case "admin":
        window.location.href = "admin-dashboard.html";
        break;
      case "teacher":
        window.location.href = "teacher-dashboard.html";
        break;
      case "student":
        window.location.href = "student-dashboard.html";
        break;
      default:
        alert("Unknown role. Please contact the system administrator.");
        break;
    }
  } catch (error) {
    console.error("Login error:", error);
    alert("Login failed: " + error.message);
  }
};
