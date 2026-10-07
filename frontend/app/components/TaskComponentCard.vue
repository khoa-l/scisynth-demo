<script setup lang="ts">
import { useDraggable } from "@dnd-kit/vue";

const props = defineProps<{ component: TaskComponent }>();

// a component in the sidebar: dragged into the task's list (a copy is placed, this stays)
const element = ref<HTMLElement>();
const { isDragSource } = useDraggable({ id: `${COMPONENT_ID}${props.component.type}`, element });
</script>

<template>
  <div
    ref="element"
    class="flex cursor-grab touch-none items-center gap-2 rounded-md border border-default bg-elevated px-3 py-2 select-none"
    :class="{ 'opacity-60': isDragSource }"
  >
    <UIcon :name="component.icon" class="size-4 shrink-0 text-muted" />
    {{ component.label }}
  </div>
</template>
