// routes/marketData.js
import express from "express";
import axios from "axios";
import { auth as authMiddleware } from "../middleware/auth.js";
import { evaluateAlerts } from "../services/alertEngine.js";

const router = express.Router();

/* ===========================================================
   INTERNAL DELAY TO PREVENT FINNHUB 429 DURING F5 SPAM
=========================================================== */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ===========================================================
   TRADIER QUOTES
=========================================================== */
async function getTradierQuotes(tickers = []) {
  try {
    const url = `${process.env.TRADIER_API_URL}/markets/quotes`;

    const res = await axios.get(url, {
      params: { symbols: tickers.join(",") },
      headers: {
        Authorization: `Bearer ${process.env.TRADIER_API_TOKEN}`,
        Accept: "application/json",
      },
    });

    let raw = res.data?.quotes?.quote || [];
    if (!Array.isArray(raw)) raw = [raw];

    const quotes = {};
    for (const q of raw) {
      if (!q?.symbol) continue;

      quotes[q.symbol] = {
        price: Number(q.last) || null,
        changeAmount: Number(q.change) || 0,
        changePercent: Number(q.change_percentage) || 0,
        volume: q.volume || 0,
      };
    }

    return quotes;
  } catch {
    return {};
  }
}

/* ===========================================================
   FINNHUB PROFILE
=========================================================== */
async function getFinnhubProfile(symbol) {
  try {
    const url = `https://finnhub.io/api/v1/stock/profile2`;

    await wait(250); // throttle
    const res = await axios.get(url, {
      params: { symbol, token: process.env.FINNHUB_API_KEY },
    });

    return {
      company: res.data.name || symbol,
      exchange: res.data.exchange,
      ipo: res.data.ipo,
      industry: res.data.finnhubIndustry,
      marketCap: res.data.marketCapitalization,
    };
  } catch {
    return { company: symbol };
  }
}

/* ===========================================================
   SPARKLINE
=========================================================== */
async function getSpark(symbol) {
  try {
    await wait(200);
    const now = Math.floor(Date.now() / 1000);
    const from = now - 6 * 60 * 60;

    const res = await axios.get(
      `https://finnhub.io/api/v1/stock/candle`,
      {
        params: {
          symbol,
          resolution: 5,
          from,
          to: now,
          token: process.env.FINNHUB_API_KEY,
        },
      }
    );

    if (!res.data || res.data.s !== "ok") return [];

    return res.data.t.map((t, i) => ({ x: t, y: res.data.c[i] }));
  } catch {
    return [];
  }
}

/* ===========================================================
   MAIN BATCH ROUTE
=========================================================== */
router.post("/batch", authMiddleware, async (req, res) => {
  try {
    let { tickers } = req.body;
    if (!tickers) return res.status(400).json({ error: "Tickers required" });

    tickers = tickers.map((t) => t.toUpperCase().trim());

    const quotes = await getTradierQuotes(tickers);

    const meta = {};
    for (const sym of tickers) {
      meta[sym] = await getFinnhubProfile(sym);
    }

    const spark = {};
    for (const sym of tickers) {
      spark[sym] = await getSpark(sym);
    }

    // 🔔 EVALUAR ALERTAS
    const io = req.app.get("io");
    await evaluateAlerts(quotes, io);

    res.json({ quotes, meta, spark });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
