import PositionCashFlow from "../models/PositionCashFlow.js";

export async function recordCashFlow({
  position,
  type,
  amount,
  date = new Date(),
  description = "",
  relatedPositionId = null,
  rollGroupId = null,
  quantity = null,
}) {
  return PositionCashFlow.create({
    positionId: position._id,
    relatedPositionId,
    rollGroupId,
    symbol: position.symbol,
    strategy: position.strategy,
    date,
    type,
    amount,
    quantity,
    description,
  });
}
