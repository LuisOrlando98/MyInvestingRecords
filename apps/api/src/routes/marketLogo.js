// routes/marketLogo.js
import express from "express";
import axios from "axios";

const router = express.Router();

/**
 * NASDAQ API (gratis) — obtiene:
 *  - nombre exacto
 *  - logo oficial (SVG/PNG)
 *  - industria
 *  - país
 *
 * URL ejemplo:
 * https://api.nasdaq.com/api/quote/AAPL/info?assetclass=stocks
 */

router.get("/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const url = `https://api.nasdaq.com/api/quote/${symbol}/info?assetclass=stocks`;

    const r = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        Origin: "https://www.nasdaq.com",
        Referer: "https://www.nasdaq.com/",
      },
    });

    const data = r.data?.data;

    if (!data) {
      return res.json({
        name: symbol,
        logo: `https://ui-avatars.com/api/?name=${symbol}&background=random`,
      });
    }

    const name = data.companyName || symbol;

   const logo =
  data.logoUrl && data.logoUrl.startsWith("http")
    ? data.logoUrl
    : `https://financialmodelingprep.com/image-stock/${symbol}.png`;
    
    return res.json({ name, logo });
  } catch (err) {
    console.log("NASDAQ ERROR:", err.message);
    return res.json({
      name: req.params.symbol,
      logo,
    });
  }
});

export default router;
