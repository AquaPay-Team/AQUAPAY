import React, { createContext, useState, useEffect, useCallback, useRef } from "react";
import { getCurrentUser } from "../../api/auth.api";
import { isAdminRole, isNormalUserRole } from "../../constants/roles";
import { getToken, getCachedUser, setSession, clearSession, updateCachedUser } from "./session";
import { queryClient } from "@/lib/queryClient";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCachedUser());
  const [isLoading, setIsLoading] = useState(true);
  const verifyingRef = useRef(false);
  const lastVerifiedAtRef = useRef(0);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  /**
   * Verify session via GET /api/auth/me (throttled to avoid redundant calls)
   */
  const verifySession = useCallback(async (force = false) => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    const now = Date.now();
    // Throttle checks to once every 15 seconds unless forced
    if (!force && now - lastVerifiedAtRef.current < 15000 && userRef.current) {
      setIsLoading(false);
      return userRef.current;
    }

    if (verifyingRef.current) return userRef.current;
    verifyingRef.current = true;

    try {
      const res = await getCurrentUser();
      const verified = res?.data || res;
      if (verified && verified.id) {
        setSession({ token, user: verified });
        setUser(verified);
        lastVerifiedAtRef.current = Date.now();
        setIsLoading(false);
        verifyingRef.current = false;
        return verified;
      } else {
        clearSession();
        setUser(null);
        setIsLoading(false);
        verifyingRef.current = false;
        return null;
      }
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        clearSession();
        setUser(null);
      }
      setIsLoading(false);
      verifyingRef.current = false;
      return null;
    }
  }, []);

  // Initial boot verification
  useEffect(() => {
    verifySession(true);
  }, [verifySession]); // Run once on app startup

  // Window focus listener (throttled)
  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        verifySession(false);
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [verifySession]);

  const login = useCallback(({ token, user: userData }) => {
    setSession({ token, user: userData });
    setUser(userData);
    setIsLoading(false);
    lastVerifiedAtRef.current = Date.now();
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setIsLoading(false);
    try {
      queryClient.clear();
    } catch {}
    window.location.replace("/login");
  }, []);

  const updateUser = useCallback((updatedFields) => {
    const merged = updateCachedUser(updatedFields);
    setUser(merged);
  }, []);

  const value = {
    user,
    isLoading,
    isAuthenticated: Boolean(user && getToken()),
    isAdmin: user ? isAdminRole(user) : false,
    isNormalUser: user ? isNormalUserRole(user) : false,
    login,
    logout,
    updateUser,
    refreshUser: () => verifySession(true),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;