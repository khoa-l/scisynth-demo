<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import type { Config, Data, Layout } from "plotly.js";
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";

import type { NodePreview, TypedArray } from "@/client";
import { decode } from "@/lib/labeling";

const props = defineProps<{
  preview: NodePreview;
  label: string;
  detailed?: boolean;
  blank?: boolean;
  navigable?: boolean;
  plot?: "heatmap" | "scatter";
  stale?: boolean;
}>();

const emit = defineEmits<{ drawn: [element: HTMLDivElement] }>();

const WEBGL_POINTS = 1000;

function scatterType(count: number) {
  return count > WEBGL_POINTS ? "scattergl" : "scatter";
}

const transparent = { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)" };

const grey = [
  [0, "#a3a3a3"],
  [1, "#a3a3a3"],
];

const thumbnailLayout: Partial<Layout> = {
  margin: { t: 0, r: 0, b: 0, l: 0 },
  xaxis: { visible: false },
  yaxis: { visible: false },
  ...transparent,
};

function paddedRange(array: TypedArray): [number, number] {
  const values = decode(array).filter(Number.isFinite);
  const [min, max] = [Math.min(...values), Math.max(...values)];
  const pad = (max - min) * 0.05;
  return [min - pad, max + pad];
}

function detailedLayout(preview: NodePreview, font: string): Partial<Layout> {
  const [x, y] = preview.axes;
  const [xRange, yRange] = [paddedRange(preview.x), paddedRange(preview.y)];
  const scaleratio = (xRange[1] - xRange[0]) / (yRange[1] - yRange[0]) || 1;
  const points = preview.layout === "points";
  return {
    margin: { t: 8, r: 8, b: 40, l: 48 },
    xaxis: { title: { text: x }, constrain: "domain", range: points ? xRange : undefined },
    yaxis: {
      title: { text: y },
      scaleanchor: "x",
      scaleratio,
      constrain: "domain",
      range: points ? yRange : undefined,
    },
    font: { family: font },
    ...transparent,
  };
}

const channel = ref(0);
const channelCount = computed(() => (props.blank ? 1 : props.preview.channels.length));
watch(channelCount, (count) => {
  channel.value = Math.min(channel.value, Math.max(count - 1, 0));
});

const plot = useTemplateRef<HTMLDivElement>("plot");
const plotly = import("plotly.js-dist-min").then((module) => module.default);

watch(
  [() => props.preview, () => props.blank, () => props.plot, plot, channel],
  async ([value, blank, kind, element, index]) => {
    const z = value.channels[index];
    if (!element || !z) return;
    const colorscale = blank ? grey : "Viridis";
    const showscale = props.detailed && !blank;
    const marker = { colorscale, size: props.detailed ? 4 : 3, showscale };
    let trace: object;
    if (value.layout === "grid" && kind !== "scatter") {
      trace = { type: "heatmap", x: value.x, y: value.y, z, colorscale, showscale };
    } else if (value.layout === "grid") {
      const [xs, ys] = [decode(value.x), decode(value.y)];
      const count = xs.length * ys.length;
      trace = {
        type: scatterType(count),
        mode: "markers",
        x: Float32Array.from({ length: count }, (_, i) => xs[i % xs.length]!),
        y: Float32Array.from({ length: count }, (_, i) => ys[Math.floor(i / xs.length)]!),
        marker: { ...marker, color: decode(z) },
      };
    } else {
      trace = {
        type: scatterType(Number(value.x.shape)),
        mode: "markers",
        x: value.x,
        y: value.y,
        marker: { ...marker, color: z },
      };
    }
    const layout: Partial<Layout> = {
      ...(props.detailed
        ? detailedLayout(value, getComputedStyle(element).fontFamily)
        : thumbnailLayout),
      ...(props.navigable && { uirevision: "navigable" }),
    };
    const config: Partial<Config> = {
      ...(props.detailed ? { displaylogo: false, responsive: true } : { staticPlot: true }),
      ...(props.navigable && { scrollZoom: true, displayModeBar: false }),
    };
    const Plotly = await plotly;
    await Plotly.react(element, [trace as unknown as Data], layout, config);
    emit("drawn", element);
  },
  { immediate: true },
);

onBeforeUnmount(async () => {
  const element = plot.value;
  if (element) (await plotly).purge(element);
});
</script>

<template>
  <div class="flex flex-col gap-1">
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
    <div class="relative">
      <div
        ref="plot"
        role="img"
        :aria-label="label"
        :aria-busy="stale"
        class="aspect-square overflow-hidden rounded-md border bg-background shadow-sm"
      />
      <div
        class="pointer-events-none absolute inset-0 rounded-md border-2 border-yellow-400 bg-yellow-50/60 transition-opacity duration-200"
        :class="stale ? 'opacity-100' : 'opacity-0'"
      />
    </div>
  </div>
</template>
