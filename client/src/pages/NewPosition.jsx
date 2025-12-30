// ==============================
// NewPosition.jsx — PART 1 / 3
// Core + State + Data loaders + OCC + Base legs + Quotes + Backend validation
// ==============================

// ==============================================
// NEW POSITION — WEBULL PRO VERSION (PER-LEG PREMIUM)
// ==============================================

import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

import {
  fetchExpirations,
  fetchChains,
  fetchUnderlyingQuote,
  fetchOptionQuotesByLegs,
} from "../services/tradierService";

import { brokerIcons } from "../utils/brokerIcons";

// ==============================================
// STRATEGY KEYS — MUST MATCH BACKEND VALIDATOR
// (Backend expects lowercase keys like: "put credit spread")
// ==============================================
const STRATEGIES = {
  STOCK: "stock",
  CSP: "cash secured put",
  CC: "covered call",

  PCS: "put credit spread",
  CCS: "call credit spread",
  PDS: "put debit spread",
  CDS: "call debit spread",

  IC: "iron condor",
  STRADDLE: "straddle",
  STRANGLE: "strangle",
  BUTTERFLY: "butterfly",
};

// ==============================================
// MAIN COMPONENT
// ==============================================
export default function NewPosition() {
  const navigate = useNavigate();

  // --------- GENERAL STATES ---------
  const [symbol, setSymbol] = useState("");
  const [broker, setBroker] = useState("");
  const [strategy, setStrategy] = useState(""); // should store lowercase key (from STRATEGIES)
  const [expiration, setExpiration] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const [expirations, setExpirations] = useState([]);
  const [chain, setChain] = useState({ strikes: [], calls: [], puts: [] });
  const [underlying, setUnderlying] = useState(null);

  const [quotes, setQuotes] = useState({});
  const [finalLegs, setFinalLegs] = useState([]);

  const [strategyError, setStrategyError] = useState("");
  const [validatingStrategy, setValidatingStrategy] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // --------- STRIKES ---------
  const [strikeA, setStrikeA] = useState("");
  const [strikeB, setStrikeB] = useState("");
  const [strikeC, setStrikeC] = useState("");
  const [strikeD, setStrikeD] = useState("");

  // ==============================================
  // LOAD EXPIRATIONS + SPOT
  // ==============================================
  useEffect(() => {
    if (!symbol.trim()) {
      setExpirations([]);
      setUnderlying(null);
      return;
    }

    const load = async () => {
      try {
        const s = symbol.trim().toUpperCase();
        const [exp, spot] = await Promise.all([
          fetchExpirations(s),
          fetchUnderlyingQuote(s),
        ]);
        setExpirations(exp || []);
        setUnderlying(spot ?? null);
      } catch (err) {
        console.error(err);
      }
    };

    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [symbol]);

  // ==============================================
  // LOAD OPTION CHAIN
  // ==============================================
  useEffect(() => {
    if (!symbol || !expiration) {
      setChain({ strikes: [], calls: [], puts: [] });
      return;
    }

    const load = async () => {
      try {
        const data = await fetchChains(symbol.toUpperCase(), expiration);
        setChain(data);
      } catch (err) {
        console.error(err);
      }
    };

    load();
  }, [symbol, expiration]);

  // ==============================================
  // OCC BUILDER
  // ==============================================
  const buildOccSymbol = (sym, exp, strike, type) => {
    const cleanExp = exp.replace(/-/g, "").slice(2); // YYMMDD
    const cp = type === "Call" ? "C" : "P";
    const strikeStr = String(Math.round(Number(strike) * 1000)).padStart(8, "0");
    return `${sym}${cleanExp}${cp}${strikeStr}`;
  };

  const occ = (strike, type) => {
    const sym = symbol.trim().toUpperCase();
    return buildOccSymbol(sym, expiration, strike, type);
  };

  // ==============================================
  // BASE LEGS (NO PREMIUM) — BUILDER BY STRATEGY
  // strategy is expected as LOWERCASE KEY (STRATEGIES.* values)
  // ==============================================
  const legs = useMemo(() => {
    if (!strategy || !expiration || !symbol) return [];

    const q = Number(quantity) || 1;

    // STOCK (optional support)
    if (strategy === STRATEGIES.STOCK) {
      return [{ type: "stock", action: "Buy", quantity: q }];
    }

    // CASH SECURED PUT
    if (strategy === STRATEGIES.CSP && strikeA) {
      return [
        {
          action: "Sell to Open",
          optionType: "Put",
          strike: Number(strikeA),
          expiration,
          quantity: q,
          occSymbol: occ(strikeA, "Put"),
        },
      ];
    }

    // COVERED CALL
    if (strategy === STRATEGIES.CC && strikeA) {
      return [
        {
          action: "Sell to Open",
          optionType: "Call",
          strike: Number(strikeA),
          expiration,
          quantity: q,
          occSymbol: occ(strikeA, "Call"),
        },
      ];
    }

    // VERTICALS (2 legs)
    const isVertical =
      [STRATEGIES.PCS, STRATEGIES.CCS, STRATEGIES.PDS, STRATEGIES.CDS].includes(strategy) &&
      strikeA &&
      strikeB;

    if (isVertical) {
      const hi = Math.max(+strikeA, +strikeB);
      const lo = Math.min(+strikeA, +strikeB);

      // PUT CREDIT: STO higher PUT, BTO lower PUT
      if (strategy === STRATEGIES.PCS) {
        return [
          {
            action: "Sell to Open",
            optionType: "Put",
            strike: hi,
            expiration,
            quantity: q,
            occSymbol: occ(hi, "Put"),
          },
          {
            action: "Buy to Open",
            optionType: "Put",
            strike: lo,
            expiration,
            quantity: q,
            occSymbol: occ(lo, "Put"),
          },
        ];
      }

      // CALL CREDIT: STO lower CALL, BTO higher CALL
      if (strategy === STRATEGIES.CCS) {
        return [
          {
            action: "Sell to Open",
            optionType: "Call",
            strike: lo,
            expiration,
            quantity: q,
            occSymbol: occ(lo, "Call"),
          },
          {
            action: "Buy to Open",
            optionType: "Call",
            strike: hi,
            expiration,
            quantity: q,
            occSymbol: occ(hi, "Call"),
          },
        ];
      }

      // PUT DEBIT: BTO higher PUT, STO lower PUT
      if (strategy === STRATEGIES.PDS) {
        return [
          {
            action: "Buy to Open",
            optionType: "Put",
            strike: hi,
            expiration,
            quantity: q,
            occSymbol: occ(hi, "Put"),
          },
          {
            action: "Sell to Open",
            optionType: "Put",
            strike: lo,
            expiration,
            quantity: q,
            occSymbol: occ(lo, "Put"),
          },
        ];
      }

      // CALL DEBIT: BTO lower CALL, STO higher CALL
      if (strategy === STRATEGIES.CDS) {
        return [
          {
            action: "Buy to Open",
            optionType: "Call",
            strike: lo,
            expiration,
            quantity: q,
            occSymbol: occ(lo, "Call"),
          },
          {
            action: "Sell to Open",
            optionType: "Call",
            strike: hi,
            expiration,
            quantity: q,
            occSymbol: occ(hi, "Call"),
          },
        ];
      }
    }

    // IRON CONDOR (4 legs) — strikeA/B = put side, strikeC/D = call side
    if (
      strategy === STRATEGIES.IC &&
      strikeA &&
      strikeB &&
      strikeC &&
      strikeD
    ) {
      const putHi = Math.max(+strikeA, +strikeB);
      const putLo = Math.min(+strikeA, +strikeB);
      const callLo = Math.min(+strikeC, +strikeD);
      const callHi = Math.max(+strikeC, +strikeD);

      return [
        {
          action: "Sell to Open",
          optionType: "Put",
          strike: putHi,
          expiration,
          quantity: q,
          occSymbol: occ(putHi, "Put"),
        },
        {
          action: "Buy to Open",
          optionType: "Put",
          strike: putLo,
          expiration,
          quantity: q,
          occSymbol: occ(putLo, "Put"),
        },
        {
          action: "Sell to Open",
          optionType: "Call",
          strike: callLo,
          expiration,
          quantity: q,
          occSymbol: occ(callLo, "Call"),
        },
        {
          action: "Buy to Open",
          optionType: "Call",
          strike: callHi,
          expiration,
          quantity: q,
          occSymbol: occ(callHi, "Call"),
        },
      ];
    }

    // STRADDLE (2 legs same strike): default LONG straddle (BTO call + BTO put)
    if (strategy === STRATEGIES.STRADDLE && strikeA) {
      return [
        {
          action: "Buy to Open",
          optionType: "Call",
          strike: Number(strikeA),
          expiration,
          quantity: q,
          occSymbol: occ(strikeA, "Call"),
        },
        {
          action: "Buy to Open",
          optionType: "Put",
          strike: Number(strikeA),
          expiration,
          quantity: q,
          occSymbol: occ(strikeA, "Put"),
        },
      ];
    }

    // STRANGLE (2 legs different strikes): default LONG strangle (BTO put lower + BTO call higher)
    if (strategy === STRATEGIES.STRANGLE && strikeA && strikeB) {
      const lo = Math.min(+strikeA, +strikeB);
      const hi = Math.max(+strikeA, +strikeB);

      return [
        {
          action: "Buy to Open",
          optionType: "Put",
          strike: lo,
          expiration,
          quantity: q,
          occSymbol: occ(lo, "Put"),
        },
        {
          action: "Buy to Open",
          optionType: "Call",
          strike: hi,
          expiration,
          quantity: q,
          occSymbol: occ(hi, "Call"),
        },
      ];
    }

    // BUTTERFLY (3 legs) — default CALL butterfly (BTO low, STO 2x middle, BTO high)
    if (strategy === STRATEGIES.BUTTERFLY && strikeA && strikeB && strikeC) {
      return [
        {
          action: "Buy to Open",
          optionType: "Call",
          strike: Number(strikeA),
          expiration,
          quantity: q,
          occSymbol: occ(strikeA, "Call"),
        },
        {
          action: "Sell to Open",
          optionType: "Call",
          strike: Number(strikeB),
          expiration,
          quantity: q * 2,
          occSymbol: occ(strikeB, "Call"),
        },
        {
          action: "Buy to Open",
          optionType: "Call",
          strike: Number(strikeC),
          expiration,
          quantity: q,
          occSymbol: occ(strikeC, "Call"),
        },
      ];
    }

    return [];
  }, [strategy, strikeA, strikeB, strikeC, strikeD, symbol, expiration, quantity]);

  // ==============================================
  // LOAD QUOTES (Tradier per leg)
  // ==============================================
  useEffect(() => {
    if (!legs.length) {
      setQuotes({});
      return;
    }

    fetchOptionQuotesByLegs(legs)
      .then((q) => setQuotes(q || {}))
      .catch((err) => {
        console.error(err);
        setQuotes({});
      });
  }, [legs]);

  // ==============================================
  // BACKEND STRATEGY VALIDATION
  // Shows user-friendly guide if backend returns { guide }
  // ==============================================
  useEffect(() => {
    if (!strategy || !finalLegs.length) {
      setStrategyError("");
      return;
    }

    // wait until all options legs have numeric premium
    const ready = finalLegs.every((l) => {
      if (!l.optionType) return true; // ignore stock
      return l.premium !== "" && Number.isFinite(Number(l.premium));
    });

    if (!ready) {
      setStrategyError("");
      return;
    }

    setValidatingStrategy(true);

    axios
      .post("/api/positions/validate", {
        strategy, // already lowercase key
        legs: finalLegs.map((l) => ({
          ...l,
          premium: Number(l.premium),
          // IMPORTANT: backend validator expects optionType in lowercase ("call"/"put")
          optionType: l.optionType ? String(l.optionType).toLowerCase() : l.optionType,
        })),
      })
      .then(() => {
        setStrategyError("");
      })
      .catch((err) => {
        const msg = err?.response?.data?.error;
        const guide = err?.response?.data?.guide;

        if (guide) {
          // guide = { example, rules: [] }
          setStrategyError(
            `${msg || "Invalid strategy"}\n\n` +
              `Example: ${guide.example}\n` +
              `Rules:\n• ${guide.rules.join("\n• ")}`
          );
        } else {
          setStrategyError(msg || "Invalid strategy");
        }
      })
      .finally(() => setValidatingStrategy(false));
  }, [strategy, finalLegs]);

  // ==============================
  // (metrics + risk curve + save + UI) in PART 2/3 and PART 3/3
  // ==============================

  // ==============================================
  // METRICS ENGINE — uses finalLegs (WITH premium)
  // ==============================================
  const metrics = useMemo(() => {
    if (!finalLegs.length || !strategy) return null;
    if (strategyError) return null;

    const S = strategy;

    // contracts (Webull-like): base on first leg qty
    const contracts = Math.max(1, Math.abs(Number(finalLegs?.[0]?.quantity || 1)));

    // ===== NET (CREDIT / DEBIT) — total dollars
    let net = 0;
    finalLegs.forEach((leg) => {
      if (!leg.optionType) return;
      const premium = Number(leg.premium ?? 0);
      const qty = Number(leg.quantity || 1);
      const sign = leg.action === "Sell to Open" ? +1 : -1;
      net += premium * 100 * qty * sign;
    });

    const credit = net > 0 ? net : 0;
    const debit = net < 0 ? Math.abs(net) : 0;

    // ===== GREEKS & IV (weighted by |delta|)
    let totalDelta = 0;
    let totalTheta = 0;
    let ivWeighted = 0;
    let ivWeightTotal = 0;

    finalLegs.forEach((leg) => {
      if (!leg.occSymbol) return;
      const q = quotes[leg.occSymbol];
      if (!q) return;

      const delta = Number(q.delta ?? 0);
      const theta = Number(q.theta ?? 0);
      const iv = Number(q.impliedVol ?? 0); // already percent
      const qtyL = Number(leg.quantity || 1);

      // Sell flips exposure
      const action = String(leg.action || "").toLowerCase();
      const sideSign = action.includes("sell") ? -1 : +1;

      totalDelta += delta * qtyL * sideSign;
      totalTheta += theta * qtyL * sideSign;

      const weight = Math.abs(delta) * qtyL;
      if (weight > 0 && iv > 0) {
        ivWeighted += iv * weight;
        ivWeightTotal += weight;
      }
    });

    const ivFinal = ivWeightTotal > 0 ? ivWeighted / ivWeightTotal : 0;

    // ===== SPREAD WIDTH
    let width = null;

    const strikes = finalLegs
      .filter((l) => l.optionType)
      .map((l) => Number(l.strike))
      .filter((s) => Number.isFinite(s));

    const isVerticalSpread =
      S === STRATEGIES.PCS ||
      S === STRATEGIES.PDS ||
      S === STRATEGIES.CCS ||
      S === STRATEGIES.CDS;

    if (isVerticalSpread && strikes.length >= 2) {
      width = (Math.max(...strikes) - Math.min(...strikes)) * 100 * contracts;
    }

    if (S === STRATEGIES.IC) {
      const puts = finalLegs
        .filter((l) => String(l.optionType) === "Put")
        .map((l) => Number(l.strike))
        .filter(Number.isFinite);

      const calls = finalLegs
        .filter((l) => String(l.optionType) === "Call")
        .map((l) => Number(l.strike))
        .filter(Number.isFinite);

      if (puts.length >= 2 && calls.length >= 2) {
        const putWidth = (Math.max(...puts) - Math.min(...puts)) * 100 * contracts;
        const callWidth = (Math.max(...calls) - Math.min(...calls)) * 100 * contracts;
        width = Math.min(putWidth, callWidth);
      }
    }

    // ===== MAX PROFIT / LOSS
    let maxProfit = null;
    let maxLoss = null;

    if (S.includes("credit") || S === STRATEGIES.IC) {
      maxProfit = Math.max(net, 0);
      maxLoss = width !== null ? Math.max(width - net, 0) : null;
    } else if (S.includes("debit")) {
      maxLoss = debit;
      maxProfit = width !== null ? Math.max(width - debit, 0) : null;
    }

    // ===== BREAKEVENS
    let breakeven = null;

    if (S === STRATEGIES.PCS && strikes.length >= 2) {
      const short = Math.max(...strikes);
      breakeven = short - net / (100 * contracts);
    }

    if (S === STRATEGIES.CCS && strikes.length >= 2) {
      const short = Math.min(...strikes);
      breakeven = short + net / (100 * contracts);
    }

    if (S === STRATEGIES.PDS && strikes.length >= 2) {
      const long = Math.min(...strikes);
      breakeven = long - debit / (100 * contracts);
    }

    if (S === STRATEGIES.CDS && strikes.length >= 2) {
      const long = Math.max(...strikes);
      breakeven = long + debit / (100 * contracts);
    }

    if (S === STRATEGIES.IC) {
      const putShort = Math.max(Number(strikeA), Number(strikeB));
      const callShort = Math.min(Number(strikeC), Number(strikeD));

      breakeven = {
        put: putShort - net / (100 * contracts),
        call: callShort + net / (100 * contracts),
      };
    }

    // Net premium per-share (nice to store, not *100)
    const netPremiumPerShare = net / (100 * contracts);

    return {
      contracts,
      net,
      credit,
      debit,
      width,
      maxProfit,
      maxLoss,
      breakeven,
      delta: totalDelta,
      theta: totalTheta,
      iv: ivFinal,
      netPremiumPerShare,
    };
  }, [finalLegs, quotes, strategy, strategyError, strikeA, strikeB, strikeC, strikeD]);

  const save = useMemo(
    () =>
      savePositionFactory({
        symbol,
        broker,
        strategy,
        notes,
        finalLegs,
        metrics,
        strategyError,
        setError,
        setSaving,
        navigate,
      }),
    [
      symbol,
      broker,
      strategy,
      notes,
      finalLegs,
      metrics,
      strategyError,
      navigate,
    ]
  );

  return (
    <NewPositionReturn
      symbol={symbol}
      setSymbol={setSymbol}
      broker={broker}
      setBroker={setBroker}
      strategy={strategy}
      setStrategy={setStrategy}
      expiration={expiration}
      setExpiration={setExpiration}
      expirations={expirations}
      quantity={quantity}
      setQuantity={setQuantity}
      notes={notes}
      setNotes={setNotes}
      underlying={underlying}
      error={error}

      chain={chain}
      strikeA={strikeA}
      setStrikeA={setStrikeA}
      strikeB={strikeB}
      setStrikeB={setStrikeB}
      strikeC={strikeC}
      setStrikeC={setStrikeC}
      strikeD={strikeD}
      setStrikeD={setStrikeD}
      legs={legs}
      quotes={quotes}
      setFinalLegs={setFinalLegs}
      strategyError={strategyError}

      metrics={metrics}
      saving={saving}
      save={save}
      validatingStrategy={validatingStrategy}
      finalLegs={finalLegs}
      RiskCurve={RiskCurve}
    />
  );
}

// ==============================
// NewPosition.jsx — PART 2 / 3
// Risk curve + Save + Main layout (wiring)
// ==============================

/* eslint-disable no-unused-vars */

// NOTE: This PART assumes it is appended directly after PART 1 inside the same file.
// We replace the temporary `return null;` from PART 1 with the real code below.

// ======================================================================================
// RISK CURVE (WEBULL STYLE)
// ======================================================================================
function buildRiskCurveData(legsIn, metricsIn) {
  if (!legsIn?.length || !metricsIn) return [];

  const optLegs = legsIn.filter(
    (l) => l.optionType && Number.isFinite(Number(l.strike))
  );
  if (!optLegs.length) return [];

  const strikes = optLegs.map((l) => Number(l.strike));
  const minPrice = Math.min(...strikes) - 20;
  const maxPrice = Math.max(...strikes) + 20;

  const steps = 80;
  const data = [];

  for (let i = 0; i <= steps; i++) {
    const price = minPrice + ((maxPrice - minPrice) * i) / steps;

    let payoffOptions = 0;

    optLegs.forEach((leg) => {
      const qty = Number(leg.quantity || 1);
      const sideSign = String(leg.action || "")
        .toLowerCase()
        .includes("sell")
        ? -1
        : +1;

      let legPayoff = 0;

      if (leg.optionType === "Call") {
        legPayoff =
          Math.max(price - Number(leg.strike), 0) * 100 * qty * sideSign;
      } else if (leg.optionType === "Put") {
        legPayoff =
          Math.max(Number(leg.strike) - price, 0) * 100 * qty * sideSign;
      }

      payoffOptions += legPayoff;
    });

    const totalPnL = payoffOptions + metricsIn.net;
    data.push({
      price: Number(price.toFixed(2)),
      pnl: Number(totalPnL.toFixed(2)),
    });
  }

  return data;
}

function RiskCurve({ legs: legsIn, metrics: metricsIn, underlying: underlyingIn }) {
  const data = useMemo(() => buildRiskCurveData(legsIn, metricsIn), [legsIn, metricsIn]);
  if (!data.length) return null;

  const be1 = metricsIn?.breakeven?.put ?? metricsIn?.breakeven ?? null;
  const be2 = metricsIn?.breakeven?.call ?? null;

  const profitY = metricsIn?.maxProfit ?? 0;
  const lossY = metricsIn?.maxLoss != null ? -Math.abs(metricsIn.maxLoss) : 0;

  const prices = data.map((d) => d.price);
  const minX = underlyingIn != null ? Math.min(...prices, underlyingIn) : Math.min(...prices);
  const maxX = underlyingIn != null ? Math.max(...prices, underlyingIn) : Math.max(...prices);

  const pnls = data.map((d) => d.pnl);
  const minY =
    metricsIn?.maxLoss != null
      ? Math.min(...pnls, -Math.abs(metricsIn.maxLoss)) - 50
      : Math.min(...pnls) - 50;

  const maxY =
    metricsIn?.maxProfit != null
      ? Math.max(...pnls, metricsIn.maxProfit) + 50
      : Math.max(...pnls) + 50;

  return (
    <div className="mt-4 h-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 60, right: 40, left: 20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
          <XAxis
            dataKey="price"
            type="number"
            domain={[minX, maxX]}
            fontSize={12}
            stroke="#444"
          />
          <YAxis domain={[minY, maxY]} fontSize={12} stroke="#444" />

          <Tooltip
            formatter={(v) => `$${Number(v).toFixed(2)}`}
            labelFormatter={(p) => `Price: $${p}`}
          />

          <Line type="linear" dataKey="pnl" stroke="#000" strokeWidth={2} dot={false} />

          {/* PROFIT AREA */}
          {metricsIn?.maxProfit != null && (
            <ReferenceArea y1={0} y2={metricsIn.maxProfit} fill="#16a34a" fillOpacity={0.15} />
          )}

          {/* LOSS AREA */}
          {metricsIn?.maxLoss != null && (
            <ReferenceArea y1={-Math.abs(metricsIn.maxLoss)} y2={0} fill="#dc2626" fillOpacity={0.15} />
          )}

          {/* PROFIT LABEL */}
          {metricsIn?.maxProfit != null && (
            <ReferenceLine
              y={profitY}
              stroke="transparent"
              label={{
                value: `↑ +$${metricsIn.maxProfit.toFixed(2)}`,
                position: "insideRight",
                fill: "#16a34a",
                fontSize: 16,
                fontWeight: "bold",
                dy: 25,
                dx: -10,
              }}
            />
          )}

          {/* LOSS LABEL */}
          {metricsIn?.maxLoss != null && (
            <ReferenceLine
              y={lossY}
              stroke="transparent"
              label={{
                value: `↓ -$${Math.abs(metricsIn.maxLoss).toFixed(2)}`,
                position: "insideLeft",
                fill: "#dc2626",
                fontSize: 16,
                fontWeight: "bold",
                dy: -25,
                dx: 10,
              }}
            />
          )}

          {/* BREAK-EVEN */}
          {be1 != null && <ReferenceLine x={be1} stroke="#666" strokeDasharray="6 4" />}

          {be2 != null && (
            <ReferenceLine
              x={be2}
              stroke="#666"
              strokeDasharray="6 4"
              label={{
                value: `BE ${be2.toFixed(2)}`,
                position: "top",
                fill: "#444",
                fontSize: 12,
              }}
            />
          )}

          {/* SPOT PRICE */}
          {underlyingIn != null && (
            <ReferenceLine
              x={underlyingIn}
              stroke="#2563eb"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `Spot $${Number(underlyingIn).toFixed(2)}`,
                position: "top",
                fill: "#2563eb",
                fontSize: 14,
                fontWeight: "bold",
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ======================================================================================
// PATCH BACK INTO NewPosition COMPONENT
// Replace the `return null;` from PART 1 with the block below.
// ======================================================================================

/*
  ====== IMPORTANT ======
  In PART 1, at the very end of `export default function NewPosition() { ... }`,
  you currently have: `return null;`

  Delete that `return null;` and paste everything below INSIDE NewPosition()
  right before the closing `}` of NewPosition().
*/

// ==============================================
// SAVE POSITION
// ==============================================
const savePositionFactory = ({
  symbol,
  broker,
  strategy,
  notes,
  finalLegs,
  metrics,
  strategyError,
  setError,
  setSaving,
  navigate,
}) => {
  return async function save() {
    setSaving(true);
    setError("");

    try {
      if (!metrics) {
        setError("Cannot save: metrics not calculated");
        return;
      }

      if (strategyError) {
        setError(strategyError);
        return;
      }

      const payload = {
        symbol: symbol.trim().toUpperCase(),
        type: "option",
        strategy, // lowercase key
        broker,
        status: "Open",
        openDate: new Date(),
        notes,

        legs: finalLegs.map((l) => ({
          ...l,
          premium: l.premium === "" ? 0 : Number(l.premium),
        })),

        // Webull-style cashflow:
        // net > 0 credit received -> totalCost should be negative (cash in)
        // net < 0 debit paid -> totalCost positive (cash out)
        totalCost: -metrics.net,
        netPremium: metrics.netPremiumPerShare, // per-share (not *100)

        maxProfit: metrics.maxProfit,
        maxLoss: metrics.maxLoss,

        breakEvenLow:
          metrics.breakeven && typeof metrics.breakeven === "number"
            ? metrics.breakeven
            : metrics.breakeven?.put ?? null,

        breakEvenHigh:
          metrics.breakeven && typeof metrics.breakeven === "number"
            ? null
            : metrics.breakeven?.call ?? null,

        revenue: metrics.netPremiumPerShare,
      };

      await axios.post("/api/positions", payload);
      navigate("/positions");
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || "Cannot save");
    } finally {
      setSaving(false);
    }
  };
};

// ======================================================================================
// MAIN LAYOUT (inside NewPosition)
// ======================================================================================

/*
  Inside NewPosition(), after defining `metrics`, add:

  const save = useMemo(() => savePositionFactory({...}), [deps]);

  then return the layout as below.
*/

function NewPositionReturn({
  // Left
  symbol,
  setSymbol,
  broker,
  setBroker,
  strategy,
  setStrategy,
  expiration,
  setExpiration,
  expirations,
  quantity,
  setQuantity,
  notes,
  setNotes,
  underlying,
  error,

  // Builder
  chain,
  strikeA,
  setStrikeA,
  strikeB,
  setStrikeB,
  strikeC,
  setStrikeC,
  strikeD,
  setStrikeD,
  legs,
  quotes,
  setFinalLegs,
  strategyError,

  // Metrics
  metrics,
  saving,
  save,
  validatingStrategy,
  finalLegs,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 p-6"
    >
      <LeftPanel
        symbol={symbol}
        setSymbol={setSymbol}
        broker={broker}
        setBroker={setBroker}
        strategy={strategy}
        setStrategy={setStrategy}
        expiration={expiration}
        setExpiration={setExpiration}
        expirations={expirations}
        quantity={quantity}
        setQuantity={setQuantity}
        notes={notes}
        setNotes={setNotes}
        underlying={underlying}
        error={error}
      />

      <LegBuilder
        chain={chain}
        strategy={strategy}
        strikeA={strikeA}
        setStrikeA={setStrikeA}
        strikeB={strikeB}
        setStrikeB={setStrikeB}
        strikeC={strikeC}
        setStrikeC={setStrikeC}
        strikeD={strikeD}
        setStrikeD={setStrikeD}
        legs={legs}
        quotes={quotes}
        setFinalLegs={setFinalLegs}
        strategyError={strategyError}
      />

      <MetricsPanel
        metrics={metrics}
        saving={saving}
        save={save}
        legs={finalLegs}
        underlying={underlying}
        strategyError={strategyError}
        validatingStrategy={validatingStrategy}
        RiskCurve={RiskCurve}
      />
    </motion.div>
  );
}

// ==============================
// NewPosition.jsx — PART 3 / 3
// UI Components: LeftPanel + LegBuilder + MetricsPanel + helpers
// AND final glue code to make NewPosition compile end-to-end
// ==============================

// ======================================================================================
// LEFT PANEL
// ======================================================================================
function LeftPanel({
  symbol,
  setSymbol,
  broker,
  setBroker,
  strategy,
  setStrategy,
  expiration,
  setExpiration,
  expirations,
  quantity,
  setQuantity,
  notes,
  setNotes,
  underlying,
  error,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white shadow-lg rounded-xl p-6 border border-gray-200"
    >
      <h2 className="text-xl font-semibold mb-4">New Position</h2>

      {error && (
        <div className="bg-red-100 text-red-700 p-2 mb-4 rounded-md text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      <label className="block text-sm font-semibold mb-1">Symbol</label>
      <input
        className="w-full p-2 border rounded-md mb-2"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        placeholder="SPY"
      />
      {underlying != null && (
        <p className="text-xs mb-4 text-gray-600">
          Spot Price: ${Number(underlying).toFixed(2)}
        </p>
      )}

      <label className="block text-sm font-semibold mb-1">Broker</label>
      <select
        className="w-full p-2 border rounded-md mb-3"
        value={broker}
        onChange={(e) => setBroker(e.target.value)}
      >
        <option value="">Select broker</option>
        {Object.keys(brokerIcons).map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      <label className="block text-sm font-semibold mb-1">Strategy</label>
      <select
        className="w-full p-2 border rounded-md mb-3"
        value={strategy}
        onChange={(e) => setStrategy(e.target.value)}
      >
        <option value="">Select strategy</option>

        <option value={STRATEGIES.STOCK}>Stock</option>
        <option value={STRATEGIES.CSP}>Cash Secured Put</option>
        <option value={STRATEGIES.CC}>Covered Call</option>

        <optgroup label="Spreads">
          <option value={STRATEGIES.PCS}>Put Credit Spread</option>
          <option value={STRATEGIES.CCS}>Call Credit Spread</option>
          <option value={STRATEGIES.PDS}>Put Debit Spread</option>
          <option value={STRATEGIES.CDS}>Call Debit Spread</option>
        </optgroup>

        <optgroup label="Neutral / Volatility">
          <option value={STRATEGIES.IC}>Iron Condor</option>
          <option value={STRATEGIES.STRADDLE}>Straddle</option>
          <option value={STRATEGIES.STRANGLE}>Strangle</option>
          <option value={STRATEGIES.BUTTERFLY}>Butterfly</option>
        </optgroup>
      </select>

      <label className="block text-sm font-semibold mb-1">Expiration</label>
      <select
        className="w-full p-2 border rounded-md mb-3"
        value={expiration}
        onChange={(e) => setExpiration(e.target.value)}
      >
        <option value="">Select expiration</option>
        {expirations.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <label className="block text-sm font-semibold mb-1">Quantity</label>
      <input
        type="number"
        min="1"
        className="w-full p-2 border rounded-md mb-3"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value || 1))}
      />

      <label className="block text-sm font-semibold mb-1">Notes</label>
      <textarea
        className="w-full p-2 border rounded-md h-24"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
    </motion.div>
  );
}

// ======================================================================================
// LEG BUILDER — strikes + per-leg premium
// ======================================================================================
function LegBuilder({
  chain,
  strategy,
  strikeA,
  setStrikeA,
  strikeB,
  setStrikeB,
  strikeC,
  setStrikeC,
  strikeD,
  setStrikeD,
  legs,
  quotes,
  setFinalLegs,
  strategyError,
}) {
  const [localLegs, setLocalLegs] = useState([]);

  // ==============================
  // Strike validation warnings (UI only, no auto-fix)
  // ==============================
  const [strikeWarning, setStrikeWarning] = React.useState("");

  React.useEffect(() => {
    setStrikeWarning("");

    const A = Number(strikeA);
    const B = Number(strikeB);
    const C = Number(strikeC);
    const D = Number(strikeD);

    if (!strategy) return;

    // ===== CASH SECURED PUT =====
    if (strategy === STRATEGIES.CSP && strikeA && A <= 0) {
      setStrikeWarning(
        "Cash Secured Put requires a valid put strike.\n\nExample:\nSell Put 60"
      );
    }

    // ===== COVERED CALL =====
    if (strategy === STRATEGIES.CC && strikeA && A <= 0) {
      setStrikeWarning(
        "Covered Call requires a valid call strike.\n\nExample:\nSell Call 65"
      );
    }

    // ===== PUT CREDIT SPREAD =====
    if (strategy === STRATEGIES.PCS && strikeA && strikeB) {
      if (A <= B) {
        setStrikeWarning(
          "Put Credit Spread requires the short put ABOVE the long put.\n\n" +
          "Correct structure (Example):\nSell Put 65 → Buy Put 60"
        );
      }
    }

    // ===== CALL CREDIT SPREAD =====
    if (strategy === STRATEGIES.CCS && strikeA && strikeB) {
      if (A >= B) {
        setStrikeWarning(
          "Call Credit Spread requires the short call BELOW the long call.\n\n" +
          "Correct structure (Example):\nSell Call 60 → Buy Call 65"
        );
      }
    }

    // ===== PUT DEBIT SPREAD =====
    if (strategy === STRATEGIES.PDS && strikeA && strikeB) {
      if (A <= B) {
        setStrikeWarning(
          "Put Debit Spread requires the long put ABOVE the short put.\n\n" +
          "Correct structure (Example):\nBuy Put 65 → Sell Put 60"
        );
      }
    }

    // ===== CALL DEBIT SPREAD =====
    if (strategy === STRATEGIES.CDS && strikeA && strikeB) {
      if (A >= B) {
        setStrikeWarning(
          "Call Debit Spread requires the long call BELOW the short call.\n\n" +
          "Correct structure (Example):\nBuy Call 60 → Sell Call 65"
        );
      }
    }

    // ===== STRADDLE =====
    if (strategy === STRATEGIES.STRADDLE && strikeA && A <= 0) {
      setStrikeWarning(
        "Straddle uses ONE strike for both call and put.\n\n" +
        "Correct structure (Example):\nBuy Call 65 + Buy Put 65"
      );
    }

    // ===== STRANGLE =====
    if (strategy === STRATEGIES.STRANGLE && strikeA && strikeB) {
      if (A >= B) {
        setStrikeWarning(
          "Strangle requires the put strike BELOW the call strike.\n\n" +
          "Correct structure (Example):\nBuy Put 60 + Buy Call 70"
        );
      }
    }

    // ===== BUTTERFLY =====
    if (strategy === STRATEGIES.BUTTERFLY && strikeA && strikeB && strikeC) {
      if (!(A < B && B < C)) {
        setStrikeWarning(
          "Butterfly requires ordered strikes: lower → middle → upper.\n\n" +
          "Correct structure (Example):\nBuy 60 → Sell 65 → Buy 70"
        );
      }
    }

    // ===== IRON CONDOR =====
    if (strategy === STRATEGIES.IC && strikeA && strikeB && strikeC && strikeD) {
      if (!(A > B && C < D)) {
        setStrikeWarning(
          "Iron Condor requires correct ordering on both sides.\n\n" +
          "Put side: Sell 65 → Buy 60\n" +
          "Call side: Sell 70 → Buy 75"
        );
      }
    }
  }, [strategy, strikeA, strikeB, strikeC, strikeD]);

  // re-init local legs whenever base legs change
  useEffect(() => {
    const initialized = (legs || []).map((l) => ({
      ...l,
      premium: l.premium ?? "",
    }));
    setLocalLegs(initialized);
  }, [legs]);

  // push to parent
  useEffect(() => {
    setFinalLegs(localLegs);
  }, [localLegs, setFinalLegs]);

  

  if (!strategy) {
    return (
      <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
        <p className="text-sm text-gray-500">Select a strategy first.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white shadow-lg rounded-xl p-6 border border-gray-200"
    >
      <h3 className="text-lg font-semibold mb-4">Leg Builder</h3>
      {strikeWarning && (
        <div className="mb-4 bg-blue-100 border border-blue-300 text-blue-800 p-3 rounded-md text-sm whitespace-pre-wrap">
          ℹ️ {strikeWarning}
        </div>
      )}

      {strategyError && (
        <div className="mb-4 bg-yellow-100 border border-yellow-300 text-yellow-800 p-3 rounded-md text-sm whitespace-pre-wrap">
          ⚠️ {strategyError}
        </div>
      )}

      {/* STRIKE SELECTS */}
      {strategy === STRATEGIES.CSP && (
        <StrikeSelect
          label="Sell to Open — Put"
          chain={chain}
          value={strikeA}
          onChange={setStrikeA}
        />
      )}

      {strategy === STRATEGIES.CC && (
        <StrikeSelect
          label="Sell to Open — Call"
          chain={chain}
          value={strikeA}
          onChange={setStrikeA}
        />
      )}

      {strategy === STRATEGIES.PCS && (
        <>
          <StrikeSelect
            label="Sell to Open — Higher Put Strike"
            chain={chain}
            value={strikeA}
            onChange={setStrikeA}
          />
          <StrikeSelect
            label="Buy to Open — Lower Put Strike"
            chain={chain}
            value={strikeB}
            onChange={setStrikeB}
          />
        </>
      )}

      {strategy === STRATEGIES.PDS && (
        <>
          <StrikeSelect
            label="Buy to Open — Higher Put Strike"
            chain={chain}
            value={strikeA}
            onChange={setStrikeA}
          />
          <StrikeSelect
            label="Sell to Open — Lower Put Strike"
            chain={chain}
            value={strikeB}
            onChange={setStrikeB}
          />
        </>
      )}

      {strategy === STRATEGIES.CCS && (
        <>
          <StrikeSelect
            label="Sell to Open — Lower Call Strike"
            chain={chain}
            value={strikeA}
            onChange={setStrikeA}
          />
          <StrikeSelect
            label="Buy to Open — Higher Call Strike"
            chain={chain}
            value={strikeB}
            onChange={setStrikeB}
          />
        </>
      )}

      {strategy === STRATEGIES.CDS && (
        <>
          <StrikeSelect
            label="Buy to Open — Lower Call Strike"
            chain={chain}
            value={strikeA}
            onChange={setStrikeA}
          />
          <StrikeSelect
            label="Sell to Open — Higher Call Strike"
            chain={chain}
            value={strikeB}
            onChange={setStrikeB}
          />
        </>
      )}

      {strategy === STRATEGIES.IC && (
        <>
          <StrikeSelect
            label="Sell to Open — Higher Put Strike"
            chain={chain}
            value={strikeA}
            onChange={setStrikeA}
          />
          <StrikeSelect
            label="Buy to Open — Lower Put Strike"
            chain={chain}
            value={strikeB}
            onChange={setStrikeB}
          />
          <StrikeSelect
            label="Sell to Open — Lower Call Strike"
            chain={chain}
            value={strikeC}
            onChange={setStrikeC}
          />
          <StrikeSelect
            label="Buy to Open — Higher Call Strike"
            chain={chain}
            value={strikeD}
            onChange={setStrikeD}
          />
        </>
      )}

      {strategy === STRATEGIES.STRADDLE && (
        <>
          <StrikeSelect
            label="Strike (both Call & Put)"
            chain={chain}
            value={strikeA}
            onChange={setStrikeA}
          />
        </>
      )}

      {strategy === STRATEGIES.STRANGLE && (
        <>
          <StrikeSelect
            label="Lower Strike (Put)"
            chain={chain}
            value={strikeA}
            onChange={setStrikeA}
          />
          <StrikeSelect
            label="Higher Strike (Call)"
            chain={chain}
            value={strikeB}
            onChange={setStrikeB}
          />
        </>
      )}

      {strategy === STRATEGIES.BUTTERFLY && (
        <>
          <StrikeSelect
            label="Lower Strike (Buy Call)"
            chain={chain}
            value={strikeA}
            onChange={setStrikeA}
          />
          <StrikeSelect
            label="Middle Strike (Sell 2 Calls)"
            chain={chain}
            value={strikeB}
            onChange={setStrikeB}
          />
          <StrikeSelect
            label="Upper Strike (Buy Call)"
            chain={chain}
            value={strikeC}
            onChange={setStrikeC}
          />
        </>
      )}

      {/* LEGS WITH PREMIUM */}
      {localLegs.length > 0 && (
        <div className="mt-4">
          <h4 className="text-base font-semibold mb-2">Legs</h4>

          {localLegs.map((leg, i) => {
            const q = leg.occSymbol ? quotes[leg.occSymbol] : null;

            const mid =
              q && q.bid != null && q.ask != null
                ? ((Number(q.bid) + Number(q.ask)) / 2).toFixed(2)
                : "-";

            const d = q?.delta != null ? Number(q.delta).toFixed(5) : "0.00000";
            const t = q?.theta != null ? Number(q.theta).toFixed(5) : "0.00000";
            const iv =
              q?.impliedVol != null ? Number(q.impliedVol).toFixed(1) : "-";

            return (
              <div
                key={`${leg.occSymbol || "leg"}-${i}`}
                className="p-3 mb-3 border rounded-lg bg-gray-50 shadow-sm"
              >
                <p className="font-medium">
                  {leg.action} •{" "}
                  {leg.optionType ? `${leg.optionType} ${leg.strike}` : "Stock"}
                </p>

                {leg.occSymbol && (
                  <p className="text-[11px] text-gray-600">{leg.occSymbol}</p>
                )}

                {q && (
                  <>
                    <p className="text-xs mt-1 text-gray-700">
                      Bid: {q.bid} • Ask: {q.ask} • Mid: {mid}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-1">
                      Δ {d} · Θ {t} · IV {iv}%
                    </p>
                  </>
                )}

                {/* Premium input only if option */}
                {leg.optionType && (
                  <>
                    <label className="block text-xs font-semibold mt-2">
                      Entry Price (premium)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full p-2 border rounded-md text-sm"
                      placeholder="e.g. 2.15"
                      value={leg.premium}
                      onChange={(e) =>
                        setLocalLegs((prev) => {
                          const copy = [...prev];
                          copy[i] = { ...copy[i], premium: e.target.value };
                          return copy;
                        })
                      }
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ======================================================================================
// METRICS PANEL
// ======================================================================================
function MetricsPanel({
  metrics,
  saving,
  save,
  legs,
  underlying,
  strategyError,
  validatingStrategy,
  RiskCurve,
}) {
  const disableSave = saving || !!strategyError || validatingStrategy || !metrics;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white shadow-lg rounded-xl p-6 border border-gray-200"
    >
      <h3 className="text-lg font-semibold mb-4">Position Metrics</h3>

      {strategyError && (
        <div className="mb-3 bg-yellow-100 border border-yellow-300 text-yellow-800 p-3 rounded-md text-sm whitespace-pre-wrap">
          ⚠️ {strategyError}
        </div>
      )}

      {!metrics ? (
        <p className="text-sm text-gray-500">Complete legs to view metrics.</p>
      ) : (
        <>
          <div className="space-y-3 text-sm">
            <Metric label="Credit Received" value={`$${metrics.credit.toFixed(2)}`} />
            <Metric label="Debit Paid" value={`$${metrics.debit.toFixed(2)}`} />
            <Metric
              label="Net (Credit - Debit)"
              value={`${metrics.net >= 0 ? "+" : ""}$${metrics.net.toFixed(2)}`}
              highlight={metrics.net >= 0 ? "green" : "red"}
            />

            {metrics.width != null && (
              <Metric label="Spread Width" value={`$${metrics.width.toFixed(2)}`} />
            )}

            {metrics.maxProfit != null && (
              <Metric
                label="Max Profit"
                highlight="green"
                value={`$${metrics.maxProfit.toFixed(2)}`}
              />
            )}

            {metrics.maxLoss != null && (
              <Metric
                label="Max Loss"
                highlight="red"
                value={`$${metrics.maxLoss.toFixed(2)}`}
              />
            )}

            {metrics.breakeven && !metrics.breakeven.put && (
              <Metric label="Breakeven" value={`$${metrics.breakeven.toFixed(2)}`} />
            )}

            {metrics.breakeven?.put != null && (
              <>
                <Metric label="BE Put Side" value={`$${metrics.breakeven.put.toFixed(2)}`} />
                <Metric label="BE Call Side" value={`$${metrics.breakeven.call.toFixed(2)}`} />
              </>
            )}

            <div className="pt-3 border-t border-gray-200 space-y-1">
              <Metric label="Delta (position)" value={metrics.delta.toFixed(5)} />
              <Metric label="Theta (per day)" value={metrics.theta.toFixed(5)} />
              <Metric label="Implied Vol (avg)" value={`${metrics.iv.toFixed(1)}%`} />
            </div>
          </div>

          {!strategyError && metrics && (
            <RiskCurve legs={legs} metrics={metrics} underlying={underlying} />
          )}
        </>
      )}

      <button
        onClick={save}
        disabled={disableSave}
        className={`w-full py-2 rounded-lg font-semibold mt-6 ${
          disableSave
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        {saving ? "Saving…" : validatingStrategy ? "Validating…" : "Save Position"}
      </button>
    </motion.div>
  );
}

// ======================================================================================
// SMALL COMPONENTS
// ======================================================================================
function StrikeSelect({ chain, label, value, onChange }) {
  const strikes = chain?.strikes || [];
  return (
    <div className="mb-3">
      <label className="block text-sm font-semibold mb-1">{label}</label>
      <select
        className="w-full p-2 border rounded-md"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select</option>
        {strikes.map((s) => (
          <option key={s} value={s}>
            {Number(s).toFixed(2)}
          </option>
        ))}
      </select>
    </div>
  );
}

function Metric({ label, value, highlight }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span
        className={
          highlight === "green"
            ? "text-green-600 font-semibold"
            : highlight === "red"
            ? "text-red-600 font-semibold"
            : "font-semibold"
        }
      >
        {value}
      </span>
    </div>
  );
}