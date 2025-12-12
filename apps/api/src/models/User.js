import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    // 🔹 Personal DATA
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: null }, // opcional
    address: { type: String, default: null }, // opcional

    // 🔹 Login
    password: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },

    // 🔹 Preferences  
    acceptsMarketing: { type: Boolean, default: false },
    settings: {
      theme: { type: String, default: "light" }, // light / dark
      language: { type: String, default: "en" },
    },

    // 🔹 Rol
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },

    // 🔹 Permits
    permissions: {
      positions: { type: Boolean, default: true },
      finviz: { type: Boolean, default: true },
      tradier: { type: Boolean, default: false },
      settings: { type: Boolean, default: true },
      adminPanel: { type: Boolean, default: false },
    },

    // 🔹 Account State
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },

    // 🔹 Tokens - Advanced Auth 
    refreshToken: { type: String, default: null },
    resetToken: { type: String, default: null },
    resetTokenExp: { type: Date, default: null },

    // 🔹 Membership (Future)
    membership: {
      plan: {
        type: String,
        enum: ["free", "silver", "gold", "pro"],
        default: "free",
      },
      expiresAt: { type: Date, default: null },
      autoRenew: { type: Boolean, default: false },
    },

    // 🔹 Fast User Login
    lastLogin: { type: Date, default: null },
    lastIP: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
