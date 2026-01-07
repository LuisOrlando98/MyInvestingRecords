import { useState, useEffect, useRef, useCallback } from "react";
import api from "../services/api";
import { socket } from "../lib/socket";

/* =========================================================
   CONSTANTES
========================================================= */
const ORDER_KEY = "mir_watchlist_order";

/* =========================================================
   LOGO PRELOAD CACHE
========================================================= */
const logoCache = new Set();
const preloadLogo = (url) => {
  if (!url || logoCache.has(url)) return;
  const img = new Image();
  img.onload = img.onerror = () => logoCache.add(url);
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
  const [loading, setLoading] = useState(true);

  const visible = usePageVisible();
  const poller = useRef(null);

  /* =========================================================
     LOAD WATCHLIST (ORDER SAFE)
  ========================================================= */
  const loadWatchlist = useCallback(async () => {
    const r = await safeAPI(() => api.get("/api/watchlist"));
    if (!r) return;

    const serverSymbols = (r.data.symbols || []).map((s) =>
      s.toUpperCase()
    );

    const savedOrder = JSON.parse(
      localStorage.getItem(ORDER_KEY) || "[]"
    );

    const ordered =
      savedOrder.length > 0
        ? [
            ...savedOrder.filter((s) => serverSymbols.includes(s)),
            ...serverSymbols.filter((s) => !savedOrder.includes(s)),
          ]
        : serverSymbols;

    localStorage.setItem(ORDER_KEY, JSON.stringify(ordered));

    setSymbols(ordered);
    setMeta(r.data.meta || {});
    setLoading(false);

    // initial fast quotes
    await loadQuotesFast(ordered);
  }, []);

  /* =========================================================
     FAST QUOTES (NO REORDER)
  ========================================================= */
  const loadQuotesFast = useCallback(
    async (customSymbols) => {
      const tickers = customSymbols || symbols;
      if (!tickers.length) return;

      const r = await safeAPI(() =>
        api.post("/api/market/quotes-fast", { tickers })
      );
      if (!r) return;

      setQuotes((prev) => {
        const next = { ...prev };
        for (const s of Object.keys(r.data.quotes || {})) {
          next[s] = {
            ...prev[s],
            ...r.data.quotes[s],
          };
        }
        return next;
      });
    },
    [symbols]
  );

  /* =========================================================
     INIT LOAD
  ========================================================= */
  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  /* =========================================================
     PRELOAD LOGOS
  ========================================================= */
  useEffect(() => {
    Object.values(meta)
      .map((m) => m?.logo)
      .filter(Boolean)
      .forEach(preloadLogo);
  }, [meta]);

  /* =========================================================
     SOCKET LIVE PRICES
  ========================================================= */
  useEffect(() => {
    if (!symbols.length) return;

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
  ========================================================= */
  useEffect(() => {
    if (poller.current) {
      clearInterval(poller.current);
      poller.current = null;
    }

    if (!visible || !symbols.length) return;

    poller.current = setInterval(() => {
      loadQuotesFast();
    }, 20000);

    return () => {
      if (poller.current) clearInterval(poller.current);
      poller.current = null;
    };
  }, [visible, symbols, loadQuotesFast]);

  /* =========================================================
     ADD SYMBOL
  ========================================================= */
  const addSymbol = async (sym) => {
    sym = sym.toUpperCase().trim();
    if (!sym) return { success: false };

    if (symbols.includes(sym)) {
      return { success: false, error: "Duplicate" };
    }

    try {
      const r = await api.post("/api/watchlist/add", { symbol: sym });

      const next = [sym, ...symbols];
      setSymbols(next);
      setMeta(r.data.watchlist.meta || meta);

      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
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
    await safeAPI(() =>
      api.post("/api/watchlist/remove", { symbol: sym })
    );

    const next = symbols.filter((s) => s !== sym);
    setSymbols(next);
    localStorage.setItem(ORDER_KEY, JSON.stringify(next));
  };

  /* =========================================================
     REORDER (PERSISTED)
  ========================================================= */
  const reorderSymbols = (list) => {
    setSymbols((prev) => {
      if (
        prev.length === list.length &&
        prev.every((s, i) => s === list[i])
      ) {
        return prev; // no-op
      }
      localStorage.setItem(ORDER_KEY, JSON.stringify(list));
      return list;
    });
  };

  return {
    symbols,
    quotes,
    meta,
    loading,
    addSymbol,
    removeSymbol,
    reorderSymbols,
    refreshAll: loadQuotesFast,
  };
}
