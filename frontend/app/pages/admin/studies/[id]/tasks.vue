<script setup lang="ts">
import { DragDropProvider } from "@dnd-kit/vue";

const route = useRoute();
const router = useRouter();
const { studies, load, addTask, moveTask } = useStudies();

await load();
const study = computed(() => studies.value.find((s) => s.id === Number(route.params.id)));

// the task shown: `?task=` (from a task's edit button or the sidebar), else the first
const task = computed(
  () => study.value?.tasks.find((t) => t.id === Number(route.query.task)) ?? study.value?.tasks[0],
);

async function newTask() {
  if (!study.value) return;
  await addTask(study.value);
  await router.replace({ query: { task: study.value.tasks.at(-1)?.id } });
}

// each task's saved list, and what a component can show: the study's workflow
const { items, setItems, flush } = useTaskComponents(computed(() => task.value?.id));
const sources = await useTaskSources(computed(() => study.value?.id));
provide(TASK_CONTEXT, { taskId: computed(() => task.value?.id), sources, flush });
let nextUid = Date.now();

const MODES = [
  { label: "Edit", value: "edit", icon: "i-lucide-pencil" },
  { label: "Preview", value: "preview", icon: "i-lucide-eye" },
];
const mode = ref("edit"); // the list to edit, or the task as shown
const preview = computed(() => mode.value === "preview");

function addItem(type: string, index: number) {
  const next = [...items.value];
  next.splice(index, 0, { uid: nextUid++, type, data: initialData(type) });
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
          <!-- own drag area: tasks sort only among themselves -->
          <DragDropProvider @drag-end="onSorted((from, to) => moveTask(study!, from, to))">
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
          <!-- the task itself, without the list; the list is wider by its padding (34px list, 18px item,
               8px body), so components match in width and proportions -->
          <div class="mx-auto" :class="preview ? 'max-w-2xl' : 'max-w-[calc(42rem+3.75rem)]'">
            <div v-if="preview" class="flex flex-col gap-6">
              <TaskBody v-for="item in items" :key="item.uid" :item="item" :editing="false" />
            </div>
            <TaskList
              v-else
              :items="items"
              @add="addItem"
              @move="(from, to) => setItems(moveItem(items, from, to))"
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
