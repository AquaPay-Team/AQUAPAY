import React from "react";
import { DashboardOverview } from "../components/DashboardOverview";
import { useUserStats } from "../hooks/useAdminUsers";

const DEFAULT_STATS = {
  total: 0,
  active: 0,
  retailers: 0,
  distributors: 0,
  verifiedKyc: 0,
  pendingKyc: 0,
};

export default function AdminDashboardOverviewPage() {
  const { data: stats, isLoading, refetch } = useUserStats();

  return (
    <DashboardOverview
      stats={stats || DEFAULT_STATS}
      loadUsers={refetch}
      isLoadingUsers={isLoading}
    />
  );
}