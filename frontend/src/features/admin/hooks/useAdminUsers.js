import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBackendUsers,
  fetchBackendDescendantRoles,
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
export function computeUserStats(users = []) {
  const safeUsers = Array.isArray(users) ? users : [];
  const total = safeUsers.length;
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

export function useUsers(roleId = "") {
  return useQuery({
    queryKey: adminQueryKeys.list(roleId),
    queryFn: async () => {
      const response = await fetchBackendUsers(roleId ? { roleId } : {});
      return Array.isArray(response?.data) ? response.data : [];
    },
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