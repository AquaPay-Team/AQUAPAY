/**
 * AquaPay Canonical Session Storage Manager
 * The SOLE owner of browser storage for credentials and user identity.
 */

const TOKEN_KEY = "accessToken";
const USER_KEY = "user";
const ADMIN_USER_KEY = "adminUser";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession({ token, user }) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      if (Number(user.role_id) === 1 || String(user.role_slug || "").toUpperCase() === "AD") {
        localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(ADMIN_USER_KEY);
      }
    }
  } catch (err) {
    console.error("Failed to write session to storage:", err);
  }
}

export function updateCachedUser(updatedFields) {
  try {
    const current = getCachedUser() || {};
    const merged = { ...current, ...updatedFields };
    localStorage.setItem(USER_KEY, JSON.stringify(merged));
    if (Number(merged.role_id) === 1 || String(merged.role_slug || "").toUpperCase() === "AD") {
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch (err) {
    console.error("Failed to update cached user:", err);
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    sessionStorage.clear();
  } catch (err) {
    console.error("Failed to clear session storage:", err);
  }
}