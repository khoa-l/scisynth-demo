<script setup lang="ts">
import ProjectPage from "@/components/ProjectPage.vue";

defineProps<{ projectId: number }>();
</script>

<template>
  <ProjectPage :project-id="projectId" />
</template>
