import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";
import { motion } from "framer-motion";

axios.defaults.baseURL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/* ============================================================
   📊 PERFORMANCE — Webull-style Analytics + Interactive Calendar
   ✅ FIX: NO toISOString() (UTC bug). Uses local dateKey safely.
============================================================ */

// --- Local DateKey helper (NO UTC) ---
const dateKeyLocal = (dateLike) => {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // YYYY-MM-DD in LOCAL time
};

const fmtMoney = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

const fmtCompact = (n) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(n || 0));

export default function Performance() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [symbol, setSymbol] = useState("");
  const [debouncedSymbol, setDebouncedSymbol] = useState("");
  const [result, setResult] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Calendar
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null);

  // cancel in-flight requests (performance)
  const abortRef = useRef(null);

  /* ================= LOAD ================= */
  const load = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const { data } = await axios.get("/api/performance", {
        params: {
          symbol: debouncedSymbol || undefined,
          from: from || undefined,
          to: to || undefined,
        },
        signal: controller.signal,
      });

      let tableRows = Array.isArray(data?.rows) ? data.rows : [];

      // ✅ normalize each row with a stable day key (NO UTC)
      tableRows = tableRows
        .map((r) => ({
          ...r,
          // prefer backend-provided dateKey if exists, else compute safely
          dateKey: r.dateKey || (r.date ? dateKeyLocal(r.date) : null),
        }))
        .filter((r) => r.dateKey);

      // result filter
      if (result !== "ALL") {
        tableRows = tableRows.filter((r) => r.result === result);
      }

      setRows(tableRows);
      setSummary(data?.summary || null);
    } catch (e) {
      // ignore aborts
      if (e?.name !== "CanceledError" && e?.code !== "ERR_CANCELED") {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSymbol, from, to, result]);

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  /* ================= DEBOUNCE SYMBOL ================= */
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSymbol(symbol.trim());
    }, 250);
    return () => clearTimeout(t);
  }, [symbol]);

  /* ================= AUTO FILTER ================= */
  useEffect(() => {
    load();
    setSelectedDay(null);
  }, [debouncedSymbol, result, from, to, load]);

  /* ================= CALENDAR MAP ================= */
  const calendarMap = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const k = r.dateKey;
      map[k] = (map[k] || 0) + Number(r.revenue || 0);
    }
    return map;
  }, [rows]);

  /* ================= FILTER BY DAY ================= */
  const filteredRows = useMemo(() => {
    if (!selectedDay) return rows;
    return rows.filter((r) => r.dateKey === selectedDay);
  }, [rows, selectedDay]);

  /* ================= TABLE TOTALS (for footer / pills) ================= */
  const totals = useMemo(() => {
    let trades = 0;
    let net = 0;
    let wins = 0;
    let losses = 0;
    for (const r of filteredRows) {
      trades += 1;
      const rev = Number(r.revenue || 0);
      net += rev;
      if (r.result === "WIN") wins += 1;
      if (r.result === "LOSS") losses += 1;
    }
    const winRate = trades ? (wins / trades) * 100 : 0;
    return { trades, net, wins, losses, winRate };
  }, [filteredRows]);

  /* ================= RENDER ================= */
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1600px] mx-auto p-6 space-y-6"
    >
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Performance</h1>
          <p className="text-sm text-gray-500">
            Calendar P&L + trade analytics (fixed day bucketing)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert("Export logic coming next 🚀")}
            className="h-9 px-4 rounded-full border text-sm font-semibold bg-white hover:bg-gray-50 transition shadow-sm"
          >
            Export
          </button>

          <button
            onClick={load}
            className="h-9 px-4 rounded-full border text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition shadow-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ===== TOP SPLIT ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===== CALENDAR ===== */}
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <CalendarPro
            month={calendarMonth}
            data={calendarMap}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onPrevMonth={() =>
              setCalendarMonth(
                (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)
              )
            }
            onNextMonth={() =>
              setCalendarMonth(
                (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)
              )
            }
          />

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">Legend:</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-emerald-200 border" /> Profit
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-rose-200 border" /> Loss
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-gray-100 border" /> No trades
            </span>
          </div>
        </div>

        {/* ===== ANALYTICS + FILTER ===== */}
        <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4 w-full">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Trade Analytics</h2>
              <p className="text-sm text-gray-500">
                Closed positions performance
              </p>
            </div>

            {(selectedDay || symbol || result !== "ALL" || from || to) && (
              <div className="flex items-center gap-2">
                <div className="text-[11px] px-3 py-1 rounded-full border bg-gray-50">
                  Trades: <span className="font-semibold">{totals.trades}</span>
                </div>
                <div
                  className={`text-[11px] px-3 py-1 rounded-full border bg-gray-50 ${
                    totals.net >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  Net:{" "}
                  <span className="font-semibold">{fmtMoney(totals.net)}</span>
                </div>
              </div>
            )}
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KPI label="Trades" value={summary.totalTrades} />
              <KPI
                label="Net P&L"
                value={fmtMoney(summary.totalPnL)}
                color={summary.totalPnL >= 0 ? "green" : "red"}
              />
              <KPI label="Win %" value={`${Number(summary.winRate || 0).toFixed(1)}%`} />
              <KPI label="Avg Win" value={fmtMoney(summary.avgWin)} color="green" />
              <KPI label="Avg Loss" value={fmtMoney(summary.avgLoss)} color="red" />
            </div>
          )}

          <div className="border-t" />

          {/* ===== FILTER LINE (FULL WIDTH) ===== */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-3 w-full">
            <input
              placeholder="Symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="h-10 w-full border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />

            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="h-10 w-full border rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option>ALL</option>
              <option>WIN</option>
              <option>LOSS</option>
              <option>BREAKEVEN</option>
            </select>

            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 w-full border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />

            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 w-full border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>

          {/* ===== ACTIVE FILTERS ===== */}
          {(selectedDay || symbol || result !== "ALL" || from || to) && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {selectedDay && (
                <FilterChip label={`Day: ${selectedDay}`} onClear={() => setSelectedDay(null)} />
              )}
              {symbol && (
                <FilterChip label={`Symbol: ${symbol}`} onClear={() => setSymbol("")} />
              )}
              {result !== "ALL" && (
                <FilterChip label={`Result: ${result}`} onClear={() => setResult("ALL")} />
              )}
              {from && (
                <FilterChip label={`From: ${from}`} onClear={() => setFrom("")} />
              )}
              {to && (
                <FilterChip label={`To: ${to}`} onClear={() => setTo("")} />
              )}

              <button
                onClick={() => {
                  setSymbol("");
                  setResult("ALL");
                  setFrom("");
                  setTo("");
                  setSelectedDay(null);
                }}
                className="ml-2 text-gray-400 hover:text-gray-700 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== TABLE ===== */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100/80 backdrop-blur border-b sticky top-0 z-10">
              <tr>
                <Th>Date</Th>
                <Th>Symbol</Th>
                <Th>Strategy</Th>
                <Th className="text-center">Result</Th>
                <Th className="text-right">Revenue</Th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <div className="font-semibold text-gray-700">
                      No trades found
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Try clearing filters or selecting another date.
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                filteredRows.map((r, i) => (
                  <tr
                    key={`${r.dateKey}-${r.symbol}-${i}`}
                    className={`border-b transition ${
                      i % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                    } hover:bg-blue-50/30`}
                  >
                    {/* ✅ show dateKey for perfect day alignment */}
                    <Td className="tabular-nums">{r.dateKey}</Td>
                    <Td className="font-semibold">{r.symbol}</Td>
                    <Td>{r.strategy}</Td>
                    <Td className="text-center">
                      <ResultBadge result={r.result} />
                    </Td>
                    <Td
                      className={`text-right font-bold tabular-nums ${
                        Number(r.revenue || 0) >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {Number(r.revenue || 0) >= 0 ? "+" : "-"}
                      {fmtMoney(Math.abs(Number(r.revenue || 0)))}
                    </Td>
                  </tr>
                ))}
            </tbody>

            {!loading && filteredRows.length > 0 && (
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td className="px-4 py-3 text-xs text-gray-500" colSpan={3}>
                    Showing <span className="font-semibold">{filteredRows.length}</span> trades
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    Net
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold tabular-nums ${
                      totals.net >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {fmtMoney(totals.net)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================
   COMPONENTS
============================================================ */

const KPI = ({ label, value, color }) => (
  <div className="rounded-xl border bg-gray-50 px-4 py-3">
    <p className="text-xs text-gray-500">{label}</p>
    <p
      className={`text-lg font-bold ${
        color === "green"
          ? "text-green-600"
          : color === "red"
          ? "text-red-600"
          : "text-gray-900"
      }`}
    >
      {value}
    </p>
  </div>
);

const FilterChip = ({ label, onClear }) => (
  <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
    <span className="tabular-nums">{label}</span>
    <button onClick={onClear} className="font-bold hover:text-blue-900">
      ×
    </button>
  </div>
);

const CalendarPro = ({
  month,
  data,
  selectedDay,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}) => {
  const year = month.getFullYear();
  const m = month.getMonth();

  // 7x6 grid
  const firstOfMonth = new Date(year, m, 1);
  const startDow = firstOfMonth.getDay(); // 0 Sun
  const start = new Date(year, m, 1 - startDow);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  // scale for heat
  const values = Object.values(data || {});
  const maxAbs = values.length ? Math.max(...values.map((v) => Math.abs(v))) : 0;

  const monthLabel = month.toLocaleString("default", { month: "long" });

  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <>
      <div className="flex justify-between items-center mb-3">
        <button
          onClick={onPrevMonth}
          className="h-9 w-9 rounded-full border bg-white hover:bg-gray-50 transition"
        >
          &lt;
        </button>

        <div className="text-sm font-semibold">
          {monthLabel} <span className="text-gray-500">{year}</span>
        </div>

        <button
          onClick={onNextMonth}
          className="h-9 w-9 rounded-full border bg-white hover:bg-gray-50 transition"
        >
          &gt;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[11px] text-gray-500 mb-2">
        {dow.map((d) => (
          <div key={d} className="text-center font-semibold">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = dateKeyLocal(d);
          const val = Number(data?.[key] || 0);
          const active = selectedDay === key;
          const inMonth = d.getMonth() === m;

          // intensity 0..1
          const intensity = maxAbs ? Math.min(Math.abs(val) / maxAbs, 1) : 0;

          // use subtle heat by opacity
          const base =
            val > 0
              ? "bg-emerald-500"
              : val < 0
              ? "bg-rose-500"
              : "bg-gray-100";

          const text =
            val > 0 || val < 0 ? "text-white" : "text-gray-500";

          return (
            <button
              key={key}
              onClick={() => onSelectDay(key)}
              className={`
                relative overflow-hidden
                rounded-xl border
                p-2 h-[58px]
                text-left
                transition
                ${inMonth ? "opacity-100" : "opacity-40"}
                ${active ? "ring-2 ring-blue-500 border-blue-500" : "hover:border-gray-300"}
                ${base}
                ${text}
              `}
              style={{
                // opacity changes intensity but keep readable
                opacity: inMonth ? (val === 0 ? 1 : 0.25 + intensity * 0.75) : 0.35,
              }}
              title={`${key} • ${fmtMoney(val)}`}
            >
              <div className="text-xs font-semibold tabular-nums">
                {d.getDate()}
              </div>

              {val !== 0 && (
                <div className="absolute bottom-2 left-2 text-[11px] font-bold tabular-nums">
                  {val >= 0 ? "+" : "-"}
                  {fmtCompact(Math.abs(val))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
};

const Th = ({ children, className = "" }) => (
  <th
    className={`
      px-4 py-3
      text-left
      text-xs
      font-semibold
      uppercase
      tracking-wide
      text-gray-600
      ${className}
    `}
  >
    {children}
  </th>
);

const Td = ({ children, className = "" }) => (
  <td className={`px-4 py-3 ${className}`}>{children}</td>
);

const ResultBadge = ({ result }) => {
  const map = {
    WIN: "bg-green-100 text-green-700",
    LOSS: "bg-red-100 text-red-700",
    BREAKEVEN: "bg-gray-200 text-gray-700",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${
        map[result] || "bg-gray-100 text-gray-700"
      }`}
    >
      {result}
    </span>
  );
};
