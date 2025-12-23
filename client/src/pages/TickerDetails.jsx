// src/pages/TickerDetails.js
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { motion } from "framer-motion";
import FinvizTable from "../components/FinvizTable";
import TradingViewSymbolInfo from "../components/TradingViewWidgets/TradingViewSymbolInfo";
import TradingViewChart from "../components/TradingViewWidgets/TradingViewChart";
import NewsFeed from "../components/NewsFeed";

/* ============================================================
   💹 TickerDetails — Premium 2025 Edition
   Includes:
   - Minimal top search bar
   - TradingView chart with MACD by default
   - Finviz fundamentals
   - Historical performance
   - Technical Analysis + News widgets
============================================================ */

function TickerDetails() {
  const { symbol } = useParams();
  const navigate = useNavigate();

  const [inputSymbol, setInputSymbol] = useState(symbol || "");
  const [isExpanded, setIsExpanded] = useState(false);
  const [finvizData, setFinvizData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState(null);
  const [positions, setPositions] = useState([]);
  const [historicalSummary, setHistoricalSummary] = useState({
    realizedPnL: 0,
    avgReturn: 0,
    totalTrades: 0,
  });

  const chartContainerId = useMemo(() => "tv_chart_container", []);

  /* ============================================================
     🧾 Load Finviz data
  ============================================================ */
  useEffect(() => {
    if (!symbol) return;
    setLoading(true);

    axios
      .get(`/api/finviz/${symbol}`)
      .then((res) => {
        const data = res.data?.data || [];
        setFinvizData(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("❌ Error loading Finviz:", err);
        setFinvizData([]);
      })
      .finally(() => setLoading(false));
  }, [symbol]);

  /* ============================================================
     💲 Load live quote
  ============================================================ */
  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await axios.get(
          `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=demo`
        );
        setQuote(res.data);
      } catch (err) {
        console.warn("Quote fetch failed:", err.message);
      }
    };
    fetchQuote();
  }, [symbol]);

  /* ============================================================
     📊 Load positions data
  ============================================================ */
  useEffect(() => {
    if (!symbol) return;

    axios
      .get(`/api/positions?symbol=${symbol}`)
      .then((res) => {
        const data = res.data || [];
        setPositions(data);

        if (data.length) {
          const realizedPnL = data.reduce(
            (sum, p) => sum + (p.realizedPnL || 0),
            0
          );
          const avgReturn =
            data.reduce((sum, p) => sum + (p.percentReturn || 0), 0) /
            data.length;
          setHistoricalSummary({
            realizedPnL,
            avgReturn,
            totalTrades: data.length,
          });
        } else {
          setHistoricalSummary({ realizedPnL: 0, avgReturn: 0, totalTrades: 0 });
        }
      })
      .catch((err) => console.error("❌ Error loading positions:", err));
  }, [symbol]);

  /* ============================================================
     🔍 Handle ticker search
  ============================================================ */
  const handleSearch = (e) => {
    e.preventDefault();
    if (inputSymbol.trim())
      navigate(`/ticker/${inputSymbol.trim().toUpperCase()}`);
  };

  // Cierra el buscador al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest("#searchBar")) {
        setIsExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ============================================================
     📈 Load TradingView script + chart with MACD
  ============================================================ */
  useEffect(() => {
    if (!window.TradingView) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = () => loadChart();
      document.head.appendChild(script);
      return;
    }
    loadChart();
  }, [symbol]);

  const loadChart = () => {
    if (!window.TradingView) return;

    new window.TradingView.widget({
      autosize: true,
      symbol: symbol.toUpperCase(),
      interval: "15",
      timezone: "Etc/UTC",
      theme: "light",
      style: "1",
      locale: "en",
      toolbar_bg: "#f1f3f6",
      enable_publishing: false,
      allow_symbol_change: false,
      container_id: chartContainerId,
      withdateranges: true,
      hide_side_toolbar: false,
      studies: ["MACD@tv-basicstudies"],
    });
  };

  /* ============================================================
     🧱 Render
  ============================================================ */
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 relative">
      {/* ====== Collapsible Search Icon (minimal improved) ====== */}
      <div id="searchBar" className="fixed bottom-6 right-6 z-50">
        <motion.div
          className={`flex items-center shadow-lg rounded-full border border-gray-300 dark:border-gray-700 
                      overflow-hidden bg-white dark:bg-gray-800 transition-all duration-300 
                      ${isExpanded ? "px-2" : "px-0"}`}
          animate={{ width: isExpanded ? 260 : 46 }}
          transition={{ duration: 0.25 }}
        >
          {/* Icon */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex items-center justify-center w-10 h-10 text-gray-500 hover:text-blue-600 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z"
              />
            </svg>
          </button>

          {/* Input visible solo al expandir */}
          {isExpanded && (
            <form
              onSubmit={handleSearch}
              className="flex items-center flex-grow"
            >
              <input
                value={inputSymbol}
                onChange={(e) => setInputSymbol(e.target.value)}
                placeholder="Search ticker..."
                className="flex-grow px-2 text-sm bg-transparent text-gray-800 dark:text-gray-100 
                          placeholder-gray-400 focus:outline-none"
                autoFocus
              />
              {inputSymbol && (
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold rounded-full 
                            bg-blue-600 hover:bg-blue-700 text-white transition"
                >
                  Go
                </button>
              )}
            </form>
          )}
        </motion.div>
      </div>

      {/* ====== Symbol Info ====== */}
      <header className="relative z-10 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-[1600px] mx-auto px-6 pt-6">
          <div
            className="
              rounded-xl
              overflow-hidden
              bg-gray-50 dark:bg-gray-900

              [&_iframe]:bg-transparent
              [&_iframe]:border-0
              [&_iframe]:shadow-none

              [&_div]:bg-transparent
              [&_section]:bg-transparent
            "
          >
            <TradingViewSymbolInfo />
          </div>
        </div>
      </header>

      {/* ====== Main ====== */}
      <main className="max-w-[1600px] mx-auto px-6 py-10 space-y-10">
        {/* ====== Chart ====== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <div id={chartContainerId} style={{ height: "600px", width: "100%" }} />
        </motion.div>

        {/* ====== Finviz Fundamentals ====== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white dark:bg-gray-800 shadow-lg rounded-lg border p-6"
        >
          {loading ? (
            <p className="text-gray-400 text-center animate-pulse">
              Loading Finviz data...
            </p>
          ) : finvizData.length > 0 ? (
            <FinvizTable data={finvizData} />
          ) : (
            <p className="text-gray-500 text-center">
              No Finviz data available for <b>{symbol.toUpperCase()}</b>.
            </p>
          )}
        </motion.div>

        {/* ====== Performance Summary + Fundamentals ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 📊 Summary + Positions */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg border shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
              📊 Performance Summary ({symbol.toUpperCase()})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-green-50 dark:bg-green-900 border p-4 rounded text-center">
                <h4 className="text-sm text-green-700 dark:text-green-300 font-medium">
                  Realized PnL
                </h4>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ${historicalSummary.realizedPnL.toFixed(2)}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900 border p-4 rounded text-center">
                <h4 className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                  Average Return
                </h4>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {historicalSummary.avgReturn.toFixed(2)}%
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 border p-4 rounded text-center">
                <h4 className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                  Total Trades
                </h4>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {historicalSummary.totalTrades}
                </p>
              </div>
            </div>
          </motion.div>

          {/* 💹 Fundamentals Widget — más alto */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow border p-2"
          >
            <iframe
              title="fundamentals"
              src={`https://www.tradingview.com/embed-widget/financials/?symbol=${symbol}`}
              width="100%"
              height="750"
              frameBorder="0"
              allowtransparency="true"
              scrolling="no"
              style={{ background: "white" }}
            />
          </motion.div>
        </div>

        {/* ====== News + Technical Analysis ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 📰 Market News (usando componente funcional) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6 lg:col-span-2"
          >
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">
              📰 Latest Market News ({symbol.toUpperCase()})
            </h3>
            <div className="h-[600px] overflow-y-auto pr-4">
              <NewsFeed symbol={symbol} />
            </div>
          </motion.div>

          {/* 📊 Technical Analysis (debajo) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow border p-2 lg:col-span-2"
          >
            <iframe
              title="technical-analysis"
              src={`https://www.tradingview.com/embed-widget/technical-analysis/?symbol=${symbol}&interval=15m`}
              width="100%"
              height="550"
              frameBorder="0"
              allowtransparency="true"
              scrolling="no"
              style={{ background: "white" }}
            />
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default TickerDetails;
