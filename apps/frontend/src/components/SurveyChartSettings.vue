<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed, useId } from "vue";

import type { DatasetPublic } from "@/client";
import { datasetsGetDatasetsOptions } from "@/client/@tanstack/vue-query.gen";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { findKind, nodeCatalogQuery } from "@/lib/dataset-nodes/catalog";
import { LABEL_TOOLS, labelToolNames, type ChartBlock, type LabelBlock } from "@/lib/survey-blocks";
import { liveNodePreview } from "@/lib/survey-charts";

const props = defineProps<{ projectId: string; block: ChartBlock | LabelBlock }>();
const emit = defineEmits<{
  update: [
    changes:
      | Pick<ChartBlock, "source">
      | Pick<ChartBlock, "appearance">
      | Pick<LabelBlock, "tools">,
  ];
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
const hasChannels = computed(() => !!props.block.source && channelCount.value > 1);

const chosen = computed(() =>
  props.block.source ? `${props.block.source.dataset_id}/${props.block.source.node_id}` : undefined,
);

function nodeOptions(dataset: DatasetPublic) {
  const seen = new Map<string, number>();
  return dataset.content.nodes.map((node) => {
    const label =
      node.name ?? (catalog.value && findKind(catalog.value, node.kind)?.label) ?? node.kind;
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    return { value: `${dataset.id}/${node.id}`, label: count > 1 ? `${label} ${count}` : label };
  });
}

const groups = computed(() =>
  (datasets.value ?? [])
    .map((dataset) => ({ dataset, options: nodeOptions(dataset) }))
    .filter((group) => group.options.length),
);

const chosenOption = computed(() => {
  for (const { dataset, options } of groups.value) {
    const option = options.find((candidate) => candidate.value === chosen.value);
    if (option) return { dataset: dataset.name, node: option.label };
  }
  return undefined;
});

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

function setTools(value: unknown) {
  if (!Array.isArray(value)) return;
  const tools = LABEL_TOOLS.filter((tool) => value.includes(tool));
  if (tools.length) emit("update", { tools });
}

function setAppearance(value: unknown) {
  if (value === "shown" || value === "blank") emit("update", { appearance: value });
}
</script>

<template>
  <div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-3">
    <Label :for="`${uid}-data`" class="text-muted-foreground">Data</Label>
    <div class="flex items-center gap-2">
      <Select :model-value="chosen" @update:model-value="choose(String($event))">
        <SelectTrigger :id="`${uid}-data`" class="w-full min-w-0 flex-1">
          <SelectValue>
            <template v-if="chosenOption">
              <span class="text-muted-foreground">{{ chosenOption.dataset }} /</span>
              {{ chosenOption.node }}
            </template>
            <template v-else>Choose a node from a dataset…</template>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <template v-for="(group, index) in groups" :key="group.dataset.id">
            <SelectSeparator v-if="index" />
            <SelectGroup>
              <SelectLabel>{{ group.dataset.name }}</SelectLabel>
              <SelectItem v-for="option in group.options" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectGroup>
          </template>
          <p v-if="!groups.length" class="px-1.5 py-1 text-sm text-muted-foreground">
            No datasets with nodes yet.
          </p>
        </SelectContent>
      </Select>
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
    <template v-if="hasChannels || block.type === 'label'">
      <span v-if="hasChannels" :id="`${uid}-channels`" class="text-sm text-muted-foreground">
        Channels
      </span>
      <span v-else :id="`${uid}-tools`" class="text-sm text-muted-foreground">Tools</span>
      <div class="flex flex-wrap items-center gap-2">
        <ToggleGroup
          v-if="hasChannels"
          type="multiple"
          variant="outline"
          orientation="horizontal"
          :aria-labelledby="`${uid}-channels`"
          :model-value="block.source?.channels"
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
        <div
          v-if="block.type === 'label'"
          class="flex items-center gap-2"
          :class="{ 'ml-auto': hasChannels }"
        >
          <span v-if="hasChannels" :id="`${uid}-tools`" class="text-sm text-muted-foreground">
            Tools
          </span>
          <ToggleGroup
            type="multiple"
            variant="outline"
            orientation="horizontal"
            :aria-labelledby="`${uid}-tools`"
            :model-value="block.tools"
            @update:model-value="setTools"
          >
            <ToggleGroupItem v-for="tool in LABEL_TOOLS" :key="tool" :value="tool">
              {{ labelToolNames[tool] }}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </template>
  </div>
</template>
