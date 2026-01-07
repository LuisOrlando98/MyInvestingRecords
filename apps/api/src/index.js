/* ============================================================
   ENV — DEBE SER LO PRIMERO (ANTES DE TODO)
============================================================ */
import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

/* ============================================================
   NETWORK / DNS (después del env)
============================================================ */
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

/* ============================================================
   CORE IMPORTS
============================================================ */
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import http from "http";

/* ============================================================
   INTERNAL MODULES
============================================================ */
import { initSocket } from "./utils/socket.js";
import { authLimiter } from "./middleware/rateLimit.js";

import alertsRoutes from "./routes/alerts.js";
import newsRoutes from "./routes/news.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import watchlistRoutes from "./routes/watchlist.js";
import marketLogoRoutes from "./routes/marketLogo.js";
import marketDataRoutes from "./routes/marketData.js";
import finvizRoutes from "./routes/finviz.js";
import positionsRoutes from "./routes/positions.js";
import performanceRoutes from "./routes/performance.js";
import optionsRoutes from "./routes/options.js";
import tradierRoutes from "./routes/tradier.js";
import symbolsRoutes from "./routes/symbols.js";

/* ============================================================
   DEBUG (temporal — puedes borrar luego)
============================================================ */
console.log("SMTP_USER =", process.env.SMTP_USER);
console.log("SMTP_PASS exists =", !!process.env.SMTP_PASS);
console.log("SMTP_HOST =", process.env.SMTP_HOST);
console.log("SMTP_PORT =", process.env.SMTP_PORT);
console.log("🔥 FINNHUB_API_KEY LOADED:", process.env.FINNHUB_API_KEY);

/* ============================================================
   APP INIT
============================================================ */
const app = express();
const PORT = process.env.PORT || 4000;

/* ============================================================
   GLOBAL MIDDLEWARE
============================================================ */
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1") ||
        origin.startsWith("http://192.168.") ||
        origin.startsWith("http://10.") ||
        origin.startsWith("http://172.")
      ) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(helmet());
app.use(compression());
app.use(morgan("dev"));

/* ============================================================
   HEALTH CHECK
============================================================ */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "MyInvestingRecords API running",
  });
});

/* ============================================================
   AUTH (FIRST)
============================================================ */
app.use("/api/auth", authLimiter, authRoutes);

/* ============================================================
   ROUTES
============================================================ */
app.use("/api/admin", adminRoutes);
app.use("/api/finviz", finvizRoutes);
app.use("/api/options", optionsRoutes);
app.use("/api/tradier", tradierRoutes);
app.use("/api/symbols", symbolsRoutes);
app.use("/api/news", newsRoutes);

app.use("/api/watchlist", watchlistRoutes);
app.use("/api/market/logo", marketLogoRoutes);
app.use("/api/market", marketDataRoutes);
app.use("/api/positions", positionsRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/alerts", alertsRoutes);

/* ============================================================
   ERROR HANDLER
============================================================ */
app.use((err, req, res, next) => {
  console.error("🔥 Error global:", err.message);
  res.status(500).json({ success: false, error: err.message });
});

/* ============================================================
   SERVER + DB + SOCKET
============================================================ */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    const server = http.createServer(app);
    const io = initSocket(server);
    app.set("io", io);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 API ON (LAN READY) → port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Mongo error:", err.message);
    process.exit(1);
  });
