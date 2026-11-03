<script setup lang="ts">
import {
  Brush,
  Eraser,
  EyeOff,
  Lasso,
  MousePointerClick,
  Move,
  RotateCcw,
  ZoomIn,
} from "@lucide/vue";
import { useResizeObserver } from "@vueuse/core";
import { computed, ref, shallowRef, useTemplateRef, watch } from "vue";

import type { NodePreview } from "@/client";
import PreviewPlot from "@/components/PreviewPlot.vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  brushed,
  decode,
  eraseLabels,
  lassoed,
  locations,
  nearest,
  setLabel,
  type Pixel,
  type PlacedLocation,
} from "@/lib/labelling";
import type { LabelBlock, LabelledPoints, LabelTool } from "@/lib/survey-blocks";

const props = defineProps<{ preview: NodePreview; block: LabelBlock; disabled?: boolean }>();

const labelled = defineModel<LabelledPoints>({ default: () => ({}) });

const POINT_RADIUS = 16;
const BRUSH_RADIUS = 12;
const MARK_RADIUS = 4;

type Navigation = "pan" | "zoom";
type Tool = LabelTool | Navigation;

const toolIcons = {
  point: MousePointerClick,
  lasso: Lasso,
  brush: Brush,
  pan: Move,
  zoom: ZoomIn,
};
const toolNames: Record<Tool, string> = {
  point: "Point",
  lasso: "Lasso",
  brush: "Brush",
  pan: "Move",
  zoom: "Zoom",
};

interface PlotAxis {
  _offset: number;
  l2p: (value: number) => number;
}

type PlotElement = HTMLDivElement & {
  _fullLayout?: { xaxis: PlotAxis; yaxis: PlotAxis };
  on?: (event: string, listener: () => void) => void;
};

const plot = shallowRef<PlotElement | null>(null);
const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const plotly = import("plotly.js-cartesian-dist-min").then((module) => module.default);
const stroke = ref<Pixel[]>([]);

const NAVIGATION = ["pan", "zoom"] as const;

const paintTools = computed<LabelTool[]>(() => (props.disabled ? [] : props.block.tools));
const chosenLabel = ref(props.block.labels[0]?.id);
const chosenPaintTool = ref(props.block.tools[0]);
const navigation = ref<Navigation | null>(props.disabled ? "pan" : null);
const erasing = ref(false);
const labelsHidden = ref(false);

const label = computed(
  () =>
    props.block.labels.find((surveyLabel) => surveyLabel.id === chosenLabel.value) ??
    props.block.labels[0],
);
const paintTool = computed(
  () => paintTools.value.find((name) => name === chosenPaintTool.value) ?? paintTools.value[0],
);
const tool = computed<Tool | undefined>(() => navigation.value ?? paintTool.value);
const navigating = computed(() => navigation.value !== null);
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

function chooseLabel(id: string) {
  chosenLabel.value = id;
  erasing.value = false;
}

function choosePaintTool(value: unknown) {
  const chosen = paintTools.value.find((name) => name === value);
  if (!chosen) return;
  chosenPaintTool.value = chosen;
  navigation.value = null;
}

function navigate(mode: Navigation) {
  navigation.value = mode;
  erasing.value = false;
}

function setErasing(on: boolean) {
  erasing.value = on;
  if (on) navigation.value = null;
}

async function setDragMode() {
  const element = plot.value;
  if (!element) return;
  await (await plotly).relayout(element, { dragmode: navigation.value ?? false });
}

async function resetView() {
  const element = plot.value;
  if (!element) return;
  await (await plotly).relayout(element, { "xaxis.autorange": true, "yaxis.autorange": true });
}

function apply(indices: number[]) {
  if (!indices.length) return;
  if (erasing.value) labelled.value = eraseLabels(labelled.value, indices);
  else if (label.value) labelled.value = setLabel(labelled.value, label.value.id, indices);
}

function pixel(event: PointerEvent): Pixel {
  const box = canvas.value!.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function start(event: PointerEvent) {
  if (props.disabled || navigating.value) return;
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
  if (!labelsHidden.value) {
    const positions = new Map(placed().map((point) => [point.index, point.at]));
    const cell = props.preview.layout === "grid" ? cellSize() : 0;
    for (const surveyLabel of props.block.labels) {
      context.fillStyle = surveyLabel.color;
      for (const index of labelled.value[surveyLabel.id] ?? []) {
        const at = positions.get(index);
        if (!at) continue;
        if (cell) {
          context.fillRect(at.x - cell / 2, at.y - cell / 2, cell, cell);
        } else {
          context.beginPath();
          context.arc(at.x, at.y, MARK_RADIUS, 0, 2 * Math.PI);
          context.fill();
        }
      }
    }
  }
  if (tool.value === "lasso" && stroke.value.length > 1) {
    context.setLineDash([4, 4]);
    context.beginPath();
    stroke.value.forEach((at) => context.lineTo(at.x, at.y));
    context.stroke();
  }
}

function plotted(element: PlotElement) {
  if (plot.value !== element) {
    plot.value = element;
    element.on?.("plotly_relayout", draw);
    element.on?.("plotly_relayouting", draw);
  }
  draw();
  void setDragMode();
}

watch(navigation, setDragMode);
watch([labelled, () => props.block.labels, stroke, labelsHidden], draw, { deep: true });
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
    <div class="flex flex-wrap items-center gap-2">
      <div v-if="!disabled && label" class="flex items-center gap-2 text-sm">
        <span class="size-3 shrink-0 rounded-full" :style="{ background: label.color }" />
        <NativeSelect
          v-if="block.labels.length > 1"
          aria-label="Label"
          :model-value="label.id"
          @update:model-value="chooseLabel(String($event))"
        >
          <NativeSelectOption
            v-for="surveyLabel in block.labels"
            :key="surveyLabel.id"
            :value="surveyLabel.id"
          >
            {{ surveyLabel.name }}
          </NativeSelectOption>
        </NativeSelect>
        <span v-else>{{ label.name }}</span>
      </div>
      <Toggle
        v-if="!disabled"
        :model-value="erasing"
        variant="outline"
        @update:model-value="setErasing"
      >
        <Eraser />
        Eraser
      </Toggle>
      <ToggleGroup
        v-if="paintTools.length"
        type="single"
        variant="outline"
        orientation="horizontal"
        aria-label="Tools"
        :model-value="navigating ? undefined : paintTool"
        @update:model-value="choosePaintTool"
      >
        <ToggleGroupItem
          v-for="name in paintTools"
          :key="name"
          :value="name"
          :aria-label="toolNames[name]"
        >
          <component :is="toolIcons[name]" />
        </ToggleGroupItem>
      </ToggleGroup>
      <ButtonGroup aria-label="Navigation">
        <Button
          v-for="mode in NAVIGATION"
          :key="mode"
          variant="outline"
          size="icon"
          :aria-label="toolNames[mode]"
          :aria-pressed="navigation === mode"
          class="aria-pressed:bg-muted"
          @click="navigate(mode)"
        >
          <component :is="toolIcons[mode]" />
        </Button>
        <Button variant="outline" size="icon" aria-label="Reset view" @click="resetView">
          <RotateCcw />
        </Button>
      </ButtonGroup>
      <Toggle v-model="labelsHidden" variant="outline" class="ml-auto">
        <EyeOff />
        Hide labels
      </Toggle>
    </div>
    <div class="relative">
      <PreviewPlot
        :preview="preview"
        :label="block.text || 'Chart to label'"
        :blank="block.appearance === 'blank'"
        detailed
        navigable
        @drawn="plotted"
      />
      <canvas
        ref="canvas"
        class="absolute inset-x-0 bottom-0 aspect-square w-full touch-none"
        :class="disabled || navigating ? 'pointer-events-none' : 'cursor-crosshair'"
        @pointerdown="start"
        @pointermove="move"
        @pointerup="finish"
        @pointerleave="finish"
      />
    </div>
  </div>
</template>
