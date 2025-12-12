// src/components/watchlist/WatchlistItem.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function WatchlistItem({
  symbol,
  name,
  price,
  change,
  percent,
  logo,
  editMode,
  onDelete,
  dragHandle, // props del handle de drag (listeners + attrs)
}) {
  const navigate = useNavigate();

  const positive = percent > 0;
  const negative = percent < 0;

  const percentClass = positive
    ? "text-emerald-600"
    : negative
    ? "text-red-600"
    : "text-slate-500";

  const changeClass = positive
    ? "text-emerald-500"
    : negative
    ? "text-red-500"
    : "text-slate-400";

  const fmtSigned = (v, digits = 2) => {
    if (v == null || isNaN(v)) return "--";
    const n = Number(v);
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(digits)}`;
  };

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
      {/* LEFT: LOGO + SYMBOL + NAME */}
      <div className="flex items-center gap-3 min-w-0">
        {logo ? (
          <img
            src={logo}
            alt={symbol}
            className="w-9 h-9 rounded-full border border-slate-200 object-contain bg-white shadow-[0_0_0_1px_rgba(148,163,184,0.2)]"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-semibold shadow-sm text-sm">
            {symbol[0]}
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

      {/* RIGHT: PRICE + CHANGE + CONTROLES */}
      <div className="flex items-center gap-3">
        {/* PRICE + CHANGE */}
        <div className="text-right mr-1">
          <p className="text-[15px] font-semibold text-slate-900 leading-snug">
            {price != null ? price.toFixed(2) : "—"}
          </p>
          <p className={`text-[11px] ${percentClass} leading-tight`}>
            {percent != null ? `${fmtSigned(percent, 2)}%` : "--"}
          </p>
          <p className={`text-[11px] ${changeClass} leading-tight`}>
            {change != null ? `(${fmtSigned(change, 2)})` : "(--)"}
          </p>
        </div>

        {/* DELETE BUTTON + DRAG HANDLE (solo en modo edición) */}
        {editMode && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="
                w-7 h-7 flex items-center justify-center
                rounded-full border border-red-200
                bg-red-50 text-red-500
                hover:bg-red-100 hover:border-red-300
                text-xs font-bold
                shadow-sm
                transition
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
                px-1 text-lg leading-none
                select-none
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
