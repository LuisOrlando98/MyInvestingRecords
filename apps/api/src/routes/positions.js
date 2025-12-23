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
    if (!filter.status) {
      filter.status = "Closed";
    }

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
        }
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
   🔁 7.a ROLL POSITION — roll profesional estilo Webull
============================================================ */
router.post("/:id/roll", async (req, res) => {
  try {
    const { id } = req.params;

    // 👉 Datos del roll
    const {
      newPosition,   // objeto completo de la nueva posición
      rollOutCost,   // costo de cerrar la vieja (positivo)
      rollInCredit,  // crédito (+) o débito (-) de la nueva
    } = req.body;

    if (
      !newPosition ||
      !Number.isFinite(rollOutCost) ||
      !Number.isFinite(rollInCredit)
    ) {
      return res.status(400).json({
        success: false,
        error: "newPosition, rollOutCost y rollInCredit son obligatorios",
      });
    }

    /* ======================================================
       1️⃣ Buscar posición original
    ====================================================== */
    const oldPosition = await Position.findById(id);
    if (!oldPosition) {
      return res.status(404).json({
        success: false,
        error: "Posición original no encontrada",
      });
    }

    if (oldPosition.status !== "Open") {
      return res.status(400).json({
        success: false,
        error: "Solo se pueden rolar posiciones abiertas",
      });
    }


    /* ======================================================
       2️⃣ Preparar grupo de roll (vínculo financiero)
    ====================================================== */
    const rollGroupId = new mongoose.Types.ObjectId();


    /* ======================================================
       3️⃣ Crear nueva posición (rolled in)
    ====================================================== */
    const rolledPosition = new Position({
      ...newPosition,
      status: "Open",
      notes: "Rolled position",
      openDate: new Date(),

      // 🔁 vínculo del roll
      rolledFrom: oldPosition._id,
      rollGroupId,

      // 💰 PREMIUM REAL DE LA NUEVA POSICIÓN
      netPremium: Number(rollInCredit),

      // 🧠 acumulados (se recalculan luego)
      cumulativeRealizedPnL: 0,
      cumulativeBreakEven: null,
    });

    await rolledPosition.save();
    

    /* ======================================================
       4️⃣ CASHFLOW REAL — CIERRE DE POSICIÓN VIEJA
       (la pérdida o ganancia se realiza aquí)
    ====================================================== */
    await recordCashFlow({
      position: oldPosition,
      type: "CLOSE_PREMIUM",
      amount: -Math.abs(rollOutCost), // SIEMPRE cash out
      relatedPositionId: rolledPosition._id,
      rollGroupId,
      description: "Roll: close old position",
    });

    /* ======================================================
       5️⃣ CASHFLOW REAL — APERTURA DE NUEVA POSICIÓN
    ====================================================== */
    await recordCashFlow({
      position: rolledPosition,
      type: "OPEN_PREMIUM",
      amount: Number(rollInCredit), // + crédito / - débito
      relatedPositionId: oldPosition._id,
      rollGroupId,
      description: "Roll: open new position",
    });

    /* ======================================================
       6️⃣ CALCULAR REALIZED PnL DE LA POSICIÓN VIEJA
       (SOLO hasta este roll)
    ====================================================== */
    const flows = await PositionCashFlow.find({
      positionId: oldPosition._id,
      rollGroupId: rollGroupId,
    });

    const realizedPnL = flows.reduce(
      (sum, f) => sum + (f.amount || 0),
      0
    );

    /* ======================================================
       7️⃣ Marcar posición vieja como ROLLED (financieramente cerrada)
    ====================================================== */
    oldPosition.status = "Rolled";
    oldPosition.archived = true;
    oldPosition.closeDate = new Date();
    oldPosition.realizedPnL = Number(realizedPnL.toFixed(2));
    oldPosition.rollGroupId = rollGroupId;

    oldPosition.closedStatus =
      oldPosition.realizedPnL > 0.01
        ? "win"
        : oldPosition.realizedPnL < -0.01
        ? "loss"
        : "breakeven";

    // ❌ No inventamos precios en un roll
    oldPosition.exitPrice = undefined;
    oldPosition.marketValue = undefined;

    await oldPosition.save();

    /* ======================================================
      8️⃣ CALCULAR ACUMULADOS REALES DEL ROLL (CORRECTO)
      - cumulativeRealizedPnL = pérdidas/ganancias históricas
      - cumulativeBreakEven = cuánto debo recuperar para quedar en cero
    ====================================================== */

    // 🔴 Si la posición vieja ya venía de otro roll, arrastramos su historial
    const prevCumulativeRealized = Number(
      oldPosition.cumulativeRealizedPnL || 0
    );

    // 🔴 Sumamos el realized PnL del cierre actual
    const newCumulativeRealized = Number(
      (prevCumulativeRealized + realizedPnL).toFixed(2)
    );

    // 🔴 Break-even REAL (lo que el trader necesita recuperar)
    const cumulativeBreakEven = Math.abs(newCumulativeRealized);

    // 🔴 Guardar acumulados en la NUEVA posición
    rolledPosition.cumulativeRealizedPnL = newCumulativeRealized;
    rolledPosition.cumulativeBreakEven = Number(
      cumulativeBreakEven.toFixed(2)
    );

    // 💾 Guardar cambios
    await rolledPosition.save();


    /* ======================================================
       8️⃣ Emitir eventos en tiempo real
    ====================================================== */
    emitChange(req, "rolled_out", oldPosition);
    emitChange(req, "rolled_in", rolledPosition);

    /* ======================================================
       9️⃣ Respuesta final
    ====================================================== */
    res.json({
      success: true,
      data: {
        oldPosition,
        newPosition: rolledPosition,
        rollGroupId,
      },
    });

  } catch (err) {
    console.error("❌ Error al rolar posición:", err.message);
    res.status(500).json({
      success: false,
      error: "Error al rolar la posición",
    });
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
    // 🛑 FIX 2 — Evitar doble cierre
    // ========================================
    if (pos.status !== "Open") {
      return res.status(400).json({
        success: false,
        error: "Solo se pueden cerrar posiciones abiertas",
      });
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

    // ========================================
    // 🔥 CASHFLOW AUTOMÁTICO — CLOSE
    // ========================================

    // Cash que sale o entra al cerrar.
    // Es el cashflow del cierre, NO el PnL.
    // 🛑 FIX 3 — Evitar cashflow duplicado
    // ========================================
    const closeCashFlow = Number((finalMarketValue * -1).toFixed(2));

    const exists = await PositionCashFlow.findOne({
      positionId: pos._id,
      type: "CLOSE_PREMIUM",
    });

    if (!exists && closeCashFlow !== 0) {
      await recordCashFlow({
        position: pos,
        type: "CLOSE_PREMIUM",
        amount: closeCashFlow,
        description: "Position closed",
      });
    }

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
   📦 ARCHIVE POSITION (no delete)
============================================================ */
router.put("/:id/archive", async (req, res) => {
  try {
    const pos = await Position.findByIdAndUpdate(
      req.params.id,
      { archived: true },
      { new: true }
    );

    if (!pos) {
      return res.status(404).json({ success: false, error: "Posición no encontrada" });
    }

    emitChange(req, "archived", pos);

    res.json({ success: true, data: pos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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

    // ========================================
    // 🔥 CASHFLOW AUTOMÁTICO — OPEN
    // ========================================
    if (
      position.status === "Open" &&
      typeof position.netPremium === "number" &&
      position.netPremium !== 0
    ) {
      await recordCashFlow({
        position,
        type: "OPEN_PREMIUM",
        amount: position.netPremium, // + crédito / - débito
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
