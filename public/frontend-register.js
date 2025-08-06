// public/frontend-register.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDeZIq3O6RK5q3TK685KEoUPECsN18YdHs",
    authDomain: "glock-25570.firebaseapp.com",
    projectId: "glock-25570",
    storageBucket: "glock-25570.firebasestorage.app",
    messagingSenderId: "810905599164",
    appId: "1:810905599164:web:b830bea79f2acf780e24b9",
    measurementId: "G-V226C4YDSY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use the existing message box to display errors
const messageBox = document.getElementById("custom-message-box");
const messageTitle = document.getElementById("message-title");
const messageText = document.getElementById("message-text");
const closeMessageBtn = document.getElementById("close-message");
const registerBtn = document.getElementById("registerBtn");

// Helper function to show messages
function showMessage(type, title, message) {
    messageBox.classList.remove('hidden', 'success', 'error');
    messageBox.classList.add('show', type);
    messageTitle.textContent = title;
    messageText.textContent = message;

    closeMessageBtn.onclick = () => messageBox.classList.remove('show');
}

document.getElementById("create-account-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    registerBtn.disabled = true;
    registerBtn.innerText = "Registering...";

    const fullName = document.getElementById("full-name").value.trim();
    const email = document.getElementById("email").value.trim();
    const country = document.getElementById("country").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirm-password").value.trim();

    if (password !== confirmPassword) {
        showMessage('error', 'Error!', "Passwords do not match.");
        registerBtn.disabled = false;
        registerBtn.innerText = "Create Account";
        return;
    }

    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCred.user;

        await sendEmailVerification(user);

        const API_BASE = window.location.origin;
        const res = await fetch(`${API_BASE}/api/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ fullName, email, country, uid: user.uid }),
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result.message || "Registration failed on the server.");
        }

        showMessage('success', 'Success!', "✅ Account created! Check your email to verify.");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 3000); // Wait 3 seconds to show the message

    } catch (error) {
        console.error("❌ Registration error:", error);
        let message = "Registration failed. Please try again.";

        if (error.code === "auth/email-already-in-use") {
            message = "This email is already registered. Please log in instead.";
        } else if (error.code === "auth/weak-password") {
            message = "Password should be at least 6 characters.";
        } else if (error.code === "auth/invalid-email") {
            message = "Please enter a valid email address.";
        } else if (error.message) {
            message = error.message;
        }

        showMessage('error', 'Error!', message);
    } finally {
        registerBtn.disabled = false;
        registerBtn.innerText = "Create Account";
    }
});
