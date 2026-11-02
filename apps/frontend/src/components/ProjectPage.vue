<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { projectsGetProjectOptions } from "@/client/@tanstack/vue-query.gen";

const props = defineProps<{ projectId: number }>();

const {
  data: project,
  isPending,
  isError,
} = useQuery(computed(() => projectsGetProjectOptions({ path: { project_id: props.projectId } })));
</script>

<template>
  <p v-if="isPending" class="text-sm text-muted-foreground">Loading project…</p>
  <p v-else-if="isError || !project" class="text-sm text-destructive">
    This project couldn't be found.
  </p>
  <div v-else class="flex h-full flex-col">
    <h1 class="text-2xl font-medium tracking-tight">{{ project.name }}</h1>
    <slot :project="project" />
  </div>
</template>
