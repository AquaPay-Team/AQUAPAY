import { authenticateWithMe, getCurrentUser } from "../../../api/auth.api";
import { isAdminRole } from "../../../constants/roles";

/**
 * Admin Authentication & Backend-Backed API Service
 * Exclusively provides functionality backed by real backend endpoints:
 * - Authentication: POST /api/auth/login, GET /api/auth/me
 * - User Management: GET /api/users, POST /api/users, PATCH /api/users/:id, GET /api/users/:id
 */

export function isAdminUser(user) {
  return isAdminRole(user);
}

// 1. Admin Authentication Flow
export const adminLogin = async ({ identifier, password }) => {
  // Use existing backend auth endpoint POST /api/auth/login + GET /api/auth/me
  const { accessToken, user } = await authenticateWithMe({
    identifier: identifier.trim(),
    password,
  });

  // Verify that the authenticated role is an authorized Admin role
  if (!isAdminUser(user)) {
    // Clear any temporary tokens/session
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("adminUser");

    throw new Error(
      "You are not authorized to access the Admin Panel. Please use the User Login."
    );
  }

  // Store credentials securely in localStorage
  if (accessToken) {
    localStorage.setItem("accessToken", accessToken);
  }
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("adminUser", JSON.stringify(user));
  }

  return { success: true, data: { accessToken, user } };
};

export const getAdminProfile = async () => {
  return getCurrentUser();
};

export const adminLogout = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
  localStorage.removeItem("adminUser");
};

// 2. Real Backend Users Management (delegated to shared usersApi)
export {
  fetchBackendUsers,
  fetchBackendDescendantRoles,
  fetchBackendUserById,
  createBackendUser,
  updateBackendUser,
  resetBackendUserPassword,
} from "../../users/api/usersApi";

export default {
  adminLogin,
  getAdminProfile,
  adminLogout,
  isAdminUser,
  fetchBackendUsers,
  fetchBackendDescendantRoles,
  fetchBackendUserById,
  createBackendUser,
  updateBackendUser,
  resetBackendUserPassword,
};
