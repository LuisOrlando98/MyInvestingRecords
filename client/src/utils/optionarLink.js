// client/src/utils/optionarLink.js

// 👇 NO usamos new Date() para evitar problemas de zona horaria
function formatOptionarExp(expStr) {
  if (!expStr) return "";
  // expStr: "2026-01-16T00:00:00.000Z" o "2026-01-16"
  const [datePart] = expStr.split("T");      // "2026-01-16"
  const [y, m, d] = datePart.split("-").map(Number);

  const yy = String(y).slice(2);             // "26"
  const mm = String(m).padStart(2, "0");     // "01"
  const dd = String(d).padStart(2, "0");     // "16"
  return `${yy}${mm}${dd}`;                  // "260116"
}

function actionToSignedQty(action = "", quantity = 1) {
  const q = Math.abs(Number(quantity) || 1);
  // Sell → negativo, Buy → positivo
  return /sell/i.test(action) ? -q : q;
}

export function buildOptionarUrlFromPosition(position) {
  if (!position || !position.symbol || !position.legs || !position.legs.length) {
    return null;
  }

  const symbol = position.symbol.toUpperCase();

  const legsStr = position.legs
    .map((leg) => {
      if (!leg.expiration || !leg.optionType || leg.strike == null || leg.premium == null) {
        return null;
      }

      const expCode = formatOptionarExp(leg.expiration);         // "251219"
      const typeCode = leg.optionType.toUpperCase().startsWith("C") ? "C" : "P"; // C / P

      // Quitar ".0" si es entero (12.0 → 12)
      const strikeCode = String(leg.strike).replace(/\.0+$/, "");

      const qty = actionToSignedQty(leg.action, leg.quantity);   // -1 o 1
      const price = Number(leg.premium);
      const priceCode = price.toFixed(2);                        // 0.91

      // .CLF251219P12x-1@0.91
      return `.${symbol}${expCode}${typeCode}${strikeCode}x${qty}@${priceCode}`;
    })
    .filter(Boolean)
    .join(",");

  if (!legsStr) return null;

  // https://www.optionar.com/build/CLF/.CLF251219P12x-1@0.91,...
  return `https://www.optionar.com/build/${symbol}/${legsStr}`;
}
