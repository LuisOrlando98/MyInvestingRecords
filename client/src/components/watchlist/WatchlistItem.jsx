// src/components/watchlist/WatchlistItem.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fmtColor, fmtSigned } from "./utils";
import { resolveLogo } from "./logoResolver";

function WatchlistItem({
  symbol,
  name,  
  price,
  change,
  percent,
  editMode,
  onDelete,
  dragHandle,
}) {
  const navigate = useNavigate();

  const percentClass = useMemo(
    () => fmtColor(percent, { neutral: "text-slate-500" }),
    [percent]
  );

  const changeClass = useMemo(
    () =>
      fmtColor(change, {
        positive: "text-emerald-500",
        negative: "text-red-500",
        neutral: "text-slate-400",
      }),
    [change]
  );

  const resolved = resolveLogo(symbol);

  return (
    <div
      className="
        flex items-center justify-between
        px-4 py-3
        border-b border-slate-100
        bg-white hover:bg-slate-50
        transition-colors duration-150
        cursor-pointer select-none
      "
      onClick={() => !editMode && navigate(`/ticker/${symbol}`)}
    >
      {/* LEFT */}
      <div className="flex items-center gap-3 min-w-0">
        {resolved.type === "img" ? (
          <img
            src={resolved.src}
            alt={symbol}
            className="w-9 h-9 rounded-full object-contain bg-white border border-slate-200"
            loading="lazy"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-semibold text-sm">
            {resolved.letter}
          </div>
        )}

        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-sm font-semibold text-slate-900 truncate">
            {symbol}
          </span>
          <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
            {name}
          </span>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-3">
        <div className="text-right mr-1">
          <p className="text-[15px] font-semibold text-slate-900">
            {price != null ? price.toFixed(2) : "—"}
          </p>
          <p className={`text-[11px] ${percentClass}`}>
            {percent != null ? `${fmtSigned(percent, 2)}%` : "--"}
          </p>
          <p className={`text-[11px] ${changeClass}`}>
            {change != null ? `(${fmtSigned(change, 2)})` : "(--)"}
          </p>
        </div>

        {editMode && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(symbol);
              }}
              className="
                w-7 h-7 flex items-center justify-center
                rounded-full border border-red-200
                bg-red-50 text-red-500
                hover:bg-red-100
                text-xs font-bold
              "
            >
              ×
            </button>

            <div
              {...dragHandle}
              onClick={(e) => e.stopPropagation()}
              className="
                text-slate-400 hover:text-slate-600
                cursor-grab active:cursor-grabbing
                px-1 text-lg
              "
            >
              ≡
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(WatchlistItem);
