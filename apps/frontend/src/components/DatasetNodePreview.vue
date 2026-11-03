<script setup lang="ts">
import { CircleAlert } from "@lucide/vue";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { refDebounced } from "@vueuse/core";
import { computed } from "vue";

import { previewsPreviewNode, type NodePreviewRequest } from "@/client";
import PreviewPlot from "@/components/PreviewPlot.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const props = defineProps<{ label: string; request: NodePreviewRequest; detailed?: boolean }>();

const request = refDebounced(
  computed(() => props.request),
  300,
);

const { data: preview, error } = useQuery(
  computed(() => ({
    queryKey: ["node-preview", request.value],
    queryFn: async () => {
      const { data } = await previewsPreviewNode({ body: request.value, throwOnError: true });
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
  })),
);

const errorMessage = computed(() => {
  const detail = (error.value as { detail?: unknown } | null)?.detail;
  return typeof detail === "string" ? detail : undefined;
});
</script>

<template>
  <Alert v-if="error" variant="destructive" class="shadow-sm">
    <CircleAlert />
    <AlertTitle>Couldn't preview this node.</AlertTitle>
    <AlertDescription v-if="errorMessage">{{ errorMessage }}</AlertDescription>
  </Alert>
  <PreviewPlot
    v-else-if="preview"
    :preview="preview"
    :label="`Preview of ${label}`"
    :detailed="detailed"
  />
</template>
