// /api/utils/strategyValidator.js
export function validateStrategy(position, { allowCloseOrRoll = false } = {}) {
  const { strategy = "", legs = [] } = position || {};
  if (!legs.length) return "No legs provided";

  const S = strategy.trim().toLowerCase();

  // 1) Reglas de acciones coherentes
  const hasOpen = legs.some(l => /to open$/i.test(l.action || ""));
  const hasClose = legs.some(l => /to close$/i.test(l.action || ""));

  if (!allowCloseOrRoll) {
    if (hasClose) return "New positions must use only *to Open* actions (BTO/STO).";
  } else {
    // roll/close: permitimos mezcla, pero cada 'to close' debe correspondER a algo abierto antes (se valida a nivel de historial).
  }

  // Helpers
  const byType = t => legs.filter(l => (l.optionType || "").toLowerCase() === t);
  const calls = byType("call");
  const puts  = byType("put");
  const strikes = legs.map(l => Number(l.strike));
  const exps = legs.map(l => new Date(l.expiration).toISOString().slice(0,10));
  const uniq = arr => Array.from(new Set(arr));
  const sameExp = uniq(exps).length === 1;
  const sameStrike = uniq(strikes).length === 1;

  const count = {
    BTO: legs.filter(l => /^buy to open$/i.test(l.action || "")).length,
    STO: legs.filter(l => /^sell to open$/i.test(l.action || "")).length,
    STC: legs.filter(l => /^sell to close$/i.test(l.action || "")).length,
    BTC: legs.filter(l => /^buy to close$/i.test(l.action || "")).length,
  };

  const needOpenOnly = !allowCloseOrRoll;

  // 2) Validaciones por estrategia
  const err = (msg) => msg;

  if (/vertical|credit spread|debit spread/.test(S)) {
    if (legs.length !== 2) return err("Vertical spread must have exactly 2 legs.");
    if (!sameExp) return err("Vertical spread legs must share the same expiration.");
    if (calls.length !== 2 && puts.length !== 2) return err("Vertical must be 2 CALLs or 2 PUTs.");
    if (needOpenOnly && (count.BTO + count.STO !== 2)) return err("Vertical: legs must be BTO/STO only.");
  }

  if (/put credit spread/.test(S)) {
    if (puts.length !== 2) return err("Put credit spread requires 2 PUTs.");
    // Crédito ⇒ neto inicial > 0: STO strike alto + BTO strike bajo
    const hi = Math.max(...puts.map(l => +l.strike));
    const lo = Math.min(...puts.map(l => +l.strike));
    const stoHi = puts.find(l => +l.strike === hi && /^sell to open$/i.test(l.action));
    const btoLo = puts.find(l => +l.strike === lo && /^buy to open$/i.test(l.action));
    if (!stoHi || !btoLo) return err("Put credit spread opening must be: STO higher strike, BTO lower strike.");
  }

  if (/call credit spread/.test(S)) {
    if (calls.length !== 2) return err("Call credit spread requires 2 CALLs.");
    const hi = Math.max(...calls.map(l => +l.strike));
    const lo = Math.min(...calls.map(l => +l.strike));
    const stoLo = calls.find(l => +l.strike === lo && /^sell to open$/i.test(l.action));
    const btoHi = calls.find(l => +l.strike === hi && /^buy to open$/i.test(l.action));
    if (!stoLo || !btoHi) return err("Call credit spread opening must be: STO lower strike, BTO higher strike.");
  }

  if (/iron condor/.test(S)) {
    if (legs.length !== 4) return err("Iron Condor must have 4 legs.");
    if (!sameExp) return err("Iron Condor legs must share the same expiration.");
    if (puts.length !== 2 || calls.length !== 2) return err("Iron Condor requires 2 PUTs and 2 CALLs.");
    // Lado put: STO strike alto + BTO strike bajo
    const phi = Math.max(...puts.map(l => +l.strike));
    const plo = Math.min(...puts.map(l => +l.strike));
    if (!puts.find(l => +l.strike === phi && /^sell to open$/i.test(l.action)) ||
        !puts.find(l => +l.strike === plo && /^buy to open$/i.test(l.action))) {
      return err("Iron Condor PUT side must be STO(high) + BTO(low).");
    }
    // Lado call: STO strike bajo + BTO strike alto
    const chi = Math.max(...calls.map(l => +l.strike));
    const clo = Math.min(...calls.map(l => +l.strike));
    if (!calls.find(l => +l.strike === clo && /^sell to open$/i.test(l.action)) ||
        !calls.find(l => +l.strike === chi && /^buy to open$/i.test(l.action))) {
      return err("Iron Condor CALL side must be STO(low) + BTO(high).");
    }
  }

  if (/straddle/.test(S)) {
    if (legs.length !== 2) return err("Straddle must have 2 legs (1 CALL + 1 PUT).");
    if (calls.length !== 1 || puts.length !== 1) return err("Straddle requires exactly 1 CALL and 1 PUT.");
    if (!sameStrike || !sameExp) return err("Straddle legs must have same strike and expiration.");
    if (needOpenOnly && !(
      (count.BTO === 2 && count.STO === 0) || (count.STO === 2 && count.BTO === 0)
    )) return err("Straddle: opening must be both BTO (long) or both STO (short).");
  }

  if (/strangle/.test(S)) {
    if (legs.length !== 2) return err("Strangle must have 2 legs (1 CALL + 1 PUT).");
    if (calls.length !== 1 || puts.length !== 1) return err("Strangle requires exactly 1 CALL and 1 PUT.");
    if (sameStrike === true) return err("Strangle strikes must be different.");
    if (needOpenOnly && !(
      (count.BTO === 2 && count.STO === 0) || (count.STO === 2 && count.BTO === 0)
    )) return err("Strangle: opening must be both BTO (long) or both STO (short).");
  }

  if (/calendar/.test(S)) {
    if (legs.length !== 2) return err("Calendar spread must have 2 legs (same strike, different expiration).");
    if (!sameStrike) return err("Calendar: same strike required.");
    if (uniq(exps).length !== 2) return err("Calendar: expirations must differ.");
    // típico: BTO far + STO near (pero puede invertirse). No forzamos, solo avisamos si ambos son BTO o ambos STO.
  }

  if (/diagonal/.test(S)) {
    if (legs.length !== 2) return err("Diagonal spread must have 2 legs (different strike & expiration).");
    if (sameStrike || sameExp) return err("Diagonal: different strike and different expiration required.");
  }

  if (/cash secured put/.test(S)) {
    if (legs.length !== 1 || puts.length !== 1) return err("Cash Secured Put must be a single PUT.");
    if (!/^sell to open$/i.test(legs[0].action || "")) return err("Cash Secured Put must be Sell to Open PUT.");
  }

  if (/covered call/.test(S)) {
    // Aquí solo validamos la leg de opción: debe ser CALL short
    if (!calls.length) return err("Covered Call must include a CALL leg.");
    if (!legs.some(l => l.optionType === "Call" && /^sell to open$/i.test(l.action || ""))) {
      return err("Covered Call must have a Call sold (Sell to Open).");
    }
  }

  if (/butterfly/.test(S) && !/iron/.test(S)) {
    // 3 o 4 legs, CALL o PUT únicamente, strikes equidistantes en el caso clásico.
    if (legs.length !== 3 && legs.length !== 4) return err("Butterfly requires 3 or 4 legs.");
    if (!sameExp) return err("Butterfly: same expiration required.");
    // Recomendación: validar patrón BTO 1 low, STO 2 mid, BTO 1 high. (Se puede ampliar según tu necesidad)
  }

  // Si llegamos aquí, pasó validaciones
  return null;
}
