<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { Handle, Position, useVueFlow, type NodeProps } from "@vue-flow/core";
import { computed } from "vue";

import DatasetNodeParams from "@/components/DatasetNodeParams.vue";
import { findKind, nodeCatalogQuery, type DatasetNodeData } from "@/lib/dataset-nodes/catalog";
import type { ParamValue } from "@/lib/dataset-nodes/types";

const props = defineProps<NodeProps<DatasetNodeData>>();

const { data: catalog } = useQuery(nodeCatalogQuery);
const kind = computed(() => catalog.value && findKind(catalog.value, props.data.kind));

const { updateNodeData } = useVueFlow();

function setParam(name: string, value: ParamValue) {
  updateNodeData<DatasetNodeData>(props.id, { params: { ...props.data.params, [name]: value } });
}
</script>

<template>
  <div
    v-if="kind"
    class="w-64 rounded-lg border bg-background text-sm shadow-sm"
    :class="{ 'ring-2 ring-ring/50': selected }"
  >
    <div data-slot="node-title" class="border-b px-3 py-2 font-medium">{{ kind.label }}</div>
    <div class="flex flex-col gap-1 py-2">
      <div v-for="port in kind.inputs" :key="port.id" class="relative px-3 text-muted-foreground">
        <Handle
          :id="port.id"
          type="target"
          :position="Position.Left"
          class="size-2.5!"
          :connectable="port.multiple ? true : 'single'"
        />
        {{ port.label }}
      </div>
      <div
        v-for="port in kind.outputs"
        :key="port.id"
        class="relative px-3 text-right text-muted-foreground"
      >
        <Handle :id="port.id" type="source" :position="Position.Right" class="size-2.5!" />
        {{ port.label }}
      </div>
    </div>
    <DatasetNodeParams
      v-if="Object.keys(kind.params).length"
      :params="kind.params"
      :values="data.params"
      class="border-t px-3 py-2"
      @update="setParam"
    />
  </div>
  <div
    v-else-if="catalog"
    class="w-64 rounded-lg border border-dashed bg-background text-sm text-muted-foreground shadow-sm"
    :class="{ 'ring-2 ring-ring/50': selected }"
  >
    <div data-slot="node-title" class="px-3 py-2 font-medium">Unknown: {{ data.kind }}</div>
  </div>
</template>
