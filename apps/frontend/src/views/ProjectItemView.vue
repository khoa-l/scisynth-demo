<script setup lang="ts">
import { ArrowLeft } from "@lucide/vue";
import { RouterLink } from "vue-router";

import ProjectPage from "@/components/ProjectPage.vue";
import { Button } from "@/components/ui/button";

defineProps<{ projectId: string; backTo: string; backLabel: string }>();
</script>

<template>
  <ProjectPage :project-id="projectId">
    <Button variant="outline" size="lg" as-child class="mt-4 h-10 self-start px-4">
      <RouterLink :to="{ name: backTo, params: { projectId } }">
        <ArrowLeft data-icon="inline-start" />
        Back to {{ backLabel }}
      </RouterLink>
    </Button>
    <section aria-label="Canvas" class="mt-6 min-h-0 flex-1 rounded-lg border" />
  </ProjectPage>
</template>
