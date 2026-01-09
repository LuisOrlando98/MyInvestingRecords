// client/src/lib/socket.js
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_WS_URL;

/**
 * Socket singleton GLOBAL
 *
 * - 1 sola conexión real
 * - Token SIEMPRE actualizado
 * - Compatible con AuthContext (syncSocketAuth)
 * - Compatible con Positions (getSocket)
 * - Seguro con React StrictMode
 */

let socket = null;

/**
 * Obtiene el socket (lazy singleton)
 * NUNCA crear socket en render, solo vía esta función
 */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: "/ws",
      transports: ["websocket"],
      withCredentials: true,

      // 🔐 auth dinámico (se evalúa en cada connect / reconnect)
      auth: (cb) => {
        const token = localStorage.getItem("mir_accessToken");
        cb({ token });
      },

      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // 🔍 DEBUG (opcional, puedes borrar luego)
    socket.on("connect", () => {
      console.log("📡 Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("🔌 Socket disconnected:", reason);
    });
  }

  return socket;
}

/**
 * Fuerza actualización del token en el socket
 * Usado cuando:
 * - login
 * - refresh token
 */
export function updateSocketAuth() {
  if (!socket) return;

  socket.auth = {
    token: localStorage.getItem("mir_accessToken"),
  };

  // 🔁 reconectar con token nuevo
  socket.disconnect();
  socket.connect();
}

/**
 * 🔁 Backward compatibility
 * AuthContext espera esta función
 * (NO romper contratos existentes)
 */
export function syncSocketAuth() {
  updateSocketAuth();
}
