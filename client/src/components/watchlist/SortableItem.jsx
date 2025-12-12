import { useSortable } from "@dnd-kit/sortable";

export default function SortableItem({ id, children }) {
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