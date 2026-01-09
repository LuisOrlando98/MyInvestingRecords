// src/pages/Positions.jsx
import React, { useEffect, useState, useMemo } from "react";
import { XCircle, MoreVertical } from "lucide-react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { buildOptionarUrlFromPosition } from "../utils/optionarLink";
import { Eye } from "lucide-react"; // icono profesional
import { useQuotes } from "../store/QuoteStore";

// 🧮 Utils centralizados
import {
  calculatePositionMetrics,
  calculateLegMetrics,
  fmtUSD as fmt,
  fmtPct as pct,
  earliestExp,
} from "../utils/positionUtils";
import { mergeLiveQuotesIntoPosition } from "../utils/mergeLiveQuotes";

// ⚡ Hook de cotizaciones Tradier

// 🏦 Íconos por broker
import { brokerIcons } from "../utils/brokerIcons";

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
  const navigate = useNavigate();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
   // 📡 Quotes globales (stocks + options)
  const { optionQuotes, trackOptionLegs } = useQuotes();

  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [showRollModal, setShowRollModal] = useState(false);
  const [rollingPosition, setRollingPosition] = useState(null);

  // ===== FILTERS (like Performance) =====
  const [symbolFilter, setSymbolFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // === 1️⃣ Cargar posiciones desde el backend ===
  const fetchPositions = async (includeArchived = false) => {
    try {
      const res = await api.get("/api/positions", {
        params: { includeArchived },
      });

      setPositions(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (e) {
      console.error("Error loading positions", e);
    } finally {
      setLoading(false);
    }
  };
  
  // 🎯 Trackear legs de opciones en el QuoteStore (UNA SOLA VEZ por cambio)
  useEffect(() => {
    if (!positions.length) return;

    trackOptionLegs(
      positions.filter((p) => p.status === "Open")
    );
  }, [positions, trackOptionLegs]);
  

  useEffect(() => {
    fetchPositions(showArchived);
  }, [showArchived]);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);
  
  const livePositionsMap = useMemo(() => {
    const map = new Map();

    positions.forEach((pos) => {
      if (pos.status !== "Open") {
        map.set(pos._id, pos);
        return;
      }

      const merged = mergeLiveQuotesIntoPosition(pos, optionQuotes);
      map.set(pos._id, merged);
    });

    return map;
  }, [positions, optionQuotes]);

  // === 4️⃣ Ordenar posiciones por expiración ===
  const sortedPositions = useMemo(() => {
    return [...positions].sort(
      (a, b) =>
        new Date(a.legs?.[0]?.expiration || 0) -
        new Date(b.legs?.[0]?.expiration || 0)
    );
  }, [positions]);

  // ✅ OJO: ESTE useMemo DEBE IR ANTES DEL "return loading" (Rules of Hooks)
  // 💰 Total Open P&L en vivo
  const totalOpenPnL = useMemo(() => {
    return sortedPositions
      .filter((p) => p.status === "Open")
      .reduce((sum, p) => {
        const m = livePositionsMap.get(p._id)
          ? calculatePositionMetrics(livePositionsMap.get(p._id))
          : calculatePositionMetrics(p);
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
      const m = livePositionsMap.get(p._id)
        ? calculatePositionMetrics(livePositionsMap.get(p._id))
        : calculatePositionMetrics(p);
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

  const filteredPositions = useMemo(() => {
    return sortedPositions.filter((p) => {
      // 🔤 Symbol
      if (
        symbolFilter &&
        !p.symbol?.toUpperCase().includes(symbolFilter.toUpperCase())
      ) {
        return false;
      }

      // 📌 Status (Open / Closed / Rolled ONLY)
      if (statusFilter !== "ALL" && p.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [sortedPositions, symbolFilter, statusFilter]);

  // ======================================================
  //      PRECALCULAR POSICIONES CON QUOTES LIVE
  // ======================================================
  
  if (loading)
    return (
      <p className="text-center mt-8 text-gray-500">Loading positions...</p>
    );
  
  const handleDelete = async (id) => {
    const confirmText =
      "DELETE this position permanently?\n\nThis action CANNOT be undone.";

    if (!window.confirm(confirmText)) return;

    try {
      await api.delete(`/api/positions/${id}`);
      fetchPositions(showArchived);
      setOpenMenuId(null);
    } catch (err) {
      console.error("Error deleting position", err);
      alert("Error deleting position");
    }
  };
  
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

              {/* Divider */}
              <span className="h-6 w-px bg-gray-300"></span>

              <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-gray-100 border">
                <input
                  id="showArchived"
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="accent-blue-600"
                />
                <label
                  htmlFor="showArchived"
                  className="text-sm text-gray-700 cursor-pointer"
                >
                  Include archived
                </label>
              </div>

              {/* Divider */}
              <span className="h-6 w-px bg-gray-300"></span>

              {/* ===== FILTER BAR (COMPACT) ===== */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border rounded-full">

              {/* Symbol */}
              <input
                placeholder="Symbol"
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value.toUpperCase())}
                className="h-8 w-24 border rounded-full px-3 text-xs
                          focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 border rounded-full px-3 text-xs bg-white"
              >
                <option value="ALL">All</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="Rolled">Rolled</option>
              </select>

              {(symbolFilter || statusFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSymbolFilter("");
                    setStatusFilter("ALL");
                  }}
                  className="text-[11px] text-gray-400 hover:text-gray-700 ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* RIGHT — Button */}
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            onClick={() => navigate("/positions/new")}
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
              <th>Premium</th>
              <th>Max Profit</th>
              <th>Max Loss</th>
              <th>Revenue</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {filteredPositions.map((pos) => {           
            const posWithLiveLegs = livePositionsMap.get(pos._id) || pos;
            const m = pos.status === "Open"
              ? calculatePositionMetrics(posWithLiveLegs)
              : {};
              const exp = earliestExp(posWithLiveLegs.legs);
              const brokerName = (pos.broker || "").trim();
              const isRolledIn = pos.status === "Open" && pos.rolledFrom;
              
              return (
                <React.Fragment key={pos._id}>
                  {/* === MAIN ROW (Double-Click to Edit) === */}
                  <tr
                    onDoubleClick={() => navigate(`/positions/${pos._id}/edit`)}                   
                    className={`relative transition cursor-pointer ${
                      pos.status === "Closed"
                        ? "bg-gray-100 text-gray-500 border-l-4 border-gray-300"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {/* Action */}
                    <td className="w-[42px] relative opacity-100">
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
                        {openMenuId === pos._id && (
                          <div
                            className="fixed z-50 w-44 bg-white border rounded-md shadow-lg text-sm"
                            style={{ top: menuPos.y, left: menuPos.x }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* ✏️ EDIT */}
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                navigate(`/positions/${openMenuId}/edit`);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100"
                            >
                              ✏️ Edit
                            </button>

                            {/* ❌ CLOSE */}
                            {pos.status === "Open" && (
                              <button
                                onClick={async () => {
                                  const value = prompt("Enter exit price to close the position:");
                                  if (!value) return;

                                  const exitPrice = parseFloat(value);
                                  if (isNaN(exitPrice)) {
                                    alert("Invalid number");
                                    return;
                                  }

                                  try {
                                    await api.put(`/api/positions/${openMenuId}/close`, {
                                      exitPrice,
                                    });
                                    fetchPositions(showArchived);
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

                            {/* 🔁 ROLL */}
                            {pos.status === "Open" && (
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  navigate(`/positions/${pos._id}/edit?roll=true`);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-purple-600"
                              >
                                🔁 Roll
                              </button>
                            )}

                            {/* 🗂️ ARCHIVE */}
                            <button
                              onClick={async () => {
                                if (!window.confirm("Archive this position?")) return;

                                try {
                                  await api.put(`/api/positions/${openMenuId}/archive`);
                                  fetchPositions(showArchived);
                                  setOpenMenuId(null);
                                } catch {
                                  alert("Error archiving position");
                                }
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-600"
                            >
                              🗂️ Archive
                            </button>

                            {/* 🧨 DELETE — SIEMPRE DISPONIBLE */}
                            <button
                              onClick={() => {
                                const confirmText =
                                  pos.status === "Open"
                                    ? "DELETE this OPEN position permanently?\n\nThis will remove ALL history and cashflows.\n\nThis action CANNOT be undone."
                                    : "DELETE this position permanently?\n\nThis action CANNOT be undone.";

                                if (!window.confirm(confirmText)) return;

                                handleDelete(openMenuId);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 border-t"
                            >
                              🧨 Delete permanently
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
                        pos.status === "Closed"
                          ? pos.realizedReturnPct >= 0
                            ? "text-green-600"
                            : "text-red-600"
                          : m.openPnLPct >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {pos.status === "Closed"
                        ? pct(pos.realizedReturnPct)
                        : pct(m.openPnLPct)}
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
                            Total Premium (after roll)
                          </span>
                        </div>
                      ) : pos.netPremium != null ? (
                        <span className="font-medium text-gray-800">
                          ${pos.netPremium.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {m.maxProfit ? fmt(m.maxProfit) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {m.maxLoss ? fmt(m.maxLoss) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {pos.status === "Open" && m.revenue != null ? (
                        <span
                          className={m.revenue >= 0 ? "text-green-600" : "text-red-600"}
                        >
                          {pct(m.revenue)}
                        </span>
                      ) : pos.status === "Closed" &&
                        m.maxLoss &&
                        pos.realizedPnL != null ? (
                        <span
                          className={
                            pos.realizedPnL >= 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {pct((pos.realizedPnL / m.maxLoss) * 100)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>

                  {/* === LEGS === */}
                  {posWithLiveLegs.legs?.map((leg, i) => {
                    
                    const liveLeg = posWithLiveLegs.legs?.[i] || leg;

                    const lm = calculateLegMetrics(liveLeg);
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

                          (posWithLiveLegs.legs || []).forEach((leg) => {
                            const occ = leg.occSymbol;

                            const greeks = {
                              delta: leg.greeks?.delta,
                              theta: leg.greeks?.theta,
                            };
                            
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
