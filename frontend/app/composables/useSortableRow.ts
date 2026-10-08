import { useSortable } from "@dnd-kit/vue/sortable";

// A row of a sortable list, dragged by its grip: bind `element` to the row and `handle` to the grip.
// `target` is what other rows collide with, if not the whole row.
export function useSortableRow(
  id: string,
  index: () => number,
  target?: Ref<HTMLElement | undefined>,
) {
  const element = ref<HTMLElement>();
  const handle = ref<HTMLElement>();
  const { isDragging } = useSortable({ id, index, element, target, handle });
  return { element, handle, isDragging };
}
