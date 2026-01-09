import { generateOccSymbol } from "./occSymbol";

// client/src/utils/mergeLiveQuotes.js

/**
 * 🔒 mergeLiveQuotesIntoPosition (HARDENED)
 *
 * OBJETIVO:
 * - NO tocar Positions.jsx
 * - NO tocar positionUtils.js
 * - Garantizar que TODA leg tenga un precio numérico usable
 * - Loggear exactamente cuándo y por qué no hay quote real
 */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function mergeLiveQuotesIntoPosition(position, optionQuotes = {}) {
  if (!position || !Array.isArray(position.legs)) return position;

  const legs = position.legs.map((leg, idx) => {
    const occ = leg.occSymbol || generateOccSymbol(position.symbol, leg.expiration, leg.strike, leg.optionType);

    /* ===============================
       1️⃣ SIN OCC = LEG ROTA
    =============================== */
    if (!occ) {
      if (process.env.NODE_ENV !== "production") {
        console.error("❌ LEG SIN occSymbol", {
          position: position.symbol,
          legIndex: idx,
          leg,
        });
      }
      return {
        ...leg,
        occSymbol: occ ?? leg.occSymbol,
        _NO_QUOTE: true,
        _priceSource: "NO_OCC",
      };
    }

    const live = optionQuotes[occ];

    /* ===============================
       2️⃣ NO HAY QUOTE LIVE
    =============================== */
    if (!live) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("⚠️ NO QUOTE LIVE", {
          position: position.symbol,
          occ,
        });
      }

      // ⚠️ fallback visual MÍNIMO (premium)
      const fallback = num(leg.premium);

      return {
        ...leg,
        occSymbol: occ ?? leg.occSymbol,
        last: Number.isFinite(fallback) ? fallback : undefined,
        _NO_QUOTE: true,
        _priceSource: Number.isFinite(fallback) ? "premium" : "NONE",
      };
    }

    /* ===============================
       3️⃣ NORMALIZACIÓN FUERTE
    =============================== */
    const bid = num(live.bid ?? leg.bid);
    const ask = num(live.ask ?? leg.ask);
    const last = num(live.last ?? leg.last);

    let resolvedLast = NaN;
    let priceSource = "NONE";

    // 1️⃣ LAST
    if (Number.isFinite(last)) {
      resolvedLast = last;
      priceSource = "last";
    }
    // 2️⃣ MID
    else if (Number.isFinite(bid) && Number.isFinite(ask)) {
      resolvedLast = (bid + ask) / 2;
      priceSource = "mid";
    }
    // 3️⃣ PREMIUM (último recurso)
    else if (Number.isFinite(num(leg.premium))) {
      resolvedLast = num(leg.premium);
      priceSource = "premium";
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("🧩 MERGE LIVE QUOTE", {
        symbol: position.symbol,
        occ,
        bid,
        ask,
        last,
        resolvedLast,
        priceSource,
      });
    }

    return {
      ...leg,
      occSymbol: occ ?? leg.occSymbol,

      // ===== PRECIOS GARANTIZADOS =====
      bid: Number.isFinite(bid) ? bid : undefined,
      ask: Number.isFinite(ask) ? ask : undefined,
      last: Number.isFinite(resolvedLast) ? resolvedLast : undefined,

      _priceSource: priceSource,
      _NO_QUOTE: !Number.isFinite(resolvedLast),

      // ===== GREEKS NORMALIZADOS =====
      greeks: {
        ...leg.greeks,
        delta: num(live.greeks?.delta ?? live.delta ?? leg.greeks?.delta),
        theta: num(live.greeks?.theta ?? live.theta ?? leg.greeks?.theta),
        gamma: num(live.greeks?.gamma ?? leg.greeks?.gamma),
        vega: num(live.greeks?.vega ?? leg.greeks?.vega),
        rho: num(live.greeks?.rho ?? leg.greeks?.rho),
      },

      // ===== IV YA EN % =====
      impliedVolatility: num(
        live.impliedVolatility ?? leg.impliedVolatility
      ),
    };
  });

  return {
    ...position,
    legs,
  };
}


