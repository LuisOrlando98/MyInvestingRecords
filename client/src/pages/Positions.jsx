// src/pages/Positions.jsx
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { XCircle, MoreVertical } from "lucide-react";
import { io } from "socket.io-client";

import { buildOptionarUrlFromPosition } from "../utils/optionarLink";
import { Eye } from "lucide-react"; // icono profesional

// 🧮 Utils centralizados
import {
  calculatePositionMetrics,
  calculateLegMetrics,
  fmtUSD as fmt,
  fmtPct as pct,
  earliestExp,
} from "../utils/positionUtils";

// ⚡ Hook de cotizaciones Tradier
import { useLiveQuotes } from "../hooks/useLiveQuotes";

// 🏦 Íconos por broker
import { brokerIcons } from "../utils/brokerIcons";

axios.defaults.baseURL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const socket = io(import.meta.env.VITE_API_WS_URL || "http://localhost:4000", {
  path: "/ws",
});

// ✅ helper: formatea fechas vengan como Date o string
function fmtDateYYYYMMDD(d) {
  if (!d) return "—";
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

function Positions() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [showRollModal, setShowRollModal] = useState(false);
  const [rollingPosition, setRollingPosition] = useState(null);

  // === 1️⃣ Cargar posiciones desde el backend ===
  const fetchPositions = async () => {
    try {
      const res = await axios.get("/api/positions");
      setPositions(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (e) {
      console.error("Error loading positions", e);
    } finally {
      setLoading(false);
    }
  };

  // === 2️⃣ WebSocket local ===
  useEffect(() => {
    fetchPositions();

    socket.on("priceUpdate", (data) => {
      setPositions((prev) =>
        prev.map((p) =>
          p.symbol === data.symbol ? { ...p, livePrice: data.price } : p
        )
      );
    });

    return () => socket.off("priceUpdate");
  }, []);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  // === 3️⃣ Hook Tradier Live (actualiza precios reales de opciones) ===
  const livePositions = useLiveQuotes(positions, 5000); // 5s refresh

  // 🔁 Forzar re-render para que los valores calculados (como Greeks) se actualicen visualmente
  const [forceRefresh, setForceRefresh] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setForceRefresh((prev) => prev + 1);
    }, 5000); // ⏱ cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  // === 4️⃣ Ordenar posiciones por expiración ===
  const sortedPositions = useMemo(
    () =>
      [...livePositions].sort(
        (a, b) =>
          new Date(a.legs?.[0]?.expiration || 0) -
          new Date(b.legs?.[0]?.expiration || 0)
      ),
    [livePositions, forceRefresh] // ✅ nuevo: para que se recalcule cada 5s
  );

  // ✅ OJO: ESTE useMemo DEBE IR ANTES DEL "return loading" (Rules of Hooks)
  // 💰 Total Open P&L en vivo
  const totalOpenPnL = useMemo(() => {
    return sortedPositions
      .filter((p) => p.status === "Open")
      .reduce((sum, p) => {
        const m = calculatePositionMetrics(p);
        return sum + (m.openPnL || 0);
      }, 0);
  }, [sortedPositions]);
  
  // 📊 Header portfolio stats (FIX)
  const headerStats = useMemo(() => {
    let openPnL = 0;
    let marketValue = 0;
    let openCount = 0;

    sortedPositions.forEach((p) => {
      if (p.status !== "Open") return;
      const m = calculatePositionMetrics(p);
      openPnL += m.openPnL || 0;
      marketValue += m.marketValue || 0;
      openCount++;
    });

    return {
      openPnL,
      marketValue,
      openCount,
    };
  }, [sortedPositions]);

  if (loading)
    return (
      <p className="text-center mt-8 text-gray-500">Loading positions...</p>
    );

  // === 5️⃣ Render ===
  return (
    <div className="p-6 bg-white min-h-screen">
        <div className="flex justify-between items-center mb-4">
          {/* LEFT — Title + Open Positions pill */}
          <div className="flex items-center gap-4">
            {/* Title */}
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Positions
            </h1>

            {/* Divider */}
            <span className="h-6 w-px bg-gray-300"></span>

            {/* Open Positions Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-sm">
              <span className="text-gray-600">
                Open Positions
              </span>

              <span className="font-semibold text-gray-900">
                {headerStats.openCount}
              </span>

              {/* PnL */}
              <span
                className={`flex items-center gap-0.5 font-semibold ${
                  headerStats.openPnL >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                <i
                  className={`bi ${
                    headerStats.openPnL >= 0
                      ? "bi-arrow-up-short"
                      : "bi-arrow-down-short"
                  } text-lg leading-none`}
                ></i>
                {fmt(Math.abs(headerStats.openPnL))}
              </span>
            </div>
          </div>

          {/* RIGHT — Button */}
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            onClick={() => (window.location.href = "/positions/new")}
          >
            + New Position
          </button>
        </div>

      {/* TABLE */}
      <div className="overflow-x-auto shadow border rounded-lg">
        <table className="min-w-full text-[15px]">
          <thead className="bg-gray-100 text-gray-700 border-b sticky top-0 shadow-sm">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
              <th>Actions</th>
              <th>Symbol</th>
              <th>Strategy</th>
              <th>Qty</th>
              <th>Market Value</th>
              <th>Open P&amp;L</th>
              <th>Open P&amp;L %</th>
              <th>Day’s P&amp;L</th>
              <th>Last Price</th>
              <th>Entry Price</th>
              <th>Total Cost</th>
              <th>BreakEven</th>
              <th>Max Profit</th>
              <th>Max Loss</th>
              <th>Revenue</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {sortedPositions.map((pos) => {
              const m =
              pos.status === "Open"
                ? calculatePositionMetrics(pos)
                : {
                    marketValue: 0,
                    openPnL: 0,
                    openPnLPct: 0,
                    daysPnL: 0,
                    last: null,
                    entry: null,
                    totalCost: pos.totalCost ?? 0,
                    breakEven: null,
                    maxProfit: null,
                    maxLoss: null,
                    revenue: null,
                  };
              const exp = earliestExp(pos.legs);
              const brokerName = (pos.broker || "").trim();
              const isRolledIn = pos.status === "Open" && pos.rolledFrom;

              return (
                <React.Fragment key={pos._id}>
                  {/* === MAIN ROW (Double-Click to Edit) === */}
                  <tr
                    onDoubleClick={() =>
                      (window.location.href = `/positions/${pos._id}/edit`)
                    }
                    className={`relative transition cursor-pointer ${
                      pos.status === "Closed"
                        ? "bg-gray-100 opacity-70"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {/* Action */}
                    <td className="w-[42px]">
                      <div className="flex items-center justify-center h-full">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();

                            const rect = e.currentTarget.getBoundingClientRect();

                            setMenuPos({
                              x: rect.right + 4,
                              y: rect.bottom + 4,
                            });

                            setOpenMenuId(openMenuId === pos._id ? null : pos._id);
                          }}
                          className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100"
                          title="Actions"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>

                    {/* Symbol + Broker */}
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        {/* ICONO DEL BROKER */}
                        {brokerIcons[brokerName] ? (
                          <img
                            src={brokerIcons[brokerName]}
                            alt={brokerName}
                            title={brokerName}
                            className="w-6 h-6 object-contain rounded-none mt-[2px]"
                          />
                        ) : (
                          <div className="w-6 h-6 flex items-center justify-center text-gray-400 text-xs mt-[2px]">
                            ?
                          </div>
                        )}

                        {/* SYMBOL + TAGS */}
                        <div className="flex flex-col leading-tight">
                          {/* SYMBOL + EXPIRATION */}
                          <span className="font-semibold">
                            {pos.symbol}{" "}
                            <span className="text-gray-500 font-normal">
                              (Exp: {exp})
                            </span>
                          </span>

                          {/* === TAGS EN UNA SOLA FILA === */}
                          <div className="flex gap-2 mt-1">
                            {/* WIN / LOSS / BREAKEVEN */}
                            {pos.status === "Closed" &&
                              pos.closedStatus === "win" && (
                                <span className="bg-green-100 text-green-700 px-2 py-[1px] rounded text-xs">
                                  WIN
                                </span>
                              )}

                            {pos.status === "Closed" &&
                              pos.closedStatus === "loss" && (
                                <span className="bg-red-100 text-red-700 px-2 py-[1px] rounded text-xs">
                                  LOSS
                                </span>
                              )}

                            {pos.status === "Closed" &&
                              pos.closedStatus === "breakeven" && (
                                <span className="bg-gray-200 text-gray-700 px-2 py-[1px] rounded text-xs">
                                  BREAKEVEN
                                </span>
                              )}

                            {/* STATUS GENERAL */}
                            {pos.status && (
                              <div className="flex flex-col">
                                <span
                                  className={`px-2 py-[1px] rounded text-xs font-semibold w-fit
                                    ${
                                      pos.status === "Open"
                                        ? "bg-blue-100 text-blue-700"
                                        : pos.status === "Closed"
                                        ? "bg-gray-200 text-gray-700"
                                        : pos.status === "Rolled"
                                        ? "bg-purple-100 text-purple-700"
                                        : pos.status === "Expired"
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-gray-200 text-gray-700"
                                    }`}
                                >
                                  {pos.status.toUpperCase()}
                                </span>

                                {pos.status === "Rolled" && pos.closeDate && (
                                  <span className="text-[11px] text-gray-500 mt-0.5">
                                    Rolled on {fmtDateYYYYMMDD(pos.closeDate)}
                                  </span>
                                )}
                                {/* 🔁 ROLLED-IN BADGE */}
                                  {isRolledIn && (
                                    <span
                                      className="bg-purple-100 text-purple-700 px-2 py-[1px] rounded text-xs font-semibold"
                                      title="This position comes from a roll"
                                    >
                                      ROLLED FROM
                                    </span>
                                  )}
                              </div>
                            )}
                          </div>
                        </div>
                        {openMenuId && (
                          <div
                            className="fixed z-50 w-36 bg-white border rounded-md shadow-lg text-sm"
                            style={{ top: menuPos.y, left: menuPos.x }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                window.location.href = `/positions/${openMenuId}/edit`;
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100"
                            >
                              ✏️ Edit
                            </button>

                            {pos.status === "Open" && (
                              <button
                                onClick={async () => {
                                  const value = prompt("Enter exit price to close the position:");
                                  if (!value) return;

                                  const exitPrice = parseFloat(value);
                                  if (isNaN(exitPrice)) return alert("Invalid number");

                                  try {
                                    await axios.put(`/api/positions/${openMenuId}/close`, { exitPrice });
                                    fetchPositions();
                                    setOpenMenuId(null);
                                  } catch {
                                    alert("Error closing position");
                                  }
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-red-600"
                              >
                                ❌ Close
                              </button>
                            )}
                            {pos.status === "Open" && (
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  window.location.href = `/positions/${pos._id}/edit?roll=true`;
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-purple-600"
                              >
                                🔁 Roll
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                if (!confirm("Archive this position?")) return;

                                try {
                                  await axios.put(`/api/positions/${openMenuId}/archive`);
                                  fetchPositions();
                                  setOpenMenuId(null);
                                } catch {
                                  alert("Error archiving position");
                                }
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-600"
                            >
                              🗂️ Archive
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Strategy (auto detectada) */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {/* Strategy Badge */}
                        <span className="bg-blue-50 text-blue-700 px-2 py-[2px] rounded-md">
                          {pos.strategy || m.strategyDetected || "—"}
                        </span>

                        {/* Optionar Eye Icon */}
                        <a
                          href={buildOptionarUrlFromPosition(pos)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                          title="Analyze on Optionar"
                        >
                          <Eye size={17} />
                        </a>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="px-3 py-2">
                      {pos.status === "Open" ? m.qty : pos.legs?.[0]?.quantity ?? "—"}
                    </td>

                    {/* Market Value */}
                    <td className="px-3 py-2 text-gray-700">
                      {fmt(m.marketValue)}
                    </td>

                    {/* Open P&L */}
                    <td
                      className={`px-3 py-2 ${
                        m.openPnL >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {fmt(m.openPnL)}
                    </td>

                    {/* Open P&L % */}
                    <td
                      className={`px-3 py-2 ${
                        m.openPnLPct >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {pct(m.openPnLPct)}
                    </td>

                    {/* Day's P&L */}
                    <td
                      className={`px-3 py-2 ${
                        m.daysPnL >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {fmt(m.daysPnL)}
                    </td>

                    {/* Pricing */}
                    <td className="px-3 py-2 text-blue-700">{fmt(m.last)}</td>
                    <td className="px-3 py-2">{fmt(m.entry)}</td>
                    <td className="px-3 py-2">{fmt(m.totalCost)}</td>

                    {/* Metrics */}
                    <td className="px-3 py-2">
                      {pos.cumulativeBreakEven != null ? (
                        <div className="flex flex-col leading-tight">
                          <span className="font-semibold text-purple-700">
                            ${pos.cumulativeBreakEven.toFixed(2)}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            Roll-adjusted BE
                          </span>
                        </div>
                      ) : m.breakEven ? (
                        `$${m.breakEven.toFixed(2)}`
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {m.maxProfit ? fmt(m.maxProfit) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {m.maxLoss ? fmt(m.maxLoss) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {m.revenue ? pct(m.revenue) : "—"}
                    </td>
                  </tr>

                  {/* === LEGS === */}
                  {pos.legs?.map((leg, i) => {
                    const lm = calculateLegMetrics(leg);
                    return (
                      <tr
                        key={i}
                        className="bg-gray-50 text-[14px] text-gray-700"
                      >
                        <td></td>
                        <td className="px-3 py-1">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                            {leg.action}
                          </div>
                        </td>
                        <td className="px-3 py-1">
                          {leg.optionType} ${leg.strike} · Exp:{" "}
                          {fmtDateYYYYMMDD(leg.expiration)}
                        </td>
                        <td className="px-3 py-1">{lm.qty}</td>
                        <td className="px-3 py-1 text-gray-700">
                          {fmt(lm.marketValue)}
                        </td>
                        <td
                          className={`px-3 py-1 ${
                            lm.pnl >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {fmt(lm.pnl)}
                        </td>
                        <td
                          className={`px-3 py-1 ${
                            lm.pnlPct >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {pct(lm.pnlPct)}
                        </td>
                        <td
                          className={`px-3 py-1 ${
                            lm.daysPnL >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {fmt(lm.daysPnL)}
                        </td>
                        <td className="px-3 py-1 text-blue-700">
                          {fmt(lm.last)}
                        </td>
                        <td className="px-3 py-1">{fmt(lm.entry)}</td>
                        <td className="px-3 py-1">{fmt(lm.totalCost)}</td>
                      </tr>
                    );
                  })}

                  {/* === GREEKS RESUMEN POR POSICIÓN === */}
                  <tr className="bg-white text-xs text-gray-600 italic">
                    <td></td>
                    <td colSpan={14} className="px-3 py-2">
                      {(() => {
                        // ✅ Cálculo correcto de Delta / Theta con signos reales
                        const calcGreek = (key, decimals = 5) => {
                          let total = 0;

                          (pos.legs || []).forEach((leg) => {
                            const greeks = leg.greeks || {};
                            const val = parseFloat(greeks[key]);
                            const qty = parseFloat(leg.quantity ?? 1);
                            if (isNaN(val)) return;

                            const action = (leg.action || "").toLowerCase();
                            const type = (leg.optionType || "").toLowerCase();

                            let sign = 0;

                            // Call BUY = +, Call SELL = -, Put BUY = -, Put SELL = +
                            if (type === "call" && action.includes("buy"))
                              sign = +1;
                            if (type === "call" && action.includes("sell"))
                              sign = -1;
                            if (type === "put" && action.includes("buy"))
                              sign = -1;
                            if (type === "put" && action.includes("sell"))
                              sign = +1;

                            total += val * qty * sign;
                          });

                          return Math.abs(total).toFixed(4);
                        };

                        // ✅ Impl. Vol. promedio ponderada correctamente
                        const avgIV = () => {
                          let totalIV = 0;
                          let totalQty = 0;

                          (pos.legs || []).forEach((leg) => {
                            const iv = parseFloat(leg.impliedVolatility);
                            const qty = Math.abs(parseFloat(leg.quantity ?? 1));
                            if (!isNaN(iv)) {
                              totalIV += iv * qty;
                              totalQty += qty;
                            }
                          });

                          if (totalQty === 0) return "—";
                          return (totalIV / totalQty).toFixed(2) + "%";
                        };

                        return (
                          <div className="flex gap-6 text-sm text-gray-600 italic px-3 py-1">
                            <span>Delta: {calcGreek("delta")}</span>
                            <span>Theta: {calcGreek("theta")}</span>
                            <span>Impl. Vol.: {avgIV()}</span>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>    
  );
}

export default Positions;
