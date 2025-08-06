document.addEventListener('DOMContentLoaded', () => {
    const addFundsForm = document.getElementById('add-funds-form');
    const addFundsBtn = document.getElementById('addFundsBtn');
    const amountInput = document.getElementById('fundInput'); // Make sure this ID matches your HTML

    // Backend URL
    const API_BASE = "https://cloud-gaming-project.onrender.com";

    const messageBox = document.getElementById("custom-message-box");
    const messageTitle = messageBox.querySelector("h3");
    const messageText = document.getElementById("message-text");
    const closeMessageBtn = document.getElementById("close-message");

    function showMessage(type, title, message) {
        messageBox.classList.remove('error', 'success');
        messageBox.classList.add('show', type);
        messageTitle.textContent = title;
        messageText.textContent = message;
        closeMessageBtn.onclick = () => messageBox.classList.remove('show');
    }

    addFundsForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const amount = parseFloat(amountInput.value);

        if (!amount || amount < 5) {
            showMessage('error', 'Error!', 'Minimum amount to add is $5');
            return;
        }

        const token = localStorage.getItem('authToken');
        if (!token) {
            showMessage('error', 'Error!', 'You must be logged in to add funds.');
            return;
        }

        addFundsBtn.disabled = true;
        const originalText = addFundsBtn.innerText;
        addFundsBtn.innerText = "Redirecting to Stripe...";

        try {
            const res = await fetch(`${API_BASE}/api/payments/create-checkout-session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ amount })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Failed to create Stripe session.");
            }

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error("No checkout URL received from server.");
            }

        } catch (error) {
            showMessage('error', 'Error!', `Payment initiation failed: ${error.message}`);
        } finally {
            addFundsBtn.disabled = false;
            addFundsBtn.innerText = originalText;
        }
    });
});
