// src/routes/performance.js
import express from "express";
import Position from "../models/Position.js";

const router = express.Router();

/* ============================================================
   📊 PERFORMANCE — REALIZED TRADES ONLY (SOURCE OF TRUTH)
============================================================ */
router.get("/", async (req, res) => {
  try {
    const { from, to, symbol, strategy, broker } = req.query;

    const match = {
      status: "Closed",
    };

    if (symbol) match.symbol = symbol.toUpperCase();
    if (strategy) match.strategy = strategy;
    if (broker) match.broker = broker;

    if (from || to) {
      match.closeDate = {};
      if (from) match.closeDate.$gte = new Date(from);
      if (to) match.closeDate.$lte = new Date(to);
    }

    const positions = await Position.find(match).sort({ closeDate: -1 });

    /* ================= TABLE ROWS ================= */
    const rows = positions.map((p) => ({
      date: p.closeDate,
      symbol: p.symbol,
      strategy: p.strategy,
      revenue: Number(p.realizedPnL || 0),
      result:
        p.realizedPnL > 0
          ? "WIN"
          : p.realizedPnL < 0
          ? "LOSS"
          : "BREAKEVEN",
    }));

    /* ================= SUMMARY ================= */
    const pnls = positions.map((p) => p.realizedPnL || 0);

    const totalTrades = pnls.length;
    const totalPnL = pnls.reduce((a, b) => a + b, 0);
    const wins = pnls.filter((p) => p > 0);
    const losses = pnls.filter((p) => p < 0);

    const summary = {
      totalTrades,
      totalPnL: Number(totalPnL.toFixed(2)),
      winRate: totalTrades
        ? Number(((wins.length / totalTrades) * 100).toFixed(2))
        : 0,
      avgWin: wins.length
        ? Number((wins.reduce((a, b) => a + b, 0) / wins.length).toFixed(2))
        : 0,
      avgLoss: losses.length
        ? Number((losses.reduce((a, b) => a + b, 0) / losses.length).toFixed(2))
        : 0,
    };

    res.json({ success: true, rows, summary });
  } catch (err) {
    console.error("❌ Performance error:", err);
    res.status(500).json({ success: false, error: "Performance error" });
  }
});

export default router;
