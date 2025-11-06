// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js";

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

// Monitor authentication state
onAuthStateChanged(auth, (user) => {
  if (user) {
    const usersCollection = collection(db, "users");
    const q = query(usersCollection, where("uid", "==", user.uid));

    getDocs(q)
      .then((querySnapshot) => {
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0].data();
          const role = userDoc.role;
          const name = `${userDoc.firstName} ${userDoc.lastName}`;
          const userClass = userDoc.userClass;

          // ✅ Allow only teachers
          if (role !== "teacher") {
            alert("Access denied. Only teachers can view this page.");
            window.location.href = "index.html";
            return;
          }

          // 🔒 Restrict access: allow only URLs starting with their class name
          const currentPage = window.location.pathname.toLowerCase();

          if (!isPageAllowed(currentPage, userClass)) {
            alert(`Access denied. You are not authorized to view this page.`);
            window.location.href = getResourceLink(userClass);
            return;
          }

          // ✅ Show welcome info
          const welcomeDiv = document.getElementById("welcomeMessage");
          if (welcomeDiv) {
            welcomeDiv.innerHTML = `
              <div style="font-family: 'Arial', sans-serif; font-size: 1.2em; color: #333; text-align: center; margin: 20px 0;">
                <span style="font-size: 2em; color: #1e90ff; font-weight: bold;">Welcome, ${name}!</span><br>
                <div style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; border-radius: 8px; margin: 10px 0; font-size: 1.0em;">
                  <span>${userClass}</span>
                </div><br>
              </div>
            `;
          }

          const resourceButton = document.getElementById("exploreResources");
          if (resourceButton) {
            resourceButton.innerText = `Explore your ${userClass} class resources`;
            resourceButton.href = getResourceLink(userClass);
          }
        } else {
          alert("User not found in database!");
          window.location.href = "index.html";
        }
      })
      .catch((error) => {
        console.error("Error fetching user data: ", error);
        alert("Error verifying access.");
        window.location.href = "index.html";
      });
  } else {
    window.location.href = "index.html";
  }
});

// ✅ Allow pages that belong to the teacher's class (based on URL prefix)
function isPageAllowed(currentPath, userClass) {
  currentPath = currentPath.toLowerCase();
  const classSlug = userClass.toLowerCase().replace(" ", ""); // e.g. "Year 1" → "year1"
  return currentPath.includes(`/${classSlug}`); // Allows any page with /year1/ or year1- prefix
}

// 📂 Get link to correct class homepage
function getResourceLink(userClass) {
  switch (userClass) {
    case "Year 1": return "/year1-t.html";
    case "Year 2": return "/year2-t.html";
    case "Year 3": return "/year3-t.html";
    case "Year 4": return "/year4-t.html";
    case "Year 5": return "/year5-t.html";
    case "Year 6": return "/year6-t.html";
    default: return "/default-teacher.html";
  }
}

// 🚪 Logout handler
window.logoutUser = function logoutUser() {
  signOut(auth)
    .then(() => {
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Error logging out: ", error);
    });
};
