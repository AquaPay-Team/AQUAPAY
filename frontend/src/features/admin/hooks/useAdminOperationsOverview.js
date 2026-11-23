import { useQuery } from "@tanstack/react-query";
import { getAdminOperationsOverview } from "../services/adminOperationsApi";

export const adminOperationsQueryKey = ["admin", "operations", "overview"];

export function useAdminOperationsOverview() {
  return useQuery({
    queryKey: adminOperationsQueryKey,
    queryFn: getAdminOperationsOverview,
    refetchInterval: 30_000,
  });
}
