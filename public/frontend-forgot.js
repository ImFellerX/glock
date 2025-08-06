// frontend-forgot.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, applyActionCode } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const sendBtn = document.getElementById("send-btn");
const messageBox = document.getElementById("custom-message-box");
const messageText = document.getElementById("message-text");
const closeBtn = document.getElementById("close-message");

function showMessage(type, title, message) {
    messageBox.classList.remove('hidden', 'success', 'error');
    messageBox.classList.add('show', type);
    messageTitle.textContent = title;
    messageText.textContent = message;
    closeBtn.onclick = () => messageBox.classList.remove('show');
}

document.getElementById("forgot-password-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const formBtn = e.submitter;
  formBtn.disabled = true;
  formBtn.innerText = "Sending...";

  messageBox.classList.remove("show");

  try {
    const API_BASE = window.location.origin;
    const res = await fetch(`${API_BASE}/api/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.message || "Failed to send reset link.");
    }

    showMessage('success', 'Success!', "✅ If an account with that email exists, you’ll receive a reset link.");
    document.getElementById("forgot-password-form").reset();
  } catch (err) {
    console.error("Forgot password error:", err);
    showMessage('error', 'Error!', "❌ Could not send reset link. Please try again later.");
  } finally {
    formBtn.disabled = false;
    formBtn.innerText = "Send Reset Link";
  }
});