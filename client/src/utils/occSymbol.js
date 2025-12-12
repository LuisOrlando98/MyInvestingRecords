// client/src/utils/occSymbol.js
export function generateOccSymbol(symbol, expiration, strike, type) {
  if (!symbol || !expiration || !strike || !type) return null;

  const date = new Date(expiration);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const formattedDate = `${yy}${mm}${dd}`;

  const strikePrice = String(Math.round(parseFloat(strike) * 1000)).padStart(8, "0");
  const callOrPut = type.toUpperCase() === "CALL" ? "C" : "P";

  return `${symbol.toUpperCase()}${formattedDate}${callOrPut}${strikePrice}`;
}
