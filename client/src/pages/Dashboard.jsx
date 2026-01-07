import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "../services/api";
import { io } from "socket.io-client";

import StockDetail from "../components/StockDetail";
import Watchlist from "../components/watchlist/Watchlist";

const socket = io(
  `${window.location.protocol}//${window.location.hostname}:4000`,
  {
    path: "/ws",
    transports: ["websocket"],
  }
);

// =========================================
// 🧩 Helpers
// =========================================
const fmt = (n) =>
  n >= 0 ? (
    <span className="text-emerald-600 font-semibold">${n.toFixed(2)}</span>
  ) : (
    <span className="text-red-600 font-semibold">
      -${Math.abs(n).toFixed(2)}
    </span>
  );

const abbreviatePosition = (pos) => {
  if (!pos.legs || pos.legs.length === 0) return pos.strategy;
  const type = pos.legs[0].optionType === "call" ? "C" : "P";
  const strikes = pos.legs.map((l) => l.strike).join("/");
  const count = pos.count ?? pos.legs.length;
  return `${type} ${strikes} • ${count}c`;
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [openPositions, setOpenPositions] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState(null);

  // =========================================
  // 🔄 LOAD DATA
  // =========================================
  useEffect(() => {
    api.get("/api/positions/stats").then((res) => {
      setStats(res.data.stats || res.data.data || {});
    });

    api.get("/api/positions/summary-by-month").then((res) => {
      setMonthlySummary(res.data.data || res.data.monthlySummary || []);
    });

    api.get("/api/positions/open-summary").then((res) => {
      setOpenPositions(res.data.data || res.data.openPositions || []);
    });

    socket.on("priceUpdate", (data) => {
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
    });

    return () => socket.off("priceUpdate");
  }, []);

  if (!stats) {
    return <div className="p-10 text-gray-500 text-sm">Loading...</div>;
  }

  // =========================================
  // 🧨 UI
  // =========================================
  return (
    <div className="flex gap-6">

      {/* MAIN DASHBOARD */}
      <div className="flex-1 p-6 space-y-8 bg-gray-50 min-h-screen">

        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 text-sm">
            Real-time insights for your portfolio
          </p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Stat label="Total Positions" value={stats.totalPositions} />
          <Stat label="Net Profit" value={fmt(stats.netProfit)} />
          <Stat label="Win Rate" value={`${stats.winRate}%`} />
          <Stat label="Avg P&L" value={fmt(stats.avgPnL)} />
          <Stat label="Avg Win" value={fmt(stats.avgWin)} />
          <Stat label="Avg Loss" value={fmt(stats.avgLoss)} />
        </div>

        {/* MONTHLY CHART */}
        <div className="bg-white rounded-xl shadow border p-4">
          <h2 className="text-sm font-semibold mb-2 text-gray-700">
            Monthly Net Profit
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlySummary}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="netProfit"
                stroke="#3b82f6"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* OPEN POSITIONS */}
        <div className="bg-white rounded-xl shadow border p-4">
          <h2 className="text-sm font-semibold mb-4 text-gray-700">
            Open Positions (Live)
          </h2>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600">
                  <Th>Symbol</Th>
                  <Th>Strategy</Th>
                  <Th>Premium</Th>
                  <Th>Live</Th>
                  <Th>Δ%</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>

              <tbody>
                {openPositions.map((pos, idx) => (
                  <tr
                    key={idx}
                    className="border-b hover:bg-gray-100 cursor-pointer"
                    onClick={() => setSelectedTicker(pos.symbol)}
                  >
                    <Td>{pos.symbol}</Td>
                    <Td className="font-medium">
                      {abbreviatePosition(pos)}
                    </Td>
                    <Td>{fmt(pos.netPremium)}</Td>
                    <Td className="font-semibold">
                      {pos.livePrice ? `$${pos.livePrice.toFixed(2)}` : "—"}
                    </Td>
                    <Td
                      className={
                        pos.changePercent > 0
                          ? "text-emerald-600"
                          : "text-red-600"
                      }
                    >
                      {pos.changePercent
                        ? pos.changePercent.toFixed(2) + "%"
                        : "—"}
                    </Td>
                    <Td className="text-gray-400">
                      {pos.updatedAt
                        ? new Date(pos.updatedAt).toLocaleTimeString()
                        : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedTicker && (
          <StockDetail
            ticker={selectedTicker}
            onClose={() => setSelectedTicker(null)}
          />
        )}
      </div>

      {/* WATCHLIST — FIXED HEIGHT + OWN SCROLL */}
      <aside className="w-72 shrink-0">
        <div
          className="
            sticky top-6
            h-[calc(100vh-3rem)]
            max-h-[calc(85vh-3rem)]
          "
        >
          <Watchlist />
        </div>
      </aside>

    </div>
  );
}

// ======================================
// 🎨 Subcomponents
// ======================================
function Stat({ label, value }) {
  return (
    <div className="bg-white rounded-lg shadow p-3 border">
      <p className="text-xs text-gray-500">{label}</p>
      <h3 className="text-lg font-bold text-gray-800">{value}</h3>
    </div>
  );
}

const Th = ({ children }) => (
  <th className="px-3 py-2 font-semibold text-left">{children}</th>
);

const Td = ({ children, className = "" }) => (
  <td className={`px-3 py-2 ${className}`}>{children}</td>
);
