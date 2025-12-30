// client/src/lib/socket.js
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_API_WS_URL || "http://localhost:4000";

export const socket = io(SOCKET_URL, {
  path: "/ws",
  transports: ["websocket"],
  withCredentials: true,
  auth: {
    token: localStorage.getItem("mir_accessToken"),
  },
});
