<script setup lang="ts">
import { useVueFlow } from "@vue-flow/core";
import type { PlotlyFigure } from "plotly.js-dist-min";

const props = defineProps<{ id: string }>();

const { edges, findNode } = useVueFlow(FLOW_ID);

// This node's own parameters (the seed)
const own = computed(
  () => findNode(props.id)?.data?.params as Record<string, ParamValue> | undefined,
);

// What is connected to this node's input: its type, plus the parameter values for the plot
const source = computed(() => {
  const edge = edges.value.find((e) => e.target === props.id);
  const data = edge ? findNode(edge.source)?.data : undefined;
  if (!data?.type) return undefined;
  const kind = kindOf(data.type);
  // the seed comes from this Preview node, the rest from the connected defect
  const params = { ...paramsOf(kind, data.params), ...paramsOf(kindOf("preview"), own.value) };
  return { type: data.type as string, params };
});
const sourceType = computed(() => source.value?.type);
// Changes whenever the plot would change (a different defect or different values)
const sourceKey = computed(() => JSON.stringify(source.value ?? null));

const plot = ref<HTMLElement>();
const status = ref<"idle" | "loading" | "error">("idle");
const errorMessage = ref("");

let shownKey: string | undefined;

async function show() {
  const el = plot.value;
  const key = sourceKey.value;
  if (!el || key === shownKey) return;
  shownKey = key;
  const current = source.value;
  // plotly.js is large, so it is only loaded once a preview is needed
  const { default: Plotly } = await import("plotly.js-dist-min");
  if (!current) {
    Plotly.purge(el);
    status.value = "idle";
    return;
  }
  status.value = "loading";
  try {
    // unset (null) parameters are left out, so obskit uses its own default for them
    const query = Object.fromEntries(Object.entries(current.params).filter(([, v]) => v !== null));
    const figure = await $fetch<PlotlyFigure>(`/api/preview/${current.type}`, { query });
    if (sourceKey.value !== key) return; // the connection or values changed while loading
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
        font: { size: 11, color: "#222" },
      },
      { staticPlot: true, displayModeBar: false },
    );
    status.value = "idle";
  } catch (error) {
    if (sourceKey.value !== key) return;
    // the backend says why obskit rejected the values (e.g. "p must be in [0, 1]")
    errorMessage.value = (error as { data?: { detail?: string } }).data?.detail ?? "";
    status.value = "error";
  }
}

// The plot element only exists once mounted, so a saved connection is drawn from onMounted.
// Typing in a parameter changes the key on every keystroke, so wait for a short pause;
// show() skips a key it has already drawn.
const REFRESH_DELAY_MS = 250;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
onMounted(show);
watch(sourceType, show, { flush: "post" }); // connecting or swapping a defect: draw at once
watch(sourceKey, () => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(show, REFRESH_DELAY_MS);
});

onBeforeUnmount(async () => {
  clearTimeout(refreshTimer);
  if (plot.value) (await import("plotly.js-dist-min")).default.purge(plot.value);
});
</script>

<template>
  <!-- nothing is shown (and the node stays normal size) until a defect is connected -->
  <div v-if="sourceType" class="mt-2" :style="{ minHeight: `${PREVIEW_PLOT.height}px` }">
    <div class="w-44">
      <ParamInputs :id="id" type="preview" :params="own" />
    </div>
    <p v-if="status === 'loading'" class="pt-36 text-muted">Loading preview…</p>
    <p v-else-if="status === 'error'" class="pt-36 text-error">
      Preview unavailable{{ errorMessage ? `: ${errorMessage}` : "" }}
    </p>
    <div v-show="status === 'idle'" ref="plot" />
  </div>
</template>
