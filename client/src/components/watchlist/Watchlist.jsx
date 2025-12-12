// src/components/watchlist/Watchlist.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

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
  useSortable,
} from "@dnd-kit/sortable";

import useWatchlist from "../../hooks/useWatchlist";
import WatchlistItem from "./WatchlistItem";

/* ---------------------------------------------------------- SORTABLE ITEM */
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  };

  return children({ setNodeRef, attributes, listeners, style });
}

/* ---------------------------------------------------------- HELPERS */
const fmtColor = (v) =>
  v > 0 ? "text-emerald-600" : v < 0 ? "text-red-600" : "text-gray-500";

const fmtSigned = (v, digits = 2) => {
  if (v == null || isNaN(v)) return "--";
  const num = Number(v);
  return `${num > 0 ? "+" : ""}${num.toFixed(digits)}`;
};

/* ---------------------------------------------------------- MAIN WATCHLIST */
export default function Watchlist() {
  const navigate = useNavigate();
  const {
    symbols,
    quotes,
    meta,
    logos,
    addSymbol,     // 👈 debe devolver { success, error }
    removeSymbol,
    reorderSymbols,
  } = useWatchlist();

  const sensors = useSensors(useSensor(PointerSensor));

  const [editMode, setEditMode] = useState(false);

  // ADD STATE
  const [showAdd, setShowAdd] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const inputRef = useRef(null);

  /* ------------------------------------------------- FOCUS WHEN OPEN INPUT */
  useEffect(() => {
    if (showAdd) {
      const t = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 120);
      return () => clearTimeout(t);
    }
  }, [showAdd]);

  /* ------------------------------------------------- DRAG END */
  const onDragEnd = (e) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = symbols.indexOf(active.id);
    const newIndex = symbols.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    reorderSymbols(arrayMove(symbols, oldIndex, newIndex));
  };

  /* ------------------------------------------------- DELETE */
  const handleDelete = (sym) => removeSymbol(sym);

  /* ------------------------------------------------- ABRIR / CERRAR ADD */
  const openAdd = () => {
    setShowAdd(true);
    setAddError("");
  };

  const closeAdd = () => {
    setShowAdd(false);
    setNewSymbol("");
    setAddError("");
    setAdding(false);
  };

  /* ------------------------------------------------- ADD (usa addSymbol del hook) */
  const handleAdd = async () => {
    const raw = newSymbol.trim().toUpperCase();
    if (!raw || adding) return;

    setAddError("");
    setAdding(true);

    try {
      const res = await addSymbol(raw); // 👈 tu hook debe hacer validación

      if (!res || !res.success) {
        if (res?.error === "Duplicate") {
          setAddError("Already in watchlist.");
        } else if (res?.error === "NotFound") {
          setAddError("Symbol does not exist.");
        } else {
          setAddError("Invalid symbol.");
        }
        setAdding(false);
        return;
      }

      // éxito
      setNewSymbol("");
      setShowAdd(false);
    } catch (err) {
      console.error("Add symbol error:", err?.message);
      setAddError("Unexpected error. Try again.");
    } finally {
      setAdding(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleAdd();
    if (e.key === "Escape") closeAdd();
  };

  /* ------------------------------------------------- RENDER */
  return (
    <div
      className="
        relative
        w-full h-full flex flex-col
        bg-white rounded-3xl
        shadow-[0_22px_60px_rgba(15,23,42,0.25)]
        overflow-hidden border border-slate-200/80
        pb-20   /* espacio para el + y el input */
      "
    >
      {/* HEADER */}
      <div
        className="
          px-4 sm:px-5 py-3
          border-b border-slate-200/70
          bg-gradient-to-b from-slate-50 to-white
          flex items-center justify-between
        "
      >
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold text-slate-900">
            Watchlist
          </h2>
          <span
            className="
              text-[10px] px-2 py-0.5
              rounded-full
              border border-slate-200 bg-white text-slate-500
              uppercase tracking-[0.08em]
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
            border border-slate-300 bg-white hover:bg-slate-100
            text-slate-800 shadow-[0_2px_4px_rgba(15,23,42,0.12)]
            transition
          "
        >
          {editMode ? "Done" : "Edit"}
        </button>
      </div>

      {/* LISTA */}
      <div className="flex-1 overflow-y-auto">
        {symbols.length === 0 && (
          <div className="px-5 py-8 text-xs text-slate-500 text-center">
            Your watchlist is empty. Tap the + button to add a symbol.
          </div>
        )}

        {symbols.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={symbols}
              strategy={verticalListSortingStrategy}
            >
              {symbols.map((sym) => {
                const q = quotes[sym] || {};
                const company =
                  meta[sym]?.company ||
                  quotes[sym]?.longName ||
                  quotes[sym]?.shortName ||
                  sym;
                const logo =
                  meta[sym]?.logo ||
                  logos[sym] ||
                  null;
                const price = q.price;
                const pct = q.changePercent;
                const chg = q.changeAmount;

                return (
                  <SortableItem key={sym} id={sym}>
                    {({ setNodeRef, attributes, listeners, style }) => (
                      <div ref={setNodeRef} style={style}>
                        <WatchlistItem
                          symbol={sym}
                          name={company}
                          price={price}
                          percent={pct}
                          change={chg}
                          logo={logo}
                          editMode={editMode}
                          onDelete={() => handleDelete(sym)}
                          dragHandle={
                            editMode ? { ...attributes, ...listeners } : {}
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

      {/* =========================================================
      ADD SYMBOL — PREMIUM MINIMAL EDITION
      ========================================================= */}
            
      {/* BOTÓN + SOLO SI NO ESTÁ ABIERTO */}
      {!showAdd && (
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
            setAddError("");
            setTimeout(() => {
              inputRef.current?.focus();
              inputRef.current?.select();
            }, 120);
          }}
          className="
            absolute bottom-5 right-6 z-20
            w-12 h-12 rounded-full
            bg-blue-600 hover:bg-blue-500 active:scale-95
            text-white text-3xl font-bold leading-none
            flex items-center justify-center
            shadow-[0_12px_35px_rgba(37,99,235,0.48)]
            transition
          "
        >
          +
        </button>
      )}

      {/* =========================================================
            OVERLAY + INPUT PREMIUM (TODO DENTRO DEL CARD)
      ========================================================= */}
      {showAdd && (
        <>
          {/* overlay dentro del card */}
          <div
            className="
              absolute inset-0 z-30
              bg-slate-900/5 backdrop-blur-sm
              animate-fadeIn
            "
            onClick={closeAdd}
          />

          {/* tarjeta de input */}
          <div
            className="
              absolute inset-x-4 bottom-5 z-40
              flex justify-center
              pointer-events-none
            "
          >
            <div
              className="
                relative max-w-xl w-full
                bg-white rounded-2xl
                shadow-[0_18px_45px_rgba(15,23,42,0.28)]
                border border-slate-200/80
                px-4 py-3 flex items-center gap-3
                pointer-events-auto
                animate-slideUpPremium
              "
              onClick={(e) => e.stopPropagation()}
            >
              {/* ERROR ENCIMA */}
              {addError && (
                <p
                  className="
                    absolute -top-5 left-4
                    text-[11px] font-semibold text-red-500
                    animate-fadeIn
                  "
                >
                  {addError}
                </p>
              )}

              {/* BARRA PREMIUM */}
              <span className="w-1.5 h-7 rounded-full bg-blue-400 bg-gradient-to-b from-blue-400 to-indigo-500" />

              {/* INPUT */}
              <input
                ref={inputRef}
                type="text"
                placeholder="Enter symbol (AAPL)"
                value={newSymbol}
                onChange={(e) => {
                  setNewSymbol(e.target.value.toUpperCase());
                  setAddError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") closeAdd();
                }}
                className="
                  flex-1 bg-transparent border-none outline-none
                  text-[15px] text-slate-900 placeholder:text-slate-400
                  font-semibold tracking-wide
                "
              />

              
            </div>
          </div>
        </>
      )}

    </div>
  );
}
