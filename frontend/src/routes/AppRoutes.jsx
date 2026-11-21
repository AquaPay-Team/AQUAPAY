import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Layouts & Guards
import AdminProtectedRoute from "./AdminProtectedRoute";
import UserProtectedRoute from "./UserProtectedRoute";
import AdminLayout from "../layouts/AdminLayout";
import UserLayout from "../layouts/UserLayout";
import RouteLoadingFallback from "@/components/feedback/RouteLoadingFallback";

// Auth Pages (Lazy)
const LoginPage = lazy(() => import("../pages/auth/LoginPage"));
const ForgotPasswordPage = lazy(() => import("../pages/auth/ForgotPasswordPage"));
const NotFoundPage = lazy(() => import("../pages/not-found/NotFoundPage"));

// Admin Pages (Lazy)
const AdminDashboardOverviewPage = lazy(() => import("@/features/admin/pages/AdminDashboardOverviewPage"));
const AdminUsersPage = lazy(() => import("@/features/admin/pages/AdminUsersPage"));
const AdminKycPage = lazy(() => import("@/features/admin/pages/AdminKycPage"));

// Normal User Pages (Lazy)
const UserDashboard = lazy(() => import("../pages/user/UserDashboard"));
const UserTeam = lazy(() => import("../pages/user/UserTeam"));
const UserProfile = lazy(() => import("@/features/users/pages/UserProfile"));
const UserSettings = lazy(() => import("../pages/user/UserSettings"));
const UserKyc = lazy(() => import("../pages/user/UserKyc"));

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback/>}>
    <Routes>
      {/* 1. Public Authentication Entry Points */}
      <Route path="/login" element={<LoginPage />} />

      {/* Backward-Compatible Login Aliases */}
      <Route path="/login/admin" element={<Navigate to="/login" replace />} />
      <Route path="/login/user" element={<Navigate to="/login" replace />} />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />

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
          <Route path="team/create" element={<Navigate to="/user/team" replace />} />
          <Route path="team/:id" element={<UserProfile />} />
          <Route path="*" element={<Navigate to="/user/dashboard" replace />} />
        </Route>

        {/* /dashboard redirect to /user/dashboard for standard user navigation */}
        <Route path="/dashboard" element={<Navigate to="/user/dashboard" replace />} />
      </Route>

      {/* Account profile and password settings remain available before KYC completion. */}
      <Route element={<UserProtectedRoute requireKyc={false} />}>
        <Route path="/user/profile" element={<UserLayout />}>
          <Route index element={<UserProfile />} />
        </Route>
        <Route path="/user/settings" element={<UserLayout />}>
          <Route index element={<UserSettings />} />
        </Route>
      </Route>

      {/* 4. Admin Protected Routes (/admin/*) */}
      <Route element={<AdminProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardOverviewPage  />} />
          <Route path="users" element={<AdminUsersPage   />} />
          <Route path="users/create" element={<Navigate to="/admin/users" replace />} />
          <Route path="users/:id" element={<UserProfile />} />
          <Route path="kyc" element={<AdminKycPage  />} />
          <Route path="reports" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="profile" element={<UserProfile />} /> 
          <Route path="settings" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>
      </Route>

      {/* Default Fallback */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense >
  );
}

export default AppRoutes;
