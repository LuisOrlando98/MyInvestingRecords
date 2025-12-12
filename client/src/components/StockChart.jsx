// client/src/components/StockChart.js
import React, { useEffect } from "react";

const StockChart = ({ symbol = "AAPL" }) => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      new window.TradingView.widget({
        container_id: "tradingview_chart",
        width: "100%",
        height: 500,
        symbol: `NASDAQ:${symbol}`,
        interval: "15", // temporalidad: 1, 5, 15, 30, 60, 1D, 1W, 1M
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#f1f3f6",
        enable_publishing: false,
        allow_symbol_change: true,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
      });
    };
    document.getElementById("tradingview_chart").innerHTML = ""; // Limpia el anterior
    document.getElementById("tradingview_chart").appendChild(script);
  }, [symbol]);

  return (
    <div className="my-4">
      <div id="tradingview_chart" />
    </div>
  );
};

export default StockChart;
