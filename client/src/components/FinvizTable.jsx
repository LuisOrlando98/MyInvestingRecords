import React from "react";
import "./FinvizTable.css";

// 📊 Orden exacto según Finviz.com (actualizado 2025)
const FINVIZ_ORDER = [
  // Row 1
  "Index", "P/E", "EPS (ttm)", "Insider Own", "Shs Outstand", "Perf Week",
  // Row 2
  "Market Cap", "Forward P/E", "EPS next Y", "Insider Trans", "Shs Float", "Perf Month",
  // Row 3
  "Enterprise Value", "PEG", "EPS next Q", "Inst Own", "Short Float", "Perf Quarter",
  // Row 4
  "Income", "P/S", "EPS this Y", "Inst Trans", "Short Ratio", "Perf Half Y",
  // Row 5
  "Sales", "P/B", "EPS next 5Y", "ROA", "Short Interest", "Perf YTD",
  // Row 6
  "Book/sh", "P/C", "EPS past 5Y", "ROE", "52W High", "Perf Year",
  // Row 7
  "Cash/sh", "P/FCF", "Sales past 5Y", "ROIC", "52W Low", "Perf 3Y",
  // Row 8
  "Dividend Est.", "EV/EBITDA", "Sales Y/Y TTM", "Gross Margin", "Volatility", "Perf 5Y",
  // Row 9
  "Dividend TTM", "EV/Sales", "EPS Y/Y TTM", "Oper. Margin", "ATR (14)", "Perf 10Y",
  // Row 10
  "Dividend Ex-Date", "Quick Ratio", "Sales Q/Q", "Profit Margin", "RSI (14)", "Recom",
  // Row 11
  "Dividend Gr. 3/5Y", "Current Ratio", "EPS Q/Q", "SMA20", "Beta", "Target Price",
  // Row 12
  "Payout", "Debt/Eq", "Sales past Q/Q", "SMA50", "Rel Volume", "Prev Close",
  // Row 13
  "Employees", "LT Debt/Eq", "Earnings", "SMA200", "Avg Volume", "Price",
  // Row 14
  "IPO", "Option/Short", "EPS/Sales Surpr.", "Trades", "Volume", "Change"
];

function FinvizTable({ data }) {
  if (!data || data.length === 0)
    return <p className="text-gray-500 text-center py-4">No Finviz data available</p>;

  // Convierte array → objeto rápido (para acceso directo por label)
  const dataMap = data.reduce((acc, { label, value }) => {
    if (label && value) acc[label] = value;
    return acc;
  }, {});

  // Genera las filas respetando el orden original
  const rows = [];
  for (let i = 0; i < FINVIZ_ORDER.length; i += 6) {
    const slice = FINVIZ_ORDER.slice(i, i + 6);
    rows.push(slice);
  }

  return (
    <div className="overflow-x-auto">
      <table className="snapshot-table2 w-full text-sm border-collapse">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((label, i) => {
                const value = dataMap[label] || "—";
                const isPositive = value.startsWith("+") || value.includes("%") && !value.startsWith("-");
                const isNegative = value.startsWith("-");

                return (
                  <React.Fragment key={i}>
                    <td className="snapshot-td2 font-medium text-gray-700 bg-gray-50 px-2 py-1 border border-gray-200">
                      {label}
                    </td>
                    <td
                      className={`snapshot-td2 border border-gray-200 px-2 py-1 font-semibold text-right ${
                        isNegative
                          ? "text-red-600"
                          : isPositive
                          ? "text-green-600"
                          : "text-gray-800"
                      }`}
                    >
                      {value}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FinvizTable;
