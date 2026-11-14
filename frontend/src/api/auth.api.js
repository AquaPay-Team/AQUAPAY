import api from "./axios";

/**
 * Shared Backend Authentication API Service
 * Exclusively uses real backend endpoints:
 * - POST /api/auth/login
 * - GET /api/auth/me
 * - POST /api/auth/forgot-password
 * - POST /api/auth/reset-password
 */

export const loginUser = async (credentials) => {
  const response = await api.post("/auth/login", credentials);
  return response.data;
};

export const getCurrentUser = async (customToken) => {
  const headers = customToken
    ? { Authorization: `Bearer ${customToken}` }
    : undefined;

  const response = await api.get("/auth/me", { headers });
  return response.data;
};

/**
 * Full authentication flow:
 * 1. Authenticate credentials via POST /api/auth/login
 * 2. Retrieve authoritative user & role details via GET /api/auth/me
 */
export const authenticateWithMe = async ({ identifier, password }) => {
  const loginRes = await api.post("/auth/login", {
    identifier: identifier.trim(),
    password,
  });

  if (!loginRes?.data?.success) {
    throw new Error(loginRes?.data?.message || "Authentication failed");
  }

  const { accessToken, user: loginUserPayload } = loginRes.data.data;

  // Retrieve fresh user and role info directly from backend
  let verifiedUser = loginUserPayload;
  try {
    const meRes = await getCurrentUser(accessToken);
    if (meRes?.data) {
      verifiedUser = meRes.data;
    }
  } catch (err) {
    console.warn("Could not fetch /auth/me after login, using login payload:", err?.message);
  }

  return {
    accessToken,
    user: verifiedUser,
  };
};

export const forgotPassword = async (identifier) => {
  const response = await api.post("/auth/forgot-password", {
    identifier,
  });

  return response.data;
};

export const resetPassword = async ({ token, otp, password }) => {
  const response = await api.post("/auth/reset-password", {
    token,
    otp,
    password,
  });

  return response.data;
};

export default {
  loginUser,
  getCurrentUser,
  authenticateWithMe,
  forgotPassword,
  resetPassword,
};
