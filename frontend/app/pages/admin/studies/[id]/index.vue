<script setup lang="ts">
import { DragDropProvider } from "@dnd-kit/vue";

interface StudyDetail {
  id: number;
  name: string;
  nodes: SavedNode[];
  edges: SavedEdge[];
}

const route = useRoute();

onMounted(preloadPlotly);

const study = await $fetch<StudyDetail>(`/api/studies/${route.params.id}`).catch(() => null);
provide(
  NODE_TASKS,
  await $fetch<Record<string, number[]>>(`/api/studies/${route.params.id}/usage`).catch(() => ({})),
);
</script>

<template>
  <DragDropProvider :plugins="CLONE_PLUGINS">
    <div class="h-screen flex">
      <aside class="flex w-64 shrink-0 flex-col border-r border-accented bg-elevated">
        <SidebarHeader :title="study?.name" missing="Study not found." />
        <SidebarSection title="Canvas">
          <NodeList />
        </SidebarSection>
        <SidebarSection title="Nodes">
          <div class="flex flex-col gap-2">
            <SidebarItem v-for="kind in NODE_KINDS" :key="kind.type" :kind="kind" />
          </div>
        </SidebarSection>
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
