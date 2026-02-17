import axios from "axios";

const API_BASE_URL = "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 (unauthorized) and 403 (forbidden) errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      const currentPath = window.location.pathname;

      // Only force redirects for protected areas (admin/staff).
      // Public pages like the monitor (/monitor) should stay publicly accessible
      // even if some background API call returns 401/403.
      if (currentPath.startsWith("/admin")) {
        if (currentPath !== "/admin/login") {
          window.location.href = "/admin/login";
        }
      } else if (currentPath.startsWith("/staff")) {
        if (currentPath !== "/staff/login") {
          const code = error.response?.data?.code;
          const query = code === "STAFF_LOGOUT_6PM" ? "?reason=logout_6pm" : "";
          window.location.href = "/staff/login" + query;
        }
      }
    }
    return Promise.reject(error);
  },
);

/** Safe parse of stored user — avoids JSON.parse("undefined") errors */
export function getStoredUser() {
  const raw = localStorage.getItem("user");
  if (raw == null || raw === "" || raw === "undefined") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default api;
