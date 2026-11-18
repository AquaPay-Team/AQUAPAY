import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isNormalUserRole, isAdminRole } from "../constants/roles";
import { toast } from "sonner";

/**
 * Route Guard for Normal User Routes (/user/*, /dashboard, /kyc)
 * - Ensures token exists
 * - Verifies user is an authorized Normal User role (Sub Admin, NSM, SH, CNF, MD, DT, RT)
 * - Redirects Admins to /admin
 * - Enforces KYC completion before dashboard access
 */
export function UserProtectedRoute({ requireKyc = true }) {
  const location = useLocation();
  const token = localStorage.getItem("accessToken");

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  // 1. Unauthenticated -> Redirect to User Login
  if (!token || !user) {
    return <Navigate to="/login/user" state={{ from: location }} replace />;
  }

  // 2. Admin attempting to access User routes -> Redirect to Admin Panel
  if (isAdminRole(user)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // 3. User does not have an authorized Normal User role
  if (!isNormalUserRole(user)) {
    toast.error("Access Denied: Unrecognized account role.");
    return <Navigate to="/login/user" replace />;
  }

  // 4. KYC Enforcement for User Dashboard
  if (requireKyc) {
    const isKycDone =
      user?.kyc &&
      ["approved", "completed", "verified", "submitted"].includes(
        String(user.kyc.status || "").toLowerCase()
      );

    if (!isKycDone) {
      return <Navigate to="/kyc" replace />;
    }
  }

  return <Outlet />;
}

export default UserProtectedRoute;
