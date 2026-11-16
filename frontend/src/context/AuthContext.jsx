import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getCurrentUser } from "../api/auth.api";
import { isAdminRole, isNormalUserRole } from "../constants/roles";

/**
 * AquaPay Canonical Authentication Context
 *
 * Single source of truth for authentication state.
 * - Validates JWT via GET /api/auth/me on every mount and tab focus.
 * - Never trusts role data stored only in localStorage.
 * - Clears all session data on logout or token invalidation.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const verifyingRef = useRef(false);

  /**
   * Clear all auth session data and reset state.
   */
  const clearSession = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("adminUser");
    setUser(null);
    setIsAuthenticated(false);
    setIsLoading(false);
  }, []);

  /**
   * Verify the current JWT via GET /api/auth/me and update auth state.
   */
  const verifySession = useCallback(async () => {
    if (verifyingRef.current) return null;
    verifyingRef.current = true;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      verifyingRef.current = false;
      return null;
    }

    try {
      const res = await getCurrentUser();
      const verifiedUser = res?.data || res;

      if (verifiedUser && verifiedUser.id) {
        const existing = (() => {
          try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
        })();
        const merged = { ...existing, ...verifiedUser };
        localStorage.setItem("user", JSON.stringify(merged));

        if (isAdminRole(verifiedUser)) {
          localStorage.setItem("adminUser", JSON.stringify(merged));
        } else {
          // Non-admin logged in: clear stale adminUser to prevent cross-contamination
          localStorage.removeItem("adminUser");
        }

        setUser(merged);
        setIsAuthenticated(true);
        setIsLoading(false);
        verifyingRef.current = false;
        return merged;
      } else {
        clearSession();
        verifyingRef.current = false;
        return null;
      }
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        clearSession();
      } else {
        // Network error: use cached data temporarily
        const cached = (() => {
          try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
        })();
        if (cached && cached.id) {
          setUser(cached);
          setIsAuthenticated(true);
        } else {
          clearSession();
        }
      }
      setIsLoading(false);
      verifyingRef.current = false;
      return null;
    }
  }, [clearSession]);

  const logout = useCallback(() => {
    clearSession();
    window.location.href = "/login/user";
  }, [clearSession]);

  const adminLogout = useCallback(() => {
    clearSession();
    window.location.href = "/login/admin";
  }, [clearSession]);

  /**
   * Update user state reactively after external mutations (e.g., KYC name sync).
   */
  const updateUser = useCallback((updatedFields) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updatedFields };
      localStorage.setItem("user", JSON.stringify(merged));
      if (isAdminRole(merged)) {
        localStorage.setItem("adminUser", JSON.stringify(merged));
      }
      return merged;
    });
  }, []);

  // Verify session on initial mount
  useEffect(() => {
    verifySession();
  }, [verifySession]);

  // Re-verify on tab focus / visibility change (handles multi-tab account switching)
  useEffect(() => {
    const handleFocus = () => {
      const token = localStorage.getItem("accessToken");
      if (!token && isAuthenticated) {
        clearSession();
      } else if (token) {
        verifySession();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    };

    // Listen for user update events from other components (e.g., KYC name sync)
    const handleUserUpdate = (e) => {
      if (e?.detail) {
        setUser((prev) => {
          if (!prev) return prev;
          return { ...prev, ...e.detail };
        });
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("aquapay:user_updated", handleUserUpdate);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("aquapay:user_updated", handleUserUpdate);
    };
  }, [isAuthenticated, clearSession, verifySession]);

  const value = {
    user,
    isLoading,
    isAuthenticated,
    isAdmin: user ? isAdminRole(user) : false,
    isNormalUser: user ? isNormalUserRole(user) : false,
    verifySession,
    updateUser,
    logout,
    adminLogout,
    clearSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

export default AuthContext;
