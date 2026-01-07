import React, { useEffect, useMemo, useState } from "react";
import {
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
import { io } from "socket.io-client";

import StockDetail from "../components/StockDetail";
import Watchlist from "../components/watchlist/Watchlist";

/* =========================================================
   SOCKET (MISMA IDEA QUE TENÍAS — NO CAMBIA API BACKEND)
========================================================= */
const socket = io(
  `${window.location.protocol}//${window.location.hostname}:4000`,
  {
    path: "/ws",
    transports: ["websocket"],
  }
);

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

const timeHHMMSS = (ts) => {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "—";
  }
};

const abbreviatePosition = (pos) => {
  if (!pos?.legs || pos.legs.length === 0) return pos?.strategy || "—";
  const type = pos.legs[0]?.optionType === "call" ? "C" : "P";
  const strikes = pos.legs.map((l) => l.strike).join("/");
  const count = pos.count ?? pos.legs.length;
  return `${type} ${strikes} • ${count}c`;
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

/* =========================================================
   MAIN
========================================================= */
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [openPositions, setOpenPositions] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState(null);

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
          api.get("/api/positions/open-summary"),
        ]);

        if (!alive) return;

        setStats(rStats.data.stats || rStats.data.data || {});
        setMonthlySummary(rMonth.data.data || rMonth.data.monthlySummary || []);
        setOpenPositions(rOpen.data.data || rOpen.data.openPositions || []);
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

    const onPrice = (data) => {
      if (!data?.symbol) return;

      // UI alert sutil si hay movimiento fuerte
      if (Math.abs(Number(data.changePercent || 0)) >= 5) {
        setAlert({
          type: "move",
          msg: `${data.symbol} moved ${fmtPct(Number(data.changePercent || 0))} • $${Number(data.price || 0).toFixed(2)}`,
        });
        setTimeout(() => setAlert(null), 3200);
      }

      setOpenPositions((prev) =>
        prev.map((pos) =>
          pos.symbol === data.symbol
            ? {
                ...pos,
                livePrice: data.price,
                changePercent: data.changePercent,
                updatedAt: data.timestamp,
              }
            : pos
        )
      );
    };

    socket.on("priceUpdate", onPrice);

    return () => {
      alive = false;
      socket.off("priceUpdate", onPrice);
    };
  }, []);

  /* =========================================================
     DERIVED (SIEMPRE ARRIBA, NO DESPUÉS DE RETURNS)
  ========================================================= */
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

  const openPositionsSorted = useMemo(() => {
    const arr = Array.isArray(openPositions) ? openPositions : [];
    // ordena por abs(changePercent) desc (más movimiento arriba)
    return [...arr].sort((a, b) => {
      const av = Math.abs(pctNum(a?.changePercent ?? 0));
      const bv = Math.abs(pctNum(b?.changePercent ?? 0));
      return bv - av;
    });
  }, [openPositions]);

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
            {/* CHART (PRO) */}
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">
                    Performance (Monthly)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Net profit and cumulative trend (last 12 months)
                  </p>
                </div>

                <div className="text-xs text-gray-400">
                  {chartData.length ? `${chartData.length} points` : "No data"}
                </div>
              </div>

              <div className="mt-3">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData}>
                    <defs>
                      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />

                    <XAxis
                      dataKey="month"
                      fontSize={11}
                      tickMargin={8}
                    />

                    <YAxis
                      fontSize={11}
                      domain={chartDomain}
                      tickMargin={8}
                    />

                    <Tooltip content={<ProfitTooltip />} />

                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" />

                    {/* Soft area under cumulative for “pro” look */}
                    <Area
                      type="monotone"
                      dataKey="cumulativeProfit"
                      stroke="transparent"
                      fill="url(#areaFill)"
                      isAnimationActive={false}
                    />

                    {/* Monthly Net */}
                    <Line
                      type="monotone"
                      dataKey="netProfit"
                      stroke="#2563eb"
                      strokeWidth={2.4}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />

                    {/* Cumulative */}
                    <Line
                      type="monotone"
                      dataKey="cumulativeProfit"
                      stroke="#10b981"
                      strokeWidth={2.4}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>

                {/* Legend minimal */}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-[2px] bg-blue-600" />
                    Monthly net
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-[2px] bg-emerald-500" />
                    Cumulative
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-[2px] bg-gray-400" />
                    Zero line
                  </div>
                </div>
              </div>
            </div>

            {/* OPEN POSITIONS TABLE */}
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">
                    Open Positions (Live)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Sorted by biggest movers (click row for details)
                  </p>
                </div>

                <div className="text-xs text-gray-400">
                  {openPositionsSorted.length} open
                </div>
              </div>

              <div className="mt-3 overflow-auto max-h-[360px] pr-1">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-gray-500">
                      <Th>Symbol</Th>
                      <Th>Strategy</Th>
                      <Th className="text-right">Premium</Th>
                      <Th className="text-right">Live</Th>
                      <Th className="text-right">Δ%</Th>
                      <Th className="text-right">Updated</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {openPositionsSorted.map((pos, idx) => {
                      const ch = pctNum(pos?.changePercent ?? 0);
                      return (
                        <tr
                          key={`${pos.symbol}-${idx}`}
                          className="border-b hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedTicker(pos.symbol)}
                        >
                          <Td className="font-semibold text-gray-900">
                            {pos.symbol}
                          </Td>

                          <Td className="text-gray-700">
                            {abbreviatePosition(pos)}
                          </Td>

                          <Td className="text-right">
                            {fmtUSDNode(moneyNum(pos?.netPremium ?? 0))}
                          </Td>

                          <Td className="text-right font-semibold">
                            {pos?.livePrice ? `$${Number(pos.livePrice).toFixed(2)}` : "—"}
                          </Td>

                          <Td
                            className={`text-right font-semibold ${
                              ch >= 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {fmtPct(ch)}
                          </Td>

                          <Td className="text-right text-gray-400">
                            {timeHHMMSS(pos?.updatedAt)}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {openPositionsSorted.length === 0 && (
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
