<script setup lang="ts">
import { CircleAlert, Palette } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";

import LabelChart from "@/components/LabelChart.vue";
import PreviewPlot from "@/components/PreviewPlot.vue";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Toggle } from "@/components/ui/toggle";
import type { ChartQuery } from "@/lib/survey-charts";
import type { ChartBlock, LabelBlock, LabeledPoints } from "@/lib/survey-blocks";

const props = defineProps<{
  block: ChartBlock | LabelBlock;
  charts: ChartQuery;
  labeled?: LabeledPoints;
  disabled?: boolean;
}>();

defineEmits<{ label: [labeled: LabeledPoints] }>();

const { data: preview, error } = useQuery(
  computed(() => ({ ...props.charts(props.block), retry: false })),
);

const revealable = computed(() => props.disabled && props.block.appearance === "blank");
const revealed = ref(false);
const blank = computed(() => props.block.appearance === "blank" && !revealed.value);
</script>

<template>
  <figure class="flex flex-col gap-2">
    <div
      v-if="block.type === 'label' ? block.text : revealable"
      class="flex items-center justify-between gap-2"
    >
      <p
        v-if="block.type === 'label' && block.text"
        :id="`question-${block.id}`"
        class="text-sm font-medium wrap-anywhere"
      >
        {{ block.text }}
      </p>
      <Toggle
        v-if="block.type === 'chart' && revealable"
        v-model="revealed"
        variant="outline"
        class="ml-auto shrink-0"
      >
        <Palette />
        Show data
      </Toggle>
    </div>
    <Alert v-if="error" variant="destructive" class="shadow-sm">
      <CircleAlert />
      <AlertTitle>Couldn't show this chart.</AlertTitle>
    </Alert>
    <template v-else-if="preview">
      <LabelChart
        v-if="block.type === 'label'"
        :preview="preview"
        :block="block"
        :model-value="labeled"
        :disabled="disabled"
        :blank="blank"
        :revealable="revealable"
        v-model:revealed="revealed"
        @update:model-value="$emit('label', $event)"
      />
      <PreviewPlot
        v-else
        :preview="preview"
        :label="block.text || 'Chart'"
        :blank="blank"
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
