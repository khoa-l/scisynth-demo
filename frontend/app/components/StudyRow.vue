<script setup lang="ts">
import { DragDropProvider } from "@dnd-kit/vue";

const props = defineProps<{ study: Study; index: number }>();

const { rename, remove, isCollapsed, toggleCollapsed, moveTask } = useStudies();

// the tasks are shown unless hidden
const showTasks = computed(() => props.study.tasks.length > 0 && !isCollapsed(props.study.id));

// the study (with its tasks) is sorted among the studies, by the grip on its card. Only the card is
// what other studies collide with (`target`): a study with a long list of tasks is a tall target that
// a dragged study would not swap places with.
const card = ref<HTMLElement>();
const { element, handle, isDragging } = useSortableRow(
  `study-${props.study.id}`,
  () => props.index,
  card,
);
</script>

<template>
  <li ref="element" class="flex flex-col gap-1" :class="{ 'opacity-60': isDragging }">
    <div
      ref="card"
      class="flex items-center justify-between rounded-md border border-accented bg-elevated py-2 pl-2 pr-2 shadow-sm"
    >
      <span class="flex items-center gap-1">
        <span ref="handle" class="cursor-grab touch-none text-muted" aria-label="Drag to reorder">
          <UIcon name="i-lucide-grip-vertical" class="size-4" />
        </span>
        <!-- hides or shows the tasks (only a study that has some) -->
        <UButton
          v-if="study.tasks.length"
          :icon="isCollapsed(study.id) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`${isCollapsed(study.id) ? 'Show' : 'Hide'} the tasks of ${study.name}`"
          :aria-expanded="!isCollapsed(study.id)"
          @click="toggleCollapsed(study.id)"
        />
        <span v-else class="w-7" />
        <EditableName :item="study" :save="() => rename(props.study)">
          <span v-if="isCollapsed(study.id)" class="text-muted">
            {{ study.tasks.length }} {{ study.tasks.length === 1 ? "task" : "tasks" }}
          </span>
        </EditableName>
      </span>
      <span class="flex gap-1">
        <!-- the study's tasks, all on one screen -->
        <UButton
          icon="i-lucide-clipboard-list"
          color="neutral"
          variant="ghost"
          title="Tasks"
          :aria-label="`Open the tasks of ${study.name}`"
          :to="`/admin/studies/${study.id}/tasks`"
        />
        <UButton
          icon="i-lucide-workflow"
          color="neutral"
          variant="ghost"
          :aria-label="`Open ${study.name}`"
          :to="`/admin/studies/${study.id}`"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :aria-label="`Delete ${study.name}`"
          @click="remove(study.id)"
        />
      </span>
    </div>
    <!-- the study's tasks: their own cards just under it, indented -->
    <!-- its own drag and drop area, so a task can only be sorted among this study's tasks -->
    <DragDropProvider
      v-if="showTasks"
      @drag-end="onSorted((from, to) => moveTask(study, from, to))"
    >
      <ul class="ml-8 flex flex-col gap-1">
        <TaskRow
          v-for="(task, index) in study.tasks"
          :key="task.id"
          :study="study"
          :task="task"
          :index="index"
        />
      </ul>
    </DragDropProvider>
  </li>
</template>
