// src/routes/positions.js
import express from "express";
import Position from "../models/Position.js";
import { getOccSymbolsFromLegs } from "../utils/positionUtils.js";
import { getOptionQuote } from "../services/tradier.js";

const router = express.Router();

// ✅ Helper: emitir eventos en tiempo real
function emitChange(req, type, data = null) {
  const io = req.app.get("io");
  if (!io) return;
  io.emit("positions:changed", { type, data });
}

/* ============================================================
   🔹 1. GET todas las posiciones (con filtros opcionales)
============================================================ */
router.get("/", async (req, res) => {
  try {
    const filter = { ...req.query };
    const positions = await Position.find(filter).sort({ openDate: -1 });
    res.json({ success: true, data: positions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   🔹 2. STATS: resumen de desempeño global
============================================================ */
router.get("/stats", async (req, res) => {
  try {
    const filter = { ...req.query };
    if (!filter.status) filter.status = "Closed";

    const positions = await Position.find(filter);
    const total = positions.length;
    const totalPnL = positions.reduce((sum, p) => sum + (p.realizedPnL || 0), 0);
    const wins = positions.filter((p) => (p.realizedPnL || 0) > 0);
    const losses = positions.filter((p) => (p.realizedPnL || 0) < 0);

    const avgPnL = total > 0 ? totalPnL / total : 0;
    const winRate = total > 0 ? (wins.length / total) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, p) => s + p.realizedPnL, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, p) => s + p.realizedPnL, 0) / losses.length : 0;

    res.json({
      success: true,
      data: {
        totalPositions: total,
        netProfit: Number(totalPnL.toFixed(2)),
        winRate: Number(winRate.toFixed(2)),
        avgPnL: Number(avgPnL.toFixed(2)),
        avgWin: Number(avgWin.toFixed(2)),
        avgLoss: Number(avgLoss.toFixed(2)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Error al calcular estadísticas" });
  }
});

/* ============================================================
   🔹 3. RESUMEN POR ESTRATEGIA
============================================================ */
router.get("/summary-by-strategy", async (req, res) => {
  try {
    const resumen = await Position.aggregate([
      { $match: { status: "Closed" } },
      {
        $group: {
          _id: "$strategy",
          count: { $sum: 1 },
          netProfit: { $sum: "$realizedPnL" },
          avgPnL: { $avg: "$realizedPnL" },
        },
      },
      {
        $project: {
          strategy: "$_id",
          _id: 0,
          count: 1,
          netProfit: { $round: ["$netProfit", 2] },
          avgPnL: { $round: ["$avgPnL", 2] },
        },
      },
      { $sort: { netProfit: -1 } },
    ]);
    res.json({ success: true, data: resumen });
  } catch {
    res.status(500).json({ success: false, error: "Error al generar resumen por estrategia" });
  }
});

/* ============================================================
   🔹 4. RESUMEN POR SÍMBOLO
============================================================ */
router.get("/summary-by-symbol", async (req, res) => {
  try {
    const resumen = await Position.aggregate([
      { $match: { status: "Closed" } },
      {
        $group: {
          _id: "$symbol",
          count: { $sum: 1 },
          netProfit: { $sum: "$realizedPnL" },
          avgPnL: { $avg: "$realizedPnL" },
        },
      },
      {
        $project: {
          symbol: "$_id",
          _id: 0,
          count: 1,
          netProfit: { $round: ["$netProfit", 2] },
          avgPnL: { $round: ["$avgPnL", 2] },
        },
      },
      { $sort: { netProfit: -1 } },
    ]);
    res.json({ success: true, data: resumen });
  } catch {
    res.status(500).json({ success: false, error: "Error al generar resumen por símbolo" });
  }
});

/* ============================================================
   🔹 5. RESUMEN POR MES
============================================================ */
router.get("/summary-by-month", async (req, res) => {
  try {
    const resumen = await Position.aggregate([
      { $match: { status: "Closed", closeDate: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$closeDate" } },
          netProfit: { $sum: "$realizedPnL" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          month: "$_id",
          _id: 0,
          netProfit: { $round: ["$netProfit", 2] },
          count: 1,
        },
      },
      { $sort: { month: 1 } },
    ]);
    res.json({ success: true, data: resumen });
  } catch {
    res.status(500).json({ success: false, error: "Error al generar resumen mensual" });
  }
});

/* ============================================================
   🔹 6. RESUMEN DE POSICIONES ABIERTAS
============================================================ */
router.get("/open-summary", async (req, res) => {
  try {
    const resumen = await Position.aggregate([
      { $match: { status: "Open" } },
      {
        $group: {
          _id: { strategy: "$strategy", symbol: "$symbol" },
          count: { $sum: 1 },
          netPremium: { $sum: "$netPremium" },
        },
      },
      {
        $project: {
          strategy: "$_id.strategy",
          symbol: "$_id.symbol",
          _id: 0,
          count: 1,
          netPremium: { $round: ["$netPremium", 2] },
        },
      },
      { $sort: { netPremium: -1 } },
    ]);
    res.json({ success: true, data: resumen });
  } catch {
    res.status(500).json({ success: false, error: "Error al generar resumen de posiciones abiertas" });
  }
});



/* ============================================================
   🔥 7.b CLOSE POSITION — cierre real estilo Webull
============================================================ */
router.put("/:id/close", async (req, res) => {
  try {
    const { id } = req.params;
    const { exitPrice } = req.body;

    const numericExit = Number(exitPrice);
    if (!Number.isFinite(numericExit)) {
      return res.status(400).json({
        success: false,
        error: "exitPrice es obligatorio y debe ser numérico",
      });
    }

    const pos = await Position.findById(id);
    if (!pos) {
      return res.status(404).json({ success: false, error: "Posición no encontrada" });
    }

    // ========================================
    // 1️⃣ Market Value final (congelado)
    // ========================================
    const MULT = 100;
    const qty = pos.legs?.[0]?.quantity ?? 1;

    let finalMarketValue = numericExit * qty * MULT;

    // SIGNO según la acción original (venta → cerrar cuesta dinero)
    const mainLeg = pos.legs[0];
    const action = (mainLeg.action || "").toLowerCase();
    if (action.includes("sell")) {
      finalMarketValue = -finalMarketValue;
    }

    // ========================================
    // 2️⃣ Actualizar legs con exitPrice + marketValue
    // ========================================
    const updatedLegs = pos.legs.map((leg) => ({
      ...leg._doc,
      exitPrice: numericExit,
      marketValue: numericExit * leg.quantity * MULT
    }));

    // ========================================
    // 3️⃣ REALIZED PROFIT/LOSS estilo Webull
    // ========================================
    // totalCost = cash neto de apertura (ya positivo o negativo)
    // finalMarketValue = cash del cierre (positivo o negativo)
    // realizedPnL = diferencia
    const realizedPnL = Number((finalMarketValue - pos.totalCost).toFixed(2));

    // ========================================
    // 4️⃣ Determinar win-loss-breakeven
    // ========================================
    let closedStatus = "breakeven";
    if (realizedPnL > 0.01) closedStatus = "win";
    if (realizedPnL < -0.01) closedStatus = "loss";

    // ========================================
    // 5️⃣ Guardar cambios
    // ========================================
    pos.status = "Closed";
    pos.exitPrice = numericExit;
    pos.closeDate = new Date();
    pos.realizedPnL = realizedPnL;
    pos.closedStatus = closedStatus;
    pos.marketValue = finalMarketValue;
    pos.legs = updatedLegs;

    await pos.save();

    // Emitir evento realtime
    emitChange(req, "closed", pos);

    res.json({ success: true, data: pos });

  } catch (err) {
    console.error("❌ Error al cerrar posición:", err.message);
    res.status(500).json({ success: false, error: "Error al cerrar la posición" });
  }
});

/* ============================================================
   🔹 8. GET /api/positions/:id/quote → Cotización en vivo de una posición multi-leg
============================================================ */
router.get("/:id/quotes", async (req, res) => {
  try {
    const position = await Position.findById(req.params.id);
    if (!position) {
      return res.status(404).json({ success: false, error: "Posición no encontrada" });
    }

    const symbols = getOccSymbolsFromLegs(position.symbol, position.legs || []);
    const quotes = [];

    for (const occSymbol of symbols) {
      const data = await getOptionQuote(occSymbol);
      quotes.push({ occSymbol, ...data });
    }

    res.json({ success: true, data: quotes });
  } catch (err) {
    console.error("❌ Error al obtener cotizaciones OCC:", err.message);
    res.status(500).json({ success: false, error: "No se pudo obtener cotizaciones" });
  }
});


/* ============================================================
   🔹 7. CRUD COMPLETO (GET, POST, PUT, DELETE)
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const position = await Position.findById(req.params.id);
    if (!position) return res.status(404).json({ success: false, error: "Posición no encontrada" });
    res.json({ success: true, data: position });
  } catch {
    res.status(500).json({ success: false, error: "Error al buscar la posición" });
  }
});

router.post("/", async (req, res) => {
  try {
    const position = new Position(req.body);
    await position.save();
    res.status(201).json({ success: true, data: position });
    emitChange(req, "created", position);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await Position.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ success: false, error: "Posición no encontrada" });
    res.json({ success: true, data: updated });
    emitChange(req, "updated", updated);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Position.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: "Posición no encontrada" });
    res.json({ success: true, message: "Posición eliminada" });
    emitChange(req, "deleted", { id: deleted._id });
  } catch {
    res.status(500).json({ success: false, error: "Error al eliminar la posición" });
  }
});


export default router;
