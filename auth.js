import { initializeApp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBXqFTnZqi1Uzo_4k1s-cZrm__eSrUQuV8",
  authDomain: "home-1e252.firebaseapp.com",
  projectId: "home-1e252",
  storageBucket: "home-1e252.firebasestorage.app",
  messagingSenderId: "702969034430",
  appId: "1:702969034430:web:47ff6e815f2017fc8f10ef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Handle login
window.loginUser = async function loginUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const usersCollection = collection(db, "users");
    const q = query(usersCollection, where("uid", "==", user.uid));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0].data();
      const role = userDoc.role;

      if (role === "admin") window.location.href = "admin-dashboard.html";
      else if (role === "teacher") window.location.href = "teacher-dashboard.html";
      else if (role === "student") window.location.href = "student-dashboard.html";
      else alert("Unauthorized role detected.");
    } else {
      alert("No matching user record found in Firestore.");
    }
  } catch (error) {
    console.error("Login error:", error);
    alert("Login failed: " + error.message);
  }
};
