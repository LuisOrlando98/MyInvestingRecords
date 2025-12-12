import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  withCredentials: true,
});

// ============================
// REQUEST → siempre envía token
// ============================
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mir_accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ============================
// RESPONSE → refresh automático
// ============================
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // si es 401 y no se ha reintentado
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      const refreshToken = localStorage.getItem("mir_refreshToken");
      if (!refreshToken) {
        console.warn("❌ No hay refresh token → logout necesario");
        return Promise.reject(err);
      }

      // pedir nuevo accessToken
      try {
        const r = await axios.post(
          (import.meta.env.VITE_API_URL || "http://localhost:4000") +
            "/api/auth/refresh",
          { refreshToken },
          { withCredentials: true }
        );

        const newAccessToken = r.data.accessToken;

        // guardar nuevo token
        localStorage.setItem("mir_accessToken", newAccessToken);

        // reintentar request original
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(original);
      } catch (e) {
        console.log("❌ Refresh token inválido, cerrar sesión");
        localStorage.removeItem("mir_accessToken");
        localStorage.removeItem("mir_refreshToken");
        localStorage.removeItem("mir_user");
        return Promise.reject(e);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
