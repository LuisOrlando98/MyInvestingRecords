// client/src/services/api.js
import axios from "axios";

/* =========================================================
   AXIOS INSTANCE
========================================================= */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000",
  withCredentials: false,
});

/* =========================================================
   TOKEN HELPERS
========================================================= */
const getAccessToken = () => localStorage.getItem("accessToken");
const getRefreshToken = () => localStorage.getItem("refreshToken");
const setAccessToken = (token) =>
  localStorage.setItem("accessToken", token);

/* =========================================================
   REQUEST INTERCEPTOR
   → añade Authorization automáticamente
========================================================= */
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* =========================================================
   REFRESH QUEUE (ANTI-SPAM)
========================================================= */
let isRefreshing = false;
let queue = [];

const processQueue = (error, token = null) => {
  queue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  queue = [];
};

/* =========================================================
   RESPONSE INTERCEPTOR
   → refresh automático
========================================================= */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // no response → network error
    if (!error.response) {
      return Promise.reject(error);
    }

    // solo 401
    if (error.response.status !== 401) {
      return Promise.reject(error);
    }

    // evitar loop infinito
    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    const msg = error.response.data?.msg;

    // solo refrescar si es token expirado
    if (
      msg !== "Token expired" &&
      msg !== "Invalid token" &&
      msg !== "Invalid or expired token"
    ) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      logoutHard();
      return Promise.reject(error);
    }

    // si ya hay refresh en curso → encolar
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const res = await axios.post(
        `${api.defaults.baseURL}/api/auth/refresh`,
        { refreshToken }
      );

      const newAccessToken = res.data?.accessToken;
      if (!newAccessToken) throw new Error("No new access token");

      setAccessToken(newAccessToken);
      api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;

      processQueue(null, newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (err) {
      processQueue(err, null);
      logoutHard();
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

/* =========================================================
   LOGOUT HARD (centralizado)
========================================================= */
function logoutHard() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");

  // corta socket si existe
  try {
    const { socket } = require("../lib/socket");
    socket?.disconnect();
  } catch {}

  window.location.href = "/login";
}

export default api;
