// src/hooks/useWatchlist.js
import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import api from "../services/api";

/* =========================================================
   SOCKET SINGLETON
========================================================= */
let socket = null;
function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_WS_URL || "http://localhost:4000", {
      path: "/ws",
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

/* =========================================================
   PAGE VISIBILITY
========================================================= */
const usePageVisible = () => {
  const [visible, setVisible] = useState(!document.hidden);

  useEffect(() => {
    const handler = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return visible;
};

/* =========================================================
   SAFE API
========================================================= */
const safeAPI = async (fn) => {
  let attempts = 0;
  let delay = 600;

  while (attempts < 3) {
    try {
      return await fn();
    } catch (err) {
      if (err.response?.status === 429) {
        attempts++;
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  return null;
};

/* =========================================================
   MAIN HOOK
========================================================= */
export default function useWatchlist() {
  const [symbols, setSymbols] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [meta, setMeta] = useState({});
  const [spark, setSpark] = useState({});
  const [loading, setLoading] = useState(true);

  const visible = usePageVisible();
  const poller = useRef(null);

  /* =========================================================
     LOAD WATCHLIST (🔥 LOGOS VIENEN AQUÍ)
  ========================================================= */
  const loadWatchlist = useCallback(async () => {
    const r = await safeAPI(() => api.get("/api/watchlist"));
    if (!r) return;

    setSymbols(r.data.symbols || []);
    setMeta(r.data.meta || {});
    setLoading(false);
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  /* =========================================================
     LOAD QUOTES + SPARK
  ========================================================= */
const loadQuotes = useCallback(async () => {
  if (!symbols.length || loading) return;

  const r = await safeAPI(() =>
    api.post("/api/market/batch", { tickers: symbols })
  );
  if (!r) return;

  setQuotes((prev) => {
    const out = {};
    for (const s of Object.keys(r.data.quotes || {})) {
      out[s] = {
        prevPrice: prev[s]?.price ?? null,
        ...r.data.quotes[s],
      };
    }
    return out;
  });

  setSpark(r.data.spark || {});
}, [symbols, loading]);

  /* =========================================================
     WEBSOCKET LIVE PRICES
  ========================================================= */
  useEffect(() => {
    const s = getSocket();

    s.on("priceUpdate", (d) => {
      if (!d.symbol) return;
      setQuotes((prev) => ({
        ...prev,
        [d.symbol]: {
          ...prev[d.symbol],
          price: d.price,
          changePercent: d.changePercent,
          changeAmount: d.changeAmount,
        },
      }));
    });

    return () => s.off("priceUpdate");
  }, []);

  /* =========================================================
     SMART POLLING
  ========================================================= */
  useEffect(() => {
    if (!visible || !symbols.length || loading) return;

    if (!poller.current) {
      poller.current = setInterval(loadQuotes, 15000);
    }

    return () => {
      clearInterval(poller.current);
      poller.current = null;
    };
  }, [visible, symbols, loading, loadQuotes]);

  /* =========================================================
     ADD SYMBOL (🔥 backend guarda logo)
  ========================================================= */
  const addSymbol = async (sym) => {
    sym = sym.toUpperCase().trim();
    if (!sym) return { success: false };

    try {
      const r = await api.post("/api/watchlist/add", { symbol: sym });
      setSymbols(r.data.watchlist.symbols);
      setMeta(r.data.watchlist.meta);
      return { success: true };
    } catch (err) {
      if (err.response?.status === 400) {
        return { success: false, error: "NotFound" };
      }
      return { success: false };
    }
  };

  /* =========================================================
     REMOVE SYMBOL
  ========================================================= */
  const removeSymbol = async (sym) => {
    const r = await safeAPI(() =>
      api.post("/api/watchlist/remove", { symbol: sym })
    );
    if (!r) return;

    setSymbols(r.data.watchlist.symbols);
    setMeta(r.data.watchlist.meta);
  };

  /* =========================================================
     REORDER (frontend only, opcional persistir luego)
  ========================================================= */
  const reorderSymbols = (list) => {
    setSymbols(list);
  };

  /* =========================================================
     DERIVED LOGOS (💎 CLAVE)
  ========================================================= */
  const logos = {};
  for (const s of symbols) {
    logos[s] = meta?.[s]?.logo || null;
  }

  return {
    symbols,
    quotes,
    logos, // 👈 ahora VIENE DE META
    meta,
    spark,
    loading,
    addSymbol,
    removeSymbol,
    reorderSymbols,
    refreshAll: loadQuotes,
  };
}
