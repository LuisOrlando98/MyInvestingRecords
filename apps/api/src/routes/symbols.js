// routes/symbols.js
import express from "express";
import axios from "axios";

const router = express.Router();

/**
 * GET /api/symbols/search?q=spy
 * Devuelve sugerencias de símbolos para autocompletar (USA).
 */
router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json({ success: true, data: [] });

    const key = process.env.FINNHUB_API_KEY;
    const { data } = await axios.get("https://finnhub.io/api/v1/search", {
      params: { q, token: key },
    });

    // Filtra a acciones/ETFs de US
    const out = (data?.result || [])
      .filter(r => (r.type === "Common Stock" || r.type === "ETF" || r.type === "REIT") && r.symbol)
      .slice(0, 10)
      .map(r => ({
        symbol: r.symbol,
        description: r.description,
        type: r.type,
      }));

    res.json({ success: true, data: out });
  } catch (err) {
    console.error("symbols/search error:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: "No se pudo buscar símbolos" });
  }
});

export default router;
