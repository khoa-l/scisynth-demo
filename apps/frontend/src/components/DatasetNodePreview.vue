<script setup lang="ts">
import { Axis3d, ChartScatter, CircleAlert, Grid3x3 } from "@lucide/vue";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { refDebounced } from "@vueuse/core";
import { computed } from "vue";

import { previewsPreviewNode, type NodePreviewRequest } from "@/client";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { decode } from "@/lib/labeling";

const props = defineProps<{
  label: string;
  request: NodePreviewRequest;
  detailed?: boolean;
  switchable?: boolean;
}>();

const plot = defineModel<"heatmap" | "scatter">("plot", { default: "heatmap" });

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

const domains = computed(() =>
  preview.value?.axes.map((name, index) => {
    let start = Infinity;
    let end = -Infinity;
    for (const value of decode(index ? preview.value!.y : preview.value!.x)) {
      if (value < start) start = value;
      if (value > end) end = value;
    }
    return { name, start: Number(start.toPrecision(4)), end: Number(end.toPrecision(4)) };
  }),
);

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
      <PopoverContent side="left" align="start" class="w-auto">
        <PopoverHeader>
          <PopoverTitle>Domain</PopoverTitle>
        </PopoverHeader>
        <dl class="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
          <template v-for="domain in domains" :key="domain.name">
            <dt class="font-medium">{{ domain.name }}</dt>
            <dd class="text-muted-foreground tabular-nums">
              {{ domain.start }} – {{ domain.end }}
            </dd>
          </template>
        </dl>
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
