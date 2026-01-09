// =======================================================
// POSITION UTILS — BROKER-ACCURATE (WEBULL STYLE)
// (Fix: leg Market Value sign for Buy/Sell)
// =======================================================

// ---------- Helpers ----------
export const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export const fmtUSD = (v) =>
  v == null ? "—" : (v < 0 ? "-$" : "$") + Math.abs(Number(v)).toFixed(2);

export const fmtPct = (v) =>
  v == null ? "—" : (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%";

export const earliestExp = (legs = []) => {
  const exp = (legs || [])
    .map((l) => l?.expiration)
    .filter(Boolean)
    .sort((a, b) => new Date(a) - new Date(b));
  return exp[0] ? exp[0].slice(0, 10) : "—";
};

const MULT = 100;

// ---------- Pricing ----------
export function legMid(leg) {
  const bid = num(leg.bid, NaN);
  const ask = num(leg.ask, NaN);
  if (Number.isFinite(bid) && Number.isFinite(ask)) return (bid + ask) / 2;

  const last = num(leg.livePrice ?? leg.last, NaN);
  if (Number.isFinite(last)) return last;

  return num(leg.premium, 0);
}

export function legPrevCloseMid(leg) {
  const prev = num(leg.prevClose, NaN);
  if (Number.isFinite(prev)) return prev;

  const last = num(leg.livePrice ?? leg.last, NaN);
  const chg = num(leg.change, NaN);
  if (Number.isFinite(last) && Number.isFinite(chg)) return last - chg;

  // si no hay datos reales, no inventar
  return legMid(leg);
}

// ---------- Métricas por posición ----------
export function calculatePositionMetrics(pos) {
  const legs = pos?.legs || [];
  if (!legs.length) return {};

  // =======================================================
  // 🔒 POSICIÓN CERRADA
  // =======================================================
  if (pos.status === "Closed") {
    const qty = Math.max(...legs.map((l) => num(l.quantity, 1)), 1);
    const realized = num(pos.realizedPnL, 0);
    const maxLoss = num(pos.maxLoss, 0);

    return {
      qty,
      entry: pos.entryPrice ?? null,
      last: pos.exitPrice ?? null,
      totalCost: num(pos.totalCost, 0),
      marketValue: 0,
      openPnL: realized,
      openPnLPct: maxLoss > 0 ? (realized / maxLoss) * 100 : null,
      daysPnL: 0,
      breakEven: pos.breakEvenLow ?? null,
      maxProfit: pos.maxProfit ?? null,
      maxLoss: maxLoss || null,
      revenue: null, // ❗ NO aplica en cerradas
      strategyDetected: pos.strategy || "Closed",
    };
  }

  // =======================================================
  // 🔴 POSICIÓN ABIERTA — DEFINICIÓN REAL DE BROKER
  // =======================================================
  let entryCash = 0; // credit +, debit -
  let marketValue = 0;
  let prevMarketValue = 0;
  const qties = [];

  legs.forEach((leg) => {
    const q = num(leg.quantity, 1);
    const isSell = (leg.action || "").toLowerCase().includes("sell");
    const mvSign = isSell ? -1 : 1;

    const mid = legMid(leg);
    const prev = legPrevCloseMid(leg);

    qties.push(q);

    // dY"` ENTRY CASH
    // Sell = credit (+), Buy = debit (-)
    entryCash += (isSell ? 1 : -1) * num(leg.premium) * MULT * q;

    // dY"` MARKET VALUE (signed by leg action)
    marketValue += mvSign * mid * MULT * q;
    prevMarketValue += mvSign * prev * MULT * q;
  });

  const qty = Math.max(...qties, 1);

  // dY"� WEBULL DEFINITIONS
  const openPnL = entryCash + marketValue;

  const openPnLPct =
    Math.abs(entryCash) > 0
      ? (openPnL / Math.abs(entryCash)) * 100
      : 0;

  const daysPnL = marketValue - prevMarketValue;

  // Precio promedio actual
  const last = Math.abs(marketValue) / (MULT * qty);

  // Total Cost mostrado = -entry cash
  const totalCost = -entryCash;

  // =======================================================
  // 📐 Estrategias
  // =======================================================
  let breakEven = null;
  let maxProfit = null;
  let maxLoss = null;
  let revenue = Math.abs(entryCash) > 0 ? (openPnL / Math.abs(entryCash)) * 100 : null;
  let strategyDetected = pos.strategy || "Single";

  if (legs.length === 2) {
    const [a, b] = legs;

    const isPut =
      a.optionType?.toLowerCase() === "put" ||
      b.optionType?.toLowerCase() === "put";

    const isCall =
      a.optionType?.toLowerCase() === "call" ||
      b.optionType?.toLowerCase() === "call";

    const width = Math.abs(num(a.strike) - num(b.strike));
    const net = entryCash / MULT;
    const netAbs = Math.abs(net);
    const isCredit = net > 0; // 👈 CLAVE

    if (isPut && isCredit) strategyDetected = "Put Credit Spread";
    else if (isPut) strategyDetected = "Put Debit Spread";
    else if (isCall && isCredit) strategyDetected = "Call Credit Spread";
    else if (isCall) strategyDetected = "Call Debit Spread";

    if (isCredit) {
      maxProfit = netAbs * MULT;
      maxLoss = (width - netAbs) * MULT;
    } else {
      maxProfit = (width - netAbs) * MULT;
      maxLoss = netAbs * MULT;
    }

    breakEven = isPut
      ? Math.min(num(a.strike), num(b.strike)) - (isCredit ? netAbs : -netAbs)
      : Math.max(num(a.strike), num(b.strike)) + (isCredit ? netAbs : -netAbs);

  }

  if (legs.length === 4) {
    const hasPut = legs.some((l) => l.optionType?.toLowerCase() === "put");
    const hasCall = legs.some((l) => l.optionType?.toLowerCase() === "call");
    strategyDetected = hasPut && hasCall ? "Iron Condor" : "Butterfly Spread";
  }

  return {
    qty,
    entry: totalCost / (MULT * qty),
    last,
    totalCost,
    marketValue,
    openPnL,
    openPnLPct,
    daysPnL,
    breakEven,
    maxProfit,
    maxLoss,
    revenue,
    strategyDetected,
  };
}

// ---------- Métricas por leg ----------
// ✅ FIX PRINCIPAL:
// - Sell to Open => Market Value NEGATIVO
// - Buy to Open  => Market Value POSITIVO
export function calculateLegMetrics(leg) {
  const q = num(leg.quantity, 1);
  const sell = (leg.action || "").toLowerCase().includes("sell");

  const premium = num(leg.premium);
  const mid = legMid(leg);
  const prev = legPrevCloseMid(leg);

  // Entry cash (credit + / debit -)
  const entryCash = (sell ? +1 : -1) * premium * MULT * q;
  const entryDisplay = (sell ? -1 : +1) * premium;

  // ✅ Webull visual MV by leg:
  // Sell = negative MV, Buy = positive MV
  const marketValue = (sell ? -1 : +1) * mid * MULT * q;
  const prevMarketValue = (sell ? -1 : +1) * prev * MULT * q;

  // PnL consistent with these signs
  const pnl = entryCash + marketValue;

  const pnlPct =
    Math.abs(entryCash) > 0 ? (pnl / Math.abs(entryCash)) * 100 : 0;

  // Day’s P&L consistent with same MV sign
  const daysPnL = marketValue - prevMarketValue;

  return {
    qty: q,
    entry: entryDisplay,
    last: mid,
    totalCost: -entryCash,
    marketValue,
    pnl,
    pnlPct,
    daysPnL,
  };
}

