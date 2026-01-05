// api/src/services/marketEngine.js
import axios from "axios";

/* ===========================================================
   Helpers
=========================================================== */
function uniqUpper(symbols = []) {
  return [
    ...new Set(
      symbols.map((s) => String(s).toUpperCase().trim()).filter(Boolean)
    ),
  ];
}

function getMarketSessionNY() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );

  const d = now.getDay();
  if (d === 0 || d === 6) return "CLOSED";

  const m = now.getHours() * 60 + now.getMinutes();
  if (m < 570) return "PRE";       // < 9:30
  if (m < 960) return "REGULAR";   // < 16:00
  if (m < 1200) return "AFTER";    // < 20:00
  return "CLOSED";
}

// Simple concurrency limit
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) break;
        out[idx] = await fn(items[idx], idx);
      }
    }
  );

  await Promise.all(workers);
  return out;
}

/* ===========================================================
   MarketEngine (Singleton)
=========================================================== */
class MarketEngine {
  constructor() {
    // TTLs
    this.TTL_QUOTES_MS = 2500; // ultra rápido UI
    this.TTL_PROFILE_MS = 24 * 60 * 60 * 1000;
    this.TTL_SPARK_MS = 20 * 1000;

    // Caches
    this.quotesCache = new Map();   // sym -> { ts, data }
    this.profileCache = new Map();
    this.sparkCache = new Map();

    // In-flight dedupe
    this.inFlightQuotes = new Map();
    this.inFlightProfile = new Map();
    this.inFlightSpark = new Map();
  }

  /* ===========================================================
     TRADIER — QUOTES (BATCH)
  ============================================================ */
  async _fetchTradierQuotes(symbols = []) {
    const tickers = uniqUpper(symbols);
    if (!tickers.length) return {};

    const url = `${process.env.TRADIER_API_URL}/markets/quotes`;
    const res = await axios.get(url, {
      params: { symbols: tickers.join(",") },
      headers: {
        Authorization: `Bearer ${process.env.TRADIER_API_TOKEN}`,
        Accept: "application/json",
      },
      timeout: 8000,
    });

    let raw = res.data?.quotes?.quote || [];
    if (!Array.isArray(raw)) raw = [raw];

    const quotes = {};

    for (const q of raw) {
      if (!q?.symbol) continue;

      quotes[q.symbol] = {
        // REGULAR
        last: Number(q.last) || null,
        close: Number(q.close) || null,
        changeAmount: Number(q.change) || 0,
        changePercent: Number(q.change_percentage) || 0,
        volume: q.volume || 0,

        // AFTER HOURS
        after: q.after_hours_price
          ? {
              price: Number(q.after_hours_price),
              changeAmount: Number(q.after_hours_change),
              changePercent: Number(q.after_hours_change_percentage),
            }
          : null,

        // PRE MARKET
        pre: q.pre_market_price
          ? {
              price: Number(q.pre_market_price),
              changeAmount: Number(q.pre_market_change),
              changePercent: Number(q.pre_market_change_percentage),
            }
          : null,
      };
    }

    return quotes;
  }

  /* ===========================================================
     FINNHUB — PROFILE
  ============================================================ */
  async _fetchFinnhubProfile(sym) {
    const url = "https://finnhub.io/api/v1/stock/profile2";
    const res = await axios.get(url, {
      params: { symbol: sym, token: process.env.FINNHUB_API_KEY },
      timeout: 8000,
    });

    return {
      company: res.data?.name || sym,
      exchange: res.data?.exchange,
      ipo: res.data?.ipo,
      industry: res.data?.finnhubIndustry,
      marketCap: res.data?.marketCapitalization,
    };
  }

  /* ===========================================================
     FINNHUB — SPARK
  ============================================================ */
  async _fetchSpark(sym) {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 6 * 60 * 60;

    const res = await axios.get(
      "https://finnhub.io/api/v1/stock/candle",
      {
        params: {
          symbol: sym,
          resolution: 5,
          from,
          to: now,
          token: process.env.FINNHUB_API_KEY,
        },
        timeout: 8000,
      }
    );

    if (!res.data || res.data.s !== "ok") return [];
    return res.data.t.map((t, i) => ({
      x: t,
      y: res.data.c[i],
    }));
  }

  /* ===========================================================
     PUBLIC API
  ============================================================ */

  // ⚡ FAST QUOTES (cache + dedupe)
  async getQuotes(symbols = []) {
    const tickers = uniqUpper(symbols);
    const session = getMarketSessionNY();
    const now = Date.now();

    if (!tickers.length)
      return { quotes: {}, marketSession: session };

    const key = tickers.slice().sort().join(",");

    if (this.inFlightQuotes.has(key)) {
      return this.inFlightQuotes.get(key);
    }

    const promise = (async () => {
      const out = {};
      const missing = [];

      for (const sym of tickers) {
        const hit = this.quotesCache.get(sym);
        if (hit && now - hit.ts < this.TTL_QUOTES_MS) {
          out[sym] = hit.data;
        } else {
          missing.push(sym);
        }
      }

      if (missing.length) {
        let fresh = {};
        try {
          fresh = await this._fetchTradierQuotes(missing);
        } catch {
          fresh = {};
        }

        for (const sym of missing) {
          const q = fresh[sym];
          if (!q) continue;

          let extended = null;

          if (session === "AFTER" && q.after) {
            extended = { session: "AH", ...q.after };
          }

          if (session === "PRE" && q.pre) {
            extended = { session: "PM", ...q.pre };
          }

          const normalized = {
            price: q.last,
            changeAmount: q.changeAmount,
            changePercent: q.changePercent,
            volume: q.volume,

            extended,              // 🔥 AH / PM REAL
            marketSession: session,
          };

          this.quotesCache.set(sym, {
            ts: Date.now(),
            data: normalized,
          });

          out[sym] = normalized;
        }
      }

      return { quotes: out, marketSession: session };
    })();

    this.inFlightQuotes.set(key, promise);

    try {
      return await promise;
    } finally {
      this.inFlightQuotes.delete(key);
    }
  }

  // 🧱 PROFILE (cache 24h)
  async getProfiles(symbols = [], { concurrency = 4 } = {}) {
    const tickers = uniqUpper(symbols);
    const now = Date.now();
    const meta = {};

    await mapLimit(tickers, concurrency, async (sym) => {
      const hit = this.profileCache.get(sym);
      if (hit && now - hit.ts < this.TTL_PROFILE_MS) {
        meta[sym] = hit.data;
        return;
      }

      if (this.inFlightProfile.has(sym)) {
        meta[sym] = await this.inFlightProfile.get(sym);
        return;
      }

      const p = (async () => {
        try {
          const data = await this._fetchFinnhubProfile(sym);
          this.profileCache.set(sym, { ts: Date.now(), data });
          return data;
        } catch {
          const data = { company: sym };
          this.profileCache.set(sym, { ts: Date.now(), data });
          return data;
        }
      })();

      this.inFlightProfile.set(sym, p);
      try {
        meta[sym] = await p;
      } finally {
        this.inFlightProfile.delete(sym);
      }
    });

    return meta;
  }

  // 📈 SPARK (cache corto)
  async getSparks(symbols = [], { concurrency = 3 } = {}) {
    const tickers = uniqUpper(symbols);
    const now = Date.now();
    const spark = {};

    await mapLimit(tickers, concurrency, async (sym) => {
      const hit = this.sparkCache.get(sym);
      if (hit && now - hit.ts < this.TTL_SPARK_MS) {
        spark[sym] = hit.data;
        return;
      }

      if (this.inFlightSpark.has(sym)) {
        spark[sym] = await this.inFlightSpark.get(sym);
        return;
      }

      const p = (async () => {
        try {
          const data = await this._fetchSpark(sym);
          this.sparkCache.set(sym, { ts: Date.now(), data });
          return data;
        } catch {
          const data = [];
          this.sparkCache.set(sym, { ts: Date.now(), data });
          return data;
        }
      })();

      this.inFlightSpark.set(sym, p);
      try {
        spark[sym] = await p;
      } finally {
        this.inFlightSpark.delete(sym);
      }
    });

    return spark;
  }
}

export const marketEngine = new MarketEngine();
