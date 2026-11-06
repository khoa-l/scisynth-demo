<script setup lang="ts">
import { ChartScatter, CircleAlert, Grid3x3 } from "@lucide/vue";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { refDebounced } from "@vueuse/core";
import { computed } from "vue";

import { previewsPreviewNode, type NodePreviewRequest } from "@/client";
import PreviewPlot from "@/components/PreviewPlot.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const props = defineProps<{
  label: string;
  request: NodePreviewRequest;
  detailed?: boolean;
  switchable?: boolean;
}>();

const plot = defineModel<"heatmap" | "scatter">("plot", { default: "heatmap" });

function setPlot(value: unknown) {
  if (value === "heatmap" || value === "scatter") plot.value = value;
}

const request = refDebounced(
  computed(() => props.request),
  300,
);

const {
  data: preview,
  error,
  isPlaceholderData,
} = useQuery(
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
  <div v-else-if="preview">
    <ToggleGroup
      v-if="switchable && preview.layout === 'grid'"
      type="single"
      variant="outline"
      orientation="vertical"
      aria-label="Plot type"
      :model-value="plot"
      class="nodrag absolute right-full bottom-0 mr-2 bg-background shadow-sm"
      @update:model-value="setPlot"
      @click.stop
    >
      <ToggleGroupItem value="heatmap" aria-label="Heatmap">
        <Grid3x3 />
      </ToggleGroupItem>
      <ToggleGroupItem value="scatter" aria-label="Scatterplot">
        <ChartScatter />
      </ToggleGroupItem>
    </ToggleGroup>
    <PreviewPlot
      :preview="preview"
      :label="`Preview of ${label}`"
      :detailed="detailed"
      :plot="plot"
      :stale="isPlaceholderData"
    />
  </div>
</template>
