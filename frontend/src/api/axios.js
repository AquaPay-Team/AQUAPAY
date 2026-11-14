import axios from "axios";

/**
 * Centralized AquaPay Axios Client
 * - Manages baseURL and default headers
 * - Automatically attaches Bearer JWT token to authorized endpoints
 * - Handles 401 Unauthorized (session expired) and 403 Forbidden responses
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request Interceptor: Attach JWT Access Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Global 401 / 403 Error Handling & Session Expiry
api.interceptors.response.use(
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
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      localStorage.removeItem("adminUser");

      // Redirect user to the corresponding login entry point
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (path.startsWith("/admin")) {
          window.location.href = "/login/admin?session=expired";
        } else if (!path.includes("/login")) {
          window.location.href = "/login/user?session=expired";
        }
      }
    }

    if (status === 403) {
      console.warn("AquaPay API 403 Forbidden:", url);
    }

    return Promise.reject(error);
  }
);

export default api;
