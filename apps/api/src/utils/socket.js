// src/utils/socket.js
import { Server } from "socket.io";
import axios from "axios";
import Position from "../models/Position.js";
import UserWatchlist from "../models/UserWatchlist.js";

let ioInstance = null;

/* ============================================================
   INIT
============================================================ */
export function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true
    },
    path: "/ws",
  });

  ioInstance.on("connection", (socket) => {
    console.log(`📡 Cliente conectado: ${socket.id}`);

    socket.emit("welcome", {
      message: "✅ Connected to MyInvesting live data stream.",
    });

    socket.on("disconnect", () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`);
    });
  });

  /* ============================================================
     🔵 1. STREAM POSICIONES ABIERTAS (tu sistema actual)
  ============================================================ */
  const fetchYahooPrice = async (symbol) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
      const res = await axios.get(url);
      const result = res.data?.chart?.result?.[0];
      const meta = result?.meta;

      if (!meta) return null;

      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose;
      const changePercent = prevClose
        ? ((price - prevClose) / prevClose) * 100
        : 0;

      return {
        symbol,
        price,
        prevClose,
        changePercent,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.error(`Error fetching ${symbol} price:`, err.message);
      return null;
    }
  };

  setInterval(async () => {
    try {
      const openPositions = await Position.find({ status: "open" }).lean();
      const uniqueSymbols = [...new Set(openPositions.map((p) => p.symbol))];

      for (const sym of uniqueSymbols) {
        const data = await fetchYahooPrice(sym);
        if (data) {
          ioInstance.emit("priceUpdate", data);
        }
      }
    } catch (err) {
      console.error("Error streaming positions:", err.message);
    }
  }, 15000);

  /* ============================================================
     🟢 2. STREAM WATCHLIST (nuevo — Tradier batch)
  ============================================================ */
  const streamWatchlist = async () => {
    try {
      const lists = await UserWatchlist.find();
      const symbols = [...new Set(lists.flatMap((w) => w.symbols))];

      if (!symbols.length) return;

      const res = await axios.get(
        `${process.env.TRADIER_API_URL}/markets/quotes`,
        {
          params: { symbols: symbols.join(",") },
          headers: {
            Authorization: `Bearer ${process.env.TRADIER_API_TOKEN}`,
            Accept: "application/json",
          },
        }
      );

      let raw = res.data?.quotes?.quote || [];
      if (!Array.isArray(raw)) raw = [raw];

      raw.forEach((q) => {
        if (!q?.symbol) return;

        ioInstance.emit("priceUpdate", {
          symbol: q.symbol,
          price: Number(q.last) || null,
          changePercent: Number(q.change_percentage) || 0,
          changeAmount: Number(q.change) || 0,
        });
      });
    } catch (err) {
      console.error("⛔ Watchlist Stream Error:", err.message);
    }
  };

  setInterval(streamWatchlist, 5000);

  /* ============================================================
     RETURN INSTANCE
  ============================================================ */
  return ioInstance;
}

export function getIO() {
  if (!ioInstance) throw new Error("Socket.IO no inicializado");
  return ioInstance;
}
