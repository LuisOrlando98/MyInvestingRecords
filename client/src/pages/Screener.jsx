import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, X, GripVertical } from "lucide-react";
import { io } from "socket.io-client";
import api from "../services/api";

/* ============================================================
   UTILS
============================================================ */
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function heatColor(pct = 0) {
  const abs = clamp(Math.abs(Number(pct) || 0), 0, 10);
  const alpha = 0.08 + (abs / 10) * 0.55;
  if (pct > 0) return `rgba(34,197,94,${alpha})`;
  if (pct < 0) return `rgba(239,68,68,${alpha})`;
  return "rgba(229,231,235,0.55)";
}

const fmtPct = (v) =>
  Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—";
const fmtPrice = (v) =>
  Number.isFinite(v) ? `$${v.toFixed(2)}` : "—";

function isExtSession(session) {
  return session === "PRE" || session === "AFTER";
}

/* ============================================================
   FAST MARKET HOOK (quotes-batch + socket)
============================================================ */
function useFastMarket(symbols, enabled) {
  const [market, setMarket] = useState({});
  const [booting, setBooting] = useState(true);

  const socketRef = useRef(null);
  const fetchedOnceRef = useRef(false);

  const symbolsKey = useMemo(() => symbols.join("|"), [symbols]);

  useEffect(() => {
    if (!enabled) return;

    let alive = true;
    fetchedOnceRef.current = false;
    setBooting(true);

    // 1) connect socket (light)
    socketRef.current = io(
      import.meta.env.VITE_API_WS_URL || "http://localhost:4000",
      { path: "/ws" }
    );

    // If your backend emits priceUpdate, we patch quickly:
    socketRef.current.on("priceUpdate", (p) => {
      setMarket((prev) => {
        // only update if it exists in current list
        if (!symbols.includes(p.symbol)) return prev;

        const existing = prev[p.symbol] || {};
        return {
          ...prev,
          [p.symbol]: {
            ...existing,
            regular: { price: p.price, pct: p.changePercent },
            // keep session if we have it (from batch)
            session: existing.session || "REGULAR",
          },
        };
      });
    });

    // 2) initial fast fetch (quotes-batch)
    const fetchFast = async () => {
      try {
        if (!symbols.length) {
          if (alive) setBooting(false);
          return;
        }

        const r = await api.post("/api/market/quotes-batch", {
          tickers: symbols,
        });

        if (!alive) return;

        const next = {};
        symbols.forEach((s) => {
          const q = r.data.quotes?.[s];
          if (!q) return;

          next[s] = {
            regular: { price: q.price, pct: q.changePercent },
            ext: { price: q.extendedPrice, pct: q.extendedChangePercent },
            session: q.marketSession || r.data.marketSession || "REGULAR",
          };
        });

        setMarket((prev) => ({ ...prev, ...next }));
        fetchedOnceRef.current = true;

        // booting termina cuando ya tenemos al menos 1 quote válido
        const hasAny = Object.values(next).some(
          (v) => Number.isFinite(v?.regular?.price)
        );
        if (hasAny || symbols.length === 0) setBooting(false);
        else setBooting(false); // evita stuck si backend no devuelve nada
      } catch (err) {
        console.error("Fast quotes-batch error:", err.message);
        if (alive) setBooting(false);
      }
    };

    fetchFast();

    return () => {
      alive = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [enabled, symbolsKey]); // ✅ estable, no se queda colgado

  return { market, booting, setMarket };
}

/* ============================================================
   SCREENER
============================================================ */
export default function Screener() {
  const navigate = useNavigate();

  const userId = useMemo(
    () => JSON.parse(localStorage.getItem("mir_user"))?._id || "anon",
    []
  );

  const ORDER_KEY = useMemo(() => `mir_watchlist_order_${userId}`, [userId]);

  const [symbols, setSymbols] = useState([]);
  const [watchlistLoaded, setWatchlistLoaded] = useState(false);

  const [mode, setMode] = useState("view"); // view | add | edit
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const dragFrom = useRef(null);

  /* ---------- load watchlist + apply saved order ---------- */
  useEffect(() => {
    let alive = true;
    setWatchlistLoaded(false);

    (async () => {
      try {
        const r = await api.get("/api/watchlist");
        if (!alive) return;

        const serverSymbols = (r.data.symbols || [])
          .map((s) => String(s).toUpperCase());

        // apply saved local order
        const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
        const savedFiltered = saved.filter((s) => serverSymbols.includes(s));
        const remaining = serverSymbols.filter((s) => !savedFiltered.includes(s));
        setSymbols([...savedFiltered, ...remaining]);
      } finally {
        if (alive) setWatchlistLoaded(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [ORDER_KEY]);

  // persist local order
  useEffect(() => {
    if (!symbols.length) return;
    localStorage.setItem(ORDER_KEY, JSON.stringify(symbols));
  }, [symbols, ORDER_KEY]);

  const { market, booting } = useFastMarket(symbols, watchlistLoaded);

  /* ---------- add (validated + fast) ---------- */
  const addSymbol = async () => {
    const sym = input.trim().toUpperCase();
    if (!sym) return;

    if (symbols.includes(sym)) {
      setError(`"${sym}" already exists`);
      return;
    }

    try {
      // ✅ validate via fast route
      const r = await api.post("/api/market/quotes-batch", { tickers: [sym] });
      const q = r.data.quotes?.[sym];

      if (!q || !Number.isFinite(q.price)) {
        setError(`"${sym}" is not a valid market symbol`);
        return;
      }

      await api.post("/api/watchlist/add", { symbol: sym });

      setSymbols((prev) => [sym, ...prev]);
      setInput("");
      setMode("view");
      setError("");
    } catch {
      setError("Validation failed. Try again.");
    }
  };

  const removeSymbol = async (sym) => {
    await api.post("/api/watchlist/remove", { symbol: sym });
    setSymbols((prev) => prev.filter((s) => s !== sym));
  };

  /* ---------- drag ---------- */
  const onDrop = (to) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from == null || from === to) return;

    setSymbols((arr) => {
      const copy = [...arr];
      const [m] = copy.splice(from, 1);
      copy.splice(to, 0, m);
      return copy;
    });
  };

  return (
    <div className="relative h-full p-3">

      {/* ================= ACTION BAR ================= */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {/* Error anchored above icons */}
        {error && (
          <div className="max-w-[320px] px-4 py-2 text-sm rounded-xl bg-red-600 text-white shadow">
            {error}
          </div>
        )}

        {/* Icon bar (clean + consistent) */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-full shadow-lg px-1 py-1">
          <button
            onClick={() => {
              setMode(mode === "add" ? "view" : "add");
              setError("");
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition
              ${mode === "add" ? "bg-blue-600 text-white" : "text-blue-600 hover:bg-blue-50"}`}
            title="Add symbol"
          >
            <Plus size={18} />
          </button>

          <button
            onClick={() => {
              setMode(mode === "edit" ? "view" : "edit");
              setError("");
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition border-l
              ${mode === "edit" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}
            title="Edit / reorder"
          >
            <Pencil size={16} />
          </button>

          {mode === "add" && (
            <div className="flex items-center gap-2 pr-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSymbol()}
                placeholder="Ticker"
                className="ml-2 text-sm px-2 py-1 border rounded-md w-28 focus:outline-none"
                autoFocus
              />
              <button
                onClick={addSymbol}
                className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= LOADING (only until first values) ================= */}
      {!watchlistLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-40">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Loading watchlist…
          </div>
        </div>
      )}

      {watchlistLoaded && booting && symbols.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-30 pointer-events-none">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Loading screener…
          </div>
        </div>
      )}

      {/* ================= GRID (renders instantly) ================= */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {symbols.map((sym, i) => {
          const d = market[sym];

          // skeleton tile (instant UI)
          if (!d) {
            return (
              <div
                key={sym}
                className="h-[72px] rounded-xl bg-gray-100 animate-pulse border border-gray-200"
                title={sym}
              />
            );
          }

          const ext = isExtSession(d.session);
          const pct = ext ? d.ext?.pct : d.regular?.pct;
          const price = ext ? d.ext?.price : d.regular?.price;

          return (
            <div
              key={sym}
              draggable={mode === "edit"}
              onDragStart={() => (dragFrom.current = i)}
              onDragOver={(e) => mode === "edit" && e.preventDefault()}
              onDrop={() => mode === "edit" && onDrop(i)}
              onClick={() => mode !== "edit" && navigate(`/ticker/${sym}`)}
              className={`relative h-[72px] rounded-xl border border-gray-200 text-center cursor-pointer select-none transition
                ${mode === "edit" ? "ring-2 ring-gray-900/10 hover:ring-gray-900/25" : "hover:scale-[1.02]"}`}
              style={{ backgroundColor: heatColor(pct) }}
              title={mode === "edit" ? "Drag to reorder" : "Open details"}
            >
              {mode === "edit" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSymbol(sym);
                  }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white border flex items-center justify-center"
                  title="Remove"
                >
                  <X size={12} />
                </button>
              )}

              {mode === "edit" && (
                <div className="absolute bottom-1 right-2 opacity-60">
                  <GripVertical size={12} />
                </div>
              )}

              <div className="mt-2 text-[11px] font-semibold">{sym}</div>
              <div className="text-sm font-bold">{fmtPrice(price)}</div>
              <div className="text-[11px] font-semibold">{fmtPct(pct)}</div>

              {/* show only if PRE/AFTER */}
              {ext && (
                <div className="absolute bottom-1 left-1 right-1 text-[10px] text-gray-700">
                  {d.session === "AFTER" ? "After Hours" : "Pre Market"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
