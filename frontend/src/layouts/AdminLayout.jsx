import React from "react";
import { Outlet } from "react-router-dom";
import AdminDashboardPage from "../pages/dashboard/AdminDashboardPage";

/**
 * Admin Layout component
 * Exclusively provides the admin shell for authorized Admin users.
 */
export function AdminLayout() {
  return <AdminDashboardPage />;
}

export default AdminLayout;
