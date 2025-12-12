// models/UserWatchlist.js
import mongoose from "mongoose";

const WatchlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },

  symbols: {
    type: [String],
    default: [],
  },

  // metadata opcional que guardaremos después (company name, etc)
  meta: {
    type: Object,
    default: {},
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("UserWatchlist", WatchlistSchema);
