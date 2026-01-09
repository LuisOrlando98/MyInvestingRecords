import React, { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
} from "recharts";
import api from "../services/api";

import StockDetail from "../components/StockDetail";
import Watchlist from "../components/watchlist/Watchlist";
import useWatchlist from "../hooks/useWatchlist";
import { calculatePositionMetrics } from "../utils/positionUtils";
import { mergeLiveQuotesIntoPosition } from "../utils/mergeLiveQuotes";
import { useQuotes } from "../store/QuoteStore";

/* =========================================================
   HELPERS
========================================================= */

const moneyNum = (v) => Number(v ?? 0);
const pctNum = (v) => Number(v ?? 0);

const fmtUSD = (n) => {
  const v = moneyNum(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toFixed(2)}`;
};

const fmtUSDNode = (n) => {
  const v = moneyNum(n);
  return (
    <span className={v >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
      {fmtUSD(v)}
    </span>
  );
};

const fmtPct = (n) => {
  const v = pctNum(n);
  if (!Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
};


/* =========================================================
   DATE HELPERS (NO UTC BUG)
========================================================= */

const dateKeyLocal = (d) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const RANGE_PRESETS = [
  { key: "TODAY", label: "Today" },
  { key: "7D", label: "Last 7D" },
  { key: "1M", label: "Last Month" },
  { key: "3M", label: "Last 3 Months" },
  { key: "YTD", label: "This Year" },
  { key: "1Y", label: "Last Year" },
];

const resolveRange = (preset) => {
  const now = new Date();
  const today = dateKeyLocal(now);

  if (preset === "TODAY") {
    return { from: today, to: today };
  }

  if (preset === "7D") {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return { from: dateKeyLocal(d), to: today };
  }

  if (preset === "1M") {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return { from: dateKeyLocal(d), to: today };
  }

  if (preset === "3M") {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return { from: dateKeyLocal(d), to: today };
  }

  if (preset === "YTD") {
    return {
      from: `${now.getFullYear()}-01-01`,
      to: today,
    };
  }

  if (preset === "1Y") {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return { from: dateKeyLocal(d), to: today };
  }

  return {};
};

/* =========================================================
   TOOLTIP PRO
========================================================= */
function ProfitTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const net = payload.find((p) => p.dataKey === "netProfit")?.value ?? 0;
  const cum = payload.find((p) => p.dataKey === "cumulativeProfit")?.value ?? 0;

  return (
    <div className="rounded-xl border bg-white shadow-lg px-3 py-2">
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-8 text-xs">
        <span className="text-gray-500">Monthly</span>
        <span className={net >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
          {fmtUSD(net)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-8 text-xs">
        <span className="text-gray-500">Cumulative</span>
        <span className={cum >= 0 ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"}>
          {fmtUSD(cum)}
        </span>
      </div>
    </div>
  );
}

const RANGE_META = {
  TODAY: {
    title: "Today",
    subtitle: "Closed trades revenue (today)",
  },
  "7D": {
    title: "Last 7 Days",
    subtitle: "Daily revenue from closed trades",
  },
  "1M": {
    title: "Last Month",
    subtitle: "Daily revenue from closed trades",
  },
  "3M": {
    title: "Last 3 Months",
    subtitle: "Daily revenue from closed trades",
  },
  YTD: {
    title: "Year to Date",
    subtitle: "Daily revenue from closed trades",
  },
  "1Y": {
    title: "Last Year",
    subtitle: "Daily revenue from closed trades",
  },
};

const rangeTitleMap = {
  TODAY: "Today Performance",
  "7D": "Last 7 Days Performance",
  "1M": "Last Month Performance",
  "3M": "Last 3 Months Performance",
  YTD: "Year to Date Performance",
  "1Y": "Last Year Performance",
};

/* =========================================================
   MAIN
========================================================= */
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState([]);
  // Chart filters
  const [range, setRange] = useState("1M"); // Last Month por defecto
  const [dailyPnL, setDailyPnL] = useState([]);
  const [openPositions, setOpenPositions] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const { quotes } = useWatchlist();
  const { optionQuotes, trackOptionLegs } = useQuotes();
  const [alert, setAlert] = useState(null);

  /* =========================================================
     LOAD DATA + LIVE UPDATES
  ========================================================= */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [rStats, rMonth, rOpen] = await Promise.all([
          api.get("/api/positions/stats"),
          api.get("/api/positions/summary-by-month"),
          api.get("/api/positions", {
            params: { status: "Open" }
          }),
        ]);

        console.log("OPEN SUMMARY RAW:", rOpen.data); // 👈 ADD THIS

        if (!alive) return;      

        setStats(rStats.data.stats || rStats.data.data || {});
        setMonthlySummary(rMonth.data.data || rMonth.data.monthlySummary || []);
        setOpenPositions(
          (rOpen.data.data || []).filter(p => p.status === "Open")
        );
      } catch (e) {
        console.error("Dashboard load error:", e);
        if (!alive) return;
        setStats({});
        setMonthlySummary([]);
        setOpenPositions([]);
        setAlert({ type: "error", msg: "Failed to load dashboard data." });
        setTimeout(() => setAlert(null), 3500);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!openPositions.length) return;
    trackOptionLegs(openPositions);
  }, [openPositions, trackOptionLegs]);

  /* =========================================================
    LOAD DAILY PnL FOR DASHBOARD CHART
  ========================================================= */
  useEffect(() => {
    const loadDailyPnL = async () => {
      try {
        const { from, to } = resolveRange(range);

        const res = await api.get("/api/performance", {
          params: {
            from: from ? `${from}T00:00:00.000` : undefined,
            to: to ? `${to}T23:59:59.999` : undefined,
          },
        });

        const rows = Array.isArray(res.data?.rows) ? res.data.rows : [];

        const map = {};
        for (const r of rows) {
          const key =
            r.dateKey ||
            (r.date ? dateKeyLocal(r.date) : null);

          if (!key) continue;

          map[key] = (map[key] || 0) + Number(r.revenue || 0);
        }

        const chart = Object.entries(map)
          .map(([date, pnl]) => ({ date, pnl }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setDailyPnL(chart);
      } catch (err) {
        console.error("Dashboard daily PnL error:", err);
        setDailyPnL([]);
      }
    };

    loadDailyPnL();
  }, [range]);

  /* =========================================================
     DERIVED 
  ========================================================= */
  const pnlStats = useMemo(() => {
    const total = dailyPnL.reduce((s, d) => s + d.pnl, 0);
    return {
      total,
      positive: total >= 0,
    };
  }, [dailyPnL]);

  const netProfitValue = useMemo(() => moneyNum(stats?.netProfit ?? 0), [stats]);

  const headerAccent =
    netProfitValue >= 0 ? "text-emerald-700" : "text-red-700";

  const headlineSub =
    openPositions?.length > 0
      ? `${openPositions.length} open position${openPositions.length === 1 ? "" : "s"} • live updates enabled`
      : "No open positions • live updates enabled";

  const monthlyWithCumulative = useMemo(() => {
    const arr = Array.isArray(monthlySummary) ? monthlySummary : [];
    let cum = 0;
    return arr.map((row) => {
      const net = moneyNum(row?.netProfit ?? 0);
      cum += net;
      return {
        ...row,
        netProfit: net,
        cumulativeProfit: cum,
      };
    });
  }, [monthlySummary]);

  // últimos 12 meses (si vienen más)
  const chartData = useMemo(() => {
    const arr = monthlyWithCumulative;
    if (arr.length <= 12) return arr;
    return arr.slice(arr.length - 12);
  }, [monthlyWithCumulative]);

  const chartDomain = useMemo(() => {
    if (!chartData.length) return ["auto", "auto"];
    const vals = chartData.flatMap((d) => [d.netProfit, d.cumulativeProfit]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    // un poquito de padding
    const pad = Math.max(10, (max - min) * 0.08);
    return [min - pad, max + pad];
  }, [chartData]);

  const openPositionsWithMetrics = useMemo(() => {
    const arr = Array.isArray(openPositions) ? openPositions : [];

    return arr.map((pos) => {
      const merged = mergeLiveQuotesIntoPosition(pos, optionQuotes);
      return {
        pos: merged,
        metrics: calculatePositionMetrics(merged),
      };
    });
  }, [openPositions, optionQuotes]);

  
  /* =========================================================
     LOADING
  ========================================================= */
  if (!stats) {
    return (
      <div className="p-10 text-gray-500 text-sm">
        Loading dashboard...
      </div>
    );
  }

  /* =========================================================
     UI
  ========================================================= */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ALERTS */}
      {alert && (
        <div
          className={`fixed top-5 right-5 z-50 rounded-xl border px-4 py-2 shadow-lg text-sm bg-white
            ${alert.type === "error" ? "border-red-200" : "border-gray-200"}`}
        >
          <div className="font-semibold text-gray-900">Alert</div>
          <div className="text-gray-600">{alert.msg}</div>
        </div>
      )}

      <div className="flex gap-6 p-6">
        {/* MAIN */}
        <div className="flex-1 space-y-6">
          {/* HERO */}
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Portfolio Overview
                  </h1>
                  <p className="text-sm text-gray-500">{headlineSub}</p>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-500">Net Profit</div>
                  <div className={`text-2xl font-extrabold ${headerAccent}`}>
                    {netProfitValue >= 0 ? "+" : "-"}$
                    {Math.abs(netProfitValue).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Win Rate:{" "}
                    <span className="font-semibold">
                      {Number(stats?.winRate ?? 0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* MINI KPIs (NO DUPLICADOS) */}
              <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniStat label="Total Positions" value={stats?.totalPositions ?? 0} />
                <MiniStat label="Avg P&L" value={fmtUSDNode(moneyNum(stats?.avgPnL ?? 0))} />
                <MiniStat label="Avg Win" value={fmtUSDNode(moneyNum(stats?.avgWin ?? 0))} />
                <MiniStat label="Avg Loss" value={fmtUSDNode(moneyNum(stats?.avgLoss ?? 0))} />
              </div>
            </div>

            {/* subtle bottom bar */}
            <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
          </div>

          {/* MAIN GRID: CHART + TABLE */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* PERFORMANCE CHART */}
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              {/* HEADER */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">
                    Performance ({RANGE_META[range]?.title})
                  </h2>
                  <p className="text-xs text-gray-500">
                    {RANGE_META[range]?.subtitle}
                  </p>
                </div>

                {/* RANGE DROPDOWN */}
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  className="
                    h-9 px-3 pr-8 rounded-lg border bg-white
                    text-xs font-semibold text-gray-700
                    hover:bg-gray-50
                    focus:outline-none focus:ring-2 focus:ring-gray-900/10
                  "
                >
                  {RANGE_PRESETS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* BODY */}
              <div className="relative">
                {/* NO DATA */}
                {dailyPnL.length === 0 && (
                  <div className="h-[340px] flex flex-col items-center justify-center text-sm text-gray-400">
                    <div className="font-semibold">No closed trades</div>
                    <div className="text-xs mt-1">
                      Try selecting a different time range
                    </div>
                  </div>
                )}
                
                {/* CHART */}
                {dailyPnL.length > 0 && (
                  <>
                    <ResponsiveContainer width="100%" height={340}>
                      <AreaChart
                        data={dailyPnL}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="0%"
                              stopColor={pnlStats.positive ? "#16a34a" : "#dc2626"}
                              stopOpacity={0.45}
                            />
                            <stop
                              offset="100%"
                              stopColor={pnlStats.positive ? "#16a34a" : "#dc2626"}
                              stopOpacity={0.05}
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />

                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickMargin={6}
                          tickFormatter={(v) =>
                            range === "TODAY" ? v.slice(11, 16) : v.slice(5)
                          }
                        />

                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => `$${v}`}
                        />

                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #e5e7eb",
                            fontSize: 12,
                          }}
                          formatter={(v) => [fmtUSD(v), "Daily P&L"]}
                          labelFormatter={(l) => `Date: ${l}`}
                        />

                        <ReferenceLine
                          y={0}
                          stroke="#9ca3af"
                          strokeDasharray="4 4"
                        />

                        <Area
                          type="monotone"
                          dataKey="pnl"
                          stroke={pnlStats.positive ? "#16a34a" : "#dc2626"}
                          strokeWidth={2}
                          fill="url(#pnlGradient)"
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>

                    {/* LEGEND */}
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-[2px] bg-blue-600" />
                        Daily revenue (closed trades)
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-[2px] bg-gray-400" />
                        Break-even
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* OPEN POSITIONS TABLE */}
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Open Positions (Live)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Active positions with real-time price updates
                  </p>
                </div>

                <div className="text-xs text-gray-400">
                  {openPositionsWithMetrics.length} open
                </div>
              </div>

              <div className="mt-3 overflow-auto max-h-[360px] pr-1">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-gray-500">
                      <Th>Symbol</Th>
                      <Th>Strategy</Th>
                      <Th className="text-right">Open P&amp;L</Th>
                      <Th className="text-right">Cost (Premium)</Th>
                      <Th className="text-right">Contracts</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {openPositionsWithMetrics.map(({ pos, metrics: m }, idx) => {
                      const symbol = String(pos.symbol).toUpperCase();
                      const q = quotes[symbol] || {};
                      const premium = Number(pos?.netPremium);

                      return (
                        <tr key={symbol + idx} className="border-b hover:bg-gray-50">
                          {/* SYMBOL + PRICE */}
                          <Td className="font-semibold text-gray-900">
                            <div>{symbol}</div>

                            {q.price != null ? (
                              <div className="text-[11px] text-gray-500">
                                ${Number(q.price).toFixed(2)}{" "}
                                <span
                                  className={
                                    Number(q.changePercent ?? 0) >= 0
                                      ? "text-emerald-600"
                                      : "text-red-600"
                                  }
                                >
                                  ({Number(q.changePercent ?? 0).toFixed(2)}%)
                                </span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-gray-400">
                                Waiting price…
                              </div>
                            )}
                          </Td>

                          {/* STRATEGY */}
                          <Td className="text-gray-700">{pos.strategy || "—"}</Td>

                          {/* OPEN P&L */}
                          <Td className="text-right">
                            <div
                              className={`font-semibold ${
                                m.openPnL >= 0 ? "text-emerald-600" : "text-red-600"
                              }`}
                            >
                              {m.openPnL >= 0 ? "+" : "-"}$
                              {Math.abs(m.openPnL).toFixed(2)}
                            </div>

                            <div className="text-[11px] text-gray-500">
                              ({fmtPct(m.openPnLPct)})
                            </div>
                          </Td>

                          {/* COST (PREMIUM) */}
                          <Td className="text-right font-semibold">
                            <span
                              className={
                                m.totalCost >= 0 ? "text-red-600" : "text-emerald-600"
                              }
                            >
                              {m.totalCost >= 0 ? "-" : "+"}$
                              {Math.abs(m.totalCost).toFixed(2)}
                            </span>
                          </Td>

                          {/* CONTRACTS */}
                          <Td className="text-right font-semibold text-gray-700">
                            {Number.isFinite(m.qty) ? m.qty : "—"}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {openPositionsWithMetrics.length === 0 && (
                  <div className="mt-6 text-sm text-gray-500">
                    No open positions right now.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MODAL */}
          {selectedTicker && (
            <StockDetail
              ticker={selectedTicker}
              onClose={() => setSelectedTicker(null)}
            />
          )}
        </div>

        {/* WATCHLIST SIDEBAR */}
        <aside className="w-80 shrink-0">
          <div className="sticky top-6 h-[calc(100vh-3rem)]">
            <Watchlist />
          </div>
        </aside>
      </div>
    </div>
  );
}

/* =========================================================
   UI PIECES
========================================================= */
function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border bg-gray-50 p-4">
      <div className="text-[11px] text-gray-500 font-semibold">{label}</div>
      <div className="mt-1 text-lg font-extrabold text-gray-900">{value}</div>
    </div>
  );
}

const Th = ({ children, className = "" }) => (
  <th className={`px-3 py-2 font-semibold text-left ${className}`}>
    {children}
  </th>
);

const Td = ({ children, className = "" }) => (
  <td className={`px-3 py-2 ${className}`}>{children}</td>
);
