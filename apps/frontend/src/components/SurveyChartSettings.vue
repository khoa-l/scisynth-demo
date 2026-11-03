<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed, useId } from "vue";

import type { DatasetPublic } from "@/client";
import { datasetsGetDatasetsOptions } from "@/client/@tanstack/vue-query.gen";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { findKind, nodeCatalogQuery } from "@/lib/dataset-nodes/catalog";
import type { ChartBlock, LabelBlock } from "@/lib/survey-blocks";
import { liveNodePreview } from "@/lib/survey-charts";

const props = defineProps<{ projectId: string; block: ChartBlock | LabelBlock }>();
const emit = defineEmits<{
  update: [changes: Pick<ChartBlock, "source"> | Pick<ChartBlock, "appearance">];
}>();

const uid = useId();

const { data: datasets } = useQuery(
  computed(() => datasetsGetDatasetsOptions({ path: { project_id: props.projectId } })),
);
const { data: catalog } = useQuery(nodeCatalogQuery);
const { data: preview } = useQuery(
  computed(() => ({
    ...liveNodePreview(
      props.projectId,
      props.block.source?.dataset_id ?? "",
      props.block.source?.node_id ?? "",
    ),
    enabled: !!props.block.source,
    retry: false,
  })),
);

const channelCount = computed(() => preview.value?.channels.length ?? 0);
const chosen = computed(() =>
  props.block.source ? `${props.block.source.dataset_id}/${props.block.source.node_id}` : "",
);

function nodeOptions(dataset: DatasetPublic) {
  const seen = new Map<string, number>();
  return dataset.content.nodes.map((node) => {
    const label = (catalog.value && findKind(catalog.value, node.kind)?.label) ?? node.kind;
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    return { value: `${dataset.id}/${node.id}`, label: count > 1 ? `${label} ${count}` : label };
  });
}

function choose(value: string) {
  const [datasetId, nodeId] = value.split("/");
  if (datasetId && nodeId) {
    emit("update", { source: { dataset_id: datasetId, node_id: nodeId, channels: [0] } });
  }
}

function setChannels(value: unknown) {
  if (!props.block.source || !Array.isArray(value) || !value.length) return;
  const channels = value.filter(Number.isInteger).sort((a, b) => a - b);
  emit("update", { source: { ...props.block.source, channels } });
}

function setAppearance(value: unknown) {
  if (value === "shown" || value === "blank") emit("update", { appearance: value });
}
</script>

<template>
  <div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
    <Label :for="`${uid}-data`" class="text-muted-foreground">Data</Label>
    <div class="flex items-center gap-2">
      <NativeSelect
        :id="`${uid}-data`"
        :model-value="chosen"
        class="w-full min-w-0 flex-1"
        @update:model-value="choose(String($event))"
      >
        <NativeSelectOption value="" disabled>Choose a node from a dataset…</NativeSelectOption>
        <NativeSelectOptGroup v-for="dataset in datasets" :key="dataset.id" :label="dataset.name">
          <NativeSelectOption
            v-for="option in nodeOptions(dataset)"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </NativeSelectOption>
        </NativeSelectOptGroup>
      </NativeSelect>
      <ToggleGroup
        type="single"
        variant="outline"
        orientation="horizontal"
        aria-label="Show as"
        class="shrink-0"
        :model-value="block.appearance"
        @update:model-value="setAppearance"
      >
        <ToggleGroupItem value="shown">Data</ToggleGroupItem>
        <ToggleGroupItem value="blank">Blank</ToggleGroupItem>
      </ToggleGroup>
    </div>
    <template v-if="block.source && channelCount > 1">
      <span :id="`${uid}-channels`" class="text-sm text-muted-foreground">Channels</span>
      <ToggleGroup
        type="multiple"
        variant="outline"
        orientation="horizontal"
        :aria-labelledby="`${uid}-channels`"
        :model-value="block.source.channels"
        @update:model-value="setChannels"
      >
        <ToggleGroupItem
          v-for="index in channelCount"
          :key="index"
          :value="index - 1"
          :aria-label="`Channel ${index}`"
        >
          {{ index }}
        </ToggleGroupItem>
      </ToggleGroup>
    </template>
  </div>
</template>
