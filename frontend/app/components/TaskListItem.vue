<script setup lang="ts">
import { useSortable } from "@dnd-kit/vue/sortable";

const props = defineProps<{ item: PlacedComponent; index: number }>();
defineEmits<{ remove: [] }>();

const component = computed(() => taskComponentOf(props.item.type));

// sorted within the list, by the grip
const element = ref<HTMLElement>();
const handle = ref<HTMLElement>();
const { isDragging } = useSortable({
  id: `item-${props.item.uid}`,
  index: () => props.index,
  element,
  handle,
});
</script>

<template>
  <li
    ref="element"
    data-item
    class="flex flex-col gap-3 rounded-md border border-accented bg-elevated p-2 shadow-sm"
    :class="{ 'opacity-60': isDragging }"
  >
    <div class="flex items-center justify-between">
      <span class="flex items-center gap-2">
        <span ref="handle" class="cursor-grab touch-none text-muted" aria-label="Drag to reorder">
          <UIcon name="i-lucide-grip-vertical" class="size-4" />
        </span>
        <UIcon :name="component.icon" class="size-4 text-muted" />
        <span>{{ component.label }}</span>
      </span>
      <UButton
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        size="sm"
        :aria-label="`Remove ${component.label}`"
        @click="$emit('remove')"
      />
    </div>
    <TaskBody :item="item" editing class="px-1 pb-1" />
  </li>
</template>
