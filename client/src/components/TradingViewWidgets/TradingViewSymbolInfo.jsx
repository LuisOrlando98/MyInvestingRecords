import React, { useEffect, useRef, memo } from "react";
import { useParams } from "react-router-dom";

function TradingViewSymbolInfo() {
  const { symbol } = useParams();
  const container = useRef(null);

  useEffect(() => {
    if (!symbol) return;
    container.current.innerHTML = "";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol.toUpperCase(),
      colorTheme: document.documentElement.classList.contains("dark")
        ? "dark"
        : "light",
      isTransparent: false,
      locale: "en",
      width: "100%",
    });
    container.current.appendChild(script);
  }, [symbol]);

  return (
    <div
      className="tradingview-widget-container rounded-lg overflow-hidden"
      ref={container}
    >
      <div className="tradingview-widget-container__widget"></div>
    </div>
  );
}

export default memo(TradingViewSymbolInfo);
