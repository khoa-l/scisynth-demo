<script setup lang="ts">
import { DragDropProvider, useDragDropMonitor, useDroppable } from "@dnd-kit/vue";

import TaskListItem from "./TaskListItem.vue";
import TaskPlaceholder from "./TaskPlaceholder.vue";

const props = defineProps<{ items: PlacedComponent[] }>();
const emit = defineEmits<{
  add: [type: string, index: number];
  move: [from: number, to: number];
  remove: [uid: number];
}>();

// The task: one big list that components are dragged into and stacked in, top to bottom. It is a drop
// area for the sidebar's components (this component is inside the page's drag and drop area) and, for
// sorting its own items, has a drag and drop area of its own, so they sort like any other list.
const element = ref<HTMLElement>();
const { isDropTarget } = useDroppable({ id: "task-list", element });

// A component dragged over the list shows where it would go: a placeholder among the items, at the
// index the pointer is at (the number of items whose middle is above it)
const preview = ref<{ type: string; index: number }>();

// The rows: the items, with the placeholder among them while a component is dragged over
interface Row {
  key: string;
  item?: PlacedComponent; // none for the placeholder
  index: number;
}
const rows = computed(() => {
  const list: Row[] = props.items.map((item, index) => ({ key: `item-${item.uid}`, item, index }));
  if (preview.value) list.splice(preview.value.index, 0, { key: "preview", index: -1 });
  return list;
});

function indexAt(y: number) {
  const rows = [...(element.value?.querySelectorAll("[data-item]") ?? [])];
  return rows.filter((row) => {
    const box = row.getBoundingClientRect();
    return box.top + box.height / 2 < y;
  }).length;
}

useDragDropMonitor({
  onDragMove(event) {
    const type = componentTypeOf(event.operation.source?.id);
    const { x, y } = event.operation.position.current;
    const box = element.value?.getBoundingClientRect();
    const over = !!box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    preview.value = type && over ? { type, index: indexAt(y) } : undefined;
  },
  onDragEnd(event) {
    const dropped = preview.value;
    preview.value = undefined;
    if (dropped && !event.canceled) emit("add", dropped.type, dropped.index);
  },
});
</script>

<template>
  <div
    ref="element"
    class="min-h-[60vh] rounded-md border border-dashed p-4"
    :class="isDropTarget ? 'border-primary bg-primary/5' : 'border-accented'"
  >
    <p v-if="items.length === 0 && !preview" class="text-muted">Drag components here.</p>
    <DragDropProvider @drag-end="onSorted((from, to) => emit('move', from, to))">
      <ul class="flex flex-col gap-2">
        <!-- one element per row, and no <template v-for> around them: the list sorts by moving these
             elements around, and Vue removes a fragment by walking from its first node to its last,
             which misses a row (it stays on screen) once they have been moved -->
        <component
          :is="row.item ? TaskListItem : TaskPlaceholder"
          v-for="row in rows"
          :key="row.key"
          v-bind="
            row.item
              ? { item: row.item, index: row.index, onRemove: () => $emit('remove', row.item!.uid) }
              : { type: preview!.type }
          "
        />
      </ul>
    </DragDropProvider>
  </div>
</template>
