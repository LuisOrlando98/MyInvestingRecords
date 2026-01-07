import React, { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fmtColor, fmtSigned } from "./utils";
import { resolveLogo } from "./logoResolver";

/* =========================================================
   WATCHLIST ITEM — PRO VERSION
   - Memo optimizado
   - UX clara en editMode
   - Drag visual feedback
========================================================= */
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

  /* =====================================================
     DERIVED STYLES (memoizados)
  ===================================================== */
  const percentClass = useMemo(
    () =>
      fmtColor(percent, {
        positive: "text-emerald-600",
        negative: "text-red-600",
        neutral: "text-slate-500",
      }),
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

  const logo = useMemo(() => resolveLogo(symbol), [symbol]);

  /* =====================================================
     NAVIGATION
  ===================================================== */
  const handleClick = () => {
    if (!editMode) {
      navigate(`/ticker/${symbol}`);
    }
  };

  /* =====================================================
     RENDER
  ===================================================== */
  return (
    <div
      onClick={handleClick}
      className={`
        group relative
        flex items-center justify-between
        px-4 py-3
        border-b border-slate-100
        bg-white
        transition-all duration-150
        select-none
        ${editMode ? "cursor-default bg-slate-50/40" : "cursor-pointer hover:bg-slate-50"}
      `}
      aria-label={`Watchlist item ${symbol}`}
    >
      {/* =================================================
          LEFT — LOGO + SYMBOL
      ================================================== */}
      <div className="flex items-center gap-3 min-w-0">
        {logo.type === "img" ? (
          <img
            src={logo.src}
            alt={symbol}
            className="
              w-9 h-9 rounded-full
              object-contain
              bg-white border border-slate-200
            "
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div
            className="
              w-9 h-9 rounded-full
              bg-gradient-to-br from-blue-500 to-indigo-600
              text-white
              flex items-center justify-center
              font-semibold text-sm
            "
          >
            {logo.letter}
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

      {/* =================================================
          RIGHT — PRICE + CHANGE
      ================================================== */}
      <div
        className={`
          flex items-center gap-4
          transition-opacity
          ${editMode ? "opacity-60" : "opacity-100"}
        `}
      >
        <div className="text-right leading-tight">
          <div className="text-[15px] font-semibold text-slate-900">
            {price != null ? price.toFixed(2) : "—"}
          </div>

          <div className={`text-[11px] font-medium ${percentClass}`}>
            {percent != null ? `${fmtSigned(percent, 2)}%` : "--"}
          </div>

          <div className={`text-[11px] ${changeClass}`}>
            {change != null ? `(${fmtSigned(change, 2)})` : "(--)"}
          </div>
        </div>

        {/* =============================================
            EDIT MODE CONTROLS
        ============================================== */}
        {editMode && (
          <div className="flex items-center gap-2">
            {/* DELETE */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(symbol);
              }}
              className="
                w-7 h-7 rounded-full
                flex items-center justify-center
                border border-red-200
                bg-red-50 text-red-500
                hover:bg-red-100
                text-xs font-bold
              "
              aria-label={`Remove ${symbol}`}
            >
              ×
            </button>

            {/* DRAG HANDLE */}
            <div
              {...dragHandle}
              onClick={(e) => e.stopPropagation()}
              className="
                px-1 text-lg
                text-slate-400 hover:text-slate-600
                cursor-grab active:cursor-grabbing
              "
              aria-label={`Reorder ${symbol}`}
              title="Drag to reorder"
            >
              ≡
            </div>
          </div>
        )}
      </div>

      {/* =================================================
          EDIT MODE OVERLAY (UX CLARITY)
      ================================================== */}
      {editMode && (
        <div className="absolute inset-0 pointer-events-none ring-1 ring-slate-200/50 rounded-md" />
      )}
    </div>
  );
}

/* =========================================================
   MEMO EXPORT — HARD OPTIMIZED
========================================================= */
export default memo(
  WatchlistItem,
  (prev, next) =>
    prev.symbol === next.symbol &&
    prev.price === next.price &&
    prev.percent === next.percent &&
    prev.change === next.change &&
    prev.editMode === next.editMode
);
