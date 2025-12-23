// routes/news.js
import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

  if (!FINNHUB_API_KEY) {
    return res.status(500).json({ error: "Missing FINNHUB_API_KEY" });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const lastWeek = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // 1️⃣ Company-specific news
    const companyReq = axios.get(
      "https://finnhub.io/api/v1/company-news",
      {
        params: {
          symbol,
          from: lastWeek,
          to: today,
          token: FINNHUB_API_KEY,
        },
      }
    );

    // 2️⃣ General market news
    const marketReq = axios.get(
      "https://finnhub.io/api/v1/news",
      {
        params: {
          category: "general",
          token: FINNHUB_API_KEY,
        },
      }
    );

    const [companyRes, marketRes] = await Promise.all([
      companyReq,
      marketReq,
    ]);

    const companyNews = Array.isArray(companyRes.data)
      ? companyRes.data
      : [];

    const marketNews = Array.isArray(marketRes.data)
      ? marketRes.data.filter(
          (n) =>
            n.headline?.toUpperCase().includes(symbol) ||
            n.summary?.toUpperCase().includes(symbol)
        )
      : [];

    // 🔀 Merge + dedupe por URL
    const merged = [...companyNews, ...marketNews].reduce(
      (acc, item) => {
        if (!acc.map.has(item.url)) {
          acc.map.set(item.url, true);
          acc.list.push(item);
        }
        return acc;
      },
      { map: new Map(), list: [] }
    ).list;

    // ⏱ Ordenar por fecha
    merged.sort((a, b) => b.datetime - a.datetime);

    res.json(merged);
  } catch (err) {
    console.error("❌ Finnhub news error:", err.response?.data || err.message);
    res.status(500).json([]);
  }
});

export default router;
