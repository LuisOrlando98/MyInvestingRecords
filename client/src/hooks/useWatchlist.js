// client/src/hooks/useWatchlist.js
import { useState, useEffect, useRef, useCallback } from "react";
import api from "../services/api";
import { socket } from "../lib/socket";

/* =========================================================
   LOGO PRELOAD CACHE
========================================================= */
const logoCache = new Set();
const preloadLogo = (url) => {
  if (!url || logoCache.has(url)) return;

  const img = new Image();
  const markCached = () => logoCache.add(url);

  img.onload = markCached;
  img.onerror = markCached;
  img.src = url;
};

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
   SAFE API (retry 429)
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
     LOAD QUOTES (FAST — NO META / NO SPARK)
  ========================================================= */
  const loadQuotesFast = useCallback(
    async (customSymbols) => {
      const tickers = customSymbols?.length ? customSymbols : symbols;
      if (!tickers.length) return;

      const r = await safeAPI(() =>
        api.post("/api/market/quotes-fast", { tickers })
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
    },
    [symbols]
  );

  /* =========================================================
     LOAD WATCHLIST (META + INITIAL SPARK)
========================================================= */
  const loadWatchlist = useCallback(async () => {
    const r = await safeAPI(() => api.get("/api/watchlist"));
    if (!r) return;

    const syms = r.data.symbols || [];

    setSymbols(syms);
    setMeta(r.data.meta || {});
    setLoading(false);

    // 1️⃣ Quotes rápidos
    await loadQuotesFast(syms);

    // 2️⃣ Spark SOLO una vez (batch pesado)
    if (syms.length) {
      const br = await safeAPI(() =>
        api.post("/api/market/batch", { tickers: syms })
      );
      if (br?.data?.spark) setSpark(br.data.spark);
    }
  }, [loadQuotesFast]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  /* =========================================================
     PRELOAD LOGOS
  ========================================================= */
  useEffect(() => {
    const logosList = Object.values(meta || {})
      .map((m) => m?.logo)
      .filter(Boolean);

    logosList.forEach(preloadLogo);
  }, [meta]);

  /* =========================================================
     WEBSOCKET LIVE PRICES (SUBSCRIPTIONS)
  ========================================================= */
  useEffect(() => {
    if (!symbols.length) return;

    // Subscribe a los símbolos actuales
    socket.emit("subscribe", { symbols });

    const onPrice = (d) => {
      if (!d?.symbol) return;
      setQuotes((prev) => ({
        ...prev,
        [d.symbol]: {
          ...prev[d.symbol],
          price: d.price,
          changePercent: d.changePercent,
          changeAmount: d.changeAmount,
          volume: d.volume,
          marketSession: d.marketSession,
        },
      }));
    };

    socket.on("priceUpdate", onPrice);

    return () => {
      socket.off("priceUpdate", onPrice);
      socket.emit("unsubscribe", { symbols });
    };
  }, [symbols]);

  /* =========================================================
     LIGHT POLLING (VISIBILITY AWARE)
     - solo quotes-fast
     - fallback si socket duerme
  ========================================================= */
  useEffect(() => {
    if (poller.current) {
      clearInterval(poller.current);
      poller.current = null;
    }

    if (!visible || !symbols.length) return;

    poller.current = setInterval(loadQuotesFast, 20000); // fallback suave

    return () => {
      if (poller.current) {
        clearInterval(poller.current);
        poller.current = null;
      }
    };
  }, [visible, symbols, loadQuotesFast]);

  /* =========================================================
     ADD SYMBOL
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
     REORDER (frontend only)
  ========================================================= */
  const reorderSymbols = (list) => {
    setSymbols(list);
  };

  /* =========================================================
     DERIVED LOGOS
  ========================================================= */
  const logos = {};
  for (const s of symbols) {
    logos[s] = meta?.[s]?.logo || null;
  }

  return {
    symbols,
    quotes,
    logos,
    meta,
    spark,
    loading,
    addSymbol,
    removeSymbol,
    reorderSymbols,
    refreshAll: loadQuotesFast,
  };
}
