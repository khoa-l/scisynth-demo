<script setup lang="ts">
import { CircleAlert } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

import LabelChart from "@/components/LabelChart.vue";
import PreviewPlot from "@/components/PreviewPlot.vue";
import { Alert, AlertTitle } from "@/components/ui/alert";
import type { ChartQuery } from "@/lib/survey-charts";
import type { ChartBlock, ChartSource, LabelBlock, LabelledPoints } from "@/lib/survey-blocks";

const props = defineProps<{
  block: ChartBlock | LabelBlock;
  source: ChartSource;
  charts: ChartQuery;
  labelled?: LabelledPoints;
  disabled?: boolean;
}>();

defineEmits<{ label: [labelled: LabelledPoints] }>();

const { data: preview, error } = useQuery(
  computed(() => ({ ...props.charts(props.block.id, props.source), retry: false })),
);
</script>

<template>
  <figure class="flex flex-col gap-2">
    <p
      v-if="block.type === 'label' && block.text"
      :id="`question-${block.id}`"
      class="text-sm font-medium wrap-anywhere"
    >
      {{ block.text }}
    </p>
    <Alert v-if="error" variant="destructive" class="shadow-sm">
      <CircleAlert />
      <AlertTitle>Couldn't show this chart.</AlertTitle>
    </Alert>
    <template v-else-if="preview">
      <LabelChart
        v-if="block.type === 'label'"
        :preview="preview"
        :block="block"
        :model-value="labelled"
        :disabled="disabled"
        @update:model-value="$emit('label', $event)"
      />
      <PreviewPlot
        v-else
        :preview="preview"
        :label="block.text || 'Chart'"
        :blank="block.appearance === 'blank'"
        detailed
      />
    </template>
    <figcaption
      v-if="block.type === 'chart' && block.text"
      class="text-sm text-muted-foreground wrap-anywhere"
    >
      {{ block.text }}
    </figcaption>
  </figure>
</template>
