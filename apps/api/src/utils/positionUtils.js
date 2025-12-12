// utils/positionUtils.js
import { generateOccSymbol } from "./occSymbol.js";

// 🔁 Genera los OCC symbols para cada leg de una posición
export function getOccSymbolsFromLegs(symbol, legs = []) {
  return legs.map((leg) => {
    return generateOccSymbol(
      symbol,
      leg.expiration,
      leg.strike,
      leg.optionType
    );
  });
}
