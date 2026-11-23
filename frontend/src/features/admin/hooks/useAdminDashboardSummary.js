import { useQuery } from "@tanstack/react-query";
import {
  getAdminDashboardSummary,
  getRecentAdminKycApplications,
} from "../services/adminDashboardApi";

export const adminDashboardQueryKeys = {
  summary: ["admin", "dashboard", "summary"],
  recentKycApplications: (params) => ["admin", "dashboard", "recent-kyc-applications", params],
};

export function useAdminDashboardSummary() {
  return useQuery({
    queryKey: adminDashboardQueryKeys.summary,
    queryFn: getAdminDashboardSummary,
  });
}

export function useRecentAdminKycApplications(params) {
  return useQuery({
    queryKey: adminDashboardQueryKeys.recentKycApplications(params),
    queryFn: () => getRecentAdminKycApplications(params),
  });
}
