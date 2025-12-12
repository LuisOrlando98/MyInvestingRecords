import mongoose from "mongoose";

const legSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ["Buy to Open", "Sell to Open", "Buy to Close", "Sell to Close"],
    required: true,
  },
  optionType: { type: String, enum: ["Call", "Put"], required: true },
  strike: { type: Number, required: true },
  expiration: { type: Date, required: true },
  premium: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
});

const positionSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true },
    type: {
      type: String,
      enum: ["stock", "option", "crypto", "etf", "future", "bond"],
      required: true,
    },
    strategy: { type: String, default: "" },
    broker: {
      type: String,
      enum: [
        "Fidelity",
        "Charles Schwab",
        "Webull",
        "Robinhood",
        "Tradier",
        "IBKR",
        "E*TRADE",
        "TD Ameritrade",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["Open", "Closed", "Rolled"],
      default: "Open",
    },

    // 👉 NUEVO: cómo terminó la posición cuando está Closed
    // (lo usaremos para pintar verde/rojo en el frontend)
    closedStatus: {
      type: String,
      enum: ["win", "loss", "breakeven"],
      default: undefined,
    }, // NEW

    action: { type: String },
    quantity: {
      type: Number,
      required: function () {
        return !this.legs || this.legs.length === 0;
      },
    },
    entryPrice: {
      type: Number,
      required: function () {
        return !this.legs || this.legs.length === 0;
      },
    },
    totalCost: { type: Number },
    fees: { type: Number },
    premiumReceived: { type: Number },
    premiumPaid: { type: Number },
    netPremium: { type: Number },
    exitPrice: { type: Number },
    revenue: { type: Number },
    maxProfit: { type: Number },
    maxLoss: { type: Number },
    breakEvenLow: { type: Number },
    breakEvenHigh: { type: Number },
    realizedPnL: { type: Number },
    openDate: { type: Date },
    closeDate: { type: Date },
    legs: { type: [legSchema], default: [] },
    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Position", positionSchema);
