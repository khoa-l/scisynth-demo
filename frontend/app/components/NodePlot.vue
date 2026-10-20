<script setup lang="ts">
import { useVueFlow } from "@vue-flow/core";
import type { PlotlyFigure } from "plotly.js-dist-min";

const props = defineProps<{ id: string; type: "preview" | "plot" }>();

const { findNode } = useVueFlow(FLOW_ID);
const graph = useFlowGraph();
const self = computed(() => kindOf(props.type));

// This node's own parameters (the seed)
const own = computed(
  () => findNode(props.id)?.data?.params as Record<string, ParamValue> | undefined,
);

// What to ask the backend for; `waiting` says what is missing
const source = computed(() => requestOf(graph.value, props.id));
const sourceType = computed(() => source.value?.type);
// Changes whenever the plot would
const sourceKey = computed(() => JSON.stringify(source.value ?? null));

const figure = ref<PlotlyFigure>();
const { status, message, refresh } = useLatestRequest(sourceKey, async (signal) => {
  const current = source.value;
  if (!current || current.waiting) {
    figure.value = undefined;
    return { waiting: current?.waiting ?? "" };
  }
  figure.value = await $fetch<PlotlyFigure>(endpointOf(current).url, {
    ...endpointOf(current),
    signal,
  });
});
onMounted(refresh);

// A still picture at the node's size, with small dots so a dense grid doesn't blur
const plot = ref<HTMLElement>();
// A 3-D scene (the Trace's) is turned with the mouse, not the canvas
const interactive = computed(() => !!(figure.value?.layout as Record<string, any>)?.scene);
usePlotly(plot, () => {
  if (!figure.value) return undefined;
  const layout = figure.value.layout as Record<string, any>;
  return {
    data: (figure.value.data as { marker?: object }[]).map((trace) =>
      // (surfaces have no dots)
      trace.marker ? { ...trace, marker: { ...trace.marker, size: PREVIEW_PLOT.dotSize } } : trace,
    ),
    layout: {
      ...layout,
      width: PREVIEW_PLOT.width,
      // a multi-panel figure sets its own height
      height: layout.height ?? PREVIEW_PLOT.height,
      margin: { l: 45, r: 10, t: 35, b: 40, ...layout.margin },
    },
    // (a static plot leaves a 3-D scene blank)
    config: { staticPlot: !interactive.value, displayModeBar: false },
  };
});
</script>

<template>
  <!-- nothing is shown until something is connected -->
  <div v-if="sourceType" class="mt-2" :style="{ minHeight: `${PREVIEW_PLOT.height}px` }">
    <div v-if="type === 'preview' || kindOf(sourceType).seeded" class="w-44">
      <ParamInputs :id="id" :type="type" :params="own" />
    </div>
    <RequestNote :status="status" :message="message" :what="self.label" class="pt-36" />
    <div v-show="status === 'idle'" ref="plot" :class="{ 'nodrag nowheel nopan': interactive }" />
  </div>
</template>
