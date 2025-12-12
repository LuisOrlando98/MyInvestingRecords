import express from "express";
import { getOptionQuoteFromDetails } from "../services/tradier.js"; // ✅ Corrección aquí

const router = express.Router();

/**
 * GET /api/options/quote?symbol=AAPL&expiration=2024-01-19&strike=150&type=call
 */
router.get("/quote", async (req, res) => {
  try {
    const data = await getOptionQuoteFromDetails(req.query); // ✅ Usa la función adecuada

    if (!data) return res.json({ success: false, data: null });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: "Error fetching option quote" });
  }
});

export default router;
