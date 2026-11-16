import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAdminRole } from "../constants/roles";
import { getCurrentUser } from "../api/auth.api";
import { toast } from "sonner";

/**
 * Route Guard for Admin Routes (/admin/*)
 *
 * Security model:
 * 1. Must have a valid accessToken in localStorage.
 * 2. Token is validated via GET /api/auth/me (backend verification).
 * 3. Role is determined EXCLUSIVELY from the backend response — never from localStorage alone.
 * 4. Clears stale adminUser / user data if token is invalid.
 * 5. Prevents normal users from accessing Admin routes even if they manually set localStorage.
 * 6. Blocks render of protected content until verification completes.
 */
export function AdminProtectedRoute() {
  const location = useLocation();

  const [state, setState] = useState({
    status: "verifying", // "verifying" | "authorized" | "unauthorized" | "not_admin"
    redirectTo: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const token = localStorage.getItem("accessToken");

      if (!token) {
        if (!cancelled) {
          setState({ status: "unauthorized", redirectTo: "/login/admin" });
        }
        return;
      }

      try {
        const res = await getCurrentUser();
        const verifiedUser = res?.data || res;

        if (!verifiedUser || !verifiedUser.id) {
          throw new Error("Invalid user response from /api/auth/me");
        }

        // Update localStorage with authoritative backend data
        const existing = (() => {
          try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
        })();
        const merged = { ...existing, ...verifiedUser };
        localStorage.setItem("user", JSON.stringify(merged));

        if (isAdminRole(verifiedUser)) {
          // Confirmed admin — also refresh adminUser
          localStorage.setItem("adminUser", JSON.stringify(merged));
          if (!cancelled) setState({ status: "authorized", redirectTo: null });
        } else {
          // Authenticated but NOT an admin
          localStorage.removeItem("adminUser");
          if (!cancelled) {
            toast.error("You are not authorized to access the Admin Panel. Please use the User Login.");
            setState({ status: "not_admin", redirectTo: "/login/admin" });
          }
        }
      } catch (err) {
        const status = err?.response?.status;
        if (!cancelled) {
          // Clear invalid session
          localStorage.removeItem("accessToken");
          localStorage.removeItem("user");
          localStorage.removeItem("adminUser");

          if (status === 401 || status === 403) {
            setState({ status: "unauthorized", redirectTo: "/login/admin?session=expired" });
          } else {
            // Network error — fall back to localStorage check (best effort)
            const cached = (() => {
              try { return JSON.parse(localStorage.getItem("adminUser") || "null"); } catch { return null; }
            })();
            const cachedToken = localStorage.getItem("accessToken");
            if (cached && cachedToken && isAdminRole(cached)) {
              setState({ status: "authorized", redirectTo: null });
            } else {
              setState({ status: "unauthorized", redirectTo: "/login/admin" });
            }
          }
        }
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [location.pathname]);

  if (state.status === "verifying") {
    // Block render until auth check completes — prevents content flash
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500">Verifying admin session…</span>
        </div>
      </div>
    );
  }

  if (state.status !== "authorized") {
    return <Navigate to={state.redirectTo || "/login/admin"} state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default AdminProtectedRoute;
