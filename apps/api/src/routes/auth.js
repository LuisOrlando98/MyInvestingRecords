import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

/* ============================================================
   REGISTER
============================================================ */
router.post("/register", authLimiter, async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      address,
      acceptsMarketing,
    } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashed,
      phone,
      address,
      acceptsMarketing,
      emailVerified: false,
    });

    const verifyToken = jwt.sign(
      { id: user._id },
      process.env.EMAIL_SECRET,
      { expiresIn: "1d" }
    );

    await sendEmail(
      email,
      "Verify your email",
      `<a href="https://yourapp.com/verify-email?token=${verifyToken}">
        Click here to verify your email
       </a>`
    );

    res.json({
      success: true,
      msg: "Registration successful. Verify your email.",
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ msg: "Registration failed" });
  }
});

/* ============================================================
   LOGIN
============================================================ */
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password, ip } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ msg: "Incorrect password" });
    }

    const accessToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    user.lastIP = ip || req.ip;
    await user.save();

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ msg: "Login failed" });
  }
});

/* ============================================================
   REFRESH TOKEN
============================================================ */
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ msg: "No refresh token" });
    }

    const user = await User.findOne({ refreshToken });
    if (!user) {
      return res.status(403).json({ msg: "Invalid refresh token" });
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const newAccessToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("REFRESH ERROR:", err);
    res.status(403).json({ msg: "Invalid refresh token" });
  }
});

/* ============================================================
   LOGOUT
============================================================ */
router.post("/logout", auth, async (req, res) => {
  try {
    req.user.refreshToken = null;
    await req.user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ msg: "Logout failed" });
  }
});

/* ============================================================
   VERIFY EMAIL
============================================================ */
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    const decoded = jwt.verify(token, process.env.EMAIL_SECRET);

    await User.findByIdAndUpdate(decoded.id, {
      emailVerified: true,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ msg: "Invalid or expired token" });
  }
});

/* ============================================================
   FORGOT PASSWORD
============================================================ */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: true });
    }

    user.resetToken = crypto.randomUUID();
    user.resetTokenExp = Date.now() + 15 * 60 * 1000;
    await user.save();

    await sendEmail(
      email,
      "Reset your password",
      `Your reset code: ${user.resetToken}`
    );

    res.json({ success: true });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ msg: "Failed to send reset token" });
  }
});

/* ============================================================
   RESET PASSWORD
============================================================ */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExp: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ msg: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExp = null;
    await user.save();

    res.json({ success: true });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ msg: "Password reset failed" });
  }
});

export default router;
