import express from "express";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

/* ============================
      LIST USERS
============================ */
router.get(
  "/users",
  auth,
  requireRole("admin", "superadmin"),
  async (req, res) => {
    const users = await User.find().select("-password");
    res.json(users);
  }
);

/* ============================
      CHANGE ROLE
============================ */
router.put(
  "/role/:id",
  auth,
  requireRole("superadmin"),
  async (req, res) => {
    await User.findByIdAndUpdate(req.params.id, { role: req.body.role });
    res.json({ success: true });
  }
);

/* ============================
      CHANGE PERMISSIONS
============================ */
router.put(
  "/permissions/:id",
  auth,
  requireRole("admin", "superadmin"),
  async (req, res) => {
    await User.findByIdAndUpdate(req.params.id, { permissions: req.body });
    res.json({ success: true });
  }
);

/* ============================
      SUSPEND USER
============================ */
router.put(
  "/suspend/:id",
  auth,
  requireRole("admin", "superadmin"),
  async (req, res) => {
    await User.findByIdAndUpdate(req.params.id, { status: "suspended" });
    res.json({ success: true });
  }
);

/* ============================
      DELETE USER
============================ */
router.delete(
  "/delete/:id",
  auth,
  requireRole("superadmin"),
  async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  }
);

export default router;
