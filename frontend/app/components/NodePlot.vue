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
const colorMode = useColorMode();
const dark = computed(() => colorMode.value === "dark");
const sourceKey = computed(() => `${dark.value}|${JSON.stringify(source.value ?? null)}`);

const plot = ref<HTMLElement>();

const { status, message, refresh } = useLatestRequest(sourceKey, async (signal) => {
  const el = plot.value;
  const current = source.value;
  if (!el) return { waiting: "" }; // not on the page (nothing connected); it is shown when it is
  // plotly.js is large, so it is only loaded once a plot is needed (and in the background once a
  // study page is open, see preloadPlotly)
  const { default: Plotly } = await import("plotly.js-dist-min");
  if (!current || current.waiting) {
    Plotly.purge(el);
    return { waiting: current?.waiting ?? "" };
  }
  const figure = await $fetch<PlotlyFigure>(endpointOf(current).url, {
    ...endpointOf(current),
    signal,
  });
  if (signal.aborted) return;
  await Plotly.react(
    el,
    // smaller dots than Plotly's default so a dense grid doesn't blur together
    (figure.data as { marker?: object }[]).map((trace) => ({
      ...trace,
      marker: { ...trace.marker, size: PREVIEW_PLOT.dotSize },
    })),
    {
      ...figure.layout,
      width: PREVIEW_PLOT.width,
      height: PREVIEW_PLOT.height,
      margin: { l: 45, r: 10, t: 35, b: 40 },
      paper_bgcolor: "rgba(0,0,0,0)",
      font: { size: 11, color: dark.value ? "#e5e7eb" : "#222" },
      // the figure's own plot area and grid are pale: dim them on a dark node
      ...(dark.value ? darkAxes(figure.layout) : {}),
    },
    { staticPlot: true, displayModeBar: false },
  );
});

// The plot element only exists while something is connected, so a saved connection is drawn from
// onMounted, and a new one once the element is on the page.
onMounted(refresh);
watch(sourceType, refresh, { flush: "post" }); // connecting or swapping: draw at once

onBeforeUnmount(async () => {
  if (plot.value) (await import("plotly.js-dist-min")).default.purge(plot.value);
});
</script>

<template>
  <!-- nothing is shown (and the node stays normal size) until something is connected -->
  <div v-if="sourceType" class="mt-2" :style="{ minHeight: `${PREVIEW_PLOT.height}px` }">
    <div v-if="type === 'preview' || kindOf(sourceType).seeded" class="w-44">
      <ParamInputs :id="id" :type="type" :params="own" />
    </div>
    <p v-if="status === 'loading'" class="pt-36 text-muted">Loading {{ self.label }}…</p>
    <p v-else-if="status === 'waiting'" class="pt-36 text-muted">{{ message }}</p>
    <p v-else-if="status === 'error'" class="pt-36 text-error">
      {{ self.label }} unavailable{{ message ? `: ${message}` : "" }}
    </p>
    <div v-show="status === 'idle'" ref="plot" />
  </div>
</template>
