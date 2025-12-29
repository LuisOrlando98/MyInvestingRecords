// src/routes/positions.js
import express from "express";
import Position from "../models/Position.js";
import { getOccSymbolsFromLegs } from "../utils/positionUtils.js";
import { getOptionQuote } from "../services/tradier.js";
import { recordCashFlow } from "../services/cashflowService.js";
import PositionCashFlow from "../models/PositionCashFlow.js";
import mongoose from "mongoose";

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
    const filter = { ...req.query, archived: { $ne: true } };
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
    const filter = { ...req.query, archived: { $ne: true } };
    if (!filter.status) filter.status = "Closed";

    const positions = await Position.find(filter);
    const total = positions.length;
    const totalPnL = positions.reduce((sum, p) => sum + (p.realizedPnL || 0), 0);
    const wins = positions.filter((p) => (p.realizedPnL || 0) > 0);
    const losses = positions.filter((p) => (p.realizedPnL || 0) < 0);

    const avgPnL = total > 0 ? totalPnL / total : 0;
    const winRate = total > 0 ? (wins.length / total) * 100 : 0;
    const avgWin =
      wins.length > 0
        ? wins.reduce((s, p) => s + (p.realizedPnL || 0), 0) / wins.length
        : 0;
    const avgLoss =
      losses.length > 0
        ? losses.reduce((s, p) => s + (p.realizedPnL || 0), 0) / losses.length
        : 0;

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
  } catch {
    res.status(500).json({ success: false, error: "Error al calcular estadísticas" });
  }
});

/* ============================================================
   🔹 3. RESUMEN POR ESTRATEGIA
============================================================ */
router.get("/summary-by-strategy", async (req, res) => {
  try {
    const resumen = await Position.aggregate([
      { $match: { status: "Closed", archived: { $ne: true } } },
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
      { $match: { status: "Closed", archived: { $ne: true } } },
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
      {
        $match: {
          status: "Closed",
          archived: { $ne: true },
          closeDate: { $ne: null },
        },
      },
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
      { $match: { status: "Open", archived: { $ne: true } } },
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
   🔁 7.a ROLL POSITION — (tu lógica OK, la dejo igual)
============================================================ */
router.post("/:id/roll", async (req, res) => {
  try {
    const { id } = req.params;
    const { newPosition, rollOutCost, rollInCredit } = req.body;

    if (!newPosition || !Number.isFinite(rollOutCost) || !Number.isFinite(rollInCredit)) {
      return res.status(400).json({
        success: false,
        error: "newPosition, rollOutCost y rollInCredit son obligatorios",
      });
    }

    const oldPosition = await Position.findById(id);
    if (!oldPosition) return res.status(404).json({ success: false, error: "Posición original no encontrada" });
    if (oldPosition.status !== "Open") return res.status(400).json({ success: false, error: "Solo se pueden rolar posiciones abiertas" });

    const rollGroupId = new mongoose.Types.ObjectId();

    const rolledPosition = new Position({
      ...newPosition,
      status: "Open",
      notes: "Rolled position",
      openDate: new Date(),
      rolledFrom: oldPosition._id,
      rollGroupId,
      netPremium: Number(rollInCredit),
      cumulativeRealizedPnL: 0,
      cumulativeBreakEven: null,
    });

    await rolledPosition.save();

    await recordCashFlow({
      position: oldPosition,
      type: "CLOSE_PREMIUM",
      amount: -Math.abs(rollOutCost),
      relatedPositionId: rolledPosition._id,
      rollGroupId,
      description: "Roll: close old position",
    });

    await recordCashFlow({
      position: rolledPosition,
      type: "OPEN_PREMIUM",
      amount: Number(rollInCredit),
      relatedPositionId: oldPosition._id,
      rollGroupId,
      description: "Roll: open new position",
    });

    const flows = await PositionCashFlow.find({ positionId: oldPosition._id, rollGroupId });
    const realizedPnL = flows.reduce((sum, f) => sum + (f.amount || 0), 0);

    oldPosition.status = "Rolled";
    oldPosition.archived = true;
    oldPosition.closeDate = new Date();
    oldPosition.realizedPnL = Number(realizedPnL.toFixed(2));
    oldPosition.rollGroupId = rollGroupId;

    oldPosition.closedStatus =
      oldPosition.realizedPnL > 0.01 ? "win" : oldPosition.realizedPnL < -0.01 ? "loss" : "breakeven";

    oldPosition.exitPrice = undefined;
    oldPosition.marketValue = undefined;

    await oldPosition.save();

    const prevCumulativeRealized = Number(oldPosition.cumulativeRealizedPnL || 0);
    const newCumulativeRealized = Number((prevCumulativeRealized + realizedPnL).toFixed(2));
    const cumulativeBreakEven = Math.abs(newCumulativeRealized);

    rolledPosition.cumulativeRealizedPnL = newCumulativeRealized;
    rolledPosition.cumulativeBreakEven = Number(cumulativeBreakEven.toFixed(2));
    await rolledPosition.save();

    emitChange(req, "rolled_out", oldPosition);
    emitChange(req, "rolled_in", rolledPosition);

    res.json({ success: true, data: { oldPosition, newPosition: rolledPosition, rollGroupId } });
  } catch (err) {
    console.error("❌ Error al rolar posición:", err.message);
    res.status(500).json({ success: false, error: "Error al rolar la posición" });
  }
});

/* ============================================================
   ✅ 7.b CLOSE POSITION — CIERRE CORRECTO (FIX PROFUNDO)
============================================================ */
router.put("/:id/close", async (req, res) => {
  try {
    const { id } = req.params;
    const numericExit = Number(req.body.exitPrice);

    if (!Number.isFinite(numericExit)) {
      return res.status(400).json({ success: false, error: "exitPrice es obligatorio y debe ser numérico" });
    }

    const pos = await Position.findById(id);
    if (!pos) return res.status(404).json({ success: false, error: "Posición no encontrada" });

    if (pos.status !== "Open") {
      return res.status(400).json({ success: false, error: "Solo se pueden cerrar posiciones abiertas" });
    }

    const MULT = 100;
    const qty = pos.legs?.[0]?.quantity ?? 1;

    // 🔥 SIGNO basado en el trade completo:
    // - credit (totalCost < 0): closing is debit (negativo)
    // - debit  (totalCost > 0): closing is credit (positivo)
    const tradeSign = pos.totalCost < 0 ? -1 : 1;

    // Market value final congelado (solo para guardar en Position)
    // (se guarda con el mismo signo del cashflow de cierre)
    const finalMarketValue = Number((Math.abs(numericExit * qty * MULT) * tradeSign).toFixed(2));

    // Update legs (si quieres marketValue por leg con signo, aquí lo puedes ajustar luego)
    const updatedLegs = (pos.legs || []).map((leg) => ({
      ...leg._doc,
      exitPrice: numericExit,
      marketValue: Number((numericExit * (leg.quantity ?? 1) * MULT).toFixed(2)),
    }));

    // ✅ realizedPnL coherente con Webull si totalCost viene con signo correcto
    // credit example: totalCost = -293, finalMarketValue = -285 => pnl = +8
    const realizedPnL = Number((finalMarketValue - pos.totalCost).toFixed(2));

    let closedStatus = "breakeven";
    if (realizedPnL > 0.01) closedStatus = "win";
    if (realizedPnL < -0.01) closedStatus = "loss";

    pos.status = "Closed";
    pos.exitPrice = numericExit;
    pos.closeDate = new Date();
    pos.realizedPnL = realizedPnL;
    pos.closedStatus = closedStatus;
    pos.marketValue = finalMarketValue;
    pos.legs = updatedLegs;

    await pos.save();

    // ✅ CASHFLOW de cierre: refleja el dinero que entra/sale (NO el PnL)
    // (mismo valor que finalMarketValue por definición)
    const closeCashFlow = finalMarketValue;

    // Evitar duplicado de cashflow de cierre
      const existingClose = await PositionCashFlow.findOne({
        positionId: pos._id,
        type: "CLOSE_PREMIUM",
      });

      if (!existingClose) {
        await recordCashFlow({
          position: pos,
          type: "CLOSE_PREMIUM",
          amount: Number(closeCashFlow.toFixed(2)),
          description: "Position closed",
        });
      } else {
        // si ya existe, solo actualizamos el amount si estaba mal, sin mover la fecha histórica
        existingClose.amount = Number(closeCashFlow.toFixed(2));
        existingClose.symbol = pos.symbol;
        existingClose.strategy = pos.strategy;
        existingClose.description = "Position closed";
        await existingClose.save();
      }

    emitChange(req, "closed", pos);
    res.json({ success: true, data: pos });
  } catch (err) {
    console.error("❌ Error al cerrar posición:", err.message);
    res.status(500).json({ success: false, error: "Error al cerrar la posición" });
  }
});

/* ============================================================
   🔹 8. GET /api/positions/:id/quotes → Cotización en vivo
============================================================ */
router.get("/:id/quotes", async (req, res) => {
  try {
    const position = await Position.findById(req.params.id);
    if (!position) return res.status(404).json({ success: false, error: "Posición no encontrada" });

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
   📦 ARCHIVE POSITION
============================================================ */
router.put("/:id/archive", async (req, res) => {
  try {
    const pos = await Position.findByIdAndUpdate(req.params.id, { archived: true }, { new: true });
    if (!pos) return res.status(404).json({ success: false, error: "Posición no encontrada" });
    emitChange(req, "archived", pos);
    res.json({ success: true, data: pos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   🔹 CRUD
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

    // =======================================================
    // 🔒 FIX CRÍTICO — totalCost SIEMPRE desde legs si es opción multi-leg
    // (no confiamos en el frontend cuando hay legs)
    // =======================================================
    if (Array.isArray(position.legs) && position.legs.length > 0) {
      const MULT = 100;
      let netCash = 0;

      for (const leg of position.legs) {
        const qty = Number(leg.quantity ?? 1);
        const premium = Number(leg.premium ?? 0);
        const action = String(leg.action || "").toLowerCase();

        const cash = premium * qty * MULT;

        if (action.includes("sell")) netCash += cash;
        if (action.includes("buy")) netCash -= cash;
      }

      // Webull style: credit => totalCost negativo
      position.totalCost = Number((-netCash).toFixed(2));
      await position.save();
    }

    // =======================================================
    // 🔥 OPEN PREMIUM — cash real de apertura
    // =======================================================
    const openCash = Number((-position.totalCost).toFixed(2));

    const openExists = await PositionCashFlow.findOne({
      positionId: position._id,
      type: "OPEN_PREMIUM",
    });

    if (!openExists && openCash !== 0) {
      await recordCashFlow({
        position,
        type: "OPEN_PREMIUM",
        amount: openCash,
        description: "Position opened",
      });
    }

    res.status(201).json({ success: true, data: position });
    emitChange(req, "created", position);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await Position.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
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
