import { Feedback, defaultPreset } from "@dnd-kit/dom";
import { isSortable } from "@dnd-kit/vue/sortable";

// dnd-kit's default plugins, but the dragged item is a clone and the original stays (the sidebar copies)
export const CLONE_PLUGINS = [
  ...defaultPreset.plugins.filter((plugin) => plugin !== Feedback),
  Feedback.configure({ feedback: "clone" }),
];

// The move a drag made in a sortable list, or none if cancelled or unchanged
function sortedMove(event: { canceled: boolean; operation: { source: unknown } }) {
  const source = event.operation.source;
  if (event.canceled || !isSortable(source as never)) return;
  const { initialIndex, index } = source as { initialIndex: number; index: number };
  return initialIndex === index ? undefined : { from: initialIndex, to: index };
}

// A drag-end handler for a sortable list: calls `move(from, to)`
export const onSorted = (move: (from: number, to: number) => void) => (event: DragEndEvent) => {
  const sorted = sortedMove(event);
  if (sorted) move(sorted.from, sorted.to);
};
type DragEndEvent = Parameters<typeof sortedMove>[0];

// The list with the item at `from` moved to `to`
export function moveItem<T>(list: T[], from: number, to: number) {
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
