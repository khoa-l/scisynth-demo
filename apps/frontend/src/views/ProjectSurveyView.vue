<script setup lang="ts">
import ProjectPage from "@/components/ProjectPage.vue";
import SplitCanvas from "@/components/SplitCanvas.vue";

defineProps<{ projectId: number }>();
</script>

<template>
  <ProjectPage :project-id="projectId">
    <SplitCanvas />
  </ProjectPage>
</template>
