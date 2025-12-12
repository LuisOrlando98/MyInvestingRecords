// services/tradier.js
import dotenv from "dotenv";
dotenv.config();

import axios from "axios";

const TRADIER_API = process.env.TRADIER_API_URL;
const TOKEN = process.env.TRADIER_ACCESS_TOKEN || process.env.TRADIER_API_TOKEN;

const client = axios.create({
  baseURL: TRADIER_API?.trim().replace(/\/$/, ""), // por si acaso trae espacio o /
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/json",
  },
});

/**
 * ✅ Cotización directa usando el símbolo OCC completo
 * Ejemplo: AAPL240119C00150000
 */
export async function getOptionQuote(symbol) {
  try {
    const res = await client.get(`/markets/quotes`, {
      params: { symbols: symbol, greeks: true },
    });

    console.log("📦 Raw Tradier Response:", JSON.stringify(res.data, null, 2));

    const q = res.data?.quotes?.quote;

    // 🟡 Caso 1: símbolo no reconocido
    if (!q || res.data?.quotes?.unmatched_symbols) {
      console.warn("⚠️ Símbolo OCC inválido o no encontrado:", symbol);
      return null;
    }

    return {
      symbol: q.symbol,
      last: q.last,
      bid: q.bid,
      ask: q.ask,
      mid: q.bid && q.ask ? (q.bid + q.ask) / 2 : q.last,
      volume: q.volume,
      greeks: q.greeks || null,
      impliedVolatility: q.greeks?.implied_vol ? q.greeks.implied_vol / 100 : null, // ✅ divide entre 100
    };
  } catch (err) {
    console.error("❌ Error al obtener cotización Tradier:", err.response?.data || err.message);
    throw err;
  }
}

/**
 * ✅ Cotización construyendo el símbolo OCC
 * Ejemplo: { symbol: "AAPL", expiration: "2024-01-19", strike: 150, type: "call" }
 */
export async function getOptionQuoteFromDetails({ symbol, expiration, strike, type }) {
  try {
    const exp = expiration.replace(/-/g, "").slice(2); // YYYY-MM-DD → YYMMDD
    const occStrike = String(Math.round(strike * 1000)).padStart(8, "0");
    const cp = type.toUpperCase() === "CALL" ? "C" : "P";
    const occSymbol = `${symbol}${exp}${cp}${occStrike}`;

    return await getOptionQuote(occSymbol);
  } catch (err) {
    console.error("❌ Error construyendo símbolo OCC:", err.message);
    throw err;
  }
}

/**
 * 🔹 Helper universal GET Tradier (para expirations, chains, underlying, etc.)
 */
export async function tradierGET(endpoint, params = {}) {
  try {
    const res = await client.get(endpoint, { params });
    return res.data;
  } catch (err) {
    console.error("❌ tradierGET error:", err.response?.data || err.message);
    throw err;
  }
}
