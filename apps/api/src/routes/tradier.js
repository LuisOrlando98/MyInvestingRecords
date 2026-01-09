// routes/tradier.js
import express from "express";
import axios from "axios";

import { getOptionQuote } from "../services/tradier.js";
import { generateOccSymbol } from "../utils/occSymbol.js";

const router = express.Router();
const TOKEN = process.env.TRADIER_ACCESS_TOKEN;

/* ============================================================
   🚀 BATCH REAL DE TRADIER (INTERNO, SEGURO)
   - NO rompe nada
   - Devuelve MISMO formato que getOptionQuote
   - Se usa SOLO en /quotes con fallback automático
============================================================ */
async function getOptionQuotesBatch(symbols = []) {
  if (!symbols.length) return [];

  const { data } = await axios.get(
    "https://api.tradier.com/v1/markets/quotes",
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/json",
      },
      params: {
        symbols: symbols.join(","),
        greeks: true,
      },
    }
  );

  const quote = data?.quotes?.quote;
  if (!quote) return [];

  return Array.isArray(quote) ? quote : [quote];
}

/* ============================================================
   GET /api/tradier/quote
   - Acepta OCC directamente
   - O genera OCC desde params
============================================================ */
router.get("/quote", async (req, res) => {
  try {
    let { symbol, expiration, strike, type } = req.query;

    if (expiration && strike && type) {
      const generated = generateOccSymbol(symbol, expiration, strike, type);
      if (!generated) {
        return res.status(400).json({
          success: false,
          error: "Invalid parameters for OCC symbol",
        });
      }
      symbol = generated;
    }

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: "Symbol is required",
      });
    }

    const data = await getOptionQuote(symbol);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Tradier /quote error:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch option quote",
    });
  }
});

/* ============================================================
   GET /api/tradier/quotes
   ✅ Batch REAL + fallback SEGURO
   ❌ NO rompe frontend
============================================================ */
router.get("/quotes", async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      return res.status(400).json({
        success: false,
        error: "Symbols are required",
      });
    }

    const list = symbols
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!list.length) {
      return res.status(400).json({
        success: false,
        error: "Empty symbols list",
      });
    }

    let quotes = [];

    try {
      // 🚀 Camino rápido (batch REAL)
      quotes = await getOptionQuotesBatch(list);

      // Seguridad total: si Tradier devuelve vacío → fallback
      if (!Array.isArray(quotes) || !quotes.length) {
        throw new Error("Empty batch response");
      }
    } catch (batchErr) {
      // 🛟 Fallback EXACTO al comportamiento original
      const results = await Promise.allSettled(
        list.map((sym) => getOptionQuote(sym))
      );

      quotes = results
        .filter((r) => r.status === "fulfilled" && r.value?.symbol)
        .map((r) => r.value);
    }

    res.json({
      success: true,
      quotes,
      count: quotes.length,
    });
  } catch (err) {
    console.error("❌ Tradier /quotes error:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch quotes",
    });
  }
});

/* ============================================================
   GET /api/tradier/expirations
   - Incluye ALL roots (XSP, minis, etc.)
============================================================ */
router.get("/expirations", async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: "Symbol is required",
      });
    }

    const { data } = await axios.get(
      "https://api.tradier.com/v1/markets/options/expirations",
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/json",
        },
        params: {
          symbol,
          includeAllRoots: true,
          strikes: false,
        },
      }
    );

    let expirations = data?.expirations?.date || [];
    if (!Array.isArray(expirations)) expirations = [expirations];

    expirations.sort((a, b) => new Date(a) - new Date(b));

    res.json({ success: true, data: expirations });
  } catch (err) {
    console.error(
      "❌ Tradier /expirations error:",
      err.response?.data || err.message
    );
    res.status(500).json({
      success: false,
      error: "Failed to fetch expirations",
    });
  }
});

/* ============================================================
   GET /api/tradier/chains
============================================================ */
router.get("/chains", async (req, res) => {
  try {
    const { symbol, expiration } = req.query;
    if (!symbol || !expiration) {
      return res.status(400).json({
        success: false,
        error: "Symbol and expiration are required",
      });
    }

    const { data } = await axios.get(
      "https://api.tradier.com/v1/markets/options/chains",
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/json",
        },
        params: { symbol, expiration },
      }
    );

    let options = data?.options?.option || [];
    if (!Array.isArray(options)) options = [];

    const strikes = Array.from(
      new Set(options.map((o) => Number(o.strike)))
    )
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
        calls: calls.map((c) => ({
          strike: Number(c.strike),
          symbol: c.symbol,
        })),
        puts: puts.map((p) => ({
          strike: Number(p.strike),
          symbol: p.symbol,
        })),
      },
    });
  } catch (err) {
    console.error(
      "❌ Tradier /chains error:",
      err.response?.data || err.message
    );
    res.status(500).json({
      success: false,
      error: "Failed to fetch option chain",
    });
  }
});

/* ============================================================
   GET /api/tradier/quote/underlying
============================================================ */
router.get("/quote/underlying", async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: "Symbol is required",
      });
    }

    const { data } = await axios.get(
      "https://api.tradier.com/v1/markets/quotes",
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/json",
        },
        params: { symbols: symbol },
      }
    );

    const quote = data?.quotes?.quote;
    const last = Array.isArray(quote) ? quote[0]?.last : quote?.last;

    res.json({
      success: true,
      data: { last: Number(last) || null },
    });
  } catch (err) {
    console.error(
      "❌ Tradier /quote/underlying error:",
      err.response?.data || err.message
    );
    res.status(500).json({
      success: false,
      error: "Failed to fetch underlying price",
    });
  }
});

export default router;
