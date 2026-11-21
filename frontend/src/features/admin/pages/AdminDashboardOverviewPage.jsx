import React, { useMemo } from "react";
import { DashboardOverview } from "../components/DashboardOverview";
import { useUsers, computeUserStats } from "../hooks/useAdminUsers";

export default function AdminDashboardOverviewPage() {
  const { data: users = [], isLoading, refetch } = useUsers();

  const stats = useMemo(() => computeUserStats(users), [users]);

  return (
    <DashboardOverview
      stats={stats}
      loadUsers={refetch}
      isLoadingUsers={isLoading}
    />
  );
}