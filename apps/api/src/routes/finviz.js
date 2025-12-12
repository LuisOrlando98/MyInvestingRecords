import express from "express";
import { getFinvizData } from "../utils/finvizScraper.js";

const router = express.Router();

router.get("/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;
    const result = await getFinvizData(ticker);

    res.json({
      success: true,
      data: result.data, // 👈 ahora "data" está dentro de "data"
      ticker: result.ticker,
    });
  } catch (err) {
    console.error("❌ Finviz route error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;