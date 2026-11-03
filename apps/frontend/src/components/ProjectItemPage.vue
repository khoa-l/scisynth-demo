<script setup lang="ts">
import { ArrowLeft } from "@lucide/vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

import ProjectPage from "@/components/ProjectPage.vue";
import { Button } from "@/components/ui/button";

const { columns = "grid-cols-2" } = defineProps<{
  projectId: string;
  noun: string;
  itemName: string | undefined;
  pageName?: string;
  isError: boolean;
  backTo: RouteLocationRaw;
  backLabel: string;
  columns?: string;
}>();
</script>

<template>
  <ProjectPage :project-id="projectId" :item-name="itemName" :page-name="pageName">
    <div class="mt-4 flex gap-2">
      <Button variant="outline" size="lg" as-child class="h-10 px-4">
        <RouterLink :to="backTo">
          <ArrowLeft data-icon="inline-start" />
          Back to {{ backLabel }}
        </RouterLink>
      </Button>
      <slot name="actions" />
    </div>
    <p v-if="isError" class="mt-6 text-sm text-destructive">This {{ noun }} couldn't be found.</p>
    <section
      v-else-if="$slots.canvas"
      aria-label="Canvas"
      class="mt-6 min-h-0 flex-1 overflow-hidden rounded-lg border"
    >
      <slot name="canvas" />
    </section>
    <div v-else :class="['mt-6 grid min-h-0 flex-1 gap-4', columns]">
      <section aria-label="Left canvas" class="overflow-hidden rounded-lg border">
        <slot name="left" />
      </section>
      <section aria-label="Right canvas" class="overflow-hidden rounded-lg border">
        <slot name="right" />
      </section>
    </div>
  </ProjectPage>
</template>
