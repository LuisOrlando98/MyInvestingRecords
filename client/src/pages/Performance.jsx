import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";

axios.defaults.baseURL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/* ============================================================
   📊 PERFORMANCE — Webull-style Analytics + Interactive Calendar
============================================================ */
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

  /* ================= LOAD ================= */
  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/performance", {
        params: {
          symbol: debouncedSymbol || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });

      let tableRows = data.rows || [];

      if (result !== "ALL") {
        tableRows = tableRows.filter((r) => r.result === result);
      }

      setRows(tableRows);
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  };

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    load();
  }, []);

  /* ================= DEBOUNCE SYMBOL ================= */
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSymbol(symbol.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [symbol]);

  /* ================= AUTO FILTER ================= */
  useEffect(() => {
    load();
    setSelectedDay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSymbol, result, from, to]);

  /* ================= CALENDAR MAP ================= */
  const calendarMap = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const d = new Date(r.date).toISOString().slice(0, 10);
      map[d] = (map[d] || 0) + r.revenue;
    });
    return map;
  }, [rows]);

  /* ================= FILTER BY DAY ================= */
  const filteredRows = useMemo(() => {
    if (!selectedDay) return rows;
    return rows.filter(
      (r) => new Date(r.date).toISOString().slice(0, 10) === selectedDay
    );
  }, [rows, selectedDay]);

  const fmtMoney = (n) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(n || 0));

  /* ================= RENDER ================= */
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1600px] mx-auto p-6 space-y-6"
    >
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Performance</h1>

        <button
          onClick={() => alert("Export logic coming next 🚀")}
          className="h-9 px-4 rounded-full border text-sm font-semibold bg-white hover:bg-gray-50 transition"
        >
          Export
        </button>
      </div>

      {/* ===== TOP SPLIT ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===== CALENDAR ===== */}
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <Calendar
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
        </div>

        {/* ===== ANALYTICS + FILTER ===== */}
        <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4 w-full">
          <div>
            <h2 className="text-base font-semibold">Trade Analytics</h2>
            <p className="text-sm text-gray-500">
              Closed positions performance
            </p>
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KPI label="Trades" value={summary.totalTrades} />
              <KPI
                label="Net P&L"
                value={fmtMoney(summary.totalPnL)}
                color={summary.totalPnL >= 0 ? "green" : "red"}
              />
              <KPI label="Win %" value={`${summary.winRate.toFixed(1)}%`} />
              <KPI
                label="Avg Win"
                value={fmtMoney(summary.avgWin)}
                color="green"
              />
              <KPI
                label="Avg Loss"
                value={fmtMoney(summary.avgLoss)}
                color="red"
              />
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
                className="h-10 w-full border rounded-lg px-3 text-sm"
            />

            <select
                value={result}
                onChange={(e) => setResult(e.target.value)}
                className="h-10 w-full border rounded-lg px-3 text-sm"
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
                className="h-10 w-full border rounded-lg px-3 text-sm"
            />

            <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 w-full border rounded-lg px-3 text-sm"
            />
            </div>

          {/* ===== ACTIVE FILTERS ===== */}
          {(selectedDay || symbol || result !== "ALL" || from || to) && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {selectedDay && (
                <FilterChip
                  label={`Day: ${new Date(selectedDay).toLocaleDateString()}`}
                  onClear={() => setSelectedDay(null)}
                />
              )}
              {symbol && (
                <FilterChip
                  label={`Symbol: ${symbol}`}
                  onClear={() => setSymbol("")}
                />
              )}
              {result !== "ALL" && (
                <FilterChip
                  label={`Result: ${result}`}
                  onClear={() => setResult("ALL")}
                />
              )}
              {from && (
                <FilterChip
                  label={`From: ${new Date(from).toLocaleDateString()}`}
                  onClear={() => setFrom("")}
                />
              )}
              {to && (
                <FilterChip
                  label={`To: ${new Date(to).toLocaleDateString()}`}
                  onClear={() => setTo("")}
                />
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
                    key={i}
                    className={`border-b transition ${
                      i % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                    } hover:bg-blue-50/30`}
                  >
                    <Td>{new Date(r.date).toLocaleDateString()}</Td>
                    <Td className="font-semibold">{r.symbol}</Td>
                    <Td>{r.strategy}</Td>
                    <Td className="text-center">
                      <ResultBadge result={r.result} />
                    </Td>
                    <Td
                      className={`text-right font-bold ${
                        r.revenue >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {r.revenue >= 0 ? "+" : "-"}
                      {fmtMoney(Math.abs(r.revenue))}
                    </Td>
                  </tr>
                ))}
            </tbody>
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
    <span>{label}</span>
    <button onClick={onClear} className="font-bold hover:text-blue-900">
      ×
    </button>
  </div>
);

const Calendar = ({
  month,
  data,
  selectedDay,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}) => {
  const year = month.getFullYear();
  const m = month.getMonth();
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  return (
    <>
      <div className="flex justify-between items-center mb-3">
        <button onClick={onPrevMonth}>&lt;</button>
        <h3 className="font-semibold">
          {month.toLocaleString("default", { month: "long" })} {year}
        </h3>
        <button onClick={onNextMonth}>&gt;</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs">
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const d = new Date(year, m, day).toISOString().slice(0, 10);
          const val = data[d] || 0;
          const active = selectedDay === d;

          return (
            <div
              key={d}
              onClick={() => onSelectDay(d)}
              className={`cursor-pointer rounded p-2 text-center ${
                active
                  ? "ring-2 ring-blue-500"
                  : val > 0
                  ? "bg-green-500 text-white"
                  : val < 0
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <div>{day}</div>
              {val !== 0 && <div>${val.toFixed(0)}</div>}
            </div>
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
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${map[result]}`}>
      {result}
    </span>
  );
};
