// src/hooks/useLiveQuotes.js
import { useEffect, useState } from "react";
import { fetchOptionQuotesByLegs } from "../services/tradierService";

// Construye símbolo OCC (e.g., SNAP251114C00008500)
function buildOccSymbol(leg, baseSymbol = "") {
  try {
    const underlying = baseSymbol || leg.symbol || leg.underlying || "";
    if (!underlying) return null;

    const expDate = leg.expiration?.split("T")[0] || leg.expiration;
    const exp = expDate?.replace(/-/g, "").slice(2); // 2025-11-14 → 251114
    if (!exp || exp.length < 6) return null;

    const cp = leg.optionType?.toUpperCase().startsWith("C") ? "C" : "P";
    const strike = String(Math.round(Number(leg.strike) * 1000)).padStart(8, "0");
    const occ = `${underlying}${exp}${cp}${strike}`;
    return occ.length >= 15 ? occ : null;
  } catch {
    return null;
  }
}

  /**
   * Hook de actualización en vivo usando Tradier (polling)
   * - Inyecta en cada leg: bid/ask/last/change/prevClose, greeks{}, impliedVolatility
   * - El resumen general (Positions.jsx) usa esos campos para Delta/Theta/IV
   */
  export function useLiveQuotes(positions = [], refreshMs = 15000) {
    const [updatedPositions, setUpdatedPositions] = useState(positions);

    useEffect(() => setUpdatedPositions(positions), [positions]);

    useEffect(() => {
    if (!positions.length) return;

    // 🔥 1) Ignorar posiciones cerradas
    const openPositions = positions.filter(p => p.status !== "Closed");

    if (!openPositions.length) {
      setUpdatedPositions(positions); // nada que actualizar
      return;
    }

    async function updateQuotes() {
      try {
        // 2) Solo pedimos quotes para posiciones abiertas
        const allLegs = openPositions.flatMap((p) =>
          (p.legs || []).map((leg) => ({
            ...leg,
            baseSymbol: p.symbol,
          }))
        );

        const legsWithOCC = allLegs.map((leg) => ({
          ...leg,
          occSymbol: leg.occSymbol || buildOccSymbol(leg, leg.baseSymbol),
        }));

        const validLegs = legsWithOCC.filter((l) => l.occSymbol);

        if (!validLegs.length) {
          setUpdatedPositions(positions);
          return;
        }

        const quotesResp = await fetchOptionQuotesByLegs(validLegs);

        let quotesBySym = {};
        if (Array.isArray(quotesResp)) {
          quotesResp.forEach((q) => {
            if (q?.symbol) quotesBySym[q.symbol] = q;
          });
        } else if (quotesResp && typeof quotesResp === "object") {
          quotesBySym = quotesResp;
        }

        // 🔥 3) NO actualizar posiciones cerradas
        const newPos = positions.map((p) => {
          if (p.status === "Closed") return p;

          const updatedLegs = (p.legs || []).map((leg) => {
            const occ = leg.occSymbol || buildOccSymbol(leg, p.symbol);
            const q = occ ? quotesBySym[occ] : null;
            if (!q) return leg;

            const greeks = q.greeks || {
              delta: q.delta,
              theta: q.theta,
              gamma: q.gamma,
              vega: q.vega,
              rho: q.rho,
            };

            const impliedVolRaw =
              q.impliedVolatility ??
              q.impliedVol ??
              q.smv_vol ??
              q.mid_iv ??
              q.bid_iv ??
              q.ask_iv ??
              q.greeks?.smv_vol ??
              q.greeks?.mid_iv ??
              q.greeks?.bid_iv ??
              q.greeks?.ask_iv ??
              leg.impliedVolatility;

            return {
              ...leg,
              occSymbol: occ,
              bid: q.bid ?? leg.bid,
              ask: q.ask ?? leg.ask,
              livePrice: q.last ?? leg.livePrice,
              change: q.change ?? leg.change,
              prevClose: q.prevclose ?? q.prevClose ?? leg.prevClose,
              greeks: {
                delta: greeks?.delta ?? leg.greeks?.delta,
                theta: greeks?.theta ?? leg.greeks?.theta,
                gamma: greeks?.gamma ?? leg.greeks?.gamma,
                vega: greeks?.vega ?? leg.greeks?.vega,
                rho: greeks?.rho ?? leg.greeks?.rho,
              },
              impliedVolatility:
                typeof impliedVolRaw === "number"
                  ? impliedVolRaw
                  : leg.impliedVolatility,
            };
          });

          const avgLast =
            updatedLegs.length > 0
              ? updatedLegs.reduce(
                  (sum, l) => sum + (Number(l.livePrice) || 0),
                  0
                ) / updatedLegs.length
              : 0;

          return { ...p, legs: updatedLegs, livePrice: avgLast };
        });

        setUpdatedPositions(newPos);
      } catch (err) {
        console.error("❌ Error actualizando quotes:", err);
      }
    }

    updateQuotes();
    const interval = setInterval(updateQuotes, refreshMs);
    return () => clearInterval(interval);
  }, [positions, refreshMs]);

  
  return updatedPositions;
}
