<script setup lang="ts">
import { Plus } from "@lucide/vue";

import ProjectPage from "@/components/ProjectPage.vue";
import { Button } from "@/components/ui/button";

defineProps<{ projectId: number }>();
</script>

<template>
  <ProjectPage :project-id="projectId">
    <Button variant="outline" size="lg" class="mt-4 h-10 px-4">
      <Plus data-icon="inline-start" />
      New Survey
    </Button>
  </ProjectPage>
</template>
