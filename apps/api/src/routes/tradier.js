// routes/tradier.js
import express from "express";
import { getOptionQuote } from "../services/tradier.js";
import { generateOccSymbol } from "../utils/occSymbol.js";

const router = express.Router();

/**
 * GET /api/tradier/quote
 * - Puede recibir directamente un símbolo OCC
 */
router.get("/quote", async (req, res) => {
  try {
    let { symbol, expiration, strike, type } = req.query;

    if (expiration && strike && type) {
      const generated = generateOccSymbol(symbol, expiration, strike, type);
      if (!generated) {
        return res.status(400).json({ success: false, error: "Parámetros inválidos para OCC" });
      }
      symbol = generated;
    }

    if (!symbol) {
      return res.status(400).json({ success: false, error: "Símbolo requerido" });
    }

    const data = await getOptionQuote(symbol);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Error Tradier /quote:", err.message);
    res.status(500).json({ success: false, error: "No se pudo obtener la cotización" });
  }
});

/**
 * GET /api/tradier/quotes
 */
router.get("/quotes", async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      return res.status(400).json({ success: false, error: "Símbolos requeridos" });
    }

    const list = symbols.split(",").map((s) => s.trim()).filter(Boolean);
    if (!list.length) {
      return res.status(400).json({ success: false, error: "Lista vacía de símbolos" });
    }

    const results = await Promise.allSettled(list.map((sym) => getOptionQuote(sym)));

    const quotes = results
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => r.value);

    res.json({ quotes, count: quotes.length });
  } catch (err) {
    console.error("❌ Error Tradier /quotes:", err.message);
    res.status(500).json({ success: false, error: "No se pudieron obtener cotizaciones" });
  }
});

/**
 * GET /api/tradier/expirations
 */
router.get("/expirations", async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ success: false, error: "Símbolo requerido" });
    }

    const axios = (await import("axios")).default;
    const token = process.env.TRADIER_ACCESS_TOKEN;

    const { data } = await axios.get("https://api.tradier.com/v1/markets/options/expirations", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      params: { symbol, includeAllRoots: true },
    });

    let expirations = data?.expirations?.date || [];
    if (!Array.isArray(expirations)) expirations = [];

    const allowAll = ["SPY", "QQQ", "IWM", "SPX", "NDX", "RUT", "DJX", "VIX"].includes(symbol.toUpperCase());
    const filtered = allowAll
      ? expirations
      : expirations.filter((d) => new Date(d + "T00:00:00Z").getUTCDay() === 5);

    res.json({ success: true, data: filtered });
  } catch (err) {
    console.error("❌ Error expirations:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: "No se pudieron obtener las expiraciones" });
  }
});

/**
 * GET /api/tradier/chains
 */
router.get("/chains", async (req, res) => {
  try {
    const { symbol, expiration } = req.query;
    if (!symbol || !expiration) {
      return res.status(400).json({ success: false, error: "Falta symbol o expiration" });
    }

    const axios = (await import("axios")).default;
    const token = process.env.TRADIER_ACCESS_TOKEN;

    const { data } = await axios.get("https://api.tradier.com/v1/markets/options/chains", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      params: { symbol, expiration },
    });

    let options = data?.options?.option || [];
    if (!Array.isArray(options)) options = [];

    const strikes = Array.from(new Set(options.map((o) => +o.strike)))
      .filter((x) => !isNaN(x))
      .sort((a, b) => a - b);

    const calls = options.filter((o) => o.option_type === "call");
    const puts = options.filter((o) => o.option_type === "put");

    let step = 1;
    for (let i = 1; i < strikes.length; i++) {
      const diff = +(strikes[i] - strikes[i - 1]).toFixed(2);
      if (diff > 0) {
        step = diff;
        break;
      }
    }

    res.json({
      success: true,
      data: {
        strikes,
        step,
        calls: calls.map((c) => ({ strike: +c.strike, symbol: c.symbol })),
        puts: puts.map((p) => ({ strike: +p.strike, symbol: p.symbol })),
      },
    });
  } catch (err) {
    console.error("❌ Error chains:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: "No se pudo obtener la cadena de opciones" });
  }
});

/**
 * GET /api/tradier/quote/underlying
 */
router.get("/quote/underlying", async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({ success: false, error: "Símbolo requerido" });
    }

    const axios = (await import("axios")).default;
    const token = process.env.TRADIER_ACCESS_TOKEN;

    const { data } = await axios.get("https://api.tradier.com/v1/markets/quotes", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      params: { symbols: symbol },
    });

    const quote = data?.quotes?.quote;
    const last = Array.isArray(quote) ? quote[0]?.last : quote?.last;

    res.json({ success: true, data: { last: Number(last) || null } });
  } catch (err) {
    console.error("❌ Error quote underlying:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: "No se pudo obtener precio del subyacente" });
  }
});

export default router;
