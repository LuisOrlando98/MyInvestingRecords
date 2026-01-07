// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();

  /* =====================================
     ESTADO INICIAL DESDE LOCALSTORAGE
  ===================================== */
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("mir_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [accessToken, setAccessToken] = useState(() => {
    return localStorage.getItem("mir_accessToken");
  });

  const [refreshToken, setRefreshToken] = useState(() => {
    return localStorage.getItem("mir_refreshToken");
  });

  const isAuthenticated = Boolean(accessToken && user);

  /* =====================================
     SINCRONIZAR TOKEN CON AXIOS AL CARGAR
  ===================================== */
  useEffect(() => {
    if (accessToken) {
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    }
  }, [accessToken]);

  /* =====================================
     LOGIN (ALINEADO CON BACKEND)
  ===================================== */
  const login = (jwt, refresh, userData, remember = false) => {
    setAccessToken(jwt);
    setRefreshToken(refresh);
    setUser(userData);

    api.defaults.headers.common.Authorization = `Bearer ${jwt}`;

    localStorage.setItem("mir_accessToken", jwt);
    localStorage.setItem("mir_refreshToken", refresh);
    localStorage.setItem("mir_user", JSON.stringify(userData));
  };

  /* =====================================
     LOGOUT LIMPIO
  ===================================== */
  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);

    delete api.defaults.headers.common.Authorization;

    localStorage.removeItem("mir_accessToken");
    localStorage.removeItem("mir_refreshToken");
    localStorage.removeItem("mir_user");

    navigate("/login", { replace: true });
  };

  /* =====================================
     ESCUCHAR LOGOUT GLOBAL (REFRESH FAIL)
  ===================================== */
  useEffect(() => {
    const forceLogout = () => {
      console.warn("🔒 Logout forzado (refresh token inválido)");
      logout();
    };

    window.addEventListener("auth:logout", forceLogout);
    return () => window.removeEventListener("auth:logout", forceLogout);
  }, []);

  /* =====================================
     DEBUG OPCIONAL
  ===================================== */
  useEffect(() => {
    console.log("🔐 Auth state:", {
      isAuthenticated,
      user,
      accessToken: accessToken ? "✔️" : "❌",
      refreshToken: refreshToken ? "✔️" : "❌",
    });
  }, [isAuthenticated, user, accessToken, refreshToken]);

  /* =====================================
     CONTEXT VALUE
  ===================================== */
  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* =====================================
   HOOK
===================================== */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
