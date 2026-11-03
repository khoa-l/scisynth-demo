<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import { publicGetPublishedOptions } from "@/client/@tanstack/vue-query.gen";
import SurveyTask from "@/components/SurveyTask.vue";

const props = defineProps<{ publicId: string }>();

const {
  data: survey,
  isPending,
  isError,
} = useQuery(
  computed(() => ({
    ...publicGetPublishedOptions({ path: { public_id: props.publicId } }),
    retry: false,
  })),
);
</script>

<template>
  <main class="flex min-h-svh items-center justify-center p-4">
    <p v-if="isPending" class="text-sm text-muted-foreground">Loading survey…</p>
    <p v-else-if="isError || !survey" class="text-sm text-muted-foreground">
      This survey isn't available.
    </p>
    <SurveyTask v-else :name="survey.name" :content="survey.content" class="w-full max-w-lg" />
  </main>
</template>
