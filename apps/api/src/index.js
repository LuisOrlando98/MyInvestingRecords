import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

console.log("🔥 FINNHUB_API_KEY LOADED:", process.env.FINNHUB_API_KEY);

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import http from "http";

import { initSocket } from "./utils/socket.js";
import { authLimiter } from "./middleware/rateLimit.js";

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

const app = express();
const PORT = process.env.PORT || 4000;

/* ============================================================
   GLOBAL MIDDLEWARE
============================================================ */
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
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
   AUTH FIRST (with rate limit)
============================================================ */
app.use("/api/auth", authLimiter, authRoutes);

/* ============================================================
   OTHER SIMPLE ROUTES
============================================================ */
app.use("/api/admin", adminRoutes);
app.use("/api/finviz", finvizRoutes);
app.use("/api/options", optionsRoutes);
app.use("/api/tradier", tradierRoutes);
app.use("/api/symbols", symbolsRoutes);
app.use("/api/news", newsRoutes);

/* ============================================================
   WATCHLIST + LOGOS
============================================================ */
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/market/logo", marketLogoRoutes);  // ✔ ESTA ES LA BUENA

/* ============================================================
   MARKET DATA
============================================================ */
app.use("/api/market", marketDataRoutes);
app.use("/api/positions", positionsRoutes);
app.use("/api/performance", performanceRoutes);

/* ============================================================
   ERROR HANDLER
============================================================ */
app.use((err, req, res, next) => {
  console.error("🔥 Error global:", err.message);
  res.status(500).json({ success: false, error: err.message });
});

/* ============================================================
   SERVER + MONGO + SOCKET.IO
============================================================ */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    const server = http.createServer(app);
    const io = initSocket(server);
    app.set("io", io);

    server.listen(PORT, () =>
      console.log(`🚀 API ON: http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("Mongo error:", err.message);
    process.exit(1);
  });
