// src/hooks/useLiveQuotes.js
import { useEffect, useRef, useState } from "react";
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

  // ✅ refs para evitar reiniciar interval cada render
  const latestPositionsRef = useRef(positions);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);

  // Siempre mantener el ref actualizado
  useEffect(() => {
    latestPositionsRef.current = positions;
    setUpdatedPositions(positions); // mantiene tu comportamiento actual
  }, [positions]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function updateQuotes() {
      // ✅ Evita overlap (si tarda, no dispares otra encima)
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        const currentPositions = latestPositionsRef.current || [];

        if (!currentPositions.length) {
          if (mountedRef.current) setUpdatedPositions(currentPositions);
          return;
        }

        // 🔥 1) Ignorar posiciones cerradas
        const openPositions = currentPositions.filter((p) => p.status !== "Closed");
        if (!openPositions.length) {
          if (mountedRef.current) setUpdatedPositions(currentPositions);
          return;
        }

        // 2) Construir legs de posiciones abiertas
        const allLegs = openPositions.flatMap((p) =>
          (p.legs || []).map((leg) => ({
            ...leg,
            baseSymbol: p.symbol,
          }))
        );

        // 3) Generar OCC y filtrar válidos
        const legsWithOCC = allLegs
          .map((leg) => ({
            ...leg,
            occSymbol: leg.occSymbol || buildOccSymbol(leg, leg.baseSymbol),
          }))
          .filter((l) => l.occSymbol);

        if (!legsWithOCC.length) {
          if (mountedRef.current) setUpdatedPositions(currentPositions);
          return;
        }

        // ✅ DEDUPE: si hay legs repetidos, no pidas quotes duplicados
        const seen = new Set();
        const dedupedLegs = [];
        for (const l of legsWithOCC) {
          if (!seen.has(l.occSymbol)) {
            seen.add(l.occSymbol);
            dedupedLegs.push(l);
          }
        }

        const quotesBySym = (await fetchOptionQuotesByLegs(dedupedLegs)) || {};

        // 4) Actualizar posiciones (sin tocar las cerradas)
        const newPos = currentPositions.map((p) => {
          if (p.status === "Closed") return p;

          const updatedLegs = (p.legs || []).map((leg) => {
            const occ = leg.occSymbol || buildOccSymbol(leg, p.symbol);
            const q = occ ? quotesBySym[occ] : null;
            if (!q) return leg;

            // ⚠️ Tu service ya normaliza delta/theta/impliedVol.
            // Aquí mantenemos compatibilidad total con tu UI.
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
              ? updatedLegs.reduce((sum, l) => sum + (Number(l.livePrice) || 0), 0) /
                updatedLegs.length
              : 0;

          return { ...p, legs: updatedLegs, livePrice: avgLast };
        });

        if (mountedRef.current) setUpdatedPositions(newPos);
      } catch (err) {
        console.error("❌ Error actualizando quotes:", err);
      } finally {
        runningRef.current = false;
      }
    }

    // ✅ dispara una vez al montar + interval estable
    updateQuotes();
    const id = setInterval(updateQuotes, refreshMs);

    return () => clearInterval(id);
  }, [refreshMs]);

  return updatedPositions;
}
