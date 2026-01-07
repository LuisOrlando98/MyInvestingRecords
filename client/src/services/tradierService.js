// src/services/tradierService.js
import api from "./api";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/* ============================================================
   SIMPLE IN-MEMORY CACHE (FAST, NO BREAKING)
   - evita llamadas repetidas mientras navegas
   - NO persiste, no toca funcionalidad
============================================================ */
const _cache = new Map();
/**
 * @param {string} key
 * @param {number} ttlMs
 * @param {Function} fetcher  async () => data
 */
async function cached(key, ttlMs, fetcher) {
  const now = Date.now();
  const hit = _cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const value = await fetcher();
  _cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/* ============================================================
   UTILS
============================================================ */
function uniq(arr) {
  return Array.from(new Set(arr));
}

function normalizeQuoteItems(data) {
  // soporta múltiples formatos que ya manejabas
  if (Array.isArray(data?.quotes)) return data.quotes;
  if (Array.isArray(data)) return data;
  if (data?.quotes) return [data.quotes];
  return [];
}

/**
 * ✅ Extrae IV correctamente desde distintas formas de Tradier
 * y lo devuelve en porcentaje (0-100)
 */
function extractImpliedVolPct(q) {
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

  // Tradier normalmente da IV en decimal (0.47) → 47%
  return ivRaw !== null && Number.isFinite(ivRaw) ? ivRaw * 100 : null;
}

/* ============================================================
   OPTION QUOTES (OCC symbols)
   - Usa api instance → cookies + refresh + LAN safe
   - Dedupe symbols → menos payload, más rápido
   - Soporta AbortController opcional (sin romper llamadas)
============================================================ */
export async function fetchOptionQuotesByLegs(legs = [], options = {}) {
  try {
    const symbolsArr = uniq(
      legs
        .map((l) => l.occSymbol || l.symbol || l.optionSymbol)
        .filter(Boolean)
        .map((s) => String(s).trim())
        .filter(Boolean)
    );

    if (!symbolsArr.length) return {};

    const symbols = symbolsArr.join(",");

    const { data } = await api.get(`/api/tradier/quotes`, {
      // baseURL ya está en api, pero esto ayuda si algún día cambias
      baseURL: API_BASE,
      params: { symbols, greeks: true },
      // opcional: permitir abort sin cambiar el resto del app
      signal: options.signal,
    });

    const items = normalizeQuoteItems(data);
    const quotes = {};

    items.forEach((q) => {
      if (!q?.symbol) return;

      quotes[q.symbol] = {
        last: q.last ?? null,
        bid: q.bid ?? null,
        ask: q.ask ?? null,
        prevClose: q.previous_close ?? null,
        change: q.change ?? null,
        delta: q.greeks?.delta ?? null,
        theta: q.greeks?.theta ?? null,
        impliedVol: extractImpliedVolPct(q),
      };
    });

    return quotes;
  } catch (err) {
    // si fue abort, no lo trates como error real
    if (err?.name === "CanceledError" || err?.name === "AbortError") {
      return {};
    }
    console.error("Tradier quote fetch error:", err);
    return {};
  }
}

/* ============================================================
   EXPIRATIONS
   - Cache corto (30s) → súper rápido al volver a abrir el modal
============================================================ */
export async function fetchExpirations(symbol, options = {}) {
  try {
    const sym = String(symbol || "").trim().toUpperCase();
    if (!sym) return [];

    const key = `exp:${sym}`;
    return await cached(key, 30_000, async () => {
      const { data } = await api.get(`/api/tradier/expirations`, {
        baseURL: API_BASE,
        params: { symbol: sym },
        signal: options.signal,
      });
      return data?.data || [];
    });
  } catch (err) {
    if (err?.name === "CanceledError" || err?.name === "AbortError") return [];
    console.error("Error fetchExpirations:", err);
    return [];
  }
}

/* ============================================================
   CHAINS
   - Cache corto (20s) → reduce lag brutal al cambiar strikes/fechas
============================================================ */
export async function fetchChains(symbol, expiration, options = {}) {
  try {
    const sym = String(symbol || "").trim().toUpperCase();
    const exp = String(expiration || "").trim();
    if (!sym || !exp) {
      return { strikes: [], step: 1, calls: [], puts: [] };
    }

    const key = `chains:${sym}:${exp}`;
    return await cached(key, 20_000, async () => {
      const { data } = await api.get(`/api/tradier/chains`, {
        baseURL: API_BASE,
        params: { symbol: sym, expiration: exp },
        signal: options.signal,
      });
      return data?.data || { strikes: [], step: 1, calls: [], puts: [] };
    });
  } catch (err) {
    if (err?.name === "CanceledError" || err?.name === "AbortError") {
      return { strikes: [], step: 1, calls: [], puts: [] };
    }
    console.error("Error fetchChains:", err);
    return { strikes: [], step: 1, calls: [], puts: [] };
  }
}

/* ============================================================
   UNDERLYING QUOTE
   - Cache ultra corto (2s) → evita spam al tipear/buscar
============================================================ */
export async function fetchUnderlyingQuote(symbol, options = {}) {
  try {
    const sym = String(symbol || "").trim().toUpperCase();
    if (!sym) return null;

    const key = `und:${sym}`;
    return await cached(key, 2_000, async () => {
      const { data } = await api.get(`/api/tradier/quote/underlying`, {
        baseURL: API_BASE,
        params: { symbol: sym },
        signal: options.signal,
      });
      return data?.data?.last ?? null;
    });
  } catch (err) {
    if (err?.name === "CanceledError" || err?.name === "AbortError") return null;
    console.error("Error fetchUnderlyingQuote:", err);
    return null;
  }
}
