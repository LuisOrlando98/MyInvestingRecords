import axios from "axios";
import * as cheerio from "cheerio";

const FINVIZ_URL = "https://finviz.com/quote.ashx?t=";

/**
 * Extrae datos fundamentales desde Finviz
 * @param {string} ticker - símbolo del activo (ej: AAPL)
 * @returns {Promise<{ ticker: string, data: Array<{label: string, value: string}> }>}
 */
export async function getFinvizData(ticker) {
  try {
    // ✅ 1. Primera petición (obtener cookies de Cloudflare)
    const initialRes = await axios.get("https://finviz.com", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.google.com/",
      },
    });

    const cookies = initialRes.headers["set-cookie"] || [];

    // ✅ 2. Petición principal a la página del ticker
    const response = await axios.get(`${FINVIZ_URL}${ticker}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://finviz.com/",
        Cookie: cookies.join("; "),
      },
    });

    // ✅ 3. Parsear HTML con cheerio
    const $ = cheerio.load(response.data);
    const data = [];

    $("table.snapshot-table2 tr").each((_, row) => {
      const cells = $(row).find("td");
      for (let i = 0; i < cells.length; i += 2) {
        const label = $(cells[i]).text().trim();
        const value = $(cells[i + 1]).text().trim();
        if (label && value) data.push({ label, value });
      }
    });

    // ✅ 4. Quitar duplicados o campos vacíos
    const filteredData = data.filter(
      (item, index, self) =>
        item.label &&
        item.value &&
        index === self.findIndex((t) => t.label === item.label)
    );

    // ✅ 5. Añadir campos placeholders si faltan (para mantener layout estable)
    const missingFields = ["Recom", "Target Price", "EPS (ttm)", "Dividend %"];
    missingFields.forEach((field) => {
      if (!filteredData.find((x) => x.label === field))
        filteredData.push({ label: field, value: "—" });
    });

    return {
      ticker: ticker.toUpperCase(),
      data: filteredData,
    };
  } catch (error) {
    console.error("❌ Error scraping Finviz:", error.message);
    throw new Error(`Failed to scrape Finviz for ${ticker}: ${error.message}`);
  }
}
