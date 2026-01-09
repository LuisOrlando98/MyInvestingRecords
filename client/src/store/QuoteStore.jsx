// client/src/store/QuoteStore.jsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { getSocket } from "../lib/socket";
import { fetchOptionQuotesByLegs } from "../services/tradierService";
import { generateOccSymbol } from "../utils/occSymbol";

/* =========================================================
   CONTEXT
========================================================= */
const QuoteContext = createContext(null);

/* =========================================================
   HELPERS
========================================================= */

// ✅ OCC BUILDER — SINGLE SOURCE OF TRUTH
export function buildOccSymbol(leg, baseSymbol = "") {
  try {
    const underlying = String(
      baseSymbol || leg.symbol || leg.underlying || ""
    )
      .toUpperCase()
      .trim();

    if (!underlying) return null;

    const occ = generateOccSymbol(
      underlying,
      leg.expiration,
      leg.strike,
      leg.optionType
    );
    return occ && occ.length >= 15 ? occ : null;
  } catch {
    return null;
  }
}

const isValidOcc = (s) =>
  /^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(String(s || "").trim());

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/* =========================================================
   PROVIDER
========================================================= */
export function QuoteProvider({ children }) {
  // ================= STOCK QUOTES (socket) =================
  const [quotes, setQuotes] = useState({});
  const subscribedRef = useRef(new Set());
  const socketRef = useRef(null);

  // ================= OPTION QUOTES =========================
  const [optionQuotes, setOptionQuotes] = useState({});
  const trackedOccRef = useRef(new Set());
  const optionCacheRef = useRef({});
  const pollingRef = useRef(false);
  const pollOnceRef = useRef(null);
  const pollNowTimerRef = useRef(null);

  /* =========================================================
     SOCKET INIT (ONCE)
  ========================================================= */
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onPriceUpdate = (d) => {
      if (!d?.symbol) return;
      const sym = d.symbol.toUpperCase();

      setQuotes((prev) => ({
        ...prev,
        [sym]: {
          ...prev[sym],
          price: d.price,
          changePercent: d.changePercent,
          changeAmount: d.changeAmount,
          updatedAt: Date.now(),
        },
      }));
    };

    socket.on("priceUpdate", onPriceUpdate);
    return () => socket.off("priceUpdate", onPriceUpdate);
  }, []);

  /* =========================================================
     STOCK SUBSCRIBE
  ========================================================= */
  const subscribe = useCallback((symbols = []) => {
    if (!socketRef.current) return;
    const next = [];

    symbols.forEach((s) => {
      const sym = String(s).toUpperCase().trim();
      if (!subscribedRef.current.has(sym)) {
        subscribedRef.current.add(sym);
        next.push(sym);
      }
    });

    if (next.length) socketRef.current.emit("subscribe", { symbols: next });
  }, []);

  const unsubscribe = useCallback((symbols = []) => {
    if (!socketRef.current) return;
    const next = [];

    symbols.forEach((s) => {
      const sym = String(s).toUpperCase().trim();
      if (subscribedRef.current.has(sym)) {
        subscribedRef.current.delete(sym);
        next.push(sym);
      }
    });

    if (next.length) socketRef.current.emit("unsubscribe", { symbols: next });
  }, []);

  /* =========================================================
     OPTION TRACKING
  ========================================================= */
  const requestPollNow = useCallback(() => {
    clearTimeout(pollNowTimerRef.current);
    pollNowTimerRef.current = setTimeout(() => {
      pollOnceRef.current?.();
    }, 50);
  }, []);

  const trackOptionLegs = useCallback(
    (positions = []) => {
      let added = 0;

      positions.forEach((p) => {
        if (p.status !== "Open") return;

        p.legs?.forEach((leg) => {
          const occ = isValidOcc(leg.occSymbol)
            ? leg.occSymbol
            : buildOccSymbol(leg, p.symbol);

          if (occ && !trackedOccRef.current.has(occ)) {
            trackedOccRef.current.add(occ);
            added++;
          }
        });
      });

      if (added > 0) requestPollNow();
      return added;
    },
    [requestPollNow]
  );

  /* =========================================================
     OPTION POLLING
  ========================================================= */
  useEffect(() => {
    let alive = true;

    async function pollOptions() {
      const occList = Array.from(trackedOccRef.current);
      if (!occList.length || pollingRef.current) return;

      pollingRef.current = true;

      try {
        const chunks = chunk(occList, 50);
        const merged = {};

        for (const batch of chunks) {
          const fakeLegs = batch.map((occ) => ({ occSymbol: occ }));
          const res = await fetchOptionQuotesByLegs(fakeLegs);
          if (res) Object.assign(merged, res);
        }

        optionCacheRef.current = { ...optionCacheRef.current, ...merged };
        if (alive) setOptionQuotes({ ...optionCacheRef.current });
      } catch (e) {
        console.error("❌ Option polling error:", e);
      } finally {
        pollingRef.current = false;
      }
    }

    pollOnceRef.current = pollOptions;
    pollOptions();

    const id = setInterval(pollOptions, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  /* =========================================================
     CONTEXT VALUE
  ========================================================= */
  const value = useMemo(
    () => ({
      quotes,
      subscribe,
      unsubscribe,
      optionQuotes,
      trackOptionLegs,
    }),
    [quotes, optionQuotes, subscribe, unsubscribe, trackOptionLegs]
  );

  return (
    <QuoteContext.Provider value={value}>
      {children}
    </QuoteContext.Provider>
  );
}

/* =========================================================
   HOOK
========================================================= */
export function useQuotes() {
  const ctx = useContext(QuoteContext);
  if (!ctx) throw new Error("useQuotes must be used inside <QuoteProvider>");
  return ctx;
}
