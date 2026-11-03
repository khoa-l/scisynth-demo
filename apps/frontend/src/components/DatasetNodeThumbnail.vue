<script setup lang="ts">
import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { refDebounced } from "@vueuse/core";
import type { Data, Layout } from "plotly.js";
import { computed, onBeforeUnmount, useTemplateRef, watch } from "vue";

import { previewsPreviewLatent, type LatentPreviewRequest } from "@/client";

const props = defineProps<{ label: string; request: LatentPreviewRequest }>();

const request = refDebounced(
  computed(() => props.request),
  300,
);

const { data: preview, isError } = useQuery(
  computed(() => ({
    queryKey: ["latent-preview", request.value],
    queryFn: async () => {
      const { data } = await previewsPreviewLatent({ body: request.value, throwOnError: true });
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

const plot = useTemplateRef<HTMLDivElement>("plot");
const plotly = import("plotly.js-cartesian-dist-min").then((module) => module.default);

watch(
  [preview, plot],
  async ([value, element]) => {
    if (!value || !element) return;
    const trace = { type: "heatmap", ...value, colorscale: "Viridis", showscale: false };
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
  <div
    v-if="preview && !isError"
    ref="plot"
    role="img"
    :aria-label="`Preview of ${label}`"
    class="aspect-square overflow-hidden rounded-md border bg-background shadow-sm"
  />
</template>
