import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

function TradingViewChart() {
  const { symbol } = useParams();
  const containerRef = useRef(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // ✅ Cargar el script de TradingView solo una vez
  useEffect(() => {
    if (window.TradingView) {
      setIsScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      console.log("✅ TradingView script loaded");
      setIsScriptLoaded(true);
    };
    script.onerror = () => console.error("❌ Failed to load TradingView script.");
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  // 📈 Crear el gráfico
  useEffect(() => {
    if (!isScriptLoaded || !containerRef.current || !symbol || !window.TradingView) return;

    const widget = new window.TradingView.widget({
      autosize: true,
      symbol: symbol.toUpperCase(),
      interval: "15",
      timezone: "America/New_York",
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      style: "1",
      locale: "en",
      container_id: containerRef.current.id,
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      studies: ["BB@tv-basicstudies", "MACD@tv-basicstudies"],
    });

    return () => {
      if (widget && widget.remove) widget.remove();
    };
  }, [isScriptLoaded, symbol]);

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
      <div id="tv_chart_container" ref={containerRef} style={{ height: "600px", width: "100%" }} />
    </div>
  );
}

export default TradingViewChart;
