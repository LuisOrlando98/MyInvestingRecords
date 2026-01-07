import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { sendEmail } from "../utils/sendEmail.js";
import { generateResetToken } from "../utils/generateResetToken.js";

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
   REFRESH TOKEN (PRO)
============================================================ */
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ msg: "No refresh token" });
    }

    // 1) verify firma/exp
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(403).json({ msg: "Invalid refresh token" });
    }

    // 2) find user and match stored token
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ msg: "Refresh token mismatch" });
    }

    // 3) issue new access token
    const newAccessToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("REFRESH ERROR:", err);
    res.status(500).json({ msg: "Refresh failed" });
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

    // 🔒 Anti user-enumeration
    if (!user) {
      return res.json({ success: true });
    }

    const { rawToken, hashedToken } = generateResetToken();

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    await sendEmail(
      user.email,
      "Security alert: reset your MyInvestingRecords password",
          `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Password Reset</title>
        </head>

        <body style="
          margin:0;
          padding:0;
          background:#ffffff;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
          color:#0f172a;
        ">

          <!-- Outer wrapper -->
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 12px;">
            <tr>
              <td align="center">

                <!-- Card -->
                <table width="100%" cellpadding="0" cellspacing="0" style="
                  max-width:520px;
                  background:#020617;
                  border-radius:16px;
                  border:1px solid #1e293b;
                  padding:32px;
                ">

                  <!-- Logo -->
                  <tr>
                    <td align="center" style="padding-bottom:20px;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="
                            width:48px;
                            height:48px;
                            border-radius:12px;
                            background:#10b981;
                            font-weight:800;
                            font-size:18px;
                            color:#020617;
                            line-height:48px;
                            text-align:center;
                          ">
                            MI
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Title -->
                  <tr>
                    <td align="center" style="padding-bottom:12px;">
                      <h1 style="
                        margin:0;
                        font-size:22px;
                        font-weight:700;
                        color:#f8fafc;
                      ">
                        Reset your password
                      </h1>
                    </td>
                  </tr>

                  <!-- Message -->
                  <tr>
                    <td align="center" style="padding-bottom:20px;">
                      <p style="
                        margin:0;
                        font-size:14px;
                        line-height:1.6;
                        color:#cbd5f5;
                      ">
                        We detected a request to change the password for your
                        <strong>MyInvestingRecords</strong> account.
                      </p>
                    </td>
                  </tr>

                  <!-- Button -->
                  <tr>
                    <td align="center" style="padding-bottom:24px;">
                      <a href="${resetUrl}" target="_blank" style="
                        display:inline-block;
                        padding:14px 22px;
                        border-radius:10px;
                        background:#10b981;
                        color:#020617;
                        font-size:14px;
                        font-weight:700;
                        text-decoration:none;
                      ">
                        Reset password
                      </a>
                    </td>
                  </tr>

                  <!-- Expiration -->
                  <tr>
                    <td align="center" style="padding-bottom:20px;">
                      <p style="
                        margin:0;
                        font-size:12px;
                        color:#94a3b8;
                      ">
                        This link will expire in <strong>15 minutes</strong>.
                      </p>
                    </td>
                  </tr>

                  <!-- Divider -->
                  <tr>
                    <td style="padding:16px 0;">
                      <div style="height:1px;background:#1e293b;"></div>
                    </td>
                  </tr>

                  <!-- Security warning -->
                  <tr>
                    <td align="center">
                      <p style="
                        margin:0;
                        font-size:12px;
                        line-height:1.6;
                        color:#94a3b8;
                      ">
                        If you did <strong>not</strong> request this password change,
                        please contact us immediately at<br/>
                        <a href="mailto:luiso.rodriguezcabrera@gmail.com"
                          style="color:#6ee7b7;text-decoration:none;font-weight:600;">
                          luiso.rodriguezcabrera@gmail.com
                        </a>
                      </p>
                    </td>
                  </tr>

                </table>

                <!-- Footer -->
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin-top:18px;">
                  <tr>
                    <td align="center">
                      <p style="
                        margin:0;
                        font-size:11px;
                        color:#64748b;
                        line-height:1.5;
                      ">
                        © ${new Date().getFullYear()} MyInvestingRecords<br/>
                        Secure trading & analytics platform
                      </p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>
          </table>

        </body>
        </html>
        `
      );


    return res.json({ success: true });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    return res.status(500).json({ msg: "Failed to process request" });
  }
});

/* ============================================================
   RESET PASSWORD
============================================================ */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ msg: "Invalid request" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ msg: "Password must be at least 8 characters long" });
    }

    // 🔒 Hash del token recibido
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ msg: "Invalid or expired reset token" });
    }

    // 🔐 Cambiar contraseña
    user.password = await bcrypt.hash(newPassword, 10);

    // 🔥 Invalidar todo
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.refreshToken = null; // logout global

    await user.save();

    return res.json({ success: true });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    return res.status(500).json({ msg: "Password reset failed" });
  }
});

export default router;
