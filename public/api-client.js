// api-client.js
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/**
 * Secure fetch function that automatically attaches
 * a fresh Firebase ID token to every backend request.
 *
 * @param {string} url - The backend endpoint
 * @param {object} options - Optional fetch config (method, body, etc.)
 * @returns {Promise<Response>}
 */
export async function secureFetch(url, options = {}) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User is not authenticated");
  }

  // Refresh token to avoid expiration issues
  const token = await user.getIdToken(true);

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  return fetch(url, { ...options, headers });
}
