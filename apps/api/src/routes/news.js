// routes/news.js
import express from "express";
import axios from "axios";

const router = express.Router();

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "d49jis1r01qlaebhlrjgd49jis1r01qlaebhlrk0";

router.get("/:symbol", async (req, res) => {
  const { symbol } = req.params;

  try {
    const today = new Date().toISOString().split("T")[0];
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const response = await axios.get("https://finnhub.io/api/v1/company-news", {
      params: {
        symbol,
        from: lastWeek,
        to: today,
        token: FINNHUB_API_KEY,
      },
    });

    res.json(response.data);
  } catch (err) {
    console.error("❌ Error fetching Finnhub news:", err.message);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

export default router;
