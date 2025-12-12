// routes/watchlist.js
import express from "express";
import axios from "axios";
import UserWatchlist from "../models/UserWatchlist.js";
import { auth as authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   GET /api/watchlist
   Devuelve la watchlist completa del usuario
========================================================= */
router.get("/", authMiddleware, async (req, res) => {
  try {
    let wl = await UserWatchlist.findOne({ userId: req.user.id });

    if (!wl) {
      wl = await UserWatchlist.create({
        userId: req.user.id,
        symbols: [],
        meta: {},
      });
    }

    res.json(wl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   POST /api/watchlist/add
   - Agrega símbolo si no existe
   - Guarda company + logo REAL (si existe)
========================================================= */
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: "Symbol required" });
    }

    let wl = await UserWatchlist.findOne({ userId: req.user.id });

    if (!wl) {
      wl = await UserWatchlist.create({
        userId: req.user.id,
        symbols: [],
        meta: {},
      });
    }

    const sym = symbol.toUpperCase().trim();

    // Agregar símbolo si no existe
    if (!wl.symbols.includes(sym)) {
      wl.symbols.push(sym);
    }

    // Asegurar meta.company + meta.logo
    if (!wl.meta?.[sym]?.logo) {
      try {
        const logoRes = await axios.get(
          `${process.env.API_BASE_URL}/api/market/logo/${sym}`
        );

        if (logoRes.data?.logo) {
          wl.meta[sym] = {
            ...(wl.meta[sym] || {}),
            company: logoRes.data.name || sym,
            logo: logoRes.data.logo,
          };
        } else {
          wl.meta[sym] = {
            ...(wl.meta[sym] || {}),
            company: sym,
          };
        }
      } catch {
        wl.meta[sym] = {
          ...(wl.meta[sym] || {}),
          company: sym,
        };
      }
    }

    wl.updatedAt = new Date();
    await wl.save();

    res.json({ success: true, watchlist: wl });
  } catch (err) {
    console.error("❌ Watchlist add error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   POST /api/watchlist/remove
   - Elimina símbolo
   - NO borra meta (cache inteligente)
========================================================= */
router.post("/remove", authMiddleware, async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: "Symbol required" });

    const sym = symbol.toUpperCase().trim();

    const wl = await UserWatchlist.findOne({ userId: req.user.id });
    if (!wl) return res.json({ success: true });

    wl.symbols = wl.symbols.filter((s) => s !== sym);
    wl.updatedAt = new Date();
    await wl.save();

    res.json({ success: true, watchlist: wl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   POST /api/watchlist/repair-meta
   🔧 Repara company + logo para TODOS los símbolos
========================================================= */
router.post("/repair-meta", authMiddleware, async (req, res) => {
  try {
    const wl = await UserWatchlist.findOne({ userId: req.user.id });
    if (!wl) return res.json({ success: true });

    let repaired = 0;

    for (const sym of wl.symbols) {
      try {
        const r = await axios.get(
          `${process.env.API_BASE_URL}/api/market/logo/${sym}`
        );

        if (r.data?.logo) {
          wl.meta[sym] = {
            ...(wl.meta[sym] || {}),
            company: r.data.name || sym,
            logo: r.data.logo,
          };
          repaired++;
        } else {
          wl.meta[sym] = {
            ...(wl.meta[sym] || {}),
            company: sym,
          };
        }
      } catch {
        wl.meta[sym] = {
          ...(wl.meta[sym] || {}),
          company: sym,
        };
      }
    }

    wl.updatedAt = new Date();
    await wl.save();

    res.json({ success: true, repaired });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   EXPORT
========================================================= */
export default router;
