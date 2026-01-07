// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { syncSocketAuth } from "../lib/socket";

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

  const [accessToken, setAccessToken] = useState(() =>
    localStorage.getItem("mir_accessToken")
  );

  // ⚠️ SE MANTIENE por compatibilidad (NO se elimina)
  const [refreshToken, setRefreshToken] = useState(() =>
    localStorage.getItem("mir_refreshToken")
  );

  const isAuthenticated = Boolean(user && accessToken);

  /* =====================================
     SINCRONIZAR TOKEN CON AXIOS
  ===================================== */
  useEffect(() => {
    if (accessToken) {
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  }, [accessToken]);

  /* =====================================
     LOGIN (MISMA FIRMA, MISMO COMPORTAMIENTO)
  ===================================== */
  const login = (jwt, refresh, userData, remember = false) => {
    setAccessToken(jwt);
    setRefreshToken(refresh);
    setUser(userData);

    api.defaults.headers.common.Authorization = `Bearer ${jwt}`;

    localStorage.setItem("mir_accessToken", jwt);
    localStorage.setItem("mir_refreshToken", refresh);
    localStorage.setItem("mir_user", JSON.stringify(userData));

    syncSocketAuth();
  };

  /* =====================================
     LOGOUT LIMPIO (MISMO COMPORTAMIENTO)
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
     LOGOUT GLOBAL (REFRESH FAIL)
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
     MEMO CONTEXT VALUE (PERFORMANCE)
  ===================================== */
  const contextValue = useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      isAuthenticated,
      login,
      logout,
    }),
    [user, accessToken, refreshToken, isAuthenticated]
  );

  return (
    <AuthContext.Provider value={contextValue}>
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
