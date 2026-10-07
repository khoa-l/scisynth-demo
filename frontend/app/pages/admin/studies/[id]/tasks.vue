<script setup lang="ts">
import { DragDropProvider } from "@dnd-kit/vue";

const route = useRoute();
const router = useRouter();
const { studies, load, addTask, moveTask } = useStudies();

await load();
const study = computed(() => studies.value.find((s) => s.id === Number(route.params.id)));

// the task shown: the one in the address (`?task=`, from a task's edit button or the sidebar), or the
// first
const task = computed(
  () => study.value?.tasks.find((t) => t.id === Number(route.query.task)) ?? study.value?.tasks[0],
);

async function newTask() {
  if (!study.value) return;
  await addTask(study.value);
  await router.replace({ query: { task: study.value.tasks.at(-1)?.id } });
}

function onTaskDragEnd(event: Parameters<typeof sortedMove>[0]) {
  const move = sortedMove(event);
  if (move && study.value) void moveTask(study.value, move.from, move.to);
}

// What is in each task's list (saved), and what a component can show: the study's workflow
const { items, setItems, flush } = useTaskComponents(computed(() => task.value?.id));
const sources = await useTaskSources(computed(() => study.value?.id));
provide(TASK_CONTEXT, { taskId: computed(() => task.value?.id), sources, flush });
let nextUid = Date.now();

const MODES = [
  { label: "Edit", value: "edit", icon: "i-lucide-pencil" },
  { label: "Preview", value: "preview", icon: "i-lucide-eye" },
];
const mode = ref("edit"); // its list to edit, or the task as it is shown
const preview = computed(() => mode.value === "preview");

function addItem(type: string, index: number) {
  const next = [...items.value];
  next.splice(index, 0, { uid: nextUid++, type, data: initialData(type) });
  setItems(next);
}

function moveItem(from: number, to: number) {
  const next = [...items.value];
  next.splice(to, 0, ...next.splice(from, 1));
  setItems(next);
}
</script>

<template>
  <DragDropProvider :plugins="CLONE_PLUGINS">
    <div class="h-screen flex">
      <aside class="flex w-64 shrink-0 flex-col border-r border-accented bg-elevated">
        <SidebarHeader :title="study?.name" missing="Study not found." />
        <SidebarSection v-if="study" title="Tasks">
          <UButton
            label="New task"
            icon="i-lucide-plus"
            size="sm"
            variant="soft"
            block
            class="mb-2"
            @click="newTask"
          />
          <!-- its own drag and drop area, so tasks are only sorted among themselves -->
          <DragDropProvider @drag-end="onTaskDragEnd">
            <ul class="flex flex-col gap-2">
              <TaskLink
                v-for="(t, index) in study.tasks"
                :key="t.id"
                :task="t"
                :current="t.id === task?.id"
                :index="index"
              />
            </ul>
          </DragDropProvider>
        </SidebarSection>
        <SidebarSection v-if="!preview" title="Components">
          <div class="flex flex-col gap-2">
            <TaskComponentCard v-for="c in TASK_COMPONENTS" :key="c.type" :component="c" />
          </div>
        </SidebarSection>
      </aside>
      <main class="flex-1 overflow-y-auto p-6">
        <template v-if="task">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg">{{ task.name }}</h2>
            <UTabs
              v-model="mode"
              :items="MODES"
              :content="false"
              size="sm"
              class="w-auto"
              aria-label="Edit or preview the task"
            />
          </div>
          <!-- the preview is the task itself: its components one after another, without the list. The
               list to edit is wider by its padding (list 34px, item 18px, body 8px), so a component has
               the same width, and a plot the same proportions, as in the preview. -->
          <div class="mx-auto" :class="preview ? 'max-w-2xl' : 'max-w-[calc(42rem+3.75rem)]'">
            <div v-if="preview" class="flex flex-col gap-6">
              <TaskBody v-for="item in items" :key="item.uid" :item="item" :editing="false" />
            </div>
            <TaskList
              v-else
              :items="items"
              @add="addItem"
              @move="moveItem"
              @remove="(uid) => setItems(items.filter((i) => i.uid !== uid))"
            />
          </div>
        </template>
        <p v-else-if="study" class="text-muted">No tasks yet. Add one with New task.</p>
      </main>
    </div>
    <TaskDragOverlay />
  </DragDropProvider>
</template>
