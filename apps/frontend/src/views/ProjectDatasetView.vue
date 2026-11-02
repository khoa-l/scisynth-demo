<script setup lang="ts">
import NodeGraph from "@/components/NodeGraph.vue";
import ProjectItemView from "@/views/ProjectItemView.vue";

defineProps<{ projectId: string }>();
</script>

<template>
  <ProjectItemView :project-id="projectId" back-to="project-datasets" back-label="Datasets">
    <template #left>
      <NodeGraph />
    </template>
  </ProjectItemView>
</template>
