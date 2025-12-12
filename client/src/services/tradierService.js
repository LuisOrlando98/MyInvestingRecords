// src/services/tradierService.js
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/**
 * Consulta las cotizaciones Tradier para una lista de símbolos OCC
 * Ejemplo: SNAP251114C00008500,SNAP251114P00007500
 */
export async function fetchOptionQuotesByLegs(legs = []) {
  try {
    const symbols = legs
      .map((l) => l.occSymbol || l.symbol || l.optionSymbol)
      .filter(Boolean)
      .join(",");

    if (!symbols) return {};

    const { data } = await axios.get(`${API_BASE}/api/tradier/quotes`, {
      params: { symbols },
    });

    const quotes = {};
    const items = Array.isArray(data?.quotes)
      ? data.quotes
      : Array.isArray(data)
      ? data
      : [data?.quotes].filter(Boolean);

    items.forEach((q) => {
      if (q && q.symbol) {
        // ✅ Extraemos IV correctamente, ya sea en raíz o dentro de greeks
        const ivRaw =
          q.implied_volatility ??
          q.mid_iv ??
          q.bid_iv ??
          q.ask_iv ??
          q.smv_vol ??
          q.greeks?.implied_volatility ??
          q.greeks?.mid_iv ??
          q.greeks?.bid_iv ??
          q.greeks?.ask_iv ??
          q.greeks?.smv_vol ??
          null;

        quotes[q.symbol] = {
          last: q.last,
          bid: q.bid,
          ask: q.ask,
          prevClose: q.previous_close,
          change: q.change,
          delta: q.greeks?.delta ?? null,
          theta: q.greeks?.theta ?? null,
          impliedVol: ivRaw !== null ? ivRaw * 100 : null, // → % real
        };
      }
    });

    return quotes;
  } catch (err) {
    console.error("Tradier quote fetch error:", err);
    return {};
  }
}

// 🔹 Cargar expiraciones válidas (solo viernes o todos si es índice)
export async function fetchExpirations(symbol) {
  try {
    const { data } = await axios.get(`${API_BASE}/api/tradier/expirations`, {
      params: { symbol },
    });
    return data?.data || [];
  } catch (err) {
    console.error("Error fetchExpirations:", err);
    return [];
  }
}

// 🔹 Cargar strikes disponibles para una fecha de expiración
export async function fetchChains(symbol, expiration) {
  try {
    const { data } = await axios.get(`${API_BASE}/api/tradier/chains`, {
      params: { symbol, expiration },
    });
    return data?.data || { strikes: [], step: 1, calls: [], puts: [] };
  } catch (err) {
    console.error("Error fetchChains:", err);
    return { strikes: [], step: 1, calls: [], puts: [] };
  }
}

// 🔹 Cargar precio spot del subyacente
export async function fetchUnderlyingQuote(symbol) {
  try {
    const { data } = await axios.get(`${API_BASE}/api/tradier/quote/underlying`, {
      params: { symbol },
    });
    return data?.data?.last ?? null;
  } catch (err) {
    console.error("Error fetchUnderlyingQuote:", err);
    return null;
  }
}
