import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Auth Pages
import LoginPage from "../pages/auth/LoginPage";
import AdminLoginPage from "../pages/admin/AdminLoginPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";

// Route Guards
import AdminProtectedRoute from "./AdminProtectedRoute";
import UserProtectedRoute from "./UserProtectedRoute";

// Layouts
import AdminLayout from "../layouts/AdminLayout";
import UserLayout from "../layouts/UserLayout";

// Admin Pages
import ExistingAdminDashboard from "../pages/admin/ExistingAdminDashboard";

// Normal User Pages
import UserDashboard from "../pages/user/UserDashboard";
import UserTeam from "../pages/user/UserTeam";
import UserProfile from "../pages/user/UserProfile";
import UserSettings from "../pages/user/UserSettings";
import UserKyc from "../pages/user/UserKyc";

export function AppRoutes() {
  return (
    <Routes>
      {/* 1. Public Authentication Entry Points */}
      <Route path="/login/admin" element={<AdminLoginPage />} />
      <Route path="/login/user" element={<LoginPage />} />

      {/* Backward-Compatible Login Aliases */}
      <Route path="/admin/login" element={<Navigate to="/login/admin" replace />} />
      <Route path="/login" element={<Navigate to="/login/user" replace />} />

      {/* Password Recovery Routes */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ForgotPasswordPage />} />

      {/* 2. Standalone KYC Route (Accessible before full KYC approval) */}
      <Route element={<UserProtectedRoute requireKyc={false} />}>
        <Route path="/kyc" element={<UserKyc />} />
        <Route path="/user/kyc" element={<UserKyc />} />
        <Route path="/user/kyc/*" element={<UserKyc />} />
      </Route>

      {/* 3. Normal User Protected Routes (/user/*) */}
      <Route element={<UserProtectedRoute requireKyc={true} />}>
        <Route path="/user" element={<UserLayout />}>
          <Route index element={<Navigate to="/user/dashboard" replace />} />
          <Route path="dashboard" element={<UserDashboard />} />
          <Route path="team" element={<UserTeam />} />
          <Route path="team/create" element={<UserTeam />} />
          <Route path="profile" element={<UserProfile />} />
          <Route path="settings" element={<UserSettings />} />
          <Route path="*" element={<Navigate to="/user/dashboard" replace />} />
        </Route>

        {/* /dashboard redirect to /user/dashboard for standard user navigation */}
        <Route path="/dashboard" element={<Navigate to="/user/dashboard" replace />} />
      </Route>

      {/* 4. Admin Protected Routes (/admin/*) */}
      <Route element={<AdminProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<ExistingAdminDashboard />} />
          <Route path="users" element={<ExistingAdminDashboard />} />
          <Route path="users/create" element={<ExistingAdminDashboard />} />
          <Route path="users/:id" element={<ExistingAdminDashboard />} />
          <Route path="kyc" element={<ExistingAdminDashboard />} />
          <Route path="reports" element={<ExistingAdminDashboard />} />
          <Route path="profile" element={<ExistingAdminDashboard />} />
          <Route path="settings" element={<ExistingAdminDashboard />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>
      </Route>

      {/* Default Fallback */}
      <Route path="/" element={<Navigate to="/login/user" replace />} />
      <Route path="*" element={<Navigate to="/login/user" replace />} />
    </Routes>
  );
}

export default AppRoutes;
