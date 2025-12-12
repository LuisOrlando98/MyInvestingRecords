// src/services/tradierWSService.js
export function createTradierWS(symbols, onMessage, onError) {
  const url = "wss://ws.tradier.com/v1/markets/events";  // endpoint WebSocket Tradier :contentReference[oaicite:1]{index=1}
  const ws = new WebSocket(url);

  ws.onopen = () => {
    const payload = JSON.stringify({
      symbols,
      sessionid: null,  // si tu backend te da un sessionid, pásalo
      linebreak: true,
      validOnly: true
    });
    ws.send(payload);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };

  ws.onerror = (error) => {
    if (onError) onError(error);
  };

  ws.onclose = () => {
    console.warn("Tradier WS closed, consider reconnecting.");
    // aquí puedes implementar reconexión automática
  };

  return ws;
}
