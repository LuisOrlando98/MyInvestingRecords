// src/routes/positions.js
import express from "express";
import mongoose from "mongoose";

import { validateStrategy } from "../utils/strategyValidator.js";

import Position from "../models/Position.js";
import PositionCashFlow from "../models/PositionCashFlow.js";

import { getOccSymbolsFromLegs } from "../utils/positionUtils.js";
import { getOptionQuote } from "../services/tradier.js";
import { recordCashFlow } from "../services/cashflowService.js";

const router = express.Router();

/* ============================================================
   SOCKET EMITTER
============================================================ */
function emitChange(req, type, data = null) {
  const io = req.app.get("io");
  if (!io) return;
  io.emit("positions:changed", { type, data });
}

/* ============================================================
   1. GET ALL POSITIONS (NON-ARCHIVED)
============================================================ */
router.get("/", async (req, res) => {
  try {
    const { includeArchived, ...query } = req.query;

    const filter = {
      ...query,
      ...(includeArchived === "true" ? {} : { archived: { $ne: true } }),
    };

    const positions = await Position.find(filter).sort({ openDate: -1 });
    res.json({ success: true, data: positions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   2. GLOBAL STATS
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
    res
      .status(500)
      .json({ success: false, error: "Stats calculation error" });
  }
});

/* ============================================================
   3. SUMMARY BY STRATEGY
============================================================ */
router.get("/summary-by-strategy", async (req, res) => {
  try {
    const summary = await Position.aggregate([
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

    res.json({ success: true, data: summary });
  } catch {
    res
      .status(500)
      .json({ success: false, error: "Strategy summary error" });
  }
});

/* ============================================================
   4. SUMMARY BY SYMBOL
============================================================ */
router.get("/summary-by-symbol", async (req, res) => {
  try {
    const summary = await Position.aggregate([
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

    res.json({ success: true, data: summary });
  } catch {
    res.status(500).json({ success: false, error: "Symbol summary error" });
  }
});

/* ============================================================
   5. SUMMARY BY MONTH
============================================================ */
router.get("/summary-by-month", async (req, res) => {
  try {
    const summary = await Position.aggregate([
      {
        $match: {
          status: "Closed",
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

    res.json({ success: true, data: summary });
  } catch {
    res.status(500).json({ success: false, error: "Monthly summary error" });
  }
});

/* ============================================================
   6. OPEN POSITIONS SUMMARY
============================================================ */
router.get("/open-summary", async (req, res) => {
  try {
    const summary = await Position.aggregate([
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

    res.json({ success: true, data: summary });
  } catch {
    res.status(500).json({ success: false, error: "Open summary error" });
  }
});

/* ============================================================
   7. ROLL POSITION — CASHFLOW-BASED (RESTORED WORKING)
   ✅ Restores rolledFrom context + keeps fields frontend expects
============================================================ */
router.post("/:id/roll", async (req, res) => {
  try {
    const { id } = req.params;

    // Support both payload styles:
    // - legacy: { newPosition, rollOutCost, rollInCredit }
    // - explicit: { newPosition, rollOutCost, rollAdjustmentAmount, rollAdjustmentType }
    const {
      newPosition,
      rollOutCost,
      rollInCredit,
      rollAdjustmentAmount,
      rollAdjustmentType,
    } = req.body;

    const oldPosition = await Position.findById(id);
    if (!oldPosition)
      return res
        .status(404)
        .json({ success: false, error: "Original position not found" });

    if (oldPosition.status !== "Open")
      return res
        .status(400)
        .json({ success: false, error: "Only open positions can be rolled" });

    const hasExplicit =
      Number.isFinite(Number(rollAdjustmentAmount)) &&
      ["credit", "debit"].includes(String(rollAdjustmentType));

    const hasLegacy = Number.isFinite(Number(rollInCredit));

    if (!newPosition || !Number.isFinite(Number(rollOutCost)) || (!hasExplicit && !hasLegacy)) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid roll payload. Required: newPosition, rollOutCost, and either rollInCredit or (rollAdjustmentAmount + rollAdjustmentType).",
      });
    }

    const rollGroupId = new mongoose.Types.ObjectId();

    // In your working system: rollInCredit is stored as netPremium for the rolled-in position
    // If explicit:
    //  - credit => positive
    //  - debit  => negative (optional support, but UI usually provides credit)
    const signedAdjustment = hasExplicit
      ? String(rollAdjustmentType) === "credit"
        ? Math.abs(Number(rollAdjustmentAmount))
        : -Math.abs(Number(rollAdjustmentAmount))
      : Number(rollInCredit);

    const rolledPosition = new Position({
      // ✅ INHERIT CONTEXT (CRITICAL FOR PREFILL)
      symbol: oldPosition.symbol,
      broker: oldPosition.broker,
      strategy: oldPosition.strategy,
      quantity: oldPosition.quantity,
      expiration: oldPosition.expiration,
      notes: oldPosition.notes,

      // ✅ ONLY thing that changes on roll
      legs: newPosition.legs,

      // ✅ Required roll metadata
      status: "Open",
      openDate: new Date(),
      notes: "Rolled position",

      rolledFrom: oldPosition._id,
      rollGroupId,

      // ✅ Premium from roll
      netPremium: Number(signedAdjustment),

      // ✅ UI / history compatibility
      cumulativeRealizedPnL: 0,
      cumulativeBreakEven: null,
    });

    await rolledPosition.save();

    // Cashflows for the roll
    await recordCashFlow({
      position: oldPosition,
      type: "CLOSE_PREMIUM",
      amount: -Math.abs(Number(rollOutCost)),
      relatedPositionId: rolledPosition._id,
      rollGroupId,
      description: "Roll: close old position",
    });

    await recordCashFlow({
      position: rolledPosition,
      type: "OPEN_PREMIUM",
      amount: Number(signedAdjustment),
      relatedPositionId: oldPosition._id,
      rollGroupId,
      description: "Roll: open new position",
    });

    // ✅ realizedPnL from flows (WORKING LOGIC)
    const flows = await PositionCashFlow.find({
      positionId: oldPosition._id,
      rollGroupId,
    });

    const realizedPnL = flows.reduce((sum, f) => sum + (f.amount || 0), 0);

    // Update old position (WORKING LOGIC)
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

    // remove close-only fields to avoid confusion
    oldPosition.exitPrice = undefined;
    oldPosition.marketValue = undefined;

    await oldPosition.save();

    // Update rolled-in cumulative values (WORKING LOGIC)
    const prevCumulativeRealized = Number(oldPosition.cumulativeRealizedPnL || 0);
    const newCumulativeRealized = Number(
      (prevCumulativeRealized + realizedPnL).toFixed(2)
    );

    rolledPosition.cumulativeRealizedPnL = newCumulativeRealized;
    rolledPosition.cumulativeBreakEven = Number(
      Math.abs(newCumulativeRealized).toFixed(2)
    );

    await rolledPosition.save();

    emitChange(req, "rolled_out", oldPosition);
    emitChange(req, "rolled_in", rolledPosition);

    res.json({
      success: true,
      data: { oldPosition, newPosition: rolledPosition, rollGroupId },
    });
  } catch (err) {
    console.error("❌ Error rolling position:", err);
    res.status(500).json({ success: false, error: "Roll failed" });
  }
});

/* ============================================================
   8. CLOSE POSITION — (WORKING "FIX PROFUNDO" VERSION)
============================================================ */
router.put("/:id/close", async (req, res) => {
  try {
    const { id } = req.params;
    const numericExit = Number(req.body.exitPrice);

    if (!Number.isFinite(numericExit)) {
      return res
        .status(400)
        .json({ success: false, error: "exitPrice is required and must be numeric" });
    }

    const pos = await Position.findById(id);
    if (!pos)
      return res.status(404).json({ success: false, error: "Position not found" });

    if (pos.status !== "Open") {
      return res
        .status(400)
        .json({ success: false, error: "Only open positions can be closed" });
    }

    const MULT = 100;
    const qty = pos.legs?.[0]?.quantity ?? 1;

    // Sign based on the full trade
    // - credit (totalCost < 0): closing is debit (negative)
    // - debit  (totalCost > 0): closing is credit (positive)
    const tradeSign = pos.totalCost < 0 ? -1 : 1;

    // Final market value saved with cashflow sign
    const finalMarketValue = Number(
      (Math.abs(numericExit * qty * MULT) * tradeSign).toFixed(2)
    );

    const updatedLegs = (pos.legs || []).map((leg) => ({
      ...leg._doc,
      exitPrice: numericExit,
      marketValue: Number((numericExit * (leg.quantity ?? 1) * MULT).toFixed(2)),
    }));

    // realizedPnL consistent with Webull if totalCost has correct sign
    // credit example: totalCost = -293, finalMarketValue = -285 => pnl = +8
    const realizedPnL = Number((finalMarketValue - pos.totalCost).toFixed(2));

    // ===============================
    // ✅ REALIZED RETURN %
    // (same logic as Open P&L %)
    // ===============================
    let realizedReturnPct = null;

    // Prefer maxLoss (credit spreads, condors)
    if (Number.isFinite(pos.maxLoss) && pos.maxLoss > 0) {
      realizedReturnPct = Number(
        ((realizedPnL / pos.maxLoss) * 100).toFixed(2)
      );
    }
    // Fallback: absolute capital used (debit trades)
    else if (Number.isFinite(pos.totalCost) && pos.totalCost !== 0) {
      realizedReturnPct = Number(
        ((realizedPnL / Math.abs(pos.totalCost)) * 100).toFixed(2)
      );
    }

    let closedStatus = "breakeven";
    if (realizedPnL > 0.01) closedStatus = "win";
    if (realizedPnL < -0.01) closedStatus = "loss";

    pos.status = "Closed";
    pos.exitPrice = numericExit;
    pos.closeDate = new Date();
    pos.realizedPnL = realizedPnL;
    pos.realizedReturnPct = realizedReturnPct;
    pos.closedStatus = closedStatus;
    pos.marketValue = finalMarketValue;
    pos.legs = updatedLegs;

    await pos.save();

    // Cashflow for close (same as finalMarketValue by definition)
    const closeCashFlow = finalMarketValue;

    // Avoid duplicate close cashflow
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
      existingClose.amount = Number(closeCashFlow.toFixed(2));
      existingClose.symbol = pos.symbol;
      existingClose.strategy = pos.strategy;
      existingClose.description = "Position closed";
      await existingClose.save();
    }

    emitChange(req, "closed", pos);
    res.json({ success: true, data: pos });
  } catch (err) {
    console.error("❌ Error closing position:", err);
    res.status(500).json({ success: false, error: "Close failed" });
  }
});

/* ============================================================
   9. LIVE QUOTES
============================================================ */
router.get("/:id/quotes", async (req, res) => {
  try {
    const position = await Position.findById(req.params.id);
    if (!position)
      return res.status(404).json({ success: false, error: "Position not found" });

    const symbols = getOccSymbolsFromLegs(position.symbol, position.legs || []);
    const quotes = [];

    for (const occSymbol of symbols) {
      const data = await getOptionQuote(occSymbol);
      quotes.push({ occSymbol, ...data });
    }

    res.json({ success: true, data: quotes });
  } catch (err) {
    console.error("❌ Quote fetch error:", err.message);
    res.status(500).json({ success: false, error: "Quote fetch error" });
  }
});

/* ============================================================
   10. ARCHIVE POSITION
============================================================ */
router.put("/:id/archive", async (req, res) => {
  try {
    const pos = await Position.findByIdAndUpdate(
      req.params.id,
      { archived: true },
      { new: true }
    );
    if (!pos)
      return res.status(404).json({ success: false, error: "Position not found" });

    emitChange(req, "archived", pos);
    res.json({ success: true, data: pos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================================================
   11. GET BY ID
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const position = await Position.findById(req.params.id);
    if (!position)
      return res.status(404).json({ success: false, error: "Position not found" });

    res.json({ success: true, data: position });
  } catch {
    res.status(500).json({ success: false, error: "Error fetching position" });
  }
});

/* ============================================================
   12. VALIDATE STRATEGY (NO SAVE)
============================================================ */
router.post("/validate", (req, res) => {
  try {
    const error = validateStrategy(req.body, { allowCloseOrRoll: false });
    if (error) return res.status(400).json({ valid: false, error });
    return res.json({ valid: true });
  } catch {
    return res.status(500).json({ valid: false, error: "Validation failed" });
  }
});

/* ============================================================
   13. CREATE POSITION
   ✅ Keeps your current safety validations
   ✅ Does NOT introduce cumulativeNetPremium
============================================================ */
router.post("/", async (req, res) => {
  try {
    const position = new Position(req.body);
    await position.save();

    // Normalize legs & compute totals server-side (trust backend only)
    if (Array.isArray(position.legs) && position.legs.length) {
      position.legs = position.legs.map((leg) => ({
        ...leg,
        premium: Number(leg.premium),
        quantity: Number(leg.quantity ?? 1),
      }));

      const MULT = 100;
      let netCash = 0;

      for (const leg of position.legs) {
        const qty = Number(leg.quantity ?? 1);
        const premium = Number(leg.premium ?? 0);

        if (!Number.isFinite(premium) || premium <= 0) {
          throw new Error(
            `Invalid option premium detected (${premium}). Expected option price like 0.55`
          );
        }

        if (premium > 50) {
          throw new Error(
            `Option premium looks like USD (${premium}). Expected option price like 0.55`
          );
        }

        const action = (leg.action || "").toLowerCase();
        const cash = premium * qty * MULT;

        if (action.includes("sell")) netCash += cash;
        if (action.includes("buy")) netCash -= cash;
      }

      // Webull style:
      // - netPremium is cash received (+) for credit, (-) for debit
      // - totalCost is negative for credit positions (cash received)
      position.totalCost = Number((-netCash).toFixed(2));
      position.netPremium = Number(netCash.toFixed(2));

      await position.save();
    }

    // OPEN PREMIUM cashflow (avoid duplicates)
    const openExists = await PositionCashFlow.findOne({
      positionId: position._id,
      type: "OPEN_PREMIUM",
    });

    if (!openExists && (position.netPremium ?? 0) !== 0) {
      await recordCashFlow({
        position,
        type: "OPEN_PREMIUM",
        amount: Number((position.netPremium ?? -position.totalCost).toFixed(2)),
        description: "Position opened",
      });
    }

    emitChange(req, "created", position);
    res.status(201).json({ success: true, data: position });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/* ============================================================
   14. UPDATE POSITION
============================================================ */
router.put("/:id", async (req, res) => {
  try {
    const updated = await Position.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated)
      return res.status(404).json({ success: false, error: "Position not found" });

    emitChange(req, "updated", updated);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/* ============================================================
   15. DELETE POSITION
============================================================ */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Position.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ success: false, error: "Position not found" });

    emitChange(req, "deleted", { id: deleted._id });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

export default router;
