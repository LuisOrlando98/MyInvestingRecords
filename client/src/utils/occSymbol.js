// client/src/utils/occSymbol.js
export function generateOccSymbol(symbol, expiration, strike, type) {
  if (!symbol || !expiration || !strike || !type) return null;

  let yy = "";
  let mm = "";
  let dd = "";
  const expStr = String(expiration || "").split("T")[0];
  const parts = expStr.split("-");

  if (parts.length === 3 && parts[0].length === 4) {
    yy = parts[0].slice(-2);
    mm = parts[1].padStart(2, "0");
    dd = parts[2].padStart(2, "0");
  } else {
    const date = new Date(expiration);
    if (Number.isNaN(date.getTime())) return null;
    yy = String(date.getUTCFullYear()).slice(-2);
    mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    dd = String(date.getUTCDate()).padStart(2, "0");
  }

  const formattedDate = `${yy}${mm}${dd}`;
  const strikePrice = String(Math.round(parseFloat(strike) * 1000)).padStart(
    8,
    "0"
  );
  const callOrPut = type.toUpperCase() === "CALL" ? "C" : "P";

  return `${symbol.toUpperCase()}${formattedDate}${callOrPut}${strikePrice}`;
}
