// services/alertEngine.js
import UserAlert from "../models/UserAlert.js";

export async function evaluateAlerts(quotes, io) {
  if (!quotes || !io) return;

  const alerts = await UserAlert.find({ triggered: false });

  for (const alert of alerts) {
    const q = quotes[alert.symbol];
    if (!q) continue;

    const current =
      alert.type === "price"
        ? q.price
        : q.changePercent;

    if (current === null || current === undefined) continue;

    const hit =
      alert.condition === "gte"
        ? current >= alert.value
        : current <= alert.value;

    if (!hit) continue;

    alert.triggered = true;
    alert.triggeredAt = new Date();
    await alert.save();

    io.to(alert.userId.toString()).emit("alert:triggered", {
      id: alert._id,
      symbol: alert.symbol,
      type: alert.type,
      condition: alert.condition,
      target: alert.value,
      current,
    });

    console.log(`🚨 ALERT TRIGGERED → ${alert.symbol}`);
  }
}
