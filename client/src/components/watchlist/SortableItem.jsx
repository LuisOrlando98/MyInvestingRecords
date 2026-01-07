// src/components/watchlist/SortableItem.jsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function SortableItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition
      ? `${transition}, box-shadow 150ms ease, transform 150ms ease`
      : undefined,
    boxShadow: isDragging
      ? "0 18px 45px rgba(15,23,42,0.35)"
      : undefined,
    zIndex: isDragging ? 50 : "auto",
  };

  return children({
    setNodeRef,
    attributes,
    listeners,
    style,
  });
}
