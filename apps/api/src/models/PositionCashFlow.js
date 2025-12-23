import mongoose from "mongoose";

const positionCashFlowSchema = new mongoose.Schema(
  {
    positionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
      required: true,
    },

    relatedPositionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
    },

    rollGroupId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    symbol: { type: String, required: true },
    strategy: { type: String },

    date: { type: Date, required: true },

    type: {
      type: String,
      enum: [
        "OPEN_PREMIUM",
        "CLOSE_PREMIUM",
        "ROLL_OUT",
        "ROLL_IN",
        "ASSIGNMENT",
        "EXERCISE",
        "STOCK_BUY",
        "STOCK_SELL",
      ],
      required: true,
    },

    amount: {
      type: Number,
      required: true, // +cash in / -cash out
    },

    quantity: { type: Number },
    description: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("PositionCashFlow", positionCashFlowSchema);
