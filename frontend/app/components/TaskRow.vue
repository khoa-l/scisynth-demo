<script setup lang="ts">
const props = defineProps<{ study: Study; task: Task; index: number }>();

const { renameTask, removeTask } = useStudies();

// a task is sorted within its study (the list it is in has its own drag and drop area), by the grip
const { element, handle, isDragging } = useSortableRow(`task-${props.task.id}`, () => props.index);
</script>

<template>
  <li
    ref="element"
    class="flex items-center justify-between rounded-md border border-accented bg-elevated py-1 pl-2 pr-2 shadow-sm"
    :class="{ 'opacity-60': isDragging }"
  >
    <span class="flex items-center gap-1">
      <span ref="handle" class="cursor-grab touch-none text-muted" aria-label="Drag to reorder">
        <UIcon name="i-lucide-grip-vertical" class="size-4" />
      </span>
      <UIcon name="i-lucide-clipboard-list" class="size-4 text-muted" />
      <EditableName :item="task" :save="() => renameTask(props.task)" />
    </span>
    <span class="flex gap-1">
      <!-- opens the task's page -->
      <UButton
        icon="i-lucide-square-pen"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="`Edit ${task.name}`"
        :to="`/admin/studies/${study.id}/tasks?task=${task.id}`"
      />
      <UButton
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        size="sm"
        :aria-label="`Delete ${task.name} of ${study.name}`"
        @click="removeTask(study, task)"
      />
    </span>
  </li>
</template>
