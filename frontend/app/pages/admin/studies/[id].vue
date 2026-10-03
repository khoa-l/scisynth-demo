<script setup lang="ts">
import { DragDropProvider } from "@dnd-kit/vue";
import { Feedback, defaultPreset } from "@dnd-kit/dom";

interface StudyDetail {
  id: number;
  name: string;
  nodes: SavedNode[];
  edges: SavedEdge[];
}

const route = useRoute();

const study = await $fetch<StudyDetail>(`/api/studies/${route.params.id}`).catch(() => null);

// Leave the original in place and drag a clone of it
const plugins = [
  ...defaultPreset.plugins.filter((plugin) => plugin !== Feedback),
  Feedback.configure({ feedback: "clone" }),
];
</script>

<template>
  <DragDropProvider :plugins="plugins">
    <div class="h-screen flex">
      <aside class="w-64 shrink-0 border-r border-default flex flex-col">
        <div class="p-4">
          <UButton
            label="Back"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/admin"
            class="-ml-2 mb-2"
          />
          <h1 v-if="study" class="text-lg">{{ study.name }}</h1>
          <p v-else>Study not found.</p>
        </div>
        <section class="min-h-0 flex-1 overflow-y-auto border-t border-default p-4">
          <NodeList />
        </section>
        <section class="min-h-0 flex-1 overflow-y-auto border-t border-default p-4">
          <div class="flex flex-col gap-2">
            <SidebarItem v-for="kind in NODE_KINDS" :key="kind.type" :kind="kind" />
          </div>
        </section>
      </aside>
      <main class="relative flex-1">
        <FlowCanvas
          v-if="study"
          :study-id="study.id"
          :initial-nodes="study.nodes"
          :initial-edges="study.edges"
        />
      </main>
    </div>
    <NodeDragOverlay />
  </DragDropProvider>
</template>
