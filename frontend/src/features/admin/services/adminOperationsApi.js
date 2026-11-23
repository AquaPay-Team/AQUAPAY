import httpClient from "@/api/httpClient";

export async function getAdminOperationsOverview() {
  const { data } = await httpClient.get("/admin/operations/overview");
  return data.data;
}
