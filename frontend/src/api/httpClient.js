import axios from "axios";
import { getToken, clearSession } from "@/features/auth/session";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;

// Fail fast in production if the API endpoint is misconfigured
if (import.meta.env.PROD && !rawBaseUrl) {
  console.error("FATAL: VITE_API_BASE_URL is not defined in production build.");
}

const baseURL = rawBaseUrl || "http://localhost:3000/api";

/**
 * Centralized AquaPay HTTP Client
 * - Manages baseURL and default headers
 * - Attaches Bearer JWT token to authorized endpoints
 * - Handles 401 Unauthorized session expiry
 */
export const httpClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request Interceptor: Attach JWT Access Token
httpClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Global 401 / 403 Error Handling & Session Expiry
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";

    const isPublicAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password");

    // Handle token expiry / invalid token on protected endpoints
    if (status === 401 && !isPublicAuthRoute) {
      clearSession();

      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (path.startsWith("/admin") || !path.includes("/login")) {
          window.location.href = "/login?session=expired";
        }
      }
    }

    if (status === 403) {
      console.warn("AquaPay API 403 Forbidden:", url);
    }

    return Promise.reject(error);
  }
);

export default httpClient;