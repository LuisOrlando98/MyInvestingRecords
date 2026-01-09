import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import api from "../services/api";
import { io } from "socket.io-client";

const QuoteContext = createContext(null);

export function QuoteProvider({ children }) {
  const [quotes, setQuotes] = useState({});
  const symbolsRef = useRef(new Set());

  /* =====================================================
     SOCKET (UNO SOLO)
  ===================================================== */
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(
      `${window.location.protocol}//${window.location.hostname}:4000`,
      {
        path: "/ws",
        transports: ["websocket"],
      }
    );

    socketRef.current.on("priceUpdate", (data) => {
      if (!data?.symbol) return;

      const symbol = data.symbol.toUpperCase();

      setQuotes((prev) => ({
        ...prev,
        [symbol]: {
          ...(prev[symbol] || {}),
          price: Number(data.price ?? 0),
          changePercent: Number(data.changePercent ?? 0),
          timestamp: data.timestamp || Date.now(),
        },
      }));
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  /* =====================================================
     REGISTRAR SÍMBOLOS (DINÁMICO)
  ===================================================== */
  const registerSymbols = useCallback((list = []) => {
    let changed = false;

    list.forEach((s) => {
      const sym = s.toUpperCase();
      if (!symbolsRef.current.has(sym)) {
        symbolsRef.current.add(sym);
        changed = true;
      }
    });

    if (changed && socketRef.current) {
      socketRef.current.emit("subscribe", {
        symbols: Array.from(symbolsRef.current),
      });
    }
  }, []);

  /* =====================================================
     POLLING TRADIER (UNO SOLO)
  ===================================================== */
  useEffect(() => {
    const poll = async () => {
      const symbols = Array.from(symbolsRef.current);
      if (!symbols.length) return;

      try {
        const res = await api.post("/api/market/quotes-fast", {
          tickers: symbols,
        });

        const incoming = res.data?.quotes || {};

        setQuotes((prev) => {
          const next = { ...prev };
          for (const s in incoming) {
            next[s] = {
              ...(prev[s] || {}),
              ...incoming[s],
              timestamp: Date.now(),
            };
          }
          return next;
        });
      } catch (e) {
        console.warn("Quote polling failed");
      }
    };

    const id = setInterval(poll, 15000); // ⏱ 15s global
    poll(); // immediate

    return () => clearInterval(id);
  }, []);

  return (
    <QuoteContext.Provider
      value={{
        quotes,
        registerSymbols,
      }}
    >
      {children}
    </QuoteContext.Provider>
  );
}

/* =====================================================
   HOOK
===================================================== */
export function useQuotes() {
  const ctx = useContext(QuoteContext);
  if (!ctx) {
    throw new Error("useQuotes must be used inside QuoteProvider");
  }
  return ctx;
}
