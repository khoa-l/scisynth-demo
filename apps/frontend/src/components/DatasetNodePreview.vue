<script setup lang="ts">
import { ChevronLeft, ChevronRight, CircleAlert } from "@lucide/vue";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { refDebounced } from "@vueuse/core";
import type { Data, Layout } from "plotly.js";
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";

import { previewsPreviewNode, type NodePreviewRequest } from "@/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const props = defineProps<{ label: string; request: NodePreviewRequest }>();

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

const layout: Partial<Layout> = {
  margin: { t: 0, r: 0, b: 0, l: 0 },
  xaxis: { visible: false },
  yaxis: { visible: false },
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
};

const errorMessage = computed(() => {
  const detail = (error.value as { detail?: unknown } | null)?.detail;
  return typeof detail === "string" ? detail : undefined;
});

const channel = ref(0);
const channelCount = computed(() => preview.value?.channels.length ?? 0);
watch(channelCount, (count) => {
  channel.value = Math.min(channel.value, Math.max(count - 1, 0));
});

const plot = useTemplateRef<HTMLDivElement>("plot");
const plotly = import("plotly.js-cartesian-dist-min").then((module) => module.default);

watch(
  [preview, plot, channel],
  async ([value, element, index]) => {
    const z = value?.channels[index];
    if (!value || !element || !z) return;
    const trace =
      value.layout === "grid"
        ? { type: "heatmap", x: value.x, y: value.y, z, colorscale: "Viridis", showscale: false }
        : {
            type: "scatter",
            mode: "markers",
            x: value.x,
            y: value.y,
            marker: { color: z, colorscale: "Viridis", size: 3 },
          };
    const Plotly = await plotly;
    await Plotly.react(element, [trace as Data], layout, { staticPlot: true });
  },
  { immediate: true },
);

onBeforeUnmount(async () => {
  const element = plot.value;
  if (element) (await plotly).purge(element);
});
</script>

<template>
  <Alert v-if="error" variant="destructive" class="shadow-sm">
    <CircleAlert />
    <AlertTitle>Couldn't preview this node.</AlertTitle>
    <AlertDescription v-if="errorMessage">{{ errorMessage }}</AlertDescription>
  </Alert>
  <div v-else-if="preview" class="flex flex-col gap-1">
    <div
      v-if="channelCount > 1"
      class="nodrag flex h-8 overflow-hidden rounded-lg border border-input bg-background text-sm shadow-sm"
    >
      <button
        type="button"
        aria-label="Previous channel"
        :disabled="channel === 0"
        class="flex w-5 items-center justify-center border-r border-input hover:bg-muted disabled:cursor-not-allowed disabled:opacity-20"
        @click="channel--"
      >
        <ChevronLeft class="size-3" />
      </button>
      <span aria-live="polite" class="flex flex-1 items-center justify-center">
        Channel {{ channel + 1 }}
      </span>
      <button
        type="button"
        aria-label="Next channel"
        :disabled="channel === channelCount - 1"
        class="flex w-5 items-center justify-center border-l border-input hover:bg-muted disabled:cursor-not-allowed disabled:opacity-20"
        @click="channel++"
      >
        <ChevronRight class="size-3" />
      </button>
    </div>
    <div
      ref="plot"
      role="img"
      :aria-label="`Preview of ${label}`"
      class="aspect-square overflow-hidden rounded-md border bg-background shadow-sm"
    />
  </div>
</template>
