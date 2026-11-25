import React from "react";
import { DashboardOverview } from "../components/DashboardOverview";
import { useAdminDashboardSummary } from "../hooks/useAdminDashboardSummary";

export default function AdminDashboardOverviewPage() {
  const summaryQuery = useAdminDashboardSummary();

  return (
    <DashboardOverview
      summary={summaryQuery.data}
      isLoading={summaryQuery.isLoading}
      isError={summaryQuery.isError}
      error={summaryQuery.error}
      isFetching={summaryQuery.isFetching}
      dataUpdatedAt={summaryQuery.dataUpdatedAt}
      refresh={summaryQuery.refetch}
    />
  );
}