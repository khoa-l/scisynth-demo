<script setup lang="ts">
const props = defineProps<{
  task: { id: number; name: string };
  current: boolean;
  index: number;
}>();

// sorted among the study's tasks (the list has its own drag and drop area), by the grip
const { element, handle, isDragging } = useSortableRow(`task-${props.task.id}`, () => props.index);
</script>

<template>
  <li
    ref="element"
    class="flex items-center gap-1 rounded-md border pl-1"
    :class="[
      current ? 'border-primary bg-elevated' : 'border-default hover:bg-elevated',
      { 'opacity-60': isDragging },
    ]"
  >
    <span ref="handle" class="cursor-grab touch-none text-muted" aria-label="Drag to reorder">
      <UIcon name="i-lucide-grip-vertical" class="size-4" />
    </span>
    <NuxtLink
      :to="{ query: { task: task.id } }"
      class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-3"
      :aria-current="current ? 'page' : undefined"
    >
      <UIcon name="i-lucide-clipboard-list" class="size-4 shrink-0 text-muted" />
      <span class="truncate">{{ task.name }}</span>
    </NuxtLink>
  </li>
</template>
