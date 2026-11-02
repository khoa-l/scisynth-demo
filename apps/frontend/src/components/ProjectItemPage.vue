<script setup lang="ts">
import { ArrowLeft } from "@lucide/vue";
import { RouterLink } from "vue-router";

import ProjectPage from "@/components/ProjectPage.vue";
import { Button } from "@/components/ui/button";

defineProps<{
  projectId: string;
  noun: string;
  itemName: string | undefined;
  isError: boolean;
  backTo: string;
  backLabel: string;
}>();
</script>

<template>
  <ProjectPage :project-id="projectId" :item-name="itemName">
    <Button variant="outline" size="lg" as-child class="mt-4 h-10 self-start px-4">
      <RouterLink :to="{ name: backTo, params: { projectId } }">
        <ArrowLeft data-icon="inline-start" />
        Back to {{ backLabel }}
      </RouterLink>
    </Button>
    <p v-if="isError" class="mt-6 text-sm text-destructive">This {{ noun }} couldn't be found.</p>
    <div v-else class="mt-6 grid min-h-0 flex-1 grid-cols-2 gap-4">
      <div class="flex min-h-0 flex-col gap-2">
        <slot name="left-toolbar" />
        <section aria-label="Left canvas" class="min-h-0 flex-1 overflow-hidden rounded-lg border">
          <slot name="left" />
        </section>
      </div>
      <section aria-label="Right canvas" class="overflow-hidden rounded-lg border">
        <slot name="right" />
      </section>
    </div>
  </ProjectPage>
</template>
