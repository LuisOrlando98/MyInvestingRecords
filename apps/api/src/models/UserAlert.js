// models/UserAlert.js
import mongoose from "mongoose";

const UserAlertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    symbol: {
      type: String,
      required: true,
      uppercase: true,
    },

    type: {
      type: String,
      enum: ["price", "percent"],
      required: true,
    },

    condition: {
      type: String,
      enum: ["gte", "lte"], // >= o <=
      required: true,
    },

    value: {
      type: Number,
      required: true,
    },

    triggered: {
      type: Boolean,
      default: false,
    },

    triggeredAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("UserAlert", UserAlertSchema);
