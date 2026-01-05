// ==============================================
// POSITION EDITOR — WEBULL PRO VERSION (2025)
// Fully compatible with NewPosition.jsx
// ==============================================

import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  fetchExpirations,
  fetchChains,
  fetchUnderlyingQuote,
  fetchOptionQuotesByLegs,
} from "../services/tradierService";

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
  ReferenceDot,
  Label
} from "recharts";

import { brokerIcons } from "../utils/brokerIcons";
import { STRATEGIES, STRATEGY_OPTIONS } from "../components/strategies";


// ==============================================
// MAIN COMPONENT
// ==============================================

export default function PositionEditor({ initialData, onSave, isRoll }) {
  // ======================
  // ROLL SNAPSHOT (READ ONLY)
  // ======================
  const [rollSnapshot, setRollSnapshot] = useState(null);

  // ======================
  // GENERAL STATE
  // ======================
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
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [strikeA, setStrikeA] = useState("");
  const [strikeB, setStrikeB] = useState("");
  const [strikeC, setStrikeC] = useState("");
  const [strikeD, setStrikeD] = useState("");

  const [localLegs, setLocalLegs] = useState([]);

  // ==============================================
  // IMPORTANT: prevent early override
  // ==============================================
  const [isPrefilled, setIsPrefilled] = useState(false);

  // ==============================================
  // PREFILL INITIAL DATA
  // ==============================================
  useEffect(() => {
    if (!initialData) return;

    console.log(
      "🧩 initialData JSON ====>",
      JSON.stringify(initialData, null, 2)
    );

    setSymbol(initialData.symbol || "");
    setBroker(initialData.broker || "");
    setStrategy(initialData.strategy || "");
    setQuantity(initialData.legs?.[0]?.quantity || 1);
    setNotes(initialData.notes || "");

    // Convert expiration ISO → YYYY-MM-DD
    if (initialData.legs?.[0]?.expiration) {
      const iso = initialData.legs[0].expiration;
      setExpiration(iso.slice(0, 10));
    }

    const legs = initialData.legs || [];

    if (legs.length >= 1) setStrikeA(legs[0].strike);
    if (legs.length >= 2) setStrikeB(legs[1].strike);
    if (legs.length >= 3) setStrikeC(legs[2].strike);
    if (legs.length >= 4) setStrikeD(legs[3].strike);

    // Preserve premiums
    const enriched = legs.map((leg) => {
      const occSymbol =
        leg.occSymbol ||
        buildOccSymbol(
          initialData.symbol.toUpperCase(),
          leg.expiration.slice(0, 10),
          leg.strike,
          leg.optionType
        );

      return {
        ...leg,
        occSymbol,
        premium: leg.premium ?? "",
      };
    });
    // ======================
    // ROLL SNAPSHOT
    // ======================
    if (isRoll) {
      // netPremium viene en $ → lo llevamos a $
      // totalCost viene con signo invertido (Webull style)
      const prevNet =
        initialData.netPremium != null
          ? Number(initialData.netPremium) // ✅ ya viene en $
          : initialData.totalCost != null
          ? Number(-initialData.totalCost) // ✅ totalCost suele ser negativo si fue crédito
          : 0;

      setRollSnapshot({
        expiration: initialData.legs?.[0]?.expiration?.slice(0, 10),
        strikes: initialData.legs?.map((l) => l.strike).join(" / "),
        netPremium: prevNet, // ✅ $
      });
    }
    setLocalLegs(enriched);
    setIsPrefilled(true); // <-- Key fix

  }, [initialData]);

  // ==============================================
  // LOAD EXPIRATIONS + SPOT PRICE
  // ==============================================
  useEffect(() => {
    if (!symbol.trim()) {
      setExpirations([]);
      setUnderlying(null);
      return;
    }

    const run = async () => {
      try {
        const s = symbol.trim().toUpperCase();
        const [exp, last] = await Promise.all([
          fetchExpirations(s),
          fetchUnderlyingQuote(s),
        ]);
        setExpirations(exp || []);
        setUnderlying(last || null);
      } catch (e) {
        console.error(e);
      }
    };

    const t = setTimeout(run, 400);
    return () => clearTimeout(t);
  }, [symbol]);

  // ==============================================
  // LOAD CHAINS
  // ==============================================
  useEffect(() => {
    if (!symbol.trim() || !expiration) {
      setChain({ strikes: [], calls: [], puts: [] });
      return;
    }

    const run = async () => {
      try {
        const data = await fetchChains(symbol.trim().toUpperCase(), expiration);
        setChain(data);
      } catch (e) {
        console.error(e);
      }
    };

    run();
  }, [symbol, expiration]);

  // OCC builder
  const buildOccSymbol = (sym, exp, strike, type) => {
    const clean = exp.replace(/-/g, "").slice(2);
    const cp = type === "Call" ? "C" : "P";
    const strikeInt = Math.round(Number(strike) * 1000);
    const strikeStr = String(strikeInt).padStart(8, "0");
    return `${sym}${clean}${cp}${strikeStr}`;
  };

  // ==============================================
  // BUILD LEGS BASE (sin premium)
  // ==============================================
  const legs = useMemo(() => {
    if (!strategy || !symbol || !expiration) return [];

    const S = strategy.toLowerCase();
    const q = Number(quantity) || 1;
    const sym = symbol.toUpperCase();
    const occ = (s, t) => buildOccSymbol(sym, expiration, s, t);

    // STOCK
    if (S === "stock") {
      return [{ type: "stock", action: q > 0 ? "Buy" : "Sell", quantity: q }];
    }

    // CSP
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

    // CC
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

    // VERTICAL SPREADS
    const isSpread =
      S === "put credit spread" ||
      S === "put debit spread" ||
      S === "call credit spread" ||
      S === "call debit spread";

    if (isSpread) {
      if (!strikeA || !strikeB) return [];

      const hi = Math.max(strikeA, strikeB);
      const lo = Math.min(strikeA, strikeB);

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
      return [
        {
          action: "Sell to Open",
          optionType: "Put",
          strike: Number(strikeA),
          expiration,
          quantity: q,
          occSymbol: occ(strikeA, "Put"),
        },
        {
          action: "Buy to Open",
          optionType: "Put",
          strike: Number(strikeB),
          expiration,
          quantity: q,
          occSymbol: occ(strikeB, "Put"),
        },
        {
          action: "Sell to Open",
          optionType: "Call",
          strike: Number(strikeC),
          expiration,
          quantity: q,
          occSymbol: occ(strikeC, "Call"),
        },
        {
          action: "Buy to Open",
          optionType: "Call",
          strike: Number(strikeD),
          expiration,
          quantity: q,
          occSymbol: occ(strikeD, "Call"),
        },
      ];
    }

    return [];
  }, [strategy, strikeA, strikeB, strikeC, strikeD, symbol, expiration, quantity]);

  // ==============================================
  // LOAD QUOTES
  // ==============================================
  useEffect(() => {
    if (!localLegs.length) {
      setQuotes({});
      return;
    }

    const run = async () => {
      try {
        const q = await fetchOptionQuotesByLegs(localLegs);
        setQuotes(q || {});
      } catch (e) {
        console.error(e);
      }
    };

    run();
  }, [localLegs]);
  // ==============================================
  // SYNC localLegs with legs base (SAFE VERSION)
  // ==============================================
  useEffect(() => {
    // ❗ Don't override during prefill
    if (!isPrefilled) return;

    if (!legs.length) {
      setLocalLegs([]);
      return;
    }

    const merged = legs.map((base) => {
      const baseStrike = Number(base.strike);

      const match = localLegs.find(
        (f) =>
          Number(f.strike) === baseStrike &&
          f.optionType === base.optionType &&
          f.action === base.action
      );

      return {
        ...base,
        strike: baseStrike,
        premium: match?.premium ?? "",
      };
    });

    setLocalLegs(merged);
  }, [legs, isPrefilled]);


  // ==============================================
  // METRICS
  // ==============================================
  const metrics = useMemo(() => {
    if (!localLegs.length || !strategy) return null;

    let net = 0;
    localLegs.forEach((leg) => {
      const p = Number(leg.premium ?? 0);
      const q = Number(leg.quantity || 1);
      const sign = leg.action === "Sell to Open" ? +1 : -1;
      net += p * 100 * q * sign;
    });

    const credit = net > 0 ? net : 0;
    const debit = net < 0 ? Math.abs(net) : 0;

    let totalDelta = 0;
    let totalTheta = 0;
    let ivWeighted = 0;
    let ivWeightTotal = 0;

    localLegs.forEach((leg) => {
      const q = quotes[leg.occSymbol];
      if (!q) return;

      const delta = Number(q.delta ?? 0);
      const theta = Number(q.theta ?? 0);
      const iv = Number(q.impliedVol ?? 0);

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

    let width = null;
    const strikes = localLegs.map((l) => l.strike);

    const S = strategy.toLowerCase();
    const isVertical = S.includes("credit spread") || S.includes("debit spread");

    if (isVertical && strikes.length >= 2) {
      width = (Math.max(...strikes) - Math.min(...strikes)) * 100;
    }

    if (S.includes("iron condor")) {
      const puts = localLegs
        .filter((l) => l.optionType === "Put")
        .map((l) => l.strike);
      const calls = localLegs
        .filter((l) => l.optionType === "Call")
        .map((l) => l.strike);

      if (puts.length >= 2 && calls.length >= 2) {
        width = Math.min(
          (Math.max(...puts) - Math.min(...puts)) * 100,
          (Math.max(...calls) - Math.min(...calls)) * 100
        );
      }
    }

    let maxProfit = null;
    let maxLoss = null;

    if (S.includes("credit") || S.includes("iron condor")) {
      maxProfit = net;
      maxLoss = width !== null ? width - net : null;
    } else if (S.includes("debit")) {
      maxLoss = debit;
      maxProfit = width !== null ? width - debit : null;
    }

    let breakeven = null;

    if (S === "put credit spread") {
      const short = Math.max(...strikes);
      breakeven = short - net / 100;
    }
    if (S === "call credit spread") {
      const short = Math.min(...strikes);
      breakeven = short + net / 100;
    }
    if (S === "put debit spread") {
      const long = Math.min(...strikes);
      breakeven = long - debit / 100;
    }
    if (S === "call debit spread") {
      const long = Math.max(...strikes);
      breakeven = long + debit / 100;
    }
    if (S.includes("iron condor")) {
      const putShort = Math.max(strikeA, strikeB);
      const callShort = Math.min(strikeC, strikeD);
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
  }, [localLegs, quotes, strategy]);

  // ==============================================
  // SAVE (PUT)
  // ==============================================
  const save = async () => {
    setSaving(true);
    setError("");

    try {
      if (!metrics) {
        setError("Metrics not ready");
        setSaving(false);
        return;
      }

      const payload = {
        symbol: symbol.toUpperCase(),
        type: "option",
        strategy,
        broker,
        notes,
        legs: localLegs,

        openDate: isRoll ? new Date() : initialData.openDate,
        status: "Open",

        // ✅ Cash-style (Webull): credit positivo, debit negativo
        totalCost: -metrics.net,

        // ✅ IMPORTANTÍSIMO: metrics.net YA está en $
        netPremium: metrics.net,

        maxProfit: metrics.maxProfit,
        maxLoss: metrics.maxLoss,

        breakEvenLow:
          typeof metrics.breakeven === "number"
            ? metrics.breakeven
            : metrics.breakeven?.put ?? null,

        breakEvenHigh:
          typeof metrics.breakeven === "number"
            ? null
            : metrics.breakeven?.call ?? null,

        // ✅ revenue = net premium (en $)
        revenue: metrics.net,
      };

      if (isRoll) {
        await onSave({
          newPosition: payload,
          rollOutCost: Math.abs(initialData.totalCost),
          rollInCredit: metrics.net,
        });
      } else {
        await onSave(payload);
      }
    } catch (e) {
      console.error(e);
      setError("Error updating position");
    } finally {
      setSaving(false);
    }
  };

  // ==============================================
  // RENDER
  // ==============================================
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 p-6"
    >
      <LeftPanel
        title={isRoll ? "Roll Position" : "Edit Position"}
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
        isRoll={isRoll}
        rollSnapshot={rollSnapshot}
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
        localLegs={localLegs}
        setLocalLegs={setLocalLegs}
      />

      <MetricsPanel
        metrics={metrics}
        saving={saving}
        save={save}
        legs={localLegs}
        underlying={underlying}
        isRoll={isRoll}
        rollSnapshot={rollSnapshot}
      />
    </motion.div>
  );
}

/* ============================================================
   LEFT PANEL
============================================================ */
function LeftPanel({
  title,
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
  isRoll,
  rollSnapshot,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white shadow-lg rounded-xl p-6 border border-gray-200"
    >
      <h2 className="text-xl font-semibold mb-4">{title}</h2>

      {isRoll && rollSnapshot && (
        <div className="mb-4 p-3 rounded-lg border border-purple-300 bg-purple-50">
          <p className="text-sm font-semibold text-purple-700 mb-1">
            Rolled From
          </p>

          <p className="text-xs text-gray-700">
            Expiration: <strong>{rollSnapshot.expiration}</strong>
          </p>

          <p className="text-xs text-gray-700">
            Strikes: <strong>{rollSnapshot.strikes}</strong>
          </p>

          <p className="text-xs text-gray-700">
            Previous Net Premium:&nbsp;
            <strong
              className={
                rollSnapshot.netPremium >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              ${rollSnapshot.netPremium.toFixed(2)}
            </strong>
          </p>
        </div>
      )}

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
        {STRATEGY_OPTIONS.map((s, i) => {
          if (s.group) {
            return (
              <optgroup key={`group-${i}`} label={s.group} />
            );
          }

          return (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          );
        })}
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

/* ============================================================
   LEG BUILDER
============================================================ */
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
  localLegs,
  setLocalLegs,
}) {
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

      {/* Strike selectors */}
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

      {/* Leg preview */}
      {localLegs.length > 0 && (
        <div className="mt-4">
          <h4 className="text-base font-semibold mb-2">Legs</h4>

          {localLegs.map((leg, i) => {
            const q = quotes[leg.occSymbol];
            const mid =
              q && q.bid != null && q.ask != null
                ? ((q.bid + q.ask) / 2).toFixed(2)
                : "-";
            const d = q?.delta !== undefined ? Number(q.delta).toFixed(5) : "-";
            const t = q?.theta !== undefined ? Number(q.theta).toFixed(5) : "-";
            const iv = q?.impliedVol !== undefined ? Number(q.impliedVol).toFixed(1)
                : "-";

            return (
              <div
                key={i}
                className="p-3 mb-3 border rounded-lg bg-gray-50 shadow-sm"
              >
                <p className="font-medium">
                  {leg.action} • {leg.optionType} {leg.strike}
                </p>
                <p className="text-[11px] text-gray-600">{leg.occSymbol}</p>

                {q && (
                  <div className="mt-2 text-[12px] text-gray-700">

                    {/* Row 1 */}
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">Bid</span>
                      <span className="font-semibold">{Number(q.bid).toFixed(2)}</span>

                      <span className="text-gray-500">Ask</span>
                      <span className="font-semibold">{Number(q.ask).toFixed(2)}</span>

                      <span className="text-gray-500">Mid</span>
                      <span className="font-semibold">{mid}</span>
                    </div>

                    {/* Row 2 */}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-gray-500">Δ</span>
                      <span className="font-semibold">{d}</span>

                      <span className="text-gray-500">Θ</span>
                      <span className="font-semibold">{t}</span>

                      <span className="text-gray-500">IV</span>
                      <span
                        className={`font-semibold ${
                          Number(iv) > 70 ? "text-orange-600" : ""
                        }`}
                      >
                        {iv}%
                      </span>
                    </div>

                  </div>
                )}

                <label className="block text-xs font-semibold mt-2">
                  Entry Price (premium)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full p-2 border rounded-md text-sm"
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

/* ============================================================
   STRIKE SELECT COMPONENT
============================================================ */
function StrikeSelect({ chain, label, value, onChange }) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-semibold mb-1">{label}</label>
      <select
        className="w-full p-2 border rounded-md"
        value={Number(value)}
        onChange={(e) => onChange(Number(e.target.value))}
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

/* ============================================================
   METRICS PANEL
============================================================ */
function MetricsPanel({
  metrics,
  saving,
  save,
  legs,
  underlying,
  isRoll,
  rollSnapshot,
  }) {
  if (!metrics) {
    return (
      <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
        <p className="text-sm text-gray-500">Complete legs to view metrics.</p>
      </div>
    );
}

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white shadow-lg rounded-xl p-6 border border-gray-200"
    >
      <h3 className="text-lg font-semibold mb-4">Position Metrics</h3>

      <div className="space-y-3 text-sm">
        <Metric
          label="Credit Received"
          value={`$${metrics.credit.toFixed(2)}`}
        />
        <Metric label="Debit Paid" value={`$${metrics.debit.toFixed(2)}`} />

        <Metric
          label="Net"
          value={`$${metrics.net.toFixed(2)}`}
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

        {metrics.breakeven && typeof metrics.breakeven === "number" && (
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

        <div className="pt-3 border-t border-gray-200 space-y-1">
          <Metric label="Delta" value={metrics.delta.toFixed(5)} />
          <Metric label="Theta" value={metrics.theta.toFixed(5)} />
          <Metric label="Implied Vol" value={`${metrics.iv.toFixed(1)}%`} />
        </div>
      </div>

      <RiskCurve legs={legs} metrics={metrics} underlying={underlying} />
      
      {isRoll && rollSnapshot && metrics.net + rollSnapshot.netPremium < 0 && (
        <div className="mt-3 p-3 rounded-md bg-red-100 text-red-700 text-xs">
          ⚠️ This roll does not fully recover the previous loss.
          <br />
          You still need{" "}
          <strong>
            ${Math.abs(metrics.net + rollSnapshot.netPremium).toFixed(2)}
          </strong>{" "}
          to break even.
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold mt-6"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </motion.div>
  );
}

/* ============================================================
   SMALL COMPONENTS
============================================================ */
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

/* ============================================================
   RISK CURVE
============================================================ */
function buildRiskCurveData(legs, metrics) {
  if (!legs || !metrics) return [];

  const strikes = legs.map((l) => l.strike);
  const min = Math.min(...strikes) - 20;
  const max = Math.max(...strikes) + 20;

  const out = [];

  for (let p = min; p <= max; p += (max - min) / 80) {
    let payoff = 0;

    legs.forEach((leg) => {
      const qty = leg.quantity || 1;
      const sign = leg.action === "Sell to Open" ? -1 : 1;

      if (leg.optionType === "Call") {
        payoff += Math.max(p - leg.strike, 0) * 100 * qty * sign;
      }
      if (leg.optionType === "Put") {
        payoff += Math.max(leg.strike - p, 0) * 100 * qty * sign;
      }
    });

    out.push({
      price: Number(p.toFixed(2)),
      pnl: Number((payoff + metrics.net).toFixed(2)),
    });
  }

  return out;
}

function textInMiddle(v) {
  return v !== null && !isNaN(v);
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
