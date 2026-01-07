// client/src/lib/socket.js
import { io } from "socket.io-client";

/**
 * Socket singleton mejorado
 * - MISMA API (export const socket)
 * - Token SIEMPRE actualizado
 * - Reconexión estable en LAN
 * - Cookies httpOnly compatibles
 * - NO requiere cambiar imports existentes
 */

const SOCKET_URL = import.meta.env.VITE_API_WS_URL;

export const socket = io(SOCKET_URL, {
  path: "/ws",
  transports: ["websocket"],
  withCredentials: true,

  // ⚠️ auth dinámico: se evalúa en cada conexión / reconexión
  auth: (cb) => {
    const token = localStorage.getItem("mir_accessToken");
    cb({ token });
  },

  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

/**
 * Mantiene el token sincronizado cuando cambia (refresh)
 * No rompe nada aunque nunca se llame
 */
export function syncSocketAuth() {
  if (socket?.connected) {
    socket.auth = {
      token: localStorage.getItem("mir_accessToken"),
    };
    socket.disconnect().connect();
  }
}
