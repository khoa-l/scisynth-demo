<script setup lang="ts">
import { useSortable } from "@dnd-kit/vue/sortable";

const props = defineProps<{ study: Study; task: Task; index: number }>();

const { renameTask, removeTask } = useStudies();

// a task is sorted within its study (the list it is in has its own drag and drop area), by the grip
const element = ref<HTMLElement>();
const handle = ref<HTMLElement>();
const { isDragging } = useSortable({
  id: `task-${props.task.id}`,
  index: () => props.index,
  element,
  handle,
});

const {
  editing,
  start: startEdit,
  finish: finishEdit,
} = useRename(props.task, () => renameTask(props.task));
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
      <UInput
        v-if="editing"
        v-model="task.name"
        autofocus
        size="sm"
        :aria-label="`Name of ${task.name}`"
        @keydown.enter="finishEdit"
        @keydown.esc="finishEdit"
        @blur="finishEdit"
      />
      <template v-else>
        <span>{{ task.name }}</span>
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`Rename ${task.name}`"
          @click="startEdit"
        />
      </template>
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
