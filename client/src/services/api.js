// src/services/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  withCredentials: true,
});

/* =====================================================
   REQUEST → adjunta access token siempre
===================================================== */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mir_accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* =====================================================
   RESPONSE → refresh automático
===================================================== */
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status === 401 && !original?._retry) {
      original._retry = true;

      const refreshToken = localStorage.getItem("mir_refreshToken");
      if (!refreshToken) {
        window.dispatchEvent(new Event("auth:logout"));
        return Promise.reject(err);
      }

      try {
        const r = await axios.post(
          `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        );

        const newAccessToken = r.data.accessToken;

        localStorage.setItem("mir_accessToken", newAccessToken);
        original.headers.Authorization = `Bearer ${newAccessToken}`;

        return api(original);
      } catch (e) {
        localStorage.removeItem("mir_accessToken");
        localStorage.removeItem("mir_refreshToken");
        localStorage.removeItem("mir_user");

        window.dispatchEvent(new Event("auth:logout"));
        return Promise.reject(e);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
