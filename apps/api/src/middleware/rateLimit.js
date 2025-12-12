import rateLimit from "express-rate-limit";

const isProd = process.env.NODE_ENV === "production";

export const authLimiter = rateLimit({
  windowMs: isProd ? 10 * 60 * 1000 : 15 * 1000,
  max: isProd ? 5 : 30,
  message: {
    success: false,
    error: "Too many login attempts. Try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
