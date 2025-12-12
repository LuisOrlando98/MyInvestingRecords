// routes/marketLogosBatch.js
import express from "express";
import axios from "axios";
import { auth as authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/market/logo/batch
 * Body: { tickers: [...] }
 * INSTANTANEO:
 * - NO usa Yahoo
 * - Logos solo via Clearbit (sin esperar confirmación)
 * - Metadata la manda vacía (viene de /batch)
 */
router.post("/", authMiddleware, async (req, res) => {
  const { tickers } = req.body;

  if (!Array.isArray(tickers) || tickers.length === 0) {
    return res.json({ logos: {}, meta: {} });
  }

  const logos = {};

  tickers.forEach((sym) => {
    // usamos el truco de clearbit con fallback automático
    logos[sym] = `https://logo.clearbit.com/${sym.toLowerCase()}.com`;
  });

  return res.json({
    logos,
    meta: {}, // los nombres vienen del batch de quotes
  });
});

export default router;
