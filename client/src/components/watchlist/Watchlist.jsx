import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";

import useWatchlist from "../../hooks/useWatchlist";
import SortableItem from "./SortableItem";
import WatchlistItem from "./WatchlistItem";

/* =========================================================
   MAIN WATCHLIST
========================================================= */
export default function Watchlist() {
  const {
    symbols,
    quotes,
    meta,
    addSymbol,
    removeSymbol,
    reorderSymbols,
  } = useWatchlist();

  /* =========================================================
     DND SENSORS
  ========================================================= */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  /* =========================================================
     UI STATE
  ========================================================= */
  const [editMode, setEditMode] = useState(false);

  // ✅ Search (frontend-only)
  const [search, setSearch] = useState("");

  // Add UI
  const [showAdd, setShowAdd] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const inputRef = useRef(null);

  /* =========================================================
     AUTO FOCUS INPUT
  ========================================================= */
  useEffect(() => {
    if (!showAdd) return;

    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 120);

    return () => clearTimeout(t);
  }, [showAdd]);

  /* =========================================================
     FILTERED SYMBOLS (FAST)
  ========================================================= */
  const renderedSymbols = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return symbols;

    return symbols.filter((sym) => {
      const company =
        meta[sym]?.company ||
        quotes[sym]?.longName ||
        quotes[sym]?.shortName ||
        sym;

      return (
        sym.toLowerCase().includes(q) ||
        String(company).toLowerCase().includes(q)
      );
    });
  }, [symbols, search, meta, quotes]);

  // ✅ Si hay filtro, no permitimos drag reorder para no romper orden
  const dragEnabled = !search.trim();

  /* =========================================================
     DRAG END (PERSISTENTE)
  ========================================================= */
  const onDragEnd = useCallback(
    (e) => {
      if (!dragEnabled) return;

      const { active, over } = e;
      if (!over || active.id === over.id) return;

      const oldIndex = symbols.indexOf(active.id);
      const newIndex = symbols.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      reorderSymbols(arrayMove(symbols, oldIndex, newIndex));
    },
    [dragEnabled, symbols, reorderSymbols]
  );

  /* =========================================================
     DELETE
  ========================================================= */
  const handleDelete = useCallback(
    (sym) => {
      removeSymbol(sym);
    },
    [removeSymbol]
  );

  /* =========================================================
     ADD SYMBOL
  ========================================================= */
  const handleAdd = async () => {
    const raw = newSymbol.trim().toUpperCase();
    if (!raw || adding) return;

    setAddError("");
    setAdding(true);

    try {
      const res = await addSymbol(raw);

      if (!res?.success) {
        if (res?.error === "Duplicate") setAddError("Already in watchlist.");
        else if (res?.error === "NotFound") setAddError("Symbol not found.");
        else setAddError("Invalid symbol.");
        return;
      }

      setNewSymbol("");
      setShowAdd(false);
    } catch {
      setAddError("Unexpected error.");
    } finally {
      setAdding(false);
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <div className="relative w-full h-full flex flex-col bg-white rounded-3xl border border-slate-200/80 shadow-[0_22px_60px_rgba(15,23,42,0.25)] overflow-hidden pb-20">
      {/* =====================================================
          HEADER
      ===================================================== */}
      <div className="border-b border-slate-200/70 bg-gradient-to-b from-slate-50 to-white">
        {/* TOP ROW */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-slate-900">
              Watchlist
            </h2>

            <span
              className="
                text-[10px] px-2 py-0.5 rounded-full
                border border-slate-200 bg-white
                text-slate-500 uppercase tracking-[0.08em]
              "
            >
              Live
            </span>
          </div>

          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className="
              text-xs font-semibold
              px-3 py-1.5 rounded-full
              border border-slate-300 bg-white
              hover:bg-slate-100
              text-slate-800
              shadow-sm transition
            "
          >
            {editMode ? "Done" : "Edit"}
          </button>
        </div>

        {/* SEARCH ROW */}
        <div className="px-4 pb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol or company…"
            className="
              w-full
              rounded-xl
              border border-slate-200
              bg-white
              px-3 py-2
              text-xs text-slate-700
              placeholder:text-slate-400
              outline-none
              focus:ring-2 focus:ring-blue-200
            "
          />
        </div>
      </div>

      {/* LIST */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {renderedSymbols.length === 0 && (
          <div className="px-5 py-8 text-xs text-slate-500 text-center">
            No matches.
          </div>
        )}

        {renderedSymbols.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={renderedSymbols}
              strategy={verticalListSortingStrategy}
            >
              {renderedSymbols.map((sym) => {
                const q = quotes[sym] || {};
                const company =
                  meta[sym]?.company || q.longName || q.shortName || sym;

                return (
                  <SortableItem key={sym} id={sym}>
                    {({ setNodeRef, attributes, listeners, style }) => (
                      <div ref={setNodeRef} style={style} className="touch-none">
                        <WatchlistItem
                          symbol={sym}
                          name={company}
                          price={q.price}
                          percent={q.changePercent}
                          change={q.changeAmount}
                          editMode={editMode}
                          onDelete={handleDelete}
                          dragHandle={
                            editMode && dragEnabled
                              ? { ...attributes, ...listeners }
                              : {}
                          }
                        />
                      </div>
                    )}
                  </SortableItem>
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ADD BUTTON */}
      {!showAdd && (
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
            setAddError("");
          }}
          className="absolute bottom-5 right-6 z-20 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-3xl font-bold flex items-center justify-center shadow-[0_12px_35px_rgba(37,99,235,0.48)] transition active:scale-95"
        >
          +
        </button>
      )}

      {/* ADD OVERLAY */}
      {showAdd && (
        <>
          <div
            className="absolute inset-0 z-30 bg-slate-900/5 backdrop-blur-sm"
            onClick={() => setShowAdd(false)}
          />

          <div className="absolute inset-x-4 bottom-5 z-40 flex justify-center">
            <div
              className="relative w-full max-w-xl bg-white rounded-2xl border border-slate-200/80 shadow-[0_18px_45px_rgba(15,23,42,0.28)] px-4 py-3 flex items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              {addError && (
                <p className="absolute -top-5 left-4 text-[11px] font-semibold text-red-500">
                  {addError}
                </p>
              )}

              <span className="w-1.5 h-7 rounded-full bg-blue-500" />

              <input
                ref={inputRef}
                value={newSymbol}
                placeholder="Enter symbol (AAPL)"
                onChange={(e) => {
                  setNewSymbol(e.target.value.toUpperCase());
                  setAddError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") setShowAdd(false);
                }}
                className="flex-1 bg-transparent outline-none text-[15px] font-semibold text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
