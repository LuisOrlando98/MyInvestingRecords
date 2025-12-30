// routes/marketData.js
import express from "express";
import { auth as authMiddleware } from "../middleware/auth.js";
import { evaluateAlerts } from "../services/alertEngine.js";
import { marketEngine } from "../services/marketEngine.js";

const router = express.Router();

/* ===========================================================
   ⚡ FAST QUOTES — UI CRÍTICO
   Usado por: Dashboard / Watchlist / Screener
=========================================================== */
router.post("/quotes-fast", authMiddleware, async (req, res) => {
  try {
    let { tickers } = req.body;
    if (!tickers) return res.status(400).json({ error: "Tickers required" });

    tickers = tickers.map((t) => String(t).toUpperCase().trim());

    const { quotes, marketSession } = await marketEngine.getQuotes(tickers);

    res.json({ quotes, marketSession });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===========================================================
   ✅ Alias compatible (frontend existente)
=========================================================== */
router.post("/quotes-batch", authMiddleware, async (req, res) => {
  try {
    let { tickers } = req.body;
    if (!tickers) return res.status(400).json({ error: "Tickers required" });

    tickers = tickers.map((t) => String(t).toUpperCase().trim());

    const { quotes, marketSession } = await marketEngine.getQuotes(tickers);

    res.json({ quotes, marketSession });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===========================================================
   🧱 BATCH COMPLETO — DETALLE (NO UI CRÍTICO)
   Mantiene response: { quotes, meta, spark }
=========================================================== */
router.post("/batch", authMiddleware, async (req, res) => {
  try {
    let { tickers } = req.body;
    if (!tickers) return res.status(400).json({ error: "Tickers required" });

    tickers = tickers.map((t) => String(t).toUpperCase().trim());

    // 1️⃣ Quotes rápidos (cacheados)
    const { quotes } = await marketEngine.getQuotes(tickers);

    // 2️⃣ Meta + spark en paralelo (cache + concurrency)
    const [meta, spark] = await Promise.all([
      marketEngine.getProfiles(tickers, { concurrency: 4 }),
      marketEngine.getSparks(tickers, { concurrency: 3 }),
    ]);

    // 3️⃣ Alerts en background (NO bloquean)
    const io = req.app.get("io");
    evaluateAlerts(quotes, io).catch((e) =>
      console.error("AlertEngine error:", e.message)
    );

    res.json({ quotes, meta, spark });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
