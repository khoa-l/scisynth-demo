<script setup lang="ts">
import { Axis3d, ChartScatter, CircleAlert, Grid3x3 } from "@lucide/vue";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { refDebounced } from "@vueuse/core";
import { computed, ref, useId } from "vue";

import { previewsPreviewNode, type NodePreviewRequest, type PreviewView } from "@/client";
import PreviewPlot from "@/components/PreviewPlot.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const props = defineProps<{
  label: string;
  request: NodePreviewRequest;
  detailed?: boolean;
  switchable?: boolean;
}>();

const plot = defineModel<"heatmap" | "scatter">("plot", { default: "heatmap" });
const view = defineModel<PreviewView | null>("view", { default: null });
const uid = useId();

function setPlot(value: unknown) {
  if (value === "heatmap" || value === "scatter") plot.value = value;
}

const request = refDebounced(
  computed(() => props.request),
  300,
);

const {
  data: preview,
  error,
  isPlaceholderData,
} = useQuery(
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

const shown = computed(() => {
  const [x = "", y = ""] = preview.value?.axes ?? [];
  return { x, y };
});
const hidden = computed(
  () =>
    preview.value?.domain.filter(
      (axis) => axis.name !== shown.value.x && axis.name !== shown.value.y,
    ) ?? [],
);
const chosenSlice = ref<string>();
const slice = computed(
  () => hidden.value.find((axis) => axis.name === chosenSlice.value) ?? hidden.value[0],
);
const slicedAt = computed(() => {
  if (!slice.value) return 0;
  const { name, start, end } = slice.value;
  return view.value?.at?.[name] ?? (start + end) / 2;
});

function setAxis(side: "x" | "y", name: unknown) {
  if (typeof name !== "string") return;
  const other = side === "x" ? "y" : "x";
  const next = { ...shown.value, [side]: name };
  if (next[other] === name) next[other] = shown.value[side];
  view.value = { ...next, at: view.value?.at ?? {} };
}

function setSlice(value: number[] | undefined) {
  if (!slice.value || value?.[0] === undefined) return;
  view.value = { ...shown.value, at: { ...view.value?.at, [slice.value.name]: value[0] } };
}

const errorMessage = computed(() => {
  const detail = (error.value as { detail?: unknown } | null)?.detail;
  return typeof detail === "string" ? detail : undefined;
});
</script>

<template>
  <Alert v-if="error" variant="destructive" class="shadow-sm">
    <CircleAlert />
    <AlertTitle>Couldn't preview this node.</AlertTitle>
    <AlertDescription v-if="errorMessage">{{ errorMessage }}</AlertDescription>
  </Alert>
  <div v-else-if="preview">
    <Popover v-if="switchable">
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          size="icon"
          aria-label="Show domain"
          class="nodrag absolute top-0 right-full mr-2 shadow-sm"
          @click.stop
        >
          <Axis3d />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" class="w-64">
        <PopoverHeader>
          <PopoverTitle>Domain</PopoverTitle>
        </PopoverHeader>
        <div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-sm">
          <template v-for="side in ['x', 'y'] as const" :key="side">
            <label :for="`${uid}-${side}`" class="text-muted-foreground">
              {{ side.toUpperCase() }} axis
            </label>
            <Select :model-value="shown[side]" @update:model-value="setAxis(side, $event)">
              <SelectTrigger :id="`${uid}-${side}`" size="sm" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="axis in preview.domain" :key="axis.name" :value="axis.name">
                  {{ axis.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </template>
          <template v-if="slice">
            <label :for="`${uid}-slice`" class="text-muted-foreground">Slice</label>
            <Select :model-value="slice.name" @update:model-value="chosenSlice = String($event)">
              <SelectTrigger :id="`${uid}-slice`" size="sm" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="axis in hidden" :key="axis.name" :value="axis.name">
                  {{ axis.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Slider
              :model-value="[slicedAt]"
              :min="slice.start"
              :max="slice.end"
              :step="(slice.end - slice.start) / 100"
              :aria-label="`Slice of ${slice.name}`"
              class="col-span-2"
              @update:model-value="setSlice"
            />
            <span class="col-span-2 text-right text-muted-foreground tabular-nums">
              {{ slice.name }} = {{ Number(slicedAt.toPrecision(4)) }}
            </span>
          </template>
        </div>
      </PopoverContent>
    </Popover>
    <ToggleGroup
      v-if="switchable && preview.layout === 'grid'"
      type="single"
      variant="outline"
      orientation="vertical"
      aria-label="Plot type"
      :model-value="plot"
      class="nodrag absolute right-full bottom-0 mr-2 bg-background shadow-sm"
      @update:model-value="setPlot"
      @click.stop
    >
      <ToggleGroupItem value="heatmap" aria-label="Heatmap">
        <Grid3x3 />
      </ToggleGroupItem>
      <ToggleGroupItem value="scatter" aria-label="Scatterplot">
        <ChartScatter />
      </ToggleGroupItem>
    </ToggleGroup>
    <PreviewPlot
      :preview="preview"
      :label="`Preview of ${label}`"
      :detailed="detailed"
      :plot="plot"
      :stale="isPlaceholderData"
    />
  </div>
</template>
