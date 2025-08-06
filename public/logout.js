// logout.js
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const auth = getAuth();

  // Ensure the button exists before adding listener
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
window.location.href = "login.html";
      } catch (error) {
        console.error("❌ Logout failed:", error);
        alert("Error logging out. Please try again.");
      }
    });
  }
});
