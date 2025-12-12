// src/context/AuthContext.jsx
import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // -----------------------------
  // STATE INICIAL DESDE LOCALSTORAGE
  // -----------------------------
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("mir_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [accessToken, setAccessToken] = useState(() => {
    return localStorage.getItem("mir_accessToken") || null;
  });

  const [refreshToken, setRefreshToken] = useState(() => {
    return localStorage.getItem("mir_refreshToken") || null;
  });

  // -----------------------------
  // LOGIN CORRECTO (ALINEADO CON BACKEND)
  // -----------------------------
    const login = (jwt, refresh, userData, remember = false) => {
      setAccessToken(jwt);
      setRefreshToken(refresh);
      setUser(userData);

      // Guardar SIEMPRE tokens
      localStorage.setItem("mir_accessToken", jwt);
      localStorage.setItem("mir_refreshToken", refresh);
      localStorage.setItem("mir_user", JSON.stringify(userData));

      // Remember sirve solo para recordar device (futuro)
    };

  // -----------------------------
  // LOGOUT
  // -----------------------------
  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);

    localStorage.removeItem("mir_accessToken");
    localStorage.removeItem("mir_refreshToken");
    localStorage.removeItem("mir_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
