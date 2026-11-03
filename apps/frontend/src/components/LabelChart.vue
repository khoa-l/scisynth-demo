<script setup lang="ts">
import { Brush, Eraser, Lasso, MousePointerClick } from "@lucide/vue";
import { useResizeObserver } from "@vueuse/core";
import { computed, ref, shallowRef, useTemplateRef, watch } from "vue";

import type { NodePreview } from "@/client";
import PreviewPlot from "@/components/PreviewPlot.vue";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  addLabel,
  brushed,
  decode,
  eraseLabels,
  lassoed,
  locations,
  nearest,
  type Pixel,
  type PlacedLocation,
} from "@/lib/labelling";
import type { LabelBlock, LabelledPoints, LabelTool } from "@/lib/survey-blocks";

const props = defineProps<{ preview: NodePreview; block: LabelBlock; disabled?: boolean }>();

const labelled = defineModel<LabelledPoints>({ default: () => ({}) });

const ERASER = "eraser";
const POINT_RADIUS = 16;
const BRUSH_RADIUS = 12;
const MARK_RADIUS = 4;

const tools = { point: MousePointerClick, lasso: Lasso, brush: Brush };
const toolNames: Record<LabelTool, string> = { point: "Point", lasso: "Lasso", brush: "Brush" };

interface PlotAxis {
  _offset: number;
  l2p: (value: number) => number;
}

type PlotElement = HTMLDivElement & { _fullLayout?: { xaxis: PlotAxis; yaxis: PlotAxis } };

const plot = shallowRef<PlotElement | null>(null);
const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const stroke = ref<Pixel[]>([]);

const chosenLabel = ref(props.block.labels[0]?.id ?? ERASER);
const chosenTool = ref<LabelTool>("point");
const label = computed(() =>
  chosenLabel.value === ERASER || props.block.labels.some((l) => l.id === chosenLabel.value)
    ? chosenLabel.value
    : (props.block.labels[0]?.id ?? ERASER),
);
const tool = computed(() =>
  props.block.tools.includes(chosenTool.value) ? chosenTool.value : props.block.tools[0],
);
const spots = computed(() => locations(props.preview));

function placed(): PlacedLocation[] {
  const layout = plot.value?._fullLayout;
  if (!layout) return [];
  const { xaxis, yaxis } = layout;
  return spots.value.map(({ index, x, y }) => ({
    index,
    at: { x: xaxis._offset + xaxis.l2p(x), y: yaxis._offset + yaxis.l2p(y) },
  }));
}

function cellSize(): number {
  const xaxis = plot.value?._fullLayout?.xaxis;
  const [first, second] = decode(props.preview.x);
  if (!xaxis || first === undefined || second === undefined) return 0;
  return Math.abs(xaxis.l2p(second) - xaxis.l2p(first));
}

function chooseLabel(value: unknown) {
  if (typeof value === "string") chosenLabel.value = value;
}

function chooseTool(value: unknown) {
  if (value === "point" || value === "lasso" || value === "brush") chosenTool.value = value;
}

function apply(indices: number[]) {
  if (!indices.length) return;
  labelled.value =
    label.value === ERASER
      ? eraseLabels(labelled.value, indices)
      : addLabel(labelled.value, label.value, indices);
}

function pixel(event: PointerEvent): Pixel {
  const box = canvas.value!.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function start(event: PointerEvent) {
  const at = pixel(event);
  stroke.value = [at];
  if (tool.value === "point") apply(nearest(placed(), at, POINT_RADIUS));
  if (tool.value === "brush") apply(brushed(placed(), at, at, BRUSH_RADIUS));
}

function move(event: PointerEvent) {
  const previous = stroke.value.at(-1);
  if (!previous || tool.value === "point") return;
  const at = pixel(event);
  stroke.value.push(at);
  if (tool.value === "brush") apply(brushed(placed(), previous, at, BRUSH_RADIUS));
}

function finish() {
  if (tool.value === "lasso" && stroke.value.length > 2) {
    apply(lassoed(placed(), stroke.value));
  }
  stroke.value = [];
}

function draw() {
  const element = canvas.value;
  const context = element?.getContext("2d");
  if (!element || !context) return;
  const { width, height } = element.getBoundingClientRect();
  element.width = width * window.devicePixelRatio;
  element.height = height * window.devicePixelRatio;
  context.scale(window.devicePixelRatio, window.devicePixelRatio);
  const positions = new Map(placed().map((point) => [point.index, point.at]));
  const cell = props.preview.layout === "grid" ? cellSize() : 0;
  const count = props.block.labels.length;
  props.block.labels.forEach((surveyLabel, order) => {
    const share = (count - order) / count;
    context.fillStyle = surveyLabel.color;
    for (const index of labelled.value[surveyLabel.id] ?? []) {
      const at = positions.get(index);
      if (!at) continue;
      if (cell) {
        const side = cell * share;
        context.fillRect(at.x - side / 2, at.y - side / 2, side, side);
      } else {
        context.beginPath();
        context.arc(at.x, at.y, MARK_RADIUS * share, 0, 2 * Math.PI);
        context.fill();
      }
    }
  });
  if (tool.value === "lasso" && stroke.value.length > 1) {
    context.setLineDash([4, 4]);
    context.beginPath();
    stroke.value.forEach((at) => context.lineTo(at.x, at.y));
    context.stroke();
  }
}

function plotted(element: HTMLDivElement) {
  plot.value = element;
  draw();
}

watch([labelled, () => props.block.labels, stroke], draw, { deep: true });
useResizeObserver(canvas, draw);
</script>

<template>
  <div class="flex flex-col gap-2">
    <ul v-if="disabled" aria-label="Labels" class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <li
        v-for="surveyLabel in block.labels"
        :key="surveyLabel.id"
        class="flex items-center gap-1.5"
      >
        <span class="size-3 rounded-full" :style="{ background: surveyLabel.color }" />
        {{ surveyLabel.name }}
        <span class="text-muted-foreground">{{ labelled[surveyLabel.id]?.length ?? 0 }}</span>
      </li>
    </ul>
    <div v-else class="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        orientation="horizontal"
        aria-label="Labels"
        :model-value="label"
        @update:model-value="chooseLabel"
      >
        <ToggleGroupItem
          v-for="surveyLabel in block.labels"
          :key="surveyLabel.id"
          :value="surveyLabel.id"
        >
          <span class="size-3 rounded-full" :style="{ background: surveyLabel.color }" />
          {{ surveyLabel.name }}
        </ToggleGroupItem>
        <ToggleGroupItem :value="ERASER">
          <Eraser />
          Eraser
        </ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        v-if="block.tools.length > 1"
        type="single"
        variant="outline"
        orientation="horizontal"
        aria-label="Tools"
        :model-value="tool"
        @update:model-value="chooseTool"
      >
        <ToggleGroupItem
          v-for="name in block.tools"
          :key="name"
          :value="name"
          :aria-label="toolNames[name]"
        >
          <component :is="tools[name]" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
    <div class="relative">
      <PreviewPlot
        :preview="preview"
        :label="block.text || 'Chart to label'"
        :blank="block.appearance === 'blank'"
        detailed
        @drawn="plotted"
      />
      <canvas
        ref="canvas"
        class="absolute inset-x-0 bottom-0 aspect-square w-full touch-none"
        :class="disabled ? 'pointer-events-none' : 'cursor-crosshair'"
        @pointerdown="start"
        @pointermove="move"
        @pointerup="finish"
        @pointerleave="finish"
      />
    </div>
  </div>
</template>
