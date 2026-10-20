<script setup lang="ts">
import type { PlotlyFigure } from "plotly.js-dist-min";

const props = defineProps<{ uid: number; editing: boolean }>();
const data = defineModel<PlotData>({ required: true });

const { taskId, flush } = inject(TASK_CONTEXT)!;

// The figure of the copied Plot or Preview: the backend runs the saved copy; the switches only change drawing
const figure = ref<PlotlyFigure>();
const { status, message, refresh } = useLatestRequest(
  computed(() => JSON.stringify(data.value.source ?? null)),
  async (signal) => {
    if (!data.value.source) {
      figure.value = undefined;
      return { waiting: "" };
    }
    await flush();
    figure.value = await $fetch<PlotlyFigure>(
      `/api/tasks/${taskId.value}/components/${props.uid}/figure`,
      { signal },
    );
  },
);
onMounted(refresh);

const element = ref<HTMLElement>();
usePlotly(element, () => {
  if (!figure.value) return undefined;
  const { interactive, colors } = data.value;
  // drop the figure's width (it fills the task); keep its height, else 360
  const { width: _w, ...layout } = figure.value.layout as Record<string, any>;
  return {
    data: (figure.value.data as { marker?: object }[]).map((trace) => ({
      ...trace,
      // without colors: one color for every point
      ...(colors
        ? {}
        : {
            marker: { ...trace.marker, color: ONE_COLOR, colorscale: undefined, showscale: false },
          }),
      ...(interactive ? { hoverinfo: "x+y" } : {}),
    })),
    layout: {
      ...(interactive ? interactiveLayout(layout) : layout),
      autosize: true,
      height: layout.height ?? 360,
      margin: { l: 45, r: 10, t: 35, b: 40, ...layout.margin },
    },
    config: interactive ? { displaylogo: false } : { staticPlot: true },
  };
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <template v-if="editing">
      <SourceBar v-model="data.source" :kinds="['plot', 'preview']" />
      <div class="flex gap-6">
        <USwitch v-model="data.interactive" label="Interactive" />
        <USwitch v-model="data.colors" label="Colors" />
      </div>
    </template>
    <RequestNote :status="status" :message="message" what="Plot" />
    <p v-if="!data.source && editing" class="text-muted">Choose a Plot or Preview to show.</p>
    <!-- hidden by height while empty (display: none would make Plotly draw at its default size); the
         plot has its own element since Plotly keeps classes Vue would overwrite -->
    <div class="w-full" :class="{ 'h-0 overflow-hidden': status !== 'idle' || !data.source }">
      <div ref="element" class="w-full" />
    </div>
  </div>
</template>
