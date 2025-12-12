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

  return num(leg.premium, 0);
}

// Acción → signo: buy = pagas (positivo), sell = recibes (negativo)
function legSign(leg) {
  return (leg.action || "").toLowerCase().includes("sell") ? -1 : +1;
}

// ---------- Métricas por posición ----------
export function calculatePositionMetrics(pos) {
  const legs = pos?.legs || [];
  if (!legs.length) return {};

  // =======================================================
  // 🔥 POSICIÓN CERRADA → usar valores fijos (no live quotes)
  // =======================================================
  if (pos.status === "Closed") {
    const qty = Math.max(...(legs.map(l => num(l.quantity,1))), 1);
    const exit = num(pos.exitPrice, 0);
    const realized = num(pos.realizedPnL, 0);
    const totalCost = num(pos.totalCost, 0);

    const marketValue = exit * MULT * qty;
    const openPnLPct =
      Math.abs(totalCost) > 0 ? (realized / Math.abs(totalCost)) * 100 : 0;

    return {
      qty,
      entry: pos.entryPrice ?? (totalCost / MULT),
      last: exit,                           // <-- clave
      totalCost,
      marketValue,
      openPnL: realized,
      openPnLPct,
      daysPnL: 0,
      breakEven: pos.breakEvenLow ?? null,
      maxProfit: pos.maxProfit ?? null,
      maxLoss: pos.maxLoss ?? null,
      revenue: openPnLPct,
      strategyDetected: pos.strategy || "Closed",
    };
  }


  let entryCash = 0;
  let currValue = 0;
  let daysPnL = 0;
  const qties = [];

  legs.forEach((leg) => {
    const q = num(leg.quantity, 1);
    const s = legSign(leg);
    const mid = legMid(leg);
    const prev = legPrevCloseMid(leg);

    qties.push(q);

    const entry = s * num(leg.premium) * MULT * q;
    const marketVal = s * mid * MULT * q;
    const dayMove = s * (mid - prev) * MULT * q;

    entryCash += entry;
    currValue += marketVal;
    daysPnL += dayMove;
  });

  const qty = Math.max(...qties, 1);

  const totalCost = entryCash; // positivo si compras (inviertes), negativo si vendes (ingreso)
  const openPnL = currValue - totalCost;
  const openPnLPct = Math.abs(totalCost) > 0 ? (openPnL / Math.abs(totalCost)) * 100 : 0;
  const last = Math.abs(currValue) / MULT;

  // === Estrategias ===
  let breakEven = null;
  let maxProfit = null;
  let maxLoss = null;
  let revenue = null;
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

    if (isPut && net < 0) strategyDetected = "Put Credit Spread";
    else if (isPut && net > 0) strategyDetected = "Put Debit Spread";
    else if (isCall && net < 0) strategyDetected = "Call Credit Spread";
    else if (isCall && net > 0) strategyDetected = "Call Debit Spread";
    else strategyDetected = "Vertical Spread";

    const netAbs = Math.abs(net);
    const isCredit = net < 0;

    if (isCredit) {
      maxProfit = netAbs * MULT;
      maxLoss = (width - netAbs) * MULT;
    } else {
      maxProfit = (width - netAbs) * MULT;
      maxLoss = netAbs * MULT;
    }

    breakEven = isPut
      ? Math.min(num(a.strike), num(b.strike)) + (isCredit ? -netAbs : netAbs)
      : Math.max(num(a.strike), num(b.strike)) - (isCredit ? -netAbs : netAbs);

    revenue = maxProfit > 0 ? (openPnL / maxProfit) * 100 : 0;
  }

  if (legs.length === 4) {
    const hasPut = legs.some((l) => l.optionType?.toLowerCase() === "put");
    const hasCall = legs.some((l) => l.optionType?.toLowerCase() === "call");
    strategyDetected = hasPut && hasCall ? "Iron Condor" : "Butterfly Spread";
  }

  return {
    qty,
    entry: entryCash / MULT,
    last,
    totalCost,
    marketValue: currValue,
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
export function calculateLegMetrics(leg) {
  const q = num(leg.quantity, 1);
  const s = legSign(leg);
  const premium = num(leg.premium);
  const mid = legMid(leg);
  const prev = legPrevCloseMid(leg);

  const totalCost = s * premium * MULT * q; // positivo si compras, negativo si vendes
  const marketValue = s * mid * MULT * q;
  const openPnL = marketValue - totalCost;
  const openPnLPct = Math.abs(totalCost) > 0 ? (openPnL / Math.abs(totalCost)) * 100 : 0;
  const daysPnL = s * (mid - prev) * MULT * q;
  const last = mid;

  return {
    qty: q,
    entry: premium,
    last,
    totalCost,
    marketValue,
    pnl: openPnL,
    pnlPct: openPnLPct,
    daysPnL,
  };
}