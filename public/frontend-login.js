document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('loginBtn');

    // Your deployed backend URL
    const API_BASE = "https://cloud-gaming-project.onrender.com";


    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!email || !password) {
            alert("Please fill in both fields.");
            return;
        }

        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerText = "Signing in...";
        }

        try {
            // ✅ Fixed lowercase "login" route
            const res = await fetch(`${API_BASE}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            console.log("🔹 Login response:", data);

            if (!res.ok) {
                throw new Error(data.message || "Login failed");
            }

            // ✅ Flexible token handling
            const token =
                data.token ||
                data.accessToken ||
                (data.user && data.user.token) ||
                null;

            if (token) {
                localStorage.setItem('authToken', token);
                console.log("✅ Token saved to localStorage");
            } else {
                console.warn("⚠️ No token found in response:", data);
            }

            // ✅ Redirect to dashboard
            window.location.href = '/dashboard.html';

        } catch (error) {
            alert("Login failed: " + error.message);
        } finally {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerText = "Sign in";
            }
        }
    });
});
