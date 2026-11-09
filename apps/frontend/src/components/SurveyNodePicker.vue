<script setup lang="ts">
import { Check, ChevronDown, ChevronRight } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { computed, ref, watch } from "vue";

import type { DatasetPublic } from "@/client";
import { datasetsGetDatasetsOptions } from "@/client/@tanstack/vue-query.gen";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { findKind, nodeCatalogQuery } from "@/lib/dataset-nodes/catalog";
import type { ChartSource } from "@/lib/survey-blocks";

const props = defineProps<{ id: string; projectId: string; source: ChartSource | null }>();
const emit = defineEmits<{ choose: [datasetId: string, nodeId: string] }>();

const { data: datasets } = useQuery(
  computed(() => datasetsGetDatasetsOptions({ path: { project_id: props.projectId } })),
);
const { data: catalog } = useQuery(nodeCatalogQuery);

function nodeOptions(dataset: DatasetPublic) {
  const seen = new Map<string, number>();
  return dataset.content.nodes.map((node) => {
    const label =
      node.name ?? (catalog.value && findKind(catalog.value, node.kind)?.label) ?? node.kind;
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    return { id: node.id, label: count > 1 ? `${label} ${count}` : label };
  });
}

const sections = computed(() =>
  (datasets.value ?? [])
    .map((dataset) => ({ dataset, options: nodeOptions(dataset) }))
    .filter((section) => section.options.length),
);

const chosen = computed(() => {
  const section = sections.value.find(({ dataset }) => dataset.id === props.source?.dataset_id);
  const option = section?.options.find(({ id }) => id === props.source?.node_id);
  return section && option && { dataset: section.dataset.name, node: option.label };
});

const open = ref(false);
const expanded = ref<string[]>([]);

watch(open, (isOpen) => {
  if (!isOpen) return;
  const shown = props.source?.dataset_id ?? sections.value[0]?.dataset.id;
  expanded.value = shown ? [shown] : [];
});

function setExpanded(datasetId: string, isExpanded: boolean) {
  expanded.value = isExpanded
    ? [...expanded.value, datasetId]
    : expanded.value.filter((id) => id !== datasetId);
}

function isChosen(datasetId: string, nodeId: string) {
  return props.source?.dataset_id === datasetId && props.source.node_id === nodeId;
}

function choose(datasetId: string, nodeId: string) {
  emit("choose", datasetId, nodeId);
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button :id="id" variant="outline" class="w-full min-w-0 flex-1 justify-between font-normal">
        <span class="truncate">
          <template v-if="chosen">
            <span class="text-muted-foreground">{{ chosen.dataset }} /</span>
            {{ chosen.node }}
          </template>
          <span v-else class="text-muted-foreground">Choose a node from a dataset…</span>
        </span>
        <ChevronDown class="text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="max-h-80 w-(--reka-popover-trigger-width) gap-0.5 overflow-y-auto p-1"
    >
      <p v-if="!sections.length" class="px-1.5 py-1 text-muted-foreground">
        No datasets with nodes yet.
      </p>
      <Collapsible
        v-for="{ dataset, options } in sections"
        :key="dataset.id"
        :open="expanded.includes(dataset.id)"
        @update:open="setExpanded(dataset.id, $event)"
      >
        <CollapsibleTrigger
          class="group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-medium outline-none hover:bg-accent focus-visible:bg-accent"
        >
          <ChevronRight
            class="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
          />
          <span class="truncate">{{ dataset.name }}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul :aria-label="dataset.name" class="flex flex-col gap-0.5">
            <li v-for="option in options" :key="option.id">
              <button
                type="button"
                :aria-current="isChosen(dataset.id, option.id)"
                class="flex w-full items-center gap-1.5 rounded-md py-1 pr-1.5 pl-7 text-left outline-none hover:bg-accent focus-visible:bg-accent"
                @click="choose(dataset.id, option.id)"
              >
                <span class="flex-1 truncate">{{ option.label }}</span>
                <Check v-if="isChosen(dataset.id, option.id)" class="size-4 shrink-0" />
              </button>
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </PopoverContent>
  </Popover>
</template>
