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

// What to ask the backend for, from what is connected to this node's input. `waiting` says what
// is still missing when the plot cannot be drawn yet.
const source = computed(() => requestOf(graph.value, props.id));
const sourceType = computed(() => source.value?.type);
// Changes whenever the plot would change (a different node or different values)
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

// A still picture of the figure at the node's size, with smaller dots than Plotly's default so a
// dense grid doesn't blur together
const plot = ref<HTMLElement>();
usePlotly(plot, () => {
  if (!figure.value) return undefined;
  const layout = figure.value.layout as Record<string, any>;
  return {
    data: (figure.value.data as { marker?: object }[]).map((trace) => ({
      ...trace,
      marker: { ...trace.marker, size: PREVIEW_PLOT.dotSize },
    })),
    layout: {
      ...layout,
      width: PREVIEW_PLOT.width,
      // a figure of several rows of panels (an Observer's) says how tall it is
      height: layout.height ?? PREVIEW_PLOT.height,
      margin: { l: 45, r: 10, t: 35, b: 40, ...layout.margin },
    },
    config: { staticPlot: true, displayModeBar: false },
  };
});
</script>

<template>
  <!-- nothing is shown (and the node stays normal size) until something is connected -->
  <div v-if="sourceType" class="mt-2" :style="{ minHeight: `${PREVIEW_PLOT.height}px` }">
    <div v-if="type === 'preview' || kindOf(sourceType).seeded" class="w-44">
      <ParamInputs :id="id" :type="type" :params="own" />
    </div>
    <RequestNote :status="status" :message="message" :what="self.label" class="pt-36" />
    <div v-show="status === 'idle'" ref="plot" />
  </div>
</template>
