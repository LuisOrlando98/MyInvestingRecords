// src/components/strategies.js

// 🔑 IMPORTANT:
// - Keys are LOWERCASE
// - These keys MUST match backend validation
// - Labels are only for UI

export const STRATEGIES = {
  STOCK: "stock",
  CSP: "cash secured put",
  CC: "covered call",

  PCS: "put credit spread",
  CCS: "call credit spread",
  PDS: "put debit spread",
  CDS: "call debit spread",

  IC: "iron condor",
  STRADDLE: "straddle",
  STRANGLE: "strangle",
  BUTTERFLY: "butterfly",
};

export const STRATEGY_OPTIONS = [
  { key: STRATEGIES.STOCK, label: "Stock" },
  { key: STRATEGIES.CSP, label: "Cash Secured Put" },
  { key: STRATEGIES.CC, label: "Covered Call" },

  { group: "Spreads" },
  { key: STRATEGIES.PCS, label: "Put Credit Spread" },
  { key: STRATEGIES.CCS, label: "Call Credit Spread" },
  { key: STRATEGIES.PDS, label: "Put Debit Spread" },
  { key: STRATEGIES.CDS, label: "Call Debit Spread" },

  { group: "Neutral / Volatility" },
  { key: STRATEGIES.IC, label: "Iron Condor" },
  { key: STRATEGIES.STRADDLE, label: "Straddle" },
  { key: STRATEGIES.STRANGLE, label: "Strangle" },
  { key: STRATEGIES.BUTTERFLY, label: "Butterfly" },
];
