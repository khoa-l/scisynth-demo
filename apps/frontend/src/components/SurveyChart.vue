<script setup lang="ts">
import { CircleAlert } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import PreviewPlot from "@/components/PreviewPlot.vue";
import { Alert, AlertTitle } from "@/components/ui/alert";
import type { ChartQuery } from "@/lib/survey-charts";
import type { ChartBlock, ChartSource } from "@/lib/survey-blocks";

const props = defineProps<{ block: ChartBlock; source: ChartSource; charts: ChartQuery }>();

const { data: preview, error } = useQuery(
  computed(() => ({ ...props.charts(props.block.id, props.source), retry: false })),
);
</script>

<template>
  <figure class="flex flex-col gap-2">
    <Alert v-if="error" variant="destructive" class="shadow-sm">
      <CircleAlert />
      <AlertTitle>Couldn't show this chart.</AlertTitle>
    </Alert>
    <PreviewPlot
      v-else-if="preview"
      :preview="preview"
      :label="block.text || 'Chart'"
      :blank="block.appearance === 'blank'"
      detailed
    />
    <figcaption v-if="block.text" class="text-sm text-muted-foreground wrap-anywhere">
      {{ block.text }}
    </figcaption>
  </figure>
</template>
