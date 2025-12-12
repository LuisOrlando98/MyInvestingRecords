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
// MAIN COMPONENT
// ==============================================
export default function NewPosition() {
  const navigate = useNavigate();

  // --------- GENERAL FIELD STATES ---------
  const [symbol, setSymbol] = useState("");
  const [broker, setBroker] = useState("");
  const [strategy, setStrategy] = useState("");
  const [expiration, setExpiration] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const [expirations, setExpirations] = useState([]);
  const [chain, setChain] = useState({ strikes: [], calls: [], puts: [] });
  const [underlying, setUnderlying] = useState(null);

  const [quotes, setQuotes] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // --------- LEG STRIKES ---------
  const [strikeA, setStrikeA] = useState("");
  const [strikeB, setStrikeB] = useState("");
  const [strikeC, setStrikeC] = useState("");
  const [strikeD, setStrikeD] = useState("");

  // Legs con premium (las que se mandan al backend y se usan en métricas)
  const [finalLegs, setFinalLegs] = useState([]);

  // ==============================================
  // LOAD EXPIRATIONS + SPOT PRICE
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
        const [exp, last] = await Promise.all([
          fetchExpirations(s),
          fetchUnderlyingQuote(s),
        ]);
        setExpirations(exp || []);
        setUnderlying(last || null);
      } catch (err) {
        console.error(err);
      }
    };

    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [symbol]);

  // ==============================================
  // LOAD CHAINS FOR EXPIRATION
  // ==============================================
  useEffect(() => {
    if (!symbol.trim() || !expiration) {
      setChain({ strikes: [], calls: [], puts: [] });
      return;
    }

    const loadChains = async () => {
      try {
        const data = await fetchChains(symbol.trim().toUpperCase(), expiration);
        setChain(data);
      } catch (err) {
        console.error(err);
      }
    };

    loadChains();
  }, [symbol, expiration]);

  // ==============================================
  // HELPER: BUILD OCC SYMBOL (DATE FIXED)
  //  YYYY-MM-DD → YYMMDD  | strike → 8 dígitos
  // ==============================================
  const buildOccSymbol = (sym, expirationISO, strike, type) => {
    const cleanExp = expirationISO.replace(/-/g, "").slice(2); // 2025-12-19 → 251219
    const cp = type.toUpperCase() === "CALL" ? "C" : "P";
    const strikeInt = Math.round(Number(strike) * 1000);
    const strikeStr = String(strikeInt).padStart(8, "0");
    return `${sym}${cleanExp}${cp}${strikeStr}`;
  };

  // ==============================================
  // LEGS BUILDER (SIN PREMIUM)
  // ==============================================
  const legs = useMemo(() => {
    if (!strategy || !symbol || !expiration) return [];

    const S = strategy.toLowerCase();
    const q = Number(quantity) || 1;
    const sym = symbol.trim().toUpperCase();
    const occ = (strike, type) => buildOccSymbol(sym, expiration, strike, type);

    // STOCK
    if (S === "stock") {
      return [
        {
          type: "stock",
          action: q > 0 ? "Buy" : "Sell",
          quantity: Math.abs(q),
        },
      ];
    }

    // CASH SECURED PUT
    if (S.includes("cash secured")) {
      if (!strikeA) return [];
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
    if (S.includes("covered call")) {
      if (!strikeA) return [];
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

    // ===== SPREADS =====
    const isVerticalSpread =
      S === "put credit spread" ||
      S === "put debit spread" ||
      S === "call credit spread" ||
      S === "call debit spread";

    if (isVerticalSpread) {
      if (!strikeA || !strikeB) return [];

      const hi = Math.max(Number(strikeA), Number(strikeB));
      const lo = Math.min(Number(strikeA), Number(strikeB));

      if (S === "put credit spread") {
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

      if (S === "put debit spread") {
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

      if (S === "call credit spread") {
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

      if (S === "call debit spread") {
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

    // IRON CONDOR
    if (S.includes("iron condor")) {
      if (!strikeA || !strikeB || !strikeC || !strikeD) return [];

      const putHi = Math.max(Number(strikeA), Number(strikeB));
      const putLo = Math.min(Number(strikeA), Number(strikeB));
      const callLo = Math.min(Number(strikeC), Number(strikeD));
      const callHi = Math.max(Number(strikeC), Number(strikeD));

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

    return [];
  }, [
    strategy,
    strikeA,
    strikeB,
    strikeC,
    strikeD,
    symbol,
    expiration,
    quantity,
  ]);

  // ==============================================
  // LOAD QUOTES FOR LEGS (NO DEPENDEN DE PREMIUM)
  // ==============================================
  useEffect(() => {
    if (!legs.length) {
      setQuotes({});
      return;
    }

    const run = async () => {
      try {
        const q = await fetchOptionQuotesByLegs(legs);
        setQuotes(q || {});
      } catch (err) {
        console.error(err);
      }
    };

    run();
  }, [legs]);

  // ==============================================
  // METRICS ENGINE — USA finalLegs (CON PREMIUM)
  // ==============================================
  const metrics = useMemo(() => {
    if (!finalLegs.length || !strategy) return null;

    const S = strategy.toLowerCase();

    // ===== NET (CREDIT / DEBIT) =====
    let net = 0;
    finalLegs.forEach((leg) => {
      const premium = Number(leg.premium ?? 0);
      const qty = Number(leg.quantity || 1);
      const sign = leg.action === "Sell to Open" ? +1 : -1;
      net += premium * 100 * qty * sign;
    });

    const credit = net > 0 ? net : 0;
    const debit = net < 0 ? Math.abs(net) : 0;

    // ===== GREEKS & IV =====
    let totalDelta = 0;
    let totalTheta = 0;
    let ivWeighted = 0;
    let ivWeightTotal = 0;

    finalLegs.forEach((leg) => {
      const q = quotes[leg.occSymbol];
      if (!q) return;

      const delta = Number(q.delta ?? 0);
      const theta = Number(q.theta ?? 0);
      const iv = Number(q.impliedVol ?? 0); // %

      const qtyL = Number(leg.quantity || 1);
      const action = leg.action.toLowerCase();
      const type = leg.optionType?.toLowerCase();
      let sign = 0;

      if (type === "call" && action.includes("buy")) sign = +1;
      if (type === "call" && action.includes("sell")) sign = -1;
      if (type === "put" && action.includes("buy")) sign = -1;
      if (type === "put" && action.includes("sell")) sign = +1;

      totalDelta += delta * qtyL * sign;
      totalTheta += theta * qtyL * sign;

      const weight = Math.abs(delta) * qtyL;
      if (weight > 0 && iv > 0) {
        ivWeighted += iv * weight;
        ivWeightTotal += weight;
      }
    });

    const ivFinal = ivWeightTotal > 0 ? ivWeighted / ivWeightTotal : 0;

    // ===== SPREAD WIDTH =====
    let width = null;
    const strikes = finalLegs
      .map((l) => l.strike)
      .filter((s) => s !== undefined && s !== null);

    const isVerticalSpread =
      S === "put credit spread" ||
      S === "put debit spread" ||
      S === "call credit spread" ||
      S === "call debit spread";

    if (isVerticalSpread && strikes.length >= 2) {
      width = (Math.max(...strikes) - Math.min(...strikes)) * 100;
    }

    if (S.includes("iron condor")) {
      const puts = finalLegs
        .filter((l) => l.optionType === "Put")
        .map((l) => l.strike);
      const calls = finalLegs
        .filter((l) => l.optionType === "Call")
        .map((l) => l.strike);
      if (puts.length >= 2 && calls.length >= 2) {
        width = Math.min(
          (Math.max(...puts) - Math.min(...puts)) * 100,
          (Math.max(...calls) - Math.min(...calls)) * 100
        );
      }
    }

    // ===== MAX PROFIT / LOSS =====
    let maxProfit = null;
    let maxLoss = null;

    if (S.includes("credit") || S.includes("iron condor")) {
      maxProfit = net;
      maxLoss = width !== null ? width - net : null;
    } else if (S.includes("debit")) {
      maxLoss = debit;
      maxProfit = width !== null ? width - debit : null;
    }

    // ===== BREAKEVENS =====
    let breakeven = null;

    if (S === "put credit spread" && strikes.length >= 2) {
      const short = Math.max(...strikes);
      breakeven = short - net / 100;
    }

    if (S === "call credit spread" && strikes.length >= 2) {
      const short = Math.min(...strikes);
      breakeven = short + net / 100;
    }

    if (S === "put debit spread" && strikes.length >= 2) {
      const long = Math.min(...strikes);
      breakeven = long - debit / 100;
    }

    if (S === "call debit spread" && strikes.length >= 2) {
      const long = Math.max(...strikes);
      breakeven = long + debit / 100;
    }

    if (S.includes("iron condor")) {
      const putShort = Math.max(Number(strikeA), Number(strikeB));
      const callShort = Math.min(Number(strikeC), Number(strikeD));

      breakeven = {
        put: putShort - net / 100,
        call: callShort + net / 100,
      };
    }

    return {
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
    };
  }, [finalLegs, quotes, strategy, strikeA, strikeB, strikeC, strikeD]);

  // ==============================================
  // SAVE POSITION
  // ==============================================
  const save = async () => {
    setSaving(true);
    setError("");

    try {
      if (!metrics) {
        setError("Cannot save: metrics not calculated");
        setSaving(false);
        return;
      }

      const payload = {
        symbol: symbol.trim().toUpperCase(),
        type: "option",
        strategy,
        broker,
        status: "Open",
        openDate: new Date(),
        notes,
        legs: finalLegs,

        totalCost: -metrics.net, // Webull style
        netPremium: metrics.net / 100, // per-share
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
        revenue: metrics.net / 100,
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

  // ==============================================
  // MAIN LAYOUT
  // ==============================================
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
      />

      <MetricsPanel
        metrics={metrics}
        saving={saving}
        save={save}
        legs={finalLegs}
        underlying={underlying}
      />
    </motion.div>
  );
}

/* ======================================================================================
   LEFT PANEL — Symbol, Strategy, Quantity, Notes
====================================================================================== */

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
        <div className="bg-red-100 text-red-700 p-2 mb-4 rounded-md text-sm">
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
      {underlying && (
        <p className="text-xs mb-4 text-gray-600">
          Spot Price: ${underlying.toFixed(2)}
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
          <option key={b}>{b}</option>
        ))}
      </select>

      <label className="block text-sm font-semibold mb-1">Strategy</label>
      <select
        className="w-full p-2 border rounded-md mb-3"
        value={strategy}
        onChange={(e) => setStrategy(e.target.value)}
      >
        <option value="">Select strategy</option>
        <option>Stock</option>
        <option>Cash Secured Put</option>
        <option>Covered Call</option>
        <option>Put Credit Spread</option>
        <option>Call Credit Spread</option>
        <option>Put Debit Spread</option>
        <option>Call Debit Spread</option>
        <option>Iron Condor</option>
      </select>

      <label className="block text-sm font-semibold mb-1">Expiration</label>
      <select
        className="w-full p-2 border rounded-md mb-3"
        value={expiration}
        onChange={(e) => setExpiration(e.target.value)}
      >
        <option value="">Select expiration</option>
        {expirations.map((d) => (
          <option key={d}>{d}</option>
        ))}
      </select>

      <label className="block text-sm font-semibold mb-1">Quantity</label>
      <input
        type="number"
        min="1"
        className="w-full p-2 border rounded-md mb-3"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
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

/* ======================================================================================
   LEG BUILDER — strikes + per-leg premium
====================================================================================== */

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
}) {
  const [localLegs, setLocalLegs] = useState([]);

  // Cuando cambian las legs base (por strikes/estrategia), reinicializamos localLegs
  useEffect(() => {
    const initialized = legs.map((l) => ({
      ...l,
      premium: l.premium ?? "",
    }));
    setLocalLegs(initialized);
  }, [legs]);

  // Enviamos siempre las patas con premium al padre
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

      {/* SELECTORES DE STRIKES (igual que antes) */}
      {strategy === "Cash Secured Put" && (
        <StrikeSelect
          label="Sell to Open — Put"
          chain={chain}
          value={strikeA}
          onChange={setStrikeA}
        />
      )}

      {strategy === "Covered Call" && (
        <StrikeSelect
          label="Sell to Open — Call"
          chain={chain}
          value={strikeA}
          onChange={setStrikeA}
        />
      )}

      {strategy === "Put Credit Spread" && (
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

      {strategy === "Put Debit Spread" && (
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

      {strategy === "Call Credit Spread" && (
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

      {strategy === "Call Debit Spread" && (
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

      {strategy === "Iron Condor" && (
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

      {/* LEG PREVIEW CON PREMIUM */}
      {localLegs.length > 0 && (
        <div className="mt-4">
          <h4 className="text-base font-semibold mb-2">Legs</h4>

          {localLegs.map((leg, i) => {
            const q = quotes[leg.occSymbol];
            const mid =
              q && q.bid != null && q.ask != null
                ? ((q.bid + q.ask) / 2).toFixed(2)
                : "-";
            const d =
              q?.delta !== undefined ? Number(q.delta).toFixed(5) : "0.00000";
            const t =
              q?.theta !== undefined ? Number(q.theta).toFixed(5) : "0.00000";
            const iv =
              q?.impliedVol !== undefined
                ? Number(q.impliedVol).toFixed(1)
                : "-";

            return (
              <div
                key={i}
                className="p-3 mb-3 border rounded-lg bg-gray-50 shadow-sm"
              >
                <p className="font-medium">
                  {leg.action} • {leg.optionType} {leg.strike}
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
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ======================================================================================
   RISK CURVE (WEBULL STYLE)
====================================================================================== */

function buildRiskCurveData(legs, metrics) {
  if (!legs || !legs.length || !metrics) return [];

  const strikes = legs.map((l) => l.strike);
  const minPrice = Math.min(...strikes) - 20;
  const maxPrice = Math.max(...strikes) + 20;
  const steps = 80;
  const data = [];

  for (let i = 0; i <= steps; i++) {
    const price = minPrice + ((maxPrice - minPrice) * i) / steps;
    let payoffOptions = 0;

    legs.forEach((leg) => {
      if (!leg.optionType) return;

      const sign = leg.action === "Sell to Open" ? -1 : 1;
      const qty = leg.quantity || 1;
      let legPayoff = 0;

      if (leg.optionType === "Call") {
        legPayoff = Math.max(price - leg.strike, 0) * 100 * qty * sign;
      } else if (leg.optionType === "Put") {
        legPayoff = Math.max(leg.strike - price, 0) * 100 * qty * sign;
      }

      payoffOptions += legPayoff;
    });

    const totalPnL = payoffOptions + metrics.net;
    data.push({
      price: Number(price.toFixed(2)),
      pnl: Number(totalPnL.toFixed(2)),
    });
  }

  return data;
}

function RiskCurve({ legs, metrics, underlying }) {
  const data = useMemo(() => buildRiskCurveData(legs, metrics), [legs, metrics]);
  if (!data.length) return null;

  // Break-even
  const be1 = metrics.breakeven?.put ?? metrics.breakeven;
  const be2 = metrics.breakeven?.call ?? null;

  // Encontrar el punto exacto de Y para la meseta del profit
  const profitPoint = data.find((d) => d.pnl === metrics.maxProfit);
  const profitY = profitPoint ? profitPoint.pnl : metrics.maxProfit;

  // Encontrar el punto exacto de Y para la meseta del loss
  const lossPoint = data.find((d) => d.pnl === -Math.abs(metrics.maxLoss));
  const lossY = lossPoint ? lossPoint.pnl : -metrics.maxLoss;

  // Dominio de ejes
  const prices = data.map(d => d.price);
  const minX = Math.min(...prices, underlying);
  const maxX = Math.max(...prices, underlying);

  const pnls = data.map(d => d.pnl);
  const minY = Math.min(...pnls, -metrics.maxLoss) - 50;
  const maxY = Math.max(...pnls, metrics.maxProfit) + 50;

  return (
    <div className="mt-4 h-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 60, right: 40, left: 20, bottom: 40 }}>

          <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />

          <XAxis
            dataKey="price"
            type="number"
            domain={[minX, maxX]}
            fontSize={12}
            stroke="#444"
          />
          <YAxis
            domain={[minY, maxY]}
            fontSize={12}
            stroke="#444"
          />

          <Tooltip
            formatter={(v) => `$${v.toFixed(2)}`}
            labelFormatter={(p) => `Price: $${p}`}
          />

          <Line
            type="linear"
            dataKey="pnl"
            stroke="#000"
            strokeWidth={2}
            dot={false}
          />

          {/* PROFIT AREA */}
          <ReferenceArea
            y1={0}
            y2={metrics.maxProfit}
            fill="#16a34a"
            fillOpacity={0.15}
          />

          {/* LOSS AREA */}
          <ReferenceArea
            y1={-Math.abs(metrics.maxLoss)}
            y2={0}
            fill="#dc2626"
            fillOpacity={0.15}
          />

          {/* ======== Texto en la meseta del PROFIT ======== */}
          <ReferenceLine
                y={profitY}
                stroke="transparent"
                label={{
                    value: `↑ +$${metrics.maxProfit.toFixed(2)}`,
                    position: "insideRight",
                    fill: "#16a34a",
                    fontSize: 16,
                    fontWeight: "bold",
                    dy: 25,     // 👈 BAJA EL TEXTO DEBAJO DE LA LÍNEA SUPERIOR
                    dx: -10,
                }}
            />

          {/* ======== Texto en el piso del LOSS ======== */}
          <ReferenceLine
                y={lossY}
                stroke="transparent"
                    label={{
                        value: `↓ -$${metrics.maxLoss.toFixed(2)}`,
                        position: "insideLeft",
                        fill: "#dc2626",
                        fontSize: 16,
                        fontWeight: "bold",
                        dy: -25,     // 👈 SUBE EL TEXTO ENCIMA DE LA LÍNEA INFERIOR
                        dx: 10,
                    }}
                />

          {/* BREAK-EVEN */}
          {be1 && (
            <ReferenceLine
              x={be1}
              stroke="#666"
              strokeDasharray="6 4"              
            />
          )}

          {be2 && (
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
          {underlying && (
            <ReferenceLine
              x={underlying}
              stroke="#2563eb"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `Spot $${underlying.toFixed(2)}`,
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




/* ======================================================================================
   METRICS PANEL
====================================================================================== */

function MetricsPanel({ metrics, saving, save, legs, underlying }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white shadow-lg rounded-xl p-6 border border-gray-200"
    >
      <h3 className="text-lg font-semibold mb-4">Position Metrics</h3>

      {!metrics ? (
        <p className="text-sm text-gray-500">Complete legs to view metrics.</p>
      ) : (
        <>
          <div className="space-y-3 text-sm">
            <Metric
              label="Credit Received"
              value={`$${metrics.credit.toFixed(2)}`}
            />
            <Metric
              label="Debit Paid"
              value={`$${metrics.debit.toFixed(2)}`}
            />
            <Metric
              label="Net (Credit - Debit)"
              value={`${metrics.net >= 0 ? "+" : ""}${metrics.net.toFixed(2)}`}
              highlight={metrics.net >= 0 ? "green" : "red"}
            />

            {metrics.width !== null && (
              <Metric label="Spread Width" value={`$${metrics.width}`} />
            )}

            {metrics.maxProfit !== null && (
              <Metric
                label="Max Profit"
                highlight="green"
                value={`$${metrics.maxProfit.toFixed(2)}`}
              />
            )}

            {metrics.maxLoss !== null && (
              <Metric
                label="Max Loss"
                highlight="red"
                value={`$${metrics.maxLoss.toFixed(2)}`}
              />
            )}

            {/* BREAKEVENS */}
            {metrics.breakeven && !metrics.breakeven.put && (
              <Metric
                label="Breakeven"
                value={`$${metrics.breakeven.toFixed(2)}`}
              />
            )}

            {metrics.breakeven?.put && (
              <>
                <Metric
                  label="BE Put Side"
                  value={`$${metrics.breakeven.put.toFixed(2)}`}
                />
                <Metric
                  label="BE Call Side"
                  value={`$${metrics.breakeven.call.toFixed(2)}`}
                />
              </>
            )}

            {/* GLOBAL GREEKS */}
            <div className="pt-3 border-t border-gray-200 space-y-1">
              <Metric
                label="Delta (position)"
                value={metrics.delta.toFixed(5)}
              />
              <Metric
                label="Theta (per day)"
                value={metrics.theta.toFixed(5)}
              />
              <Metric
                label="Implied Vol (avg)"
                value={`${metrics.iv.toFixed(1)}%`}
              />
            </div>
          </div>

          {/* RISK CURVE */}
          <RiskCurve legs={legs} metrics={metrics} underlying={underlying} />
        </>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold mt-6"
      >
        {saving ? "Saving…" : "Save Position"}
      </button>
    </motion.div>
  );
}

/* ======================================================================================
   SMALL COMPONENTS
====================================================================================== */

function StrikeSelect({ chain, label, value, onChange }) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-semibold mb-1">{label}</label>
      <select
        className="w-full p-2 border rounded-md"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select</option>
        {chain.strikes.map((s) => (
          <option key={s} value={s}>
            {s.toFixed(2)}
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
