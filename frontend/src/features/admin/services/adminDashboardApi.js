import httpClient from "@/api/httpClient";

export async function getAdminDashboardSummary() {
  const { data } = await httpClient.get("/admin/dashboard/summary");
  return data.data;
}

export async function getRecentAdminKycApplications(params = {}) {
  const { data } = await httpClient.get("/admin/kyc/recent", { params });
  return data.data;
}
