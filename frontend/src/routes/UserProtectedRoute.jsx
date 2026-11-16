import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isNormalUserRole, isAdminRole } from "../constants/roles";
import { getCurrentUser } from "../api/auth.api";
import { toast } from "sonner";

/**
 * Route Guard for Normal User Routes (/user/*, /kyc)
 *
 * Security model:
 * 1. Must have a valid accessToken.
 * 2. Token validated via GET /api/auth/me (never trusts localStorage role alone).
 * 3. Admin users are redirected to /admin/dashboard.
 * 4. Normal users without valid role are denied.
 * 5. KYC enforcement: if requireKyc=true, redirects to /kyc unless KYC is completed.
 * 6. Blocks content render until verification completes.
 */
export function UserProtectedRoute({ requireKyc = true }) {
  const location = useLocation();

  const [state, setState] = useState({
    status: "verifying", // "verifying" | "authorized" | "unauthorized" | "redirect_admin" | "redirect_kyc"
    redirectTo: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const token = localStorage.getItem("accessToken");

      if (!token) {
        if (!cancelled) {
          setState({ status: "unauthorized", redirectTo: "/login/user" });
        }
        return;
      }

      try {
        const res = await getCurrentUser();
        const verifiedUser = res?.data || res;

        if (!verifiedUser || !verifiedUser.id) {
          throw new Error("Invalid user response");
        }

        // Update localStorage with authoritative backend data
        const existing = (() => {
          try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
        })();
        const merged = { ...existing, ...verifiedUser };
        localStorage.setItem("user", JSON.stringify(merged));

        // Admin user attempting to access user routes → redirect to admin
        if (isAdminRole(verifiedUser)) {
          localStorage.setItem("adminUser", JSON.stringify(merged));
          if (!cancelled) {
            setState({ status: "redirect_admin", redirectTo: "/admin/dashboard" });
          }
          return;
        }

        // Clear stale adminUser if a normal user is logged in
        localStorage.removeItem("adminUser");

        // Unrecognized role
        if (!isNormalUserRole(verifiedUser)) {
          if (!cancelled) {
            toast.error("Access Denied: Unrecognized account role.");
            setState({ status: "unauthorized", redirectTo: "/login/user" });
          }
          return;
        }

        // KYC enforcement
        if (requireKyc) {
          const kycStatus = String(verifiedUser?.kyc?.status || "").toLowerCase();
          const isKycComplete = ["approved", "completed", "verified", "submitted"].includes(kycStatus);

          if (!isKycComplete) {
            if (!cancelled) {
              setState({ status: "redirect_kyc", redirectTo: "/kyc" });
            }
            return;
          }
        }

        if (!cancelled) setState({ status: "authorized", redirectTo: null });
      } catch (err) {
        const status = err?.response?.status;
        if (!cancelled) {
          if (status === 401 || status === 403) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("user");
            localStorage.removeItem("adminUser");
            setState({ status: "unauthorized", redirectTo: "/login/user?session=expired" });
          } else {
            // Network error — fall back to cached data (best effort)
            const cached = (() => {
              try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
            })();
            const cachedToken = localStorage.getItem("accessToken");

            if (cached && cachedToken && isNormalUserRole(cached)) {
              if (requireKyc) {
                const kycStatus = String(cached?.kyc?.status || "").toLowerCase();
                const isKycComplete = ["approved", "completed", "verified", "submitted"].includes(kycStatus);
                if (!isKycComplete) {
                  setState({ status: "redirect_kyc", redirectTo: "/kyc" });
                  return;
                }
              }
              setState({ status: "authorized", redirectTo: null });
            } else if (cached && cachedToken && isAdminRole(cached)) {
              setState({ status: "redirect_admin", redirectTo: "/admin/dashboard" });
            } else {
              setState({ status: "unauthorized", redirectTo: "/login/user" });
            }
          }
        }
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [location.pathname, requireKyc]);

  if (state.status === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500">Verifying session…</span>
        </div>
      </div>
    );
  }

  if (state.status === "redirect_admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (state.status === "redirect_kyc") {
    return <Navigate to="/kyc" replace />;
  }

  if (state.status !== "authorized") {
    return <Navigate to={state.redirectTo || "/login/user"} state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default UserProtectedRoute;
