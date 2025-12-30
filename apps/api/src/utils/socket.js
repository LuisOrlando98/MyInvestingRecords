// api/src/utils/socket.js
import { Server } from "socket.io";
import { marketEngine } from "../services/marketEngine.js";

let ioInstance = null;

// Helpers
const symRoom = (sym) => `sym:${String(sym).toUpperCase().trim()}`;

// In-memory subscriptions
const socketToSyms = new Map(); // socket.id -> Set(symbols)
const allSubscribedSyms = new Set();

function recalcUnion() {
  allSubscribedSyms.clear();
  for (const set of socketToSyms.values()) {
    for (const s of set) allSubscribedSyms.add(s);
  }
}

function addSubs(socket, symbols = []) {
  const set = socketToSyms.get(socket.id) || new Set();
  symbols.forEach((s) => {
    const sym = String(s).toUpperCase().trim();
    if (!sym) return;
    set.add(sym);
    socket.join(symRoom(sym));
  });
  socketToSyms.set(socket.id, set);
  recalcUnion();
}

function removeSubs(socket, symbols = []) {
  const set = socketToSyms.get(socket.id) || new Set();
  symbols.forEach((s) => {
    const sym = String(s).toUpperCase().trim();
    if (!sym) return;
    set.delete(sym);
    socket.leave(symRoom(sym));
  });
  socketToSyms.set(socket.id, set);
  recalcUnion();
}

export function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/ws",
  });

  ioInstance.on("connection", (socket) => {
    console.log(`📡 Socket connected: ${socket.id}`);

    socket.emit("welcome", {
      message: "✅ Connected to MyInvesting live market stream",
    });

    socket.on("subscribe", ({ symbols = [] } = {}) => {
      addSubs(socket, symbols);
      socket.emit("subscribed", {
        symbols: Array.from(socketToSyms.get(socket.id) || []),
      });
    });

    socket.on("unsubscribe", ({ symbols = [] } = {}) => {
      removeSubs(socket, symbols);
      socket.emit("subscribed", {
        symbols: Array.from(socketToSyms.get(socket.id) || []),
      });
    });

    socket.on("disconnect", () => {
      socketToSyms.delete(socket.id);
      recalcUnion();
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  /* ============================================================
     🔥 CENTRAL MARKET LOOP (socket-first)
     - One loop
     - marketEngine cache + TTL
     - Emits ONLY to subscribed rooms
  ============================================================ */
  const STREAM_MS = 2000;

  setInterval(async () => {
    try {
      if (!allSubscribedSyms.size) return;

      const symbols = Array.from(allSubscribedSyms);
      const { quotes, marketSession } =
        await marketEngine.getQuotes(symbols);

      for (const [sym, q] of Object.entries(quotes || {})) {
        ioInstance.to(symRoom(sym)).emit("priceUpdate", {
          symbol: sym,
          price: q.price,
          changePercent: q.changePercent,
          changeAmount: q.changeAmount,
          volume: q.volume,
          marketSession,
        });
      }
    } catch (err) {
      console.error("⛔ Socket market loop error:", err.message);
    }
  }, STREAM_MS);

  return ioInstance;
}

export function getIO() {
  if (!ioInstance) throw new Error("Socket.IO not initialized");
  return ioInstance;
}
