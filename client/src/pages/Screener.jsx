import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Pencil,
  X,
  GripVertical,
  ArrowDownAZ,
  ArrowUpZA,
} from "lucide-react";
import { io } from "socket.io-client";
import api from "../services/api";

/* ============================================================
   SOCKET SINGLETON (🔥 NO TOCAR — FUNCIONA)
============================================================ */
const SOCKET_URL =
  import.meta.env.VITE_API_WS_URL || "http://localhost:4000";

let screenerSocket = null;
function getScreenerSocket() {
  if (!screenerSocket) {
    screenerSocket = io(SOCKET_URL, {
      path: "/ws",
      transports: ["websocket"],
    });
  }
  return screenerSocket;
}

/* ============================================================
   UTILS
============================================================ */
function heatColor(pct = 0) {
  const v = Math.abs(Number(pct) || 0);

  const intensity =
    v < 0.2 ? 0.06 :
    v < 0.5 ? 0.14 :
    v < 1   ? 0.26 :
    v < 2   ? 0.42 :
    v < 3   ? 0.58 :
    v < 5   ? 0.72 :
              0.85;

  if (pct > 0) return `rgba(34,197,94,${intensity})`;
  if (pct < 0) return `rgba(239,68,68,${intensity})`;
  return "rgba(243,244,246,0.95)";
}

const fmtPct = (v) =>
  Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—";

const fmtPrice = (v) =>
  Number.isFinite(v) ? `$${v.toFixed(2)}` : "—";

/* ============================================================
   FAST MARKET (REALTIME — NO ROMPER)
============================================================ */
function useFastMarket(symbols, enabled) {
  const [market, setMarket] = useState({});
  const symbolsKey = useMemo(() => symbols.join("|"), [symbols]);

  useEffect(() => {
    if (!enabled || !symbols.length) return;

    const socket = getScreenerSocket();
    socket.emit("subscribe", { symbols });

    const onPrice = (p) => {
      if (!p?.symbol || !symbols.includes(p.symbol)) return;

      setMarket((prev) => ({
        ...prev,
        [p.symbol]: {
          ...(prev[p.symbol] || {}),
          regular: { price: p.price, pct: p.changePercent },
        },
      }));
    };

    socket.on("priceUpdate", onPrice);

    (async () => {
      const r = await api.post("/api/market/quotes-batch", {
        tickers: symbols,
      });

      const next = {};
      symbols.forEach((s) => {
        const q = r.data.quotes?.[s];
        if (!q) return;
        next[s] = {
          regular: { price: q.price, pct: q.changePercent },
        };
      });

      setMarket(next);
    })();

    return () => {
      socket.off("priceUpdate", onPrice);
      socket.emit("unsubscribe", { symbols });
    };
  }, [enabled, symbolsKey]);

  return market;
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

  const ORDER_KEY = `mir_watchlist_order_${userId}`;
  const GRID_KEY  = `mir_screener_cols_${userId}`;

  const [symbols, setSymbols] = useState([]);
  const [watchlistLoaded, setWatchlistLoaded] = useState(false);

  const [mode, setMode] = useState("view");
  const [input, setInput] = useState("");
  const [alert, setAlert] = useState(null);
  const [sortDir, setSortDir] = useState("ASC");

  const [cols, setCols] = useState(
    () => Number(localStorage.getItem(GRID_KEY)) || 6
  );

  const dragFrom = useRef(null);
  const dragOver = useRef(null);

  /* ---------- LOAD WATCHLIST ---------- */
  useEffect(() => {
    (async () => {
      const r = await api.get("/api/watchlist");
      const server = (r.data.symbols || []).map((s) => s.toUpperCase());

      const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
      const ordered = [
        ...saved.filter((s) => server.includes(s)),
        ...server.filter((s) => !saved.includes(s)),
      ];

      setSymbols(ordered);
      setWatchlistLoaded(true);
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(symbols));
  }, [symbols]);

  useEffect(() => {
    localStorage.setItem(GRID_KEY, cols);
  }, [cols]);

  const market = useFastMarket(symbols, watchlistLoaded);

  /* ---------- ALERT ---------- */
  const showAlert = (msg) => {
    setAlert(msg);
    setTimeout(() => setAlert(null), 3000);
  };

  /* ---------- ADD / REMOVE ---------- */
  const addSymbol = async () => {
    const sym = input.trim().toUpperCase();
    if (!sym) return;

    if (symbols.includes(sym)) {
      showAlert(`"${sym}" already exists`);
      return;
    }

    try {
      const r = await api.post("/api/market/quotes-batch", { tickers: [sym] });
      if (!r.data.quotes?.[sym]) {
        showAlert(`"${sym}" is not a valid symbol`);
        return;
      }

      await api.post("/api/watchlist/add", { symbol: sym });
      setSymbols((p) => [sym, ...p]);
      setInput("");
      setMode("view");
    } catch {
      showAlert("Validation failed");
    }
  };

  const removeSymbol = async (sym) => {
    await api.post("/api/watchlist/remove", { symbol: sym });
    setSymbols((p) => p.filter((s) => s !== sym));
  };

  const toggleSort = () => {
    setSortDir((d) => {
      const next = d === "ASC" ? "DESC" : "ASC";
      setSymbols((p) =>
        [...p].sort((a, b) =>
          next === "ASC" ? a.localeCompare(b) : b.localeCompare(a)
        )
      );
      return next;
    });
  };

  const onDrop = (to) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    dragOver.current = null;
    if (from == null || from === to) return;

    setSymbols((arr) => {
      const copy = [...arr];
      const [m] = copy.splice(from, 1);
      copy.splice(to, 0, m);
      return copy;
    });
  };

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div className="relative h-full p-3">

      {/* ALERT */}
      {alert && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl
                        bg-gray-900 text-white shadow-lg text-sm">
          {alert}
        </div>
      )}

      {/* DENSITY SLIDER (EDIT MODE) */}
      {mode === "edit" && (
        <div className="mb-3 px-4 py-3 rounded-xl border bg-white/80 backdrop-blur shadow-sm">
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-gray-600">
              Density
            </span>

            <input
              type="range"
              min={3}
              max={24}
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
              className="flex-1 accent-gray-900 cursor-pointer"
            />

            <span className="text-xs font-semibold text-gray-800 w-20 text-right">
              {cols} cols
            </span>
          </div>
        </div>
      )}

      {/* ACTION BAR */}
      <div className="fixed bottom-5 right-5 z-50">
        <div className="flex items-center gap-1 px-2 py-2 rounded-2xl
                        bg-white/90 backdrop-blur border shadow-xl">

          <button
            onClick={() => setMode(mode === "add" ? "view" : "add")}
            className={`w-10 h-10 rounded-xl flex items-center justify-center
              ${mode === "add" ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
          >
            <Plus size={18} />
          </button>

          <button
            onClick={() => setMode(mode === "edit" ? "view" : "edit")}
            className={`w-10 h-10 rounded-xl flex items-center justify-center
              ${mode === "edit" ? "bg-gray-900 text-white" : "hover:bg-gray-100"}`}
          >
            <Pencil size={16} />
          </button>

          <button
            onClick={toggleSort}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-100"
          >
            {sortDir === "ASC" ? <ArrowDownAZ size={16} /> : <ArrowUpZA size={16} />}
          </button>

          {mode === "add" && (
            <div className="flex items-center gap-2 pl-2 border-l">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSymbol()}
                className="text-sm px-2 py-1 border rounded-md w-28"
                placeholder="Ticker"
              />
              <button
                onClick={addSymbol}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded-full"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* GRID */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {symbols.map((sym, i) => {
          const d = market[sym];
          const pct = d?.regular?.pct;
          const price = d?.regular?.price;

          return (
            <div
              key={sym}
              draggable={mode === "edit"}
              onDragStart={() => (dragFrom.current = i)}
              onDragOver={(e) => {
                if (mode === "edit") {
                  e.preventDefault();
                  dragOver.current = i;
                }
              }}
              onDrop={() => mode === "edit" && onDrop(i)}
              onClick={() => mode !== "edit" && navigate(`/ticker/${sym}`)}
              className={`relative h-[72px] rounded-xl text-center cursor-pointer
                ${dragOver.current === i ? "border-2 border-dashed border-blue-500" : "border"}`}
              style={{ backgroundColor: heatColor(pct) }}
            >
              {mode === "edit" && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSymbol(sym);
                    }}
                    className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full
                               flex items-center justify-center shadow
                               hover:bg-red-50 hover:text-red-600 transition"
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>

                  <div className="absolute bottom-1 right-2 opacity-60">
                    <GripVertical size={12} />
                  </div>
                </>
              )}

              <div className="mt-2 text-[11px] font-semibold">{sym}</div>
              <div className="text-sm font-bold">{fmtPrice(price)}</div>
              <div className="text-[11px] font-semibold">{fmtPct(pct)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
