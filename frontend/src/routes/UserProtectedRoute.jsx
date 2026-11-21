import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import { isKycComplete } from "../features/kyc/model/kycStatus";
import { Loader2 } from "lucide-react";

export function UserProtectedRoute({ requireKyc = true }) {
  const { isLoading, isAuthenticated, isAdmin, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-xs font-medium text-slate-500">Verifying session…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // KYC verification check
  const kycStatus = user?.kyc?.status || user?.kyc_status;
  if (requireKyc && !isKycComplete(kycStatus)) {
    return <Navigate to="/kyc" replace />;
  }

  return <Outlet />;
}

export default UserProtectedRoute;