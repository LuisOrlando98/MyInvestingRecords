// /api/utils/strategyValidator.js

// ======================================================
// STRATEGY GUIDES — User-friendly explanations
// (Used to produce better error messages & guidance)
// ======================================================

const STRATEGY_GUIDES = {
  "put credit spread": {
    example: "STO PUT 100 / BTO PUT 95",
    rules: [
      "Sell PUT at the HIGHER strike",
      "Buy PUT at the LOWER strike",
      "Same expiration"
    ]
  },

  "call credit spread": {
    example: "STO CALL 105 / BTO CALL 110",
    rules: [
      "Sell CALL at the LOWER strike",
      "Buy CALL at the HIGHER strike",
      "Same expiration"
    ]
  },

  "iron condor": {
    example: "PUT: STO 100 / BTO 95  —  CALL: STO 110 / BTO 115",
    rules: [
      "PUT side: Sell higher strike, Buy lower strike",
      "CALL side: Sell lower strike, Buy higher strike",
      "All legs must share the same expiration"
    ]
  }
};

// ======================================================
// MAIN VALIDATOR
// ======================================================

export function validateStrategy(position, { allowCloseOrRoll = false } = {}) {
  const { strategy = "", legs = [] } = position || {};
  if (!legs.length) return "No option legs provided.";

  const S = strategy.trim().toLowerCase();

  // ======================================================
  // 1) ACTION CONSISTENCY
  // ======================================================

  const hasOpen = legs.some(l => /to open$/i.test(l.action || ""));
  const hasClose = legs.some(l => /to close$/i.test(l.action || ""));

  if (!allowCloseOrRoll && hasClose) {
    return "New positions must use only Buy/Sell to Open actions (BTO / STO).";
  }

  // ======================================================
  // 2) HELPERS
  // ======================================================

  const byType = t =>
    legs.filter(l => (l.optionType || "").toLowerCase() === t);

  const calls = byType("call");
  const puts = byType("put");

  const strikes = legs.map(l => Number(l.strike));
  const exps = legs.map(l =>
    new Date(l.expiration).toISOString().slice(0, 10)
  );

  const uniq = arr => Array.from(new Set(arr));

  const sameExp = uniq(exps).length === 1;
  const sameStrike = uniq(strikes).length === 1;

  const count = {
    BTO: legs.filter(l => /^buy to open$/i.test(l.action || "")).length,
    STO: legs.filter(l => /^sell to open$/i.test(l.action || "")).length,
    STC: legs.filter(l => /^sell to close$/i.test(l.action || "")).length,
    BTC: legs.filter(l => /^buy to close$/i.test(l.action || "")).length
  };

  const needOpenOnly = !allowCloseOrRoll;
  const err = msg => msg;

  // ======================================================
  // 3) GENERIC VERTICAL SPREAD RULES
  // ======================================================

  if (/vertical|credit spread|debit spread/.test(S)) {
    if (legs.length !== 2)
      return err("Vertical spreads must have exactly 2 legs.");

    if (!sameExp)
      return err("Vertical spread legs must share the same expiration.");

    if (calls.length !== 2 && puts.length !== 2)
      return err("Vertical spreads must be either 2 CALLs or 2 PUTs.");

    if (needOpenOnly && count.BTO + count.STO !== 2)
      return err("Vertical spreads must be opened using only BTO / STO.");
  }

  // ======================================================
  // 4) PUT CREDIT SPREAD
  // ======================================================

  if (/put credit spread/.test(S)) {
    if (puts.length !== 2)
      return err("Put Credit Spread requires exactly 2 PUTs.");

    const hi = Math.max(...puts.map(l => +l.strike));
    const lo = Math.min(...puts.map(l => +l.strike));

    const stoHi = puts.find(
      l => +l.strike === hi && /^sell to open$/i.test(l.action)
    );
    const btoLo = puts.find(
      l => +l.strike === lo && /^buy to open$/i.test(l.action)
    );

    if (!stoHi || !btoLo) {
      return err(
        "Put Credit Spread setup incorrect.\n" +
        "Expected:\n" +
        "• Sell PUT at the HIGHER strike\n" +
        "• Buy PUT at the LOWER strike\n" +
        `Example: ${STRATEGY_GUIDES["put credit spread"].example}`
      );
    }
  }

  // ======================================================
  // 5) CALL CREDIT SPREAD
  // ======================================================

  if (/call credit spread/.test(S)) {
    if (calls.length !== 2)
      return err("Call Credit Spread requires exactly 2 CALLs.");

    const hi = Math.max(...calls.map(l => +l.strike));
    const lo = Math.min(...calls.map(l => +l.strike));

    const stoLo = calls.find(
      l => +l.strike === lo && /^sell to open$/i.test(l.action)
    );
    const btoHi = calls.find(
      l => +l.strike === hi && /^buy to open$/i.test(l.action)
    );

    if (!stoLo || !btoHi) {
      return err(
        "Call Credit Spread setup incorrect.\n" +
        "Expected:\n" +
        "• Sell CALL at the LOWER strike\n" +
        "• Buy CALL at the HIGHER strike\n" +
        `Example: ${STRATEGY_GUIDES["call credit spread"].example}`
      );
    }
  }

  // ======================================================
  // 6) IRON CONDOR
  // ======================================================

  if (/iron condor/.test(S)) {
    if (legs.length !== 4)
      return err("Iron Condor must have exactly 4 legs.");

    if (!sameExp)
      return err("Iron Condor legs must all share the same expiration.");

    if (puts.length !== 2 || calls.length !== 2)
      return err("Iron Condor requires 2 PUTs and 2 CALLs.");

    // PUT SIDE
    const phi = Math.max(...puts.map(l => +l.strike));
    const plo = Math.min(...puts.map(l => +l.strike));

    if (
      !puts.find(l => +l.strike === phi && /^sell to open$/i.test(l.action)) ||
      !puts.find(l => +l.strike === plo && /^buy to open$/i.test(l.action))
    ) {
      return err(
        "Iron Condor PUT side incorrect.\n" +
        "Expected:\n" +
        "• Sell PUT at the HIGHER strike\n" +
        "• Buy PUT at the LOWER strike\n" +
        `Example: ${STRATEGY_GUIDES["iron condor"].example}`
      );
    }

    // CALL SIDE
    const chi = Math.max(...calls.map(l => +l.strike));
    const clo = Math.min(...calls.map(l => +l.strike));

    if (
      !calls.find(l => +l.strike === clo && /^sell to open$/i.test(l.action)) ||
      !calls.find(l => +l.strike === chi && /^buy to open$/i.test(l.action))
    ) {
      return err(
        "Iron Condor CALL side incorrect.\n" +
        "Expected:\n" +
        "• Sell CALL at the LOWER strike\n" +
        "• Buy CALL at the HIGHER strike\n" +
        `Example: ${STRATEGY_GUIDES["iron condor"].example}`
      );
    }
  }

  // ======================================================
  // 7) STRADDLE
  // ======================================================

  if (/straddle/.test(S)) {
    if (legs.length !== 2)
      return err("Straddle must have exactly 2 legs.");

    if (calls.length !== 1 || puts.length !== 1)
      return err("Straddle requires 1 CALL and 1 PUT.");

    if (!sameStrike || !sameExp)
      return err("Straddle legs must share the same strike and expiration.");

    if (
      needOpenOnly &&
      !(
        (count.BTO === 2 && count.STO === 0) ||
        (count.STO === 2 && count.BTO === 0)
      )
    ) {
      return err(
        "Straddle opening must be either:\n" +
        "• Both Buy to Open (long straddle)\n" +
        "• Both Sell to Open (short straddle)"
      );
    }
  }

  // ======================================================
  // 8) STRANGLE
  // ======================================================

  if (/strangle/.test(S)) {
    if (legs.length !== 2)
      return err("Strangle must have exactly 2 legs.");

    if (calls.length !== 1 || puts.length !== 1)
      return err("Strangle requires 1 CALL and 1 PUT.");

    if (sameStrike)
      return err("Strangle strikes must be different.");

    if (
      needOpenOnly &&
      !(
        (count.BTO === 2 && count.STO === 0) ||
        (count.STO === 2 && count.BTO === 0)
      )
    ) {
      return err(
        "Strangle opening must be either:\n" +
        "• Both Buy to Open (long strangle)\n" +
        "• Both Sell to Open (short strangle)"
      );
    }
  }

  // ======================================================
  // 9) CASH SECURED PUT
  // ======================================================

  if (/cash secured put/.test(S)) {
    if (legs.length !== 1 || puts.length !== 1)
      return err("Cash Secured Put must have a single PUT leg.");

    if (!/^sell to open$/i.test(legs[0].action || ""))
      return err("Cash Secured Put must be Sell to Open.");
  }

  // ======================================================
  // 10) COVERED CALL
  // ======================================================

  if (/covered call/.test(S)) {
    if (!calls.length)
      return err("Covered Call must include a CALL option.");

    if (
      !legs.some(
        l =>
          l.optionType === "Call" &&
          /^sell to open$/i.test(l.action || "")
      )
    ) {
      return err("Covered Call must sell a CALL (Sell to Open).");
    }
  }

  // ======================================================
  // 11) BUTTERFLY (basic)
  // ======================================================

  if (/butterfly/.test(S) && !/iron/.test(S)) {
    if (legs.length !== 3 && legs.length !== 4)
      return err("Butterfly must have 3 or 4 legs.");

    if (!sameExp)
      return err("Butterfly legs must share the same expiration.");
  }

  // ======================================================
  // ✅ PASSED ALL VALIDATIONS
  // ======================================================

  return null;
}
