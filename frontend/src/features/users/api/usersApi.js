import httpClient from "../../../api/httpClient";

/**
 * Shared Users & Hierarchy API Service
 * Backed by real backend endpoints, consumed by both Admin and User Team modules.
 */

export const fetchBackendUsers = async (params = {}) => {
  const response = await httpClient.get("/users", { params });
  return response.data;
};

export const fetchBackendDescendantRoles = async () => {
  const response = await httpClient.get("/users/roles/descendants");
  return response.data;
};

export const fetchBackendUserById = async (id) => {
  const response = await httpClient.get(`/users/${id}`);
  return response.data;
};

export const createBackendUser = async (userData) => {
  const response = await httpClient.post("/users", userData);
  return response.data;
};

export const updateBackendUser = async (id, userData) => {
  const response = await httpClient.patch(`/users/${id}`, userData);
  return response.data;
};

export const resetBackendUserPassword = async (id, { newPassword, confirmPassword }) => {
  const response = await httpClient.post(`/users/${id}/reset-password`, { newPassword, confirmPassword });
  return response.data;
};

export default {
  fetchBackendUsers,
  fetchBackendDescendantRoles,
  fetchBackendUserById,
  createBackendUser,
  updateBackendUser,
  resetBackendUserPassword,
};