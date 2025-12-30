// routes/alerts.js
import express from "express";
import UserAlert from "../models/UserAlert.js";
import { auth as authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/* ===============================
   GET /api/alerts
=============================== */
router.get("/", authMiddleware, async (req, res) => {
  const alerts = await UserAlert.find({
    userId: req.user.id,
  }).sort({ createdAt: -1 });

  res.json(alerts);
});

/* ===============================
   POST /api/alerts
=============================== */
router.post("/", authMiddleware, async (req, res) => {
  const { symbol, type, condition, value } = req.body;

  if (!symbol || !type || !condition || value == null) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const alert = await UserAlert.create({
    userId: req.user.id,
    symbol,
    type,
    condition,
    value,
  });

  res.json({ success: true, alert });
});

/* ===============================
   DELETE /api/alerts/:id
=============================== */
router.delete("/:id", authMiddleware, async (req, res) => {
  await UserAlert.deleteOne({
    _id: req.params.id,
    userId: req.user.id,
  });

  res.json({ success: true });
});

export default router;
