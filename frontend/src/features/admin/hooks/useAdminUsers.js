import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBackendUsers,
  fetchBackendDescendantRoles,
  fetchBackendUserStats,
  createBackendUser,
  updateBackendUser,
} from "@/features/users/api/usersApi";

export const adminQueryKeys = {
  all: ["users"],
  list: (roleId) => ["users", { roleId: roleId ? String(roleId) : null }],
  roles: ["roles", "descendants"],
};

/**
 * Pure function to derive network stats from user records
 */
export function computeUserStats(input = []) {
  let safeUsers = [];
  let total = 0;

  if (Array.isArray(input)) {
    safeUsers = input;
    total = input.length;
  } else if (input && typeof input === "object") {
    safeUsers = Array.isArray(input.users) ? input.users : [];
    total = Number(input.pagination?.total) || safeUsers.length;
  }

  const active = safeUsers.filter((u) => u.status === "active").length;
  const retailers = safeUsers.filter(
    (u) =>
      String(u.role_name || "").toLowerCase() === "retailer" ||
      String(u.role_slug || "").toLowerCase() === "rt"
  ).length;
  const distributors = safeUsers.filter(
    (u) =>
      String(u.role_name || "").toLowerCase() === "distributor" ||
      String(u.role_slug || "").toLowerCase() === "dt"
  ).length;
  const pendingKyc = safeUsers.filter(
    (u) => !u.kyc || u.kyc?.status === "pending" || u.kyc?.status === "in_progress"
  ).length;
  const verifiedKyc = safeUsers.filter(
    (u) =>
      u.kyc?.status === "verified" ||
      u.kyc?.status === "completed" ||
      u.kyc?.status === "submitted"
  ).length;

  return {
    total,
    active,
    retailers,
    distributors,
    pendingKyc,
    verifiedKyc,
  };
}

export function useUsers(args = {}) {
  const options = typeof args === "object" && args !== null ? args : { roleId: args };
  const { roleId = "", page = 1, limit = 100, search = "", status = "", kycStatus = "" } = options;

  const queryParams = {
    ...(roleId ? { roleId } : {}),
    page,
    limit,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(kycStatus ? { kycStatus } : {}),
  };

  return useQuery({
    queryKey: ["users", queryParams],
    queryFn: async () => {
      const response = await fetchBackendUsers(queryParams);
      const data = response?.data;
      if (data && typeof data === "object" && Array.isArray(data.users)) {
        return {
          users: data.users,
          pagination: data.pagination || {
            total: data.users.length,
            page: 1,
            limit: 100,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      }
      const fallbackList = Array.isArray(data) ? data : [];
      return {
        users: fallbackList,
        pagination: {
          total: fallbackList.length,
          page: 1,
          limit: 100,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useDescendantRoles() {
  return useQuery({
    queryKey: adminQueryKeys.roles,
    queryFn: async () => {
      const response = await fetchBackendDescendantRoles();
      return Array.isArray(response?.data) ? response.data : [];
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userData) => createBackendUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, fields }) => updateBackendUser(userId, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    },
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: ["users", "stats"],
    queryFn: async () => {
      const response = await fetchBackendUserStats();
      const stats = response?.data || response;
      return {
        total: Number(stats?.total || 0),
        active: Number(stats?.active || 0),
        retailers: Number(stats?.retailers || 0),
        distributors: Number(stats?.distributors || 0),
        verifiedKyc: Number(stats?.verifiedKyc || 0),
        pendingKyc: Number(stats?.pendingKyc || 0),
      };
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}