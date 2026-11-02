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
    <div class="mt-6 grid min-h-0 flex-1 grid-cols-2 gap-4">
      <section aria-label="Left canvas" class="rounded-lg border" />
      <section aria-label="Right canvas" class="rounded-lg border" />
    </div>
  </ProjectPage>
</template>
