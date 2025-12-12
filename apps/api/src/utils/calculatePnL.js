// utils/calculatePnL.js

export function calculatePnL(position) {
  const { strategy, type, legs, quantity, entryPrice, exitPrice } = position;

  switch (strategy) {
    case "Iron Condor":
      return calculateIronCondor(legs);

    case "Vertical Spread":
      return calculateVerticalSpread(legs);

    case "Covered Call":
      return calculateCoveredCall(position);

    case "Cash Secured Put":
      return calculateCashSecuredPut(position);

    default:
      if (type === "stock") {
        return calculateStockPnL(position);
      } else {
        return { maxProfit: null, maxLoss: null, breakEven: null };
      }
  }
}

function calculateIronCondor(legs) {
  const credit = sumPremiums(legs.filter(l => l.action === "Sell to Open"));
  const debit = sumPremiums(legs.filter(l => l.action === "Buy to Open"));
  const netCredit = credit - debit;

  const putSpread = Math.abs(legs[0].strike - legs[1].strike);
  const callSpread = Math.abs(legs[2].strike - legs[3].strike);
  const width = Math.max(putSpread, callSpread);

  return {
    maxProfit: netCredit * 100,
    maxLoss: (width * 100) - (netCredit * 100),
    breakEven: [
      legs[0].strike - netCredit,
      legs[2].strike + netCredit
    ]
  };
}

function calculateVerticalSpread(legs) {
  const long = legs.find(l => l.action === "Buy to Open");
  const short = legs.find(l => l.action === "Sell to Open");
  const netPremium = short.premium - long.premium;
  const width = Math.abs(long.strike - short.strike);
  const isCredit = netPremium > 0;

  return {
    maxProfit: isCredit ? netPremium * 100 : (width - netPremium) * 100,
    maxLoss: isCredit ? (width - netPremium) * 100 : netPremium * 100,
    breakEven: isCredit
      ? short.strike + (short.optionType === "Call" ? netPremium : -netPremium)
      : long.strike + (long.optionType === "Call" ? -netPremium : netPremium)
  };
}

function calculateCoveredCall(position) {
  const { entryPrice, premiumReceived, strike } = position;
  return {
    maxProfit: ((strike - entryPrice) + premiumReceived) * 100,
    maxLoss: (entryPrice - premiumReceived) * 100,
    breakEven: entryPrice - premiumReceived
  };
}

function calculateCashSecuredPut(position) {
  const { strike, premiumReceived } = position;
  return {
    maxProfit: premiumReceived * 100,
    maxLoss: (strike - premiumReceived) * 100,
    breakEven: strike - premiumReceived
  };
}

function calculateStockPnL(position) {
  const { entryPrice, exitPrice, quantity = 1 } = position;
  return {
    maxProfit: (exitPrice - entryPrice) * quantity,
    maxLoss: 0,
    breakEven: entryPrice
  };
}

function sumPremiums(legs) {
  return legs.reduce((sum, leg) => sum + (leg.premium || 0), 0);
}
