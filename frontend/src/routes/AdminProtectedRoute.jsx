import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAdminRole } from "../constants/roles";
import { toast } from "sonner";

/**
 * Route Guard for Admin Routes (/admin/*)
 * - Ensures token exists
 * - Verifies that the authenticated role is exclusively an authorized Admin (Role 1 / AD)
 * - Prevents normal users from accessing Admin routes
 */
export function AdminProtectedRoute() {
  const location = useLocation();
  const token = localStorage.getItem("accessToken");

  const user = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("adminUser") ||
          localStorage.getItem("user") ||
          "null"
      );
    } catch {
      return null;
    }
  })();

  // 1. Unauthenticated -> Redirect to Admin Login
  if (!token || !user) {
    return <Navigate to="/login/admin" state={{ from: location }} replace />;
  }

  // 2. Authenticated, but not an Admin role -> Deny access to Admin Panel
  if (!isAdminRole(user)) {
    toast.error(
      "You are not authorized to access the Admin Panel. Please use the User Login."
    );
    return <Navigate to="/login/admin" replace />;
  }

  return <Outlet />;
}

export default AdminProtectedRoute;
